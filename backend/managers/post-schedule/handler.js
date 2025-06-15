const { createClient } = require('@supabase/supabase-js');
const { pool } = require('/opt/nodejs/poolLayer');
const { responses } = require('/opt/nodejs/headersUtil');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

// Helper function to get shift status summary (no database updates needed)
function calculateShiftStatus(assignedCount, requiredHeadcount) {
  if (assignedCount >= requiredHeadcount) return 'fully_staffed';
  if (assignedCount > 0) return 'partially_staffed';
  return 'unstaffed';
}

exports.handler = async (event) => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return responses.success(null, 'CORS preflight success');
    }

    // Validate authorization header
    const authHeader =
      event.headers?.authorization || event.headers?.Authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return responses.unauthorized('Authorization token required');
    }

    const token = authHeader.split(' ')[1];

    if (!token || token.split('.').length !== 3) {
      return responses.unauthorized('Invalid token format');
    }

    // Validate the token and get user info
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('User validation error:', userError);
      return responses.unauthorized('Invalid or expired token');
    }

    // Verify user is a manager
    const client = await pool.connect();
    let managerUserId;

    try {
      const userQuery = `
        SELECT au.userid 
        FROM public.appuser au
        WHERE au.userid = $1 AND au.role = 'manager'
      `;

      const userResult = await client.query(userQuery, [user.id]);

      if (userResult.rows.length === 0) {
        return responses.forbidden(
          'Access denied. Only managers can create schedules.'
        );
      }

      managerUserId = userResult.rows[0].userid;
    } finally {
      client.release();
    }

    // Get all shifts that need scheduling (from this manager)
    const shiftsClient = await pool.connect();
    let shifts;

    try {
      const shiftsQuery = `
        SELECT 
          s.*,
          COALESCE(current_assignments.assigned_count, 0) as current_assigned_count
        FROM public.shift s
        LEFT JOIN (
          SELECT 
            shiftid, 
            COUNT(*) as assigned_count
          FROM public.shiftassignment 
          WHERE status != 'cancelled'
          GROUP BY shiftid
        ) current_assignments ON s.shiftid = current_assignments.shiftid
        WHERE s.managerid = $1 
        AND (
          COALESCE(current_assignments.assigned_count, 0) < s.requiredheadcount
        )
        ORDER BY s.date, s.starttime
      `;

      const shiftsResult = await shiftsClient.query(shiftsQuery, [
        managerUserId,
      ]);
      shifts = shiftsResult.rows;
    } finally {
      shiftsClient.release();
    }

    if (shifts.length === 0) {
      return responses.success(
        {
          message: 'No shifts require additional scheduling',
          assignmentsMade: [],
          unfilledShifts: [],
          shiftStatusSummary: [],
          summary: {
            totalShifts: 0,
            successfulAssignments: 0,
            unfilledShifts: 0,
            fullyStaffedShifts: 0,
            partiallyStaffedShifts: 0,
            unstaffedShifts: 0
          },
        },
        'Scheduling completed - no shifts to process'
      );
    }

    // Get manager's employees
    const employeesClient = await pool.connect();
    let employees;

    try {
      const employeesQuery = `
        SELECT DISTINCT au.userid, au.firstname, au.lastname, au.email
        FROM public.manageremployeeassignment mea
        INNER JOIN public.appuser au ON mea.employeeid = au.userid
        WHERE mea.managerid = $1 AND au.role = 'employee' AND mea.status = 'active'
      `;

      const employeesResult = await employeesClient.query(employeesQuery, [
        managerUserId,
      ]);
      employees = employeesResult.rows;
    } finally {
      employeesClient.release();
    }

    // Get employee availabilities for relevant dates
    const dates = [...new Set(shifts.map((s) => s.date))];
    const availabilityClient = await pool.connect();
    let availabilities;

    try {
      const availabilityQuery = `
        SELECT av.*
        FROM public.availability av
        INNER JOIN public.manageremployeeassignment mea ON av.employeeprofileid = mea.employeeid
        WHERE mea.managerid = $1 
        AND av.date = ANY($2::date[])
        ORDER BY av.date, av.starttime
      `;

      const availabilityResult = await availabilityClient.query(
        availabilityQuery,
        [managerUserId, dates]
      );
      availabilities = availabilityResult.rows;
    } finally {
      availabilityClient.release();
    }

    // Scheduling algorithm
    const assignmentsMade = [];
    const unfilledShifts = [];
    const partialOverlaps = [];
    const shiftStatusSummary = []; // Track final status of each shift

    for (const shift of shifts) {
      const spotsToFill =
        shift.requiredheadcount - shift.current_assigned_count;
      const shiftDate = shift.date;
      const shiftStart = shift.starttime;
      const shiftEnd = shift.endtime;

      // Find available employees for this shift
      const availableEmployees = availabilities.filter((av) => {
        // Check if availability date matches shift date
        if (av.date.getTime() !== shiftDate.getTime()) return false;

        // Check if employee availability covers the entire shift
        const avStart = av.starttime;
        const avEnd = av.endtime;

        // Full coverage check: availability must start at or before shift start and end at or after shift end
        if (avStart <= shiftStart && avEnd >= shiftEnd) {
          return true;
        } else {
          // Log partial overlap for reporting
          partialOverlaps.push({
            shiftId: shift.shiftid,
            employeeId: av.employeeprofileid,
            shiftTime: `${shiftStart}-${shiftEnd}`,
            availabilityTime: `${avStart}-${avEnd}`,
            reason: 'Partial time overlap - skipped',
          });
          return false;
        }
      });

      // Remove employees who are already assigned to shifts at the same time
      const assignmentClient = await pool.connect();
      let conflictingEmployees = [];

      try {
        const conflictQuery = `
          SELECT DISTINCT sa.employeeid
          FROM public.shiftassignment sa
          INNER JOIN public.shift s ON sa.shiftid = s.shiftid
          WHERE s.date = $1
          AND (
            (sa.starttime <= $2 AND sa.endtime > $2) OR
            (sa.starttime < $3 AND sa.endtime >= $3) OR
            (sa.starttime >= $2 AND sa.endtime <= $3)
          )
          AND sa.status != 'cancelled'
        `;

        const conflictResult = await assignmentClient.query(conflictQuery, [
          shiftDate,
          shiftStart,
          shiftEnd,
        ]);
        conflictingEmployees = conflictResult.rows.map((row) => row.employeeid);
      } finally {
        assignmentClient.release();
      }

      const eligibleEmployees = availableEmployees.filter(
        (av) => !conflictingEmployees.includes(av.employeeprofileid)
      );

      // Randomly shuffle eligible employees
      const shuffledEmployees = [...eligibleEmployees].sort(
        () => Math.random() - 0.5
      );

      // Assign employees to fill spots
      const assignedToThisShift = [];
      for (
        let i = 0;
        i < Math.min(spotsToFill, shuffledEmployees.length);
        i++
      ) {
        const employee = shuffledEmployees[i];

        // Create shift assignment
        const assignmentInsertClient = await pool.connect();
        try {
          const insertQuery = `
            INSERT INTO public.shiftassignment (shiftid, employeeid, status, starttime, endtime, notes, assignedat)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            RETURNING *;
          `;

          const values = [
            shift.shiftid,
            employee.employeeprofileid,
            'assigned',
            shiftStart,
            shiftEnd,
            'Auto-scheduled by system',
          ];

          const result = await assignmentInsertClient.query(
            insertQuery,
            values
          );
          const assignment = result.rows[0];

          assignedToThisShift.push({
            assignmentId: assignment.shiftassignmentid,
            employeeId: employee.employeeprofileid,
            shiftId: shift.shiftid,
            date: shiftDate,
            startTime: shiftStart,
            endTime: shiftEnd,
          });
        } finally {
          assignmentInsertClient.release();
        }
      }

      // Calculate final assignment count and status for this shift
      const finalAssignedCount = shift.current_assigned_count + assignedToThisShift.length;
      const shiftStatus = calculateShiftStatus(finalAssignedCount, shift.requiredheadcount);
      
      shiftStatusSummary.push({
        shiftId: shift.shiftid,
        requiredHeadcount: shift.requiredheadcount,
        assignedCount: finalAssignedCount,
        status: shiftStatus,
        date: shiftDate,
        startTime: shiftStart,
        endTime: shiftEnd
      });

      // Track results
      assignmentsMade.push(...assignedToThisShift);

      if (assignedToThisShift.length < spotsToFill) {
        unfilledShifts.push({
          shiftId: shift.shiftid,
          date: shiftDate,
          startTime: shiftStart,
          endTime: shiftEnd,
          requiredHeadcount: shift.requiredheadcount,
          currentAssigned:
            shift.current_assigned_count + assignedToThisShift.length,
          spotsStillNeeded: spotsToFill - assignedToThisShift.length,
          availableEmployees: eligibleEmployees.length,
          reason:
            eligibleEmployees.length === 0
              ? 'No available employees'
              : 'Not enough available employees',
        });
      }
    }

    // Calculate summary statistics
    const fullyStaffedShifts = shiftStatusSummary.filter(s => s.status === 'fully_staffed').length;
    const partiallyStaffedShifts = shiftStatusSummary.filter(s => s.status === 'partially_staffed').length;
    const unstaffedShifts = shiftStatusSummary.filter(s => s.status === 'unstaffed').length;

    const summary = {
      totalShifts: shifts.length,
      successfulAssignments: assignmentsMade.length,
      unfilledShifts: unfilledShifts.length,
      partialOverlaps: partialOverlaps.length,
      fullyStaffedShifts,
      partiallyStaffedShifts,
      unstaffedShifts
    };

    return responses.success(
      {
        assignmentsMade,
        unfilledShifts,
        partialOverlaps,
        shiftStatusSummary,
        summary,
        message: `Scheduling completed: ${assignmentsMade.length} assignments made across ${shifts.length} shifts. ${fullyStaffedShifts} fully staffed, ${partiallyStaffedShifts} partially staffed, ${unstaffedShifts} unstaffed.`,
      },
      'Scheduling completed successfully'
    );
  } catch (err) {
    console.error('Post schedule error:', err);
    return responses.serverError(err.message);
  }
};
