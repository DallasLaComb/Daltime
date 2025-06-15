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
          'Access denied. Only employees can view available shifts.'
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
    const sortBy = queryParams.sortBy || 'date'; // date, starttime
    const sortOrder = queryParams.sortOrder || 'asc'; // asc, desc

    // Validate sort parameters
    const validSortColumns = ['date', 'starttime', 'availableat'];
    const validSortOrders = ['asc', 'desc'];

    if (!validSortColumns.includes(sortBy)) {
      return responses.badRequest(
        `Invalid sortBy parameter. Must be one of: ${validSortColumns.join(', ')}`
      );
    }

    if (!validSortOrders.includes(sortOrder.toLowerCase())) {
      return responses.badRequest(
        `Invalid sortOrder parameter. Must be 'asc' or 'desc'`
      );
    }

    // Build query conditions for date filtering
    let dateConditions = '';
    let queryValues = [employeeUserId];
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

    // Get available shifts from coworkers under the same manager
    const shiftsClient = await pool.connect();
    let availableShifts;

    try {
      const shiftsQuery = `
        SELECT 
          sa.shiftassignmentid,
          sa.shiftid,
          sa.employeeid,
          sa.status,
          sa.starttime as assignment_starttime,
          sa.endtime as assignment_endtime,
          sa.notes as assignment_notes,
          sa.assignedat,
          sa.lastupdated as availableat,
          sa.ownership_history,
          s.date,
          s.starttime as shift_starttime,
          s.endtime as shift_endtime,
          s.notes as shift_notes,
          s.requiredheadcount,
          s.createdat as shift_createdat,
          l.locationname,
          c.companyname,
          au_current.firstname as current_employee_firstname,
          au_current.lastname as current_employee_lastname,
          au_current.email as current_employee_email,
          au_manager.firstname as manager_firstname,
          au_manager.lastname as manager_lastname,
          au_manager.email as manager_email,
          CASE 
            WHEN s.date < CURRENT_DATE THEN 'past'
            WHEN s.date = CURRENT_DATE THEN 'today'
            ELSE 'future'
          END as shift_status,
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
        INNER JOIN public.appuser au_current ON sa.employeeid = au_current.userid
        LEFT JOIN public.appuser au_manager ON s.managerid = au_manager.userid
        LEFT JOIN public.location l ON s.locationid = l.locationid
        LEFT JOIN public.company c ON s.companyid = c.companyid
        WHERE sa.status = 'available'
        AND sa.employeeid != $1
        AND s.managerid IN (
          SELECT mea.managerid 
          FROM public.manageremployeeassignment mea 
          WHERE mea.employeeid = $1 AND mea.status = 'active'
        )
        AND s.date >= CURRENT_DATE
        ${dateConditions}
        ORDER BY s.${sortBy === 'availableat' ? 'date, sa.lastupdated' : sortBy} ${sortOrder.toUpperCase()}, s.date ASC, s.starttime ASC
      `;

      const shiftsResult = await shiftsClient.query(shiftsQuery, queryValues);
      availableShifts = shiftsResult.rows;
    } finally {
      shiftsClient.release();
    }

    // Group shifts by date for better organization
    const shiftsByDate = {};
    let totalShifts = 0;
    let totalHours = 0;

    availableShifts.forEach((shift) => {
      const dateKey = shift.date;
      if (!shiftsByDate[dateKey]) {
        shiftsByDate[dateKey] = [];
      }

      const hours = parseFloat(shift.duration_hours);
      totalShifts++;
      totalHours += hours;

      shiftsByDate[dateKey].push({
        assignmentId: shift.shiftassignmentid,
        shiftId: shift.shiftid,
        date: shift.date,
        startTime: shift.assignment_starttime,
        endTime: shift.assignment_endtime,
        shiftStartTime: shift.shift_starttime,
        shiftEndTime: shift.shift_endtime,
        formattedDate: shift.formatted_date.trim(),
        formattedStartTime: shift.formatted_start_time,
        formattedEndTime: shift.formatted_end_time,
        durationHours: Math.round(hours * 100) / 100,
        status: shift.status,
        shiftStatus: shift.shift_status,
        isPast: shift.is_past,
        location: shift.locationname || 'No location specified',
        company: shift.companyname || 'No company specified',
        assignmentNotes: shift.assignment_notes,
        shiftNotes: shift.shift_notes,
        requiredHeadcount: shift.requiredheadcount,
        currentEmployee: {
          firstName: shift.current_employee_firstname,
          lastName: shift.current_employee_lastname,
          email: shift.current_employee_email,
        },
        manager: {
          firstName: shift.manager_firstname,
          lastName: shift.manager_lastname,
          email: shift.manager_email,
        },
        ownershipHistory: shift.ownership_history ? JSON.parse(shift.ownership_history) : [],
        transferCount: shift.ownership_history ? JSON.parse(shift.ownership_history).length : 0,
        originalOwner: shift.ownership_history ? JSON.parse(shift.ownership_history)[0] : null,
        assignedAt: shift.assignedat,
        availableAt: shift.availableat,
        shiftCreatedAt: shift.shift_createdat,
      });
    });

    // Calculate summary statistics
    const today = new Date();
    const upcomingWeek = new Date(today);
    upcomingWeek.setDate(today.getDate() + 7);

    const upcomingShifts = availableShifts.filter((shift) => {
      const shiftDate = new Date(shift.date);
      return shiftDate >= today && shiftDate <= upcomingWeek;
    });

    const summary = {
      totalAvailableShifts: totalShifts,
      totalHours: Math.round(totalHours * 100) / 100,
      upcomingWeekShifts: upcomingShifts.length,
      upcomingWeekHours:
        Math.round(
          upcomingShifts.reduce(
            (sum, shift) => sum + parseFloat(shift.duration_hours),
            0
          ) * 100
        ) / 100,
      dateRange: {
        earliest: availableShifts.length > 0 ? availableShifts[0]?.date : null,
        latest:
          availableShifts.length > 0
            ? availableShifts[availableShifts.length - 1]?.date
            : null,
      },
    };

    // Add filter info
    const filters = {
      startDate: startDate || null,
      endDate: endDate || null,
      sortBy: sortBy,
      sortOrder: sortOrder,
    };

    // Format response
    const responseData = {
      availableShifts: availableShifts.map((shift) => ({
        assignmentId: shift.shiftassignmentid,
        shiftId: shift.shiftid,
        date: shift.date,
        startTime: shift.assignment_starttime,
        endTime: shift.assignment_endtime,
        shiftStartTime: shift.shift_starttime,
        shiftEndTime: shift.shift_endtime,
        formattedDate: shift.formatted_date.trim(),
        formattedStartTime: shift.formatted_start_time,
        formattedEndTime: shift.formatted_end_time,
        durationHours: Math.round(parseFloat(shift.duration_hours) * 100) / 100,
        status: shift.status,
        shiftStatus: shift.shift_status,
        isPast: shift.is_past,
        location: shift.locationname || 'No location specified',
        company: shift.companyname || 'No company specified',
        assignmentNotes: shift.assignment_notes,
        shiftNotes: shift.shift_notes,
        requiredHeadcount: shift.requiredheadcount,
        currentEmployee: {
          firstName: shift.current_employee_firstname,
          lastName: shift.current_employee_lastname,
          email: shift.current_employee_email,
        },
        manager: {
          firstName: shift.manager_firstname,
          lastName: shift.manager_lastname,
          email: shift.manager_email,
        },
        assignedAt: shift.assignedat,
        availableAt: shift.availableat,
        shiftCreatedAt: shift.shift_createdat,
      })),
      shiftsByDate: shiftsByDate,
      summary: summary,
      filters: filters,
      employeeId: employeeUserId,
    };

    return responses.success(
      responseData,
      `Available shifts retrieved successfully. ${summary.totalAvailableShifts} shifts found with ${summary.totalHours} total hours.`
    );
  } catch (err) {
    console.error('Get available shifts error:', err);
    return responses.serverError(err.message);
  }
};
