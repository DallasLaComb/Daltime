const { createClient } = require('@supabase/supabase-js');
const { pool } = require('/opt/nodejs/poolLayer');
const { responses } = require('/opt/nodejs/headersUtil');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

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
          'Access denied. Only managers can view shift status.'
        );
      }

      managerUserId = userResult.rows[0].userid;
    } finally {
      client.release();
    }

    // Get all shifts for this manager with fill status
    const shiftsClient = await pool.connect();
    let shifts;

    try {
      const shiftsQuery = `
        SELECT 
          s.*,
          l.locationname,
          COALESCE(assignments.assigned_count, 0) as current_assigned_count,
          CASE 
            WHEN COALESCE(assignments.assigned_count, 0) >= s.requiredheadcount THEN 'fully_staffed'
            WHEN COALESCE(assignments.assigned_count, 0) > 0 THEN 'partially_staffed'
            ELSE 'unstaffed'
          END as fill_status,
          ROUND(
            (COALESCE(assignments.assigned_count, 0)::decimal / s.requiredheadcount) * 100, 1
          ) as fill_percentage
        FROM public.shift s
        LEFT JOIN public.location l ON s.locationid = l.locationid
        LEFT JOIN (
          SELECT 
            shiftid, 
            COUNT(*) as assigned_count
          FROM public.shiftassignment 
          WHERE status = 'assigned'
          GROUP BY shiftid
        ) assignments ON s.shiftid = assignments.shiftid
        WHERE s.managerid = $1 
        ORDER BY s.date, s.starttime
      `;

      const shiftsResult = await shiftsClient.query(shiftsQuery, [
        managerUserId,
      ]);
      shifts = shiftsResult.rows;
    } finally {
      shiftsClient.release();
    }

    // Get assigned employees for each shift
    const assignmentsClient = await pool.connect();
    let assignedEmployees = {};

    try {
      if (shifts.length > 0) {
        const shiftIds = shifts.map((s) => s.shiftid);
        const assignmentsQuery = `
          SELECT 
            sa.shiftid,
            sa.shiftassignmentid,
            sa.status,
            sa.assignedat,
            au.userid as employeeid,
            au.firstname,
            au.lastname,
            au.email
          FROM public.shiftassignment sa
          INNER JOIN public.appuser au ON sa.employeeid = au.userid
          WHERE sa.shiftid = ANY($1::uuid[])
          AND sa.status = 'assigned'
          ORDER BY sa.assignedat
        `;

        const assignmentsResult = await assignmentsClient.query(
          assignmentsQuery,
          [shiftIds]
        );

        // Group assignments by shift ID
        assignmentsResult.rows.forEach((assignment) => {
          if (!assignedEmployees[assignment.shiftid]) {
            assignedEmployees[assignment.shiftid] = [];
          }
          assignedEmployees[assignment.shiftid].push({
            assignmentId: assignment.shiftassignmentid,
            employeeId: assignment.employeeid,
            firstName: assignment.firstname,
            lastName: assignment.lastname,
            email: assignment.email,
            status: assignment.status,
            assignedAt: assignment.assignedat,
          });
        });
      }
    } finally {
      assignmentsClient.release();
    }

    // Format the response
    const formattedShifts = shifts.map((shift) => ({
      shiftId: shift.shiftid,
      date: shift.date,
      startTime: shift.starttime,
      endTime: shift.endtime,
      location: shift.locationname || 'No location specified',
      notes: shift.notes,
      requiredHeadcount: shift.requiredheadcount,
      currentAssignedCount: shift.current_assigned_count,
      fillStatus: shift.fill_status,
      fillPercentage: shift.fill_percentage,
      spotsRemaining: Math.max(
        0,
        shift.requiredheadcount - shift.current_assigned_count
      ),
      assignedEmployees: assignedEmployees[shift.shiftid] || [],
      createdAt: shift.createdat,
    }));

    // Generate summary statistics
    const summary = {
      totalShifts: shifts.length,
      fullyStaffed: shifts.filter((s) => s.fill_status === 'fully_staffed')
        .length,
      partiallyStaffed: shifts.filter(
        (s) => s.fill_status === 'partially_staffed'
      ).length,
      unstaffed: shifts.filter((s) => s.fill_status === 'unstaffed').length,
      totalSpotsNeeded: shifts.reduce((sum, s) => sum + s.requiredheadcount, 0),
      totalSpotsAssigned: shifts.reduce(
        (sum, s) => sum + s.current_assigned_count,
        0
      ),
      overallFillPercentage:
        shifts.length > 0
          ? Math.round(
              (shifts.reduce((sum, s) => sum + s.current_assigned_count, 0) /
                shifts.reduce((sum, s) => sum + s.requiredheadcount, 0)) *
                100
            )
          : 0,
    };

    return responses.success(
      {
        shifts: formattedShifts,
        summary,
      },
      'Shift status retrieved successfully'
    );
  } catch (err) {
    console.error('Get shift status error:', err);
    return responses.serverError(err.message);
  }
};
