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
          'Access denied. Only managers can post shifts.'
        );
      }

      managerUserId = userResult.rows[0].userid;
    } finally {
      client.release();
    }

    // Parse and validate request body
    const body = JSON.parse(event.body || '{}');
    const {
      companyid,
      locationid,
      date,
      starttime,
      endtime,
      notes,
      requiredheadcount,
    } = body;

    // Validate required fields
    if (!date || !starttime || !endtime || !requiredheadcount) {
      return responses.badRequest(
        'Date, start time, end time, and required headcount are required'
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

    // Validate required headcount is positive integer
    if (!Number.isInteger(requiredheadcount) || requiredheadcount <= 0) {
      return responses.badRequest(
        'Required headcount must be a positive integer'
      );
    }

    // Insert shift record
    const insertClient = await pool.connect();
    let newShift;

    try {
      const insertQuery = `
        INSERT INTO public.shift (companyid, locationid, managerid, date, starttime, endtime, notes, requiredheadcount, createdat)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING *;
      `;

      const values = [
        companyid || null,
        locationid || null,
        managerUserId,
        date,
        starttime,
        endtime,
        notes || null,
        requiredheadcount,
      ];

      const result = await insertClient.query(insertQuery, values);
      newShift = result.rows[0];
    } finally {
      insertClient.release();
    }

    return responses.created(newShift, 'Shift posted successfully');
  } catch (err) {
    console.error('Post shift error:', err);
    return responses.serverError(err.message);
  }
};
