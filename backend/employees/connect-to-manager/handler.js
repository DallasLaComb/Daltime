const { createClient } = require('@supabase/supabase-js');
const { pool } = require('/opt/nodejs/poolLayer');
const { responses } = require('/opt/nodejs/headersUtil');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

exports.handler = async (event) => {
  try {
    // Debug logging
    console.log('Event object:', JSON.stringify(event, null, 2));
    console.log('HTTP Method:', event.httpMethod);
    console.log('Request Method:', event.requestContext?.http?.method);

    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return responses.success(null, 'CORS preflight success');
    }

    // Check both possible method properties
    const method = event.httpMethod || event.requestContext?.http?.method;

    // Only allow POST requests
    if (method !== 'POST') {
      return responses.badRequest(
        `Only POST requests are allowed. Received: ${method}`
      );
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
          'Access denied. Only employees can connect to managers.'
        );
      }

      employeeUserId = userResult.rows[0].userid;
    } finally {
      client.release();
    }

    // Parse and validate request body
    const body = JSON.parse(event.body || '{}');
    const { managerId } = body;

    // Validate required fields
    if (!managerId) {
      return responses.badRequest('Manager ID is required');
    }

    // Validate managerId is a valid UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(managerId)) {
      return responses.badRequest('Invalid manager ID format');
    }

    // Verify the manager exists and is actually a manager
    const managerValidationClient = await pool.connect();
    let managerInfo;

    try {
      const managerQuery = `
        SELECT 
          au.userid,
          au.firstname,
          au.lastname,
          au.email,
          au.role
        FROM public.appuser au
        WHERE au.userid = $1 AND au.role = 'manager'
      `;

      const managerResult = await managerValidationClient.query(managerQuery, [
        managerId,
      ]);

      if (managerResult.rows.length === 0) {
        return responses.notFound('Manager not found or user is not a manager');
      }

      managerInfo = managerResult.rows[0];
    } finally {
      managerValidationClient.release();
    }

    // Check if the employee is already connected to this manager
    const existingConnectionClient = await pool.connect();

    try {
      const existingQuery = `
        SELECT 
          assignmentid,
          status,
          dateassigned
        FROM public.manageremployeeassignment
        WHERE managerid = $1 AND employeeid = $2
      `;

      const existingResult = await existingConnectionClient.query(
        existingQuery,
        [managerId, employeeUserId]
      );

      if (existingResult.rows.length > 0) {
        const existing = existingResult.rows[0];

        if (existing.status === 'active') {
          return responses.badRequest(
            `You are already connected to manager ${managerInfo.firstname} ${managerInfo.lastname} (active since ${existing.dateassigned})`
          );
        } else {
          // If connection exists but is inactive, reactivate it
          const reactivateClient = await pool.connect();

          try {
            const reactivateQuery = `
              UPDATE public.manageremployeeassignment
              SET 
                status = 'active',
                dateassigned = CURRENT_DATE
              WHERE assignmentid = $1
              RETURNING *
            `;

            const reactivateResult = await reactivateClient.query(
              reactivateQuery,
              [existing.assignmentid]
            );

            if (reactivateResult.rows.length === 0) {
              return responses.serverError(
                'Failed to reactivate manager connection'
              );
            }

            const reactivatedConnection = reactivateResult.rows[0];

            return responses.success(
              {
                assignmentId: reactivatedConnection.assignmentid,
                managerId: managerId,
                employeeId: employeeUserId,
                manager: {
                  firstName: managerInfo.firstname,
                  lastName: managerInfo.lastname,
                  email: managerInfo.email,
                },
                status: reactivatedConnection.status,
                dateAssigned: reactivatedConnection.dateassigned,
                connectionType: 'reactivated',
              },
              `Successfully reactivated connection to manager ${managerInfo.firstname} ${managerInfo.lastname}!`
            );
          } finally {
            reactivateClient.release();
          }
        }
      }
    } finally {
      existingConnectionClient.release();
    }

    // Create new manager-employee connection
    const connectionClient = await pool.connect();
    let newConnection;

    try {
      await connectionClient.query('BEGIN');

      const insertQuery = `
        INSERT INTO public.manageremployeeassignment (managerid, employeeid, dateassigned, status)
        VALUES ($1, $2, CURRENT_DATE, 'active')
        RETURNING *
      `;

      const insertResult = await connectionClient.query(insertQuery, [
        managerId,
        employeeUserId,
      ]);

      if (insertResult.rows.length === 0) {
        await connectionClient.query('ROLLBACK');
        return responses.serverError('Failed to create manager connection');
      }

      newConnection = insertResult.rows[0];

      await connectionClient.query('COMMIT');
    } catch (error) {
      await connectionClient.query('ROLLBACK');
      console.error('Database error creating manager connection:', error);
      return responses.serverError('Failed to create manager connection');
    } finally {
      connectionClient.release();
    }

    // Get additional manager statistics for response
    const statsClient = await pool.connect();
    let managerStats = {};

    try {
      const statsQuery = `
        SELECT 
          COUNT(DISTINCT mea.employeeid) as total_employees,
          COUNT(DISTINCT CASE WHEN mea.status = 'active' THEN mea.employeeid END) as active_employees,
          COUNT(DISTINCT s.shiftid) as total_shifts_created,
          COUNT(DISTINCT CASE WHEN s.date >= CURRENT_DATE THEN s.shiftid END) as future_shifts
        FROM public.manageremployeeassignment mea
        LEFT JOIN public.shift s ON mea.managerid = s.managerid
        WHERE mea.managerid = $1
      `;

      const statsResult = await statsClient.query(statsQuery, [managerId]);

      if (statsResult.rows.length > 0) {
        const stats = statsResult.rows[0];
        managerStats = {
          totalEmployees: parseInt(stats.total_employees) || 0,
          activeEmployees: parseInt(stats.active_employees) || 0,
          totalShiftsCreated: parseInt(stats.total_shifts_created) || 0,
          futureShifts: parseInt(stats.future_shifts) || 0,
        };
      }
    } catch (error) {
      console.error('Error fetching manager stats:', error);
      // Don't fail the request if stats fail
      managerStats = {
        totalEmployees: 0,
        activeEmployees: 0,
        totalShiftsCreated: 0,
        futureShifts: 0,
      };
    } finally {
      statsClient.release();
    }

    // Format successful response
    const responseData = {
      assignmentId: newConnection.assignmentid,
      managerId: managerId,
      employeeId: employeeUserId,
      manager: {
        firstName: managerInfo.firstname,
        lastName: managerInfo.lastname,
        email: managerInfo.email,
      },
      status: newConnection.status,
      dateAssigned: newConnection.dateassigned,
      connectionType: 'new',
      managerStats: managerStats,
    };

    return responses.created(
      responseData,
      `Successfully connected to manager ${managerInfo.firstname} ${managerInfo.lastname}! You can now see shifts they create and they can assign you to their shifts.`
    );
  } catch (err) {
    console.error('Connect to manager error:', err);
    return responses.serverError(err.message);
  }
};
