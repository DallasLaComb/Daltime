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
          'Access denied. Only employees can view managers.'
        );
      }

      employeeUserId = userResult.rows[0].userid;
    } finally {
      client.release();
    }

    // Get employee's current managers
    const currentManagersClient = await pool.connect();
    let currentManagers = [];

    try {
      const currentManagersQuery = `
        SELECT 
          mea.assignmentid,
          mea.dateassigned,
          mea.status,
          au.userid as managerid,
          au.firstname,
          au.lastname,
          au.email,
          au.phonenumber,
          au.createdat as manager_created_at
        FROM public.manageremployeeassignment mea
        INNER JOIN public.appuser au ON mea.managerid = au.userid
        WHERE mea.employeeid = $1 AND au.role = 'manager'
        ORDER BY mea.dateassigned DESC, au.lastname, au.firstname
      `;

      const currentResult = await currentManagersClient.query(
        currentManagersQuery,
        [employeeUserId]
      );
      currentManagers = currentResult.rows;
    } finally {
      currentManagersClient.release();
    }

    // Get all managers from the same company as the employee
    const allManagersClient = await pool.connect();
    let availableManagers = [];

    try {
      // First, get the employee's company
      const employeeCompanyQuery = `
        SELECT au.companyid
        FROM public.appuser au
        WHERE au.userid = $1
      `;

      const employeeCompanyResult = await allManagersClient.query(
        employeeCompanyQuery,
        [employeeUserId]
      );

      if (employeeCompanyResult.rows.length > 0) {
        const employeeCompanyId = employeeCompanyResult.rows[0].companyid;

        // Get all managers from the same company
        const allManagersQuery = `
          SELECT DISTINCT
            au.userid as managerid,
            au.firstname,
            au.lastname,
            au.email,
            au.phonenumber,
            au.createdat as manager_created_at,
            au.companyid,
            c.companyname,
            CASE 
              WHEN mea.managerid IS NOT NULL THEN true 
              ELSE false 
            END as is_current_manager,
            mea.status as assignment_status,
            mea.dateassigned
          FROM public.appuser au
          LEFT JOIN public.company c ON au.companyid = c.companyid
          LEFT JOIN public.manageremployeeassignment mea ON au.userid = mea.managerid AND mea.employeeid = $1
          WHERE au.role = 'manager'
          AND au.companyid = $2
          ORDER BY 
            is_current_manager DESC,
            au.lastname, 
            au.firstname
        `;

        const allResult = await allManagersClient.query(allManagersQuery, [
          employeeUserId,
          employeeCompanyId,
        ]);
        availableManagers = allResult.rows;
      } else {
        // Fallback: If employee doesn't have company set, try to find managers from current assignments
        const fallbackQuery = `
          SELECT DISTINCT
            au.userid as managerid,
            au.firstname,
            au.lastname,
            au.email,
            au.phonenumber,
            au.createdat as manager_created_at,
            au.companyid,
            c.companyname,
            CASE 
              WHEN mea.managerid IS NOT NULL THEN true 
              ELSE false 
            END as is_current_manager,
            mea.status as assignment_status,
            mea.dateassigned
          FROM public.appuser au
          LEFT JOIN public.company c ON au.companyid = c.companyid
          LEFT JOIN public.manageremployeeassignment mea ON au.userid = mea.managerid AND mea.employeeid = $1
          WHERE au.role = 'manager'
          AND au.companyid IN (
            SELECT DISTINCT m.companyid 
            FROM public.appuser m
            INNER JOIN public.manageremployeeassignment mea2 ON m.userid = mea2.managerid
            WHERE mea2.employeeid = $1 AND m.companyid IS NOT NULL
          )
          ORDER BY 
            is_current_manager DESC,
            au.lastname, 
            au.firstname
        `;

        const fallbackResult = await allManagersClient.query(fallbackQuery, [
          employeeUserId,
        ]);
        availableManagers = fallbackResult.rows;
      }
    } finally {
      allManagersClient.release();
    }

    // Format current managers
    const formattedCurrentManagers = currentManagers.map((manager) => ({
      assignmentId: manager.assignmentid,
      managerId: manager.managerid,
      firstName: manager.firstname,
      lastName: manager.lastname,
      email: manager.email,
      phoneNumber: manager.phonenumber,
      dateAssigned: manager.dateassigned,
      status: manager.status,
      managerCreatedAt: manager.manager_created_at,
    }));

    // Format available managers with connection status
    const formattedAvailableManagers = availableManagers.map((manager) => ({
      managerId: manager.managerid,
      firstName: manager.firstname,
      lastName: manager.lastname,
      email: manager.email,
      phoneNumber: manager.phonenumber,
      companyId: manager.companyid,
      companyName: manager.companyname,
      isCurrentManager: manager.is_current_manager,
      assignmentStatus: manager.assignment_status,
      dateAssigned: manager.dateassigned,
      managerCreatedAt: manager.manager_created_at,
    }));

    // Remove duplicates from available managers list
    const uniqueAvailableManagers = [];
    const seenManagerIds = new Set();

    for (const manager of formattedAvailableManagers) {
      if (!seenManagerIds.has(manager.managerId)) {
        seenManagerIds.add(manager.managerId);
        uniqueAvailableManagers.push(manager);
      }
    }

    // Generate summary statistics
    const summary = {
      totalCurrentManagers: formattedCurrentManagers.length,
      activeManagers: formattedCurrentManagers.filter(
        (m) => m.status === 'active'
      ).length,
      totalAvailableManagers: uniqueAvailableManagers.length,
      availableToConnect: uniqueAvailableManagers.filter(
        (m) => !m.isCurrentManager
      ).length,
      companiesRepresented: [
        ...new Set(
          uniqueAvailableManagers
            .filter((m) => m.companyName)
            .map((m) => m.companyName)
        ),
      ].length,
    };

    return responses.success(
      {
        employeeId: employeeUserId,
        currentManagers: formattedCurrentManagers,
        availableManagers: uniqueAvailableManagers,
        summary: summary,
      },
      `Managers retrieved successfully. You are currently connected to ${summary.activeManagers} active managers and can connect to ${summary.availableToConnect} additional managers.`
    );
  } catch (err) {
    console.error('Get managers error:', err);
    return responses.serverError(err.message);
  }
};
