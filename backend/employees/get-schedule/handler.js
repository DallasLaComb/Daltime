const { createClient } = require('@supabase/supabase-js');
const { pool } = require('/opt/nodejs/poolLayer');
const { responses } = require('/opt/nodejs/headersUtil');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

// Calculate summary statisticsPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

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

    // Verify user is an employee
    const client = await pool.connect();
    let employeeUserId;

    try {
      const userQuery = `
        SELECT au.userid 
        FROM public.appuser au
        WHERE au.userid = $1 AND au.role = 'employee'
      `;

      const userResult = await client.query(userQuery, [user.id]);

      if (userResult.rows.length === 0) {
        return responses.forbidden(
          'Access denied. Only employees can view their schedule.'
        );
      }

      employeeUserId = userResult.rows[0].userid;
    } finally {
      client.release();
    }

    // Get query parameters for filtering
    const queryParams = event.queryStringParameters || {};
    const startDate = queryParams.startDate; // Optional YYYY-MM-DD
    const endDate = queryParams.endDate; // Optional YYYY-MM-DD
    const status = queryParams.status || 'assigned'; // assigned, completed, cancelled, all
    const sortBy = queryParams.sortBy || 'date'; // date, starttime, assignedat
    const sortOrder = queryParams.sortOrder || 'asc'; // asc, desc
    const includePast = queryParams.includePast === 'true'; // Default false

    // Build query conditions
    let whereConditions = 'WHERE sa.employeeid = $1';
    let queryValues = [employeeUserId];
    let paramIndex = 2;

    // Add status filter
    if (status !== 'all') {
      whereConditions += ` AND sa.status = $${paramIndex}`;
      queryValues.push(status);
      paramIndex++;
    }

    // Add date filters
    if (startDate) {
      whereConditions += ` AND s.date >= $${paramIndex}`;
      queryValues.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereConditions += ` AND s.date <= $${paramIndex}`;
      queryValues.push(endDate);
      paramIndex++;
    }

    // By default, exclude past dates unless specifically requested
    if (!includePast) {
      whereConditions += ` AND s.date >= CURRENT_DATE`;
    }

    // Validate sort parameters
    const validSortColumns = ['date', 'starttime', 'assignedat'];
    const validSortOrders = ['asc', 'desc'];
    const validStatuses = [
      'assigned',
      'available',
      'completed',
      'cancelled',
      'all',
    ];

    if (!validSortColumns.includes(sortBy)) {
      return responses.badRequest(
        `Invalid sortBy parameter. Must be one of: ${validSortColumns.join(
          ', '
        )}`
      );
    }

    if (!validSortOrders.includes(sortOrder.toLowerCase())) {
      return responses.badRequest(
        `Invalid sortOrder parameter. Must be 'asc' or 'desc'`
      );
    }

    if (!validStatuses.includes(status)) {
      return responses.badRequest(
        `Invalid status parameter. Must be one of: ${validStatuses.join(', ')}`
      );
    }

    // Get shift assignments for this employee with comprehensive details
    const scheduleClient = await pool.connect();
    let schedule;

    try {
      const scheduleQuery = `
        SELECT 
          sa.shiftassignmentid,
          sa.shiftid,
          sa.employeeid,
          sa.status,
          sa.assignedat,
          sa.starttime as assignment_starttime,
          sa.endtime as assignment_endtime,
          sa.notes as assignment_notes,
          sa.ownership_history,
          s.date,
          s.starttime as shift_starttime,
          s.endtime as shift_endtime,
          s.notes as shift_notes,
          s.requiredheadcount,
          s.createdat as shift_createdat,
          l.locationname,
          c.companyname,
          au_manager.firstname as manager_firstname,
          au_manager.lastname as manager_lastname,
          au_manager.email as manager_email,
          CASE 
            WHEN s.date < CURRENT_DATE THEN 'past'
            WHEN s.date = CURRENT_DATE THEN 'today'
            ELSE 'future'
          END as schedule_status,
          CASE 
            WHEN s.date < CURRENT_DATE THEN true
            ELSE false
          END as is_past,
          -- Calculate duration in hours
          EXTRACT(EPOCH FROM (sa.endtime::time - sa.starttime::time)) / 3600 as duration_hours,
          -- Format for display
          TO_CHAR(s.date, 'Day, Month DD, YYYY') as formatted_date,
          TO_CHAR(sa.starttime, 'HH12:MI AM') as formatted_start_time,
          TO_CHAR(sa.endtime, 'HH12:MI AM') as formatted_end_time
        FROM public.shiftassignment sa
        INNER JOIN public.shift s ON sa.shiftid = s.shiftid
        LEFT JOIN public.location l ON s.locationid = l.locationid
        LEFT JOIN public.company c ON s.companyid = c.companyid
        LEFT JOIN public.appuser au_manager ON s.managerid = au_manager.userid
        ${whereConditions}
        ORDER BY s.${
          sortBy === 'date'
            ? 'date'
            : sortBy === 'starttime'
            ? 'date, s.starttime'
            : 'sa.assignedat'
        } ${sortOrder.toUpperCase()}
      `;

      const scheduleResult = await scheduleClient.query(
        scheduleQuery,
        queryValues
      );
      schedule = scheduleResult.rows;
    } finally {
      scheduleClient.release();
    }

    // Group schedule by date for better organization
    const scheduleByDate = {};
    let totalHours = 0;
    let futureHours = 0;
    let pastHours = 0;
    let todayHours = 0;

    schedule.forEach((assignment) => {
      const dateKey = assignment.date;
      if (!scheduleByDate[dateKey]) {
        scheduleByDate[dateKey] = [];
      }

      // Add to appropriate totals
      const hours = parseFloat(assignment.duration_hours);
      totalHours += hours;

      if (assignment.schedule_status === 'past') {
        pastHours += hours;
      } else if (assignment.schedule_status === 'today') {
        todayHours += hours;
      } else {
        futureHours += hours;
      }

      scheduleByDate[dateKey].push({
        assignmentId: assignment.shiftassignmentid,
        shiftId: assignment.shiftid,
        date: assignment.date,
        assignmentStartTime: assignment.assignment_starttime,
        assignmentEndTime: assignment.assignment_endtime,
        shiftStartTime: assignment.shift_starttime,
        shiftEndTime: assignment.shift_endtime,
        formattedDate: assignment.formatted_date.trim(),
        formattedStartTime: assignment.formatted_start_time,
        formattedEndTime: assignment.formatted_end_time,
        durationHours: Math.round(hours * 100) / 100,
        status: assignment.status,
        scheduleStatus: assignment.schedule_status,
        isPast: assignment.is_past,
        location: assignment.locationname || 'No location specified',
        company: assignment.companyname || 'No company specified',
        assignmentNotes: assignment.assignment_notes,
        shiftNotes: assignment.shift_notes,
        requiredHeadcount: assignment.requiredheadcount,
        manager: {
          firstName: assignment.manager_firstname,
          lastName: assignment.manager_lastname,
          email: assignment.manager_email,
        },
        assignedAt: assignment.assignedat,
        shiftCreatedAt: assignment.shift_createdat,
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

    // Calculate summary statistics
    const today = new Date();
    const upcomingWeek = new Date(today);
    upcomingWeek.setDate(today.getDate() + 7);

    const upcomingSchedule = schedule.filter((assignment) => {
      const assignmentDate = new Date(assignment.date);
      return assignmentDate >= today && assignmentDate <= upcomingWeek;
    });

    const summary = {
      totalAssignments: schedule.length,
      totalHours: Math.round(totalHours * 100) / 100,
      futureHours: Math.round(futureHours * 100) / 100,
      pastHours: Math.round(pastHours * 100) / 100,
      todayHours: Math.round(todayHours * 100) / 100,
      upcomingWeekAssignments: upcomingSchedule.length,
      upcomingWeekHours:
        Math.round(
          upcomingSchedule.reduce(
            (sum, assignment) => sum + parseFloat(assignment.duration_hours),
            0
          ) * 100
        ) / 100,
      dateRange: {
        earliest: schedule.length > 0 ? schedule[0]?.date : null,
        latest:
          schedule.length > 0 ? schedule[schedule.length - 1]?.date : null,
      },
      assignmentsByStatus: {
        assigned: schedule.filter((a) => a.status === 'assigned').length,
        available: schedule.filter((a) => a.status === 'available').length,
        completed: schedule.filter((a) => a.status === 'completed').length,
        cancelled: schedule.filter((a) => a.status === 'cancelled').length,
      },
      assignmentsByScheduleStatus: {
        past: schedule.filter((a) => a.schedule_status === 'past').length,
        today: schedule.filter((a) => a.schedule_status === 'today').length,
        future: schedule.filter((a) => a.schedule_status === 'future').length,
      },
    };

    // Add filter info
    const filters = {
      startDate: startDate || null,
      endDate: endDate || null,
      status: status,
      sortBy: sortBy,
      sortOrder: sortOrder,
      includePast: includePast,
    };

    // Format response
    const responseData = {
      schedule: schedule.map((assignment) => ({
        assignmentId: assignment.shiftassignmentid,
        shiftId: assignment.shiftid,
        date: assignment.date,
        assignmentStartTime: assignment.assignment_starttime,
        assignmentEndTime: assignment.assignment_endtime,
        shiftStartTime: assignment.shift_starttime,
        shiftEndTime: assignment.shift_endtime,
        formattedDate: assignment.formatted_date.trim(),
        formattedStartTime: assignment.formatted_start_time,
        formattedEndTime: assignment.formatted_end_time,
        durationHours:
          Math.round(parseFloat(assignment.duration_hours) * 100) / 100,
        status: assignment.status,
        scheduleStatus: assignment.schedule_status,
        isPast: assignment.is_past,
        location: assignment.locationname || 'No location specified',
        company: assignment.companyname || 'No company specified',
        assignmentNotes: assignment.assignment_notes,
        shiftNotes: assignment.shift_notes,
        requiredHeadcount: assignment.requiredheadcount,
        manager: {
          firstName: assignment.manager_firstname,
          lastName: assignment.manager_lastname,
          email: assignment.manager_email,
        },
        assignedAt: assignment.assignedat,
        shiftCreatedAt: assignment.shift_createdat,
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
      })),
      scheduleByDate: scheduleByDate,
      summary: summary,
      filters: filters,
      employeeId: employeeUserId,
    };

    return responses.success(
      responseData,
      `Schedule retrieved successfully. ${summary.totalAssignments} assignments found with ${summary.totalHours} total hours.`
    );
  } catch (err) {
    console.error('Get employee schedule error:', err);
    return responses.serverError(err.message);
  }
};
