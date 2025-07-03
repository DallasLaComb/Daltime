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
          'Access denied. Only managers can view employee assignments.'
        );
      }

      managerUserId = userResult.rows[0].userid;
    } finally {
      client.release();
    }

    // Get all employees assigned to this manager
    const employeesClient = await pool.connect();
    let employees;

    try {
      const employeesQuery = `
        SELECT 
          mea.assignmentid,
          mea.dateassigned,
          mea.status,
          au.userid as employeeid,
          au.firstname,
          au.lastname,
          au.email,
          au.phonenumber,
          au.createdat as employee_created_at
        FROM public.manageremployeeassignment mea
        INNER JOIN public.appuser au ON mea.employeeid = au.userid
        WHERE mea.managerid = $1 AND au.role = 'employee'
        ORDER BY au.lastname, au.firstname
      `;

      const result = await employeesClient.query(employeesQuery, [
        managerUserId,
      ]);
      employees = result.rows;
    } finally {
      employeesClient.release();
    }

    // Format the response
    const formattedEmployees = employees.map((emp) => ({
      assignmentId: emp.assignmentid,
      employeeId: emp.employeeid,
      firstName: emp.firstname,
      lastName: emp.lastname,
      email: emp.email,
      phoneNumber: emp.phonenumber,
      dateAssigned: emp.dateassigned,
      status: emp.status,
      employeeCreatedAt: emp.employee_created_at,
    }));

    return responses.success(
      {
        managerId: managerUserId,
        totalEmployees: formattedEmployees.length,
        employees: formattedEmployees,
      },
      'Employees retrieved successfully'
    );
  } catch (err) {
    console.error('Get all employees error:', err);
    return responses.serverError(err.message);
  }
};
