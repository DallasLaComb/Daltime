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

    // Get employee profile ID from database
    const client = await pool.connect();
    let employeeProfileId;

    try {
      const userQuery = `
        SELECT ep.employeeprofileid 
        FROM public.employeeprofile ep
        WHERE ep.userid = $1
      `;

      const userResult = await client.query(userQuery, [user.id]);

      if (userResult.rows.length === 0) {
        return responses.notFound(
          'Employee profile not found. Please contact your manager.'
        );
      }

      employeeProfileId = userResult.rows[0].employeeprofileid;
    } finally {
      client.release();
    }

    // Parse and validate request body
    const body = JSON.parse(event.body || '{}');
    const { date, starttime, endtime } = body;

    // Validate required fields
    if (!date || !starttime || !endtime) {
      return responses.badRequest(
        'Date, start time, and end time are required'
      );
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return responses.badRequest('Date must be in YYYY-MM-DD format');
    }

    // Validate time format (HH:MM:SS or HH:MM)
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
    if (!timeRegex.test(starttime) || !timeRegex.test(endtime)) {
      return responses.badRequest('Time must be in HH:MM or HH:MM:SS format');
    }

    // Validate that start time is before end time
    const startTimeDate = new Date(`2000-01-01T${starttime}`);
    const endTimeDate = new Date(`2000-01-01T${endtime}`);

    if (startTimeDate >= endTimeDate) {
      return responses.badRequest('Start time must be before end time');
    }

    // Validate that the date is not in the past (optional - you can remove this if needed)
    const today = new Date();
    const availabilityDate = new Date(date);
    today.setHours(0, 0, 0, 0);

    if (availabilityDate < today) {
      return responses.badRequest('Cannot post availability for past dates');
    }

    // Insert availability record
    const insertClient = await pool.connect();
    let newAvailability;

    try {
      // Check if availability already exists for this employee on this date
      const existingQuery = `
        SELECT availabilityid 
        FROM public.availability 
        WHERE employeeprofileid = $1 AND date = $2
      `;

      const existing = await insertClient.query(existingQuery, [
        employeeProfileId,
        date,
      ]);

      if (existing.rows.length > 0) {
        return responses.badRequest(
          'Availability already exists for this date. Please update or delete the existing availability first.'
        );
      }

      // Insert new availability
      const insertQuery = `
        INSERT INTO public.availability (employeeprofileid, date, starttime, endtime, createdat)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING *;
      `;

      const values = [employeeProfileId, date, starttime, endtime];

      const result = await insertClient.query(insertQuery, values);
      newAvailability = result.rows[0];
    } finally {
      insertClient.release();
    }

    return responses.created(
      newAvailability,
      'Availability posted successfully'
    );
  } catch (err) {
    console.error('Post availability error:', err);
    return responses.serverError(err.message);
  }
};
