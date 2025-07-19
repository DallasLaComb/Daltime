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
          'Access denied. Only employees can view their availability.'
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
    const sortBy = queryParams.sortBy || 'date'; // date, starttime, endtime, createdat
    const sortOrder = queryParams.sortOrder || 'asc'; // asc, desc
    const includePast = queryParams.includePast === 'true'; // Default false

    // Build query conditions
    let whereConditions = 'WHERE a.employeeprofileid = $1';
    let queryValues = [employeeUserId];
    let paramIndex = 2;

    // Add date filters
    if (startDate) {
      whereConditions += ` AND a.date >= $${paramIndex}`;
      queryValues.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereConditions += ` AND a.date <= $${paramIndex}`;
      queryValues.push(endDate);
      paramIndex++;
    }

    // By default, exclude past dates unless specifically requested
    if (!includePast) {
      whereConditions += ` AND a.date >= CURRENT_DATE`;
    }

    // Validate sort parameters
    const validSortColumns = ['date', 'starttime', 'endtime', 'createdat'];
    const validSortOrders = ['asc', 'desc'];

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

    // Get availability records for this employee
    const availabilityClient = await pool.connect();
    let availability;

    try {
      const availabilityQuery = `
        SELECT 
          a.availabilityid,
          a.employeeprofileid,
          a.date,
          a.starttime,
          a.endtime,
          a.createdat,
          CASE 
            WHEN a.date < CURRENT_DATE THEN 'past'
            WHEN a.date = CURRENT_DATE THEN 'today'
            ELSE 'future'
          END as status,
          CASE 
            WHEN a.date < CURRENT_DATE THEN true
            ELSE false
          END as is_past,
          -- Calculate duration in hours
          EXTRACT(EPOCH FROM (a.endtime::time - a.starttime::time)) / 3600 as duration_hours,
          -- Format for display
          TO_CHAR(a.date, 'Day, Month DD, YYYY') as formatted_date,
          TO_CHAR(a.starttime, 'HH12:MI AM') as formatted_start_time,
          TO_CHAR(a.endtime, 'HH12:MI AM') as formatted_end_time
        FROM public.availability a
        ${whereConditions}
        ORDER BY a.${sortBy} ${sortOrder.toUpperCase()}, a.date ASC, a.starttime ASC
      `;

      const availabilityResult = await availabilityClient.query(
        availabilityQuery,
        queryValues
      );
      availability = availabilityResult.rows;
    } finally {
      availabilityClient.release();
    }

    // Group availability by date for better organization
    const availabilityByDate = {};
    let totalHours = 0;
    let futureHours = 0;
    let pastHours = 0;

    availability.forEach((record) => {
      const dateKey = record.date;
      if (!availabilityByDate[dateKey]) {
        availabilityByDate[dateKey] = [];
      }

      // Add to appropriate totals
      const hours = parseFloat(record.duration_hours);
      totalHours += hours;

      if (record.status === 'past') {
        pastHours += hours;
      } else {
        futureHours += hours;
      }

      availabilityByDate[dateKey].push({
        availabilityId: record.availabilityid,
        date: record.date,
        startTime: record.starttime,
        endTime: record.endtime,
        formattedDate: record.formatted_date.trim(),
        formattedStartTime: record.formatted_start_time,
        formattedEndTime: record.formatted_end_time,
        durationHours: Math.round(hours * 100) / 100, // Round to 2 decimal places
        status: record.status,
        isPast: record.is_past,
        createdAt: record.createdat,
      });
    });

    // Calculate summary statistics
    const today = new Date();
    const upcomingWeek = new Date(today);
    upcomingWeek.setDate(today.getDate() + 7);

    const upcomingAvailability = availability.filter((record) => {
      const recordDate = new Date(record.date);
      return recordDate >= today && recordDate <= upcomingWeek;
    });

    const summary = {
      totalRecords: availability.length,
      totalHours: Math.round(totalHours * 100) / 100,
      futureHours: Math.round(futureHours * 100) / 100,
      pastHours: Math.round(pastHours * 100) / 100,
      upcomingWeekRecords: upcomingAvailability.length,
      upcomingWeekHours:
        Math.round(
          upcomingAvailability.reduce(
            (sum, record) => sum + parseFloat(record.duration_hours),
            0
          ) * 100
        ) / 100,
      dateRange: {
        earliest: availability.length > 0 ? availability[0]?.date : null,
        latest:
          availability.length > 0
            ? availability[availability.length - 1]?.date
            : null,
      },
      recordsByStatus: {
        past: availability.filter((r) => r.status === 'past').length,
        today: availability.filter((r) => r.status === 'today').length,
        future: availability.filter((r) => r.status === 'future').length,
      },
    };

    // Add filter info
    const filters = {
      startDate: startDate || null,
      endDate: endDate || null,
      sortBy: sortBy,
      sortOrder: sortOrder,
      includePast: includePast,
    };

    // Format response based on query parameters
    const responseData = {
      availability: availability.map((record) => ({
        availabilityId: record.availabilityid,
        date: record.date,
        startTime: record.starttime,
        endTime: record.endtime,
        formattedDate: record.formatted_date.trim(),
        formattedStartTime: record.formatted_start_time,
        formattedEndTime: record.formatted_end_time,
        durationHours:
          Math.round(parseFloat(record.duration_hours) * 100) / 100,
        status: record.status,
        isPast: record.is_past,
        createdAt: record.createdat,
        lastUpdated: record.lastupdated,
      })),
      availabilityByDate: availabilityByDate,
      summary: summary,
      filters: filters,
      employeeId: employeeUserId,
    };

    return responses.success(
      responseData,
      `Availability retrieved successfully. ${summary.totalRecords} records found with ${summary.totalHours} total hours.`
    );
  } catch (err) {
    console.error('Get availability error:', err);
    return responses.serverError(err.message);
  }
};
