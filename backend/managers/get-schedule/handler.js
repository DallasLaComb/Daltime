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
          'Access denied. Only managers can view schedule.'
        );
      }

      managerUserId = userResult.rows[0].userid;
    } finally {
      client.release();
    }

    // Get query parameters for filtering
    const queryParams = event.queryStringParameters || {};
    const startDate = queryParams.startDate; // Optional YYYY-MM-DD
    const endDate = queryParams.endDate; // Optional YYYY-MM-DD
    const fillStatus = queryParams.fillStatus; // Optional: 'fully_staffed', 'partially_staffed', 'unstaffed', 'all'
    const includeAssignments = queryParams.includeAssignments !== 'false'; // Default true

    // Build date filter conditions
    let dateConditions = '';
    let queryValues = [managerUserId];
    let paramIndex = 2;

    if (startDate) {
      dateConditions += ` AND s.date >= $${paramIndex}`;
      queryValues.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      dateConditions += ` AND s.date <= $${paramIndex}`;
      queryValues.push(endDate);
      paramIndex++;
    }

    // Get all shifts for this manager with comprehensive details
    const shiftsClient = await pool.connect();
    let shifts;

    try {
      const shiftsQuery = `
        SELECT 
          s.*,
          l.locationname,
          c.companyname,
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
        LEFT JOIN public.company c ON s.companyid = c.companyid
        LEFT JOIN (
          SELECT 
            shiftid, 
            COUNT(*) as assigned_count
          FROM public.shiftassignment 
          WHERE status IN ('assigned', 'available')
          GROUP BY shiftid
        ) assignments ON s.shiftid = assignments.shiftid
        WHERE s.managerid = $1 
        ${dateConditions}
        ORDER BY s.date, s.starttime
      `;

      const shiftsResult = await shiftsClient.query(shiftsQuery, queryValues);
      shifts = shiftsResult.rows;
    } finally {
      shiftsClient.release();
    }

    // Filter by fill status if specified
    if (fillStatus && fillStatus !== 'all') {
      shifts = shifts.filter((shift) => shift.fill_status === fillStatus);
    }

    // Get shift assignments with employee details if requested
    let shiftAssignments = {};
    if (includeAssignments && shifts.length > 0) {
      const assignmentsClient = await pool.connect();

      try {
        const shiftIds = shifts.map((s) => s.shiftid);
        const assignmentsQuery = `
          SELECT 
            sa.shiftid,
            sa.shiftassignmentid,
            sa.status,
            sa.assignedat,
            sa.starttime as assignment_starttime,
            sa.endtime as assignment_endtime,
            sa.notes as assignment_notes,
            sa.ownership_history,
            au.userid as employeeid,
            au.firstname,
            au.lastname,
            au.email,
            au.phonenumber
          FROM public.shiftassignment sa
          INNER JOIN public.appuser au ON sa.employeeid = au.userid
          WHERE sa.shiftid = ANY($1::uuid[])
          AND sa.status IN ('assigned', 'available', 'completed', 'cancelled')
          ORDER BY sa.assignedat, au.lastname, au.firstname
        `;

        const assignmentsResult = await assignmentsClient.query(
          assignmentsQuery,
          [shiftIds]
        );

        // Group assignments by shift ID
        assignmentsResult.rows.forEach((assignment) => {
          if (!shiftAssignments[assignment.shiftid]) {
            shiftAssignments[assignment.shiftid] = [];
          }
          shiftAssignments[assignment.shiftid].push({
            assignmentId: assignment.shiftassignmentid,
            employeeId: assignment.employeeid,
            firstName: assignment.firstname,
            lastName: assignment.lastname,
            email: assignment.email,
            phoneNumber: assignment.phonenumber,
            status: assignment.status,
            assignedAt: assignment.assignedat,
            startTime: assignment.assignment_starttime,
            endTime: assignment.assignment_endtime,
            notes: assignment.assignment_notes,
            // Add ownership history information
            ownershipHistory: assignment.ownership_history || [],
            isTransferred:
              assignment.ownership_history &&
              assignment.ownership_history.length > 1,
            transferCount: assignment.ownership_history
              ? assignment.ownership_history.length - 1
              : 0,
            originalOwner:
              assignment.ownership_history &&
              assignment.ownership_history.length > 0
                ? assignment.ownership_history[0]
                : null,
            currentOwner:
              assignment.ownership_history &&
              assignment.ownership_history.length > 0
                ? assignment.ownership_history[
                    assignment.ownership_history.length - 1
                  ]
                : null,
          });
        });
      } finally {
        assignmentsClient.release();
      }
    }

    // Format the response
    const schedule = shifts.map((shift) => ({
      shiftId: shift.shiftid,
      date: shift.date,
      startTime: shift.starttime,
      endTime: shift.endtime,
      location: shift.locationname || 'No location specified',
      company: shift.companyname || 'No company specified',
      notes: shift.notes,
      requiredHeadcount: shift.requiredheadcount,
      currentAssignedCount: shift.current_assigned_count,
      fillStatus: shift.fill_status,
      fillPercentage: shift.fill_percentage,
      spotsRemaining: Math.max(
        0,
        shift.requiredheadcount - shift.current_assigned_count
      ),
      needsFilling: shift.current_assigned_count < shift.requiredheadcount,
      assignments: includeAssignments
        ? shiftAssignments[shift.shiftid] || []
        : [],
      createdAt: shift.createdat,
      lastUpdated: shift.lastupdated,
    }));

    // Generate comprehensive summary statistics
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
      totalSpotsRemaining: shifts.reduce(
        (sum, s) =>
          sum + Math.max(0, s.requiredheadcount - s.current_assigned_count),
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
      shiftsNeedingFilling: shifts.filter(
        (s) => s.current_assigned_count < s.requiredheadcount
      ).length,
    };

    // Add date range info if filters were applied
    const filters = {
      startDate: startDate || null,
      endDate: endDate || null,
      fillStatus: fillStatus || 'all',
      includeAssignments: includeAssignments,
    };

    return responses.success(
      {
        schedule,
        summary,
        filters,
        managerId: managerUserId,
      },
      `Schedule retrieved successfully. ${summary.totalShifts} shifts found.`
    );
  } catch (err) {
    console.error('Get schedule error:', err);
    return responses.serverError(err.message);
  }
};
