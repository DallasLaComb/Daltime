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
        return responses.notFound(
          'User not found or user is not an employee. Please contact your manager.'
        );
      }

      employeeUserId = userResult.rows[0].userid;
    } finally {
      client.release();
    }

    // Parse and validate request body
    const body = JSON.parse(event.body || '{}');

    // Support both single record and bulk array insertion
    const availabilityRecords = body.availability ? body.availability : [body];

    // Validate that we have at least one record
    if (!availabilityRecords || availabilityRecords.length === 0) {
      return responses.badRequest(
        'At least one availability record is required'
      );
    }

    // Validation helpers
    const validateAvailabilityRecord = (record, index = null) => {
      const { date, starttime, endtime } = record;
      const prefix = index !== null ? `Record ${index + 1}: ` : '';

      // Validate required fields
      if (!date || !starttime || !endtime) {
        throw new Error(`${prefix}Date, start time, and end time are required`);
      }

      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        throw new Error(`${prefix}Date must be in YYYY-MM-DD format`);
      }

      // Validate time format (HH:MM:SS or HH:MM)
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
      const normalizeTime = (time) =>
        time.includes(':') && !time.includes(':', time.lastIndexOf(':'))
          ? `${time}:00`
          : time;

      const normalizedStart = normalizeTime(starttime);
      const normalizedEnd = normalizeTime(endtime);

      if (!timeRegex.test(normalizedStart) || !timeRegex.test(normalizedEnd)) {
        throw new Error(`${prefix}Time must be in HH:MM or HH:MM:SS format`);
      }

      // Validate that start time is before end time
      const startTimeDate = new Date(`2000-01-01T${normalizedStart}`);
      const endTimeDate = new Date(`2000-01-01T${normalizedEnd}`);

      if (startTimeDate >= endTimeDate) {
        throw new Error(`${prefix}Start time must be before end time`);
      }

      // Validate that the date is not in the past (optional)
      const today = new Date();
      const availabilityDate = new Date(date);
      today.setHours(0, 0, 0, 0);

      if (availabilityDate < today) {
        throw new Error(`${prefix}Cannot post availability for past dates`);
      }

      return {
        date,
        starttime: normalizedStart,
        endtime: normalizedEnd,
      };
    };

    // Validate all records first
    let validatedRecords = [];
    try {
      validatedRecords = availabilityRecords.map((record, index) =>
        validateAvailabilityRecord(
          record,
          availabilityRecords.length > 1 ? index : null
        )
      );
    } catch (validationError) {
      return responses.badRequest(validationError.message);
    }

    // Check for duplicate dates in the request
    const requestDates = validatedRecords.map((r) => r.date);
    const duplicateDates = requestDates.filter(
      (date, index) => requestDates.indexOf(date) !== index
    );
    if (duplicateDates.length > 0) {
      return responses.badRequest(
        `Duplicate dates found in request: ${[...new Set(duplicateDates)].join(
          ', '
        )}`
      );
    }

    // Insert availability records
    const insertClient = await pool.connect();
    let results = [];

    try {
      // Check for existing availability records for these dates
      const dateList = validatedRecords.map((r) => r.date);
      const existingQuery = `
        SELECT date 
        FROM public.availability 
        WHERE employeeprofileid = $1 AND date = ANY($2::date[])
      `;

      const existing = await insertClient.query(existingQuery, [
        employeeUserId,
        dateList,
      ]);

      if (existing.rows.length > 0) {
        const existingDates = existing.rows.map((row) => row.date);
        return responses.badRequest(
          `Availability already exists for the following dates: ${existingDates.join(
            ', '
          )}. Please update or delete existing availability first.`
        );
      }

      // Begin transaction for bulk insert
      await insertClient.query('BEGIN');

      // Insert all records
      for (const record of validatedRecords) {
        const insertQuery = `
          INSERT INTO public.availability (employeeprofileid, date, starttime, endtime, createdat)
          VALUES ($1, $2, $3, $4, NOW())
          RETURNING *;
        `;

        const values = [
          employeeUserId,
          record.date,
          record.starttime,
          record.endtime,
        ];
        const result = await insertClient.query(insertQuery, values);
        results.push(result.rows[0]);
      }

      // Commit transaction
      await insertClient.query('COMMIT');
    } catch (error) {
      // Rollback transaction on error
      await insertClient.query('ROLLBACK');
      throw error;
    } finally {
      insertClient.release();
    }

    // Return appropriate response based on whether it was bulk or single insert
    const message =
      results.length === 1
        ? 'Availability posted successfully'
        : `${results.length} availability records posted successfully`;

    return responses.created(
      results.length === 1 ? results[0] : results,
      message
    );
  } catch (err) {
    console.error('Post availability error:', err);
    return responses.serverError(err.message);
  }
};
