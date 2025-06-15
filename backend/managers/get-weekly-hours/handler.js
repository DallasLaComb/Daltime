const { createClient } = require('@supabase/supabase-js');
const { pool } = require('/opt/nodejs/poolLayer');
const { responses } = require('/opt/nodejs/headersUtil');
const {
  getWeeklyHoursSummary,
  getAvailableEmployeesForHours,
  getWeekStartDate,
  getDetailedWeeklyHoursSummary,
  getMonthWeeks,
  getCurrentMonthYear,
  getMonthlyEmployeeLoad,
} = require('./weeklyHoursHelper');
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
    let managerEmployees;

    try {
      const userQuery = `
        SELECT au.userid 
        FROM public.appuser au
        WHERE au.userid = $1 AND au.role = 'manager'
      `;

      const userResult = await client.query(userQuery, [user.id]);

      if (userResult.rows.length === 0) {
        return responses.forbidden(
          'Access denied. Only managers can view weekly hours.'
        );
      }

      managerUserId = userResult.rows[0].userid;

      // Get manager's employees
      const employeesQuery = `
        SELECT DISTINCT mea.employeeid
        FROM public.manageremployeeassignment mea
        WHERE mea.managerid = $1 AND mea.status = 'active'
      `;

      const employeesResult = await client.query(employeesQuery, [
        managerUserId,
      ]);
      managerEmployees = employeesResult.rows.map((row) => row.employeeid);
    } finally {
      client.release();
    }

    // Get query parameters
    const queryParams = event.queryStringParameters || {};
    const viewType = queryParams.viewType || 'weekly'; // 'weekly' or 'monthly'
    const weekOffset = parseInt(queryParams.weekOffset) || 0; // For weekly view
    const year = parseInt(queryParams.year) || new Date().getFullYear(); // For monthly view
    const month = parseInt(queryParams.month) || new Date().getMonth() + 1; // For monthly view
    const minHoursAvailable = parseFloat(queryParams.minHoursAvailable) || 0;

    if (viewType === 'monthly') {
      // Monthly view - show 5 weeks of the month
      const monthInfo = getCurrentMonthYear(new Date(year, month - 1, 1));
      const monthlyLoad = await getMonthlyEmployeeLoad(
        year,
        month,
        managerEmployees
      );
      const weeks = getMonthWeeks(year, month);

      // Calculate monthly statistics
      let totalEmployeesWithHours = 0;
      let totalHoursWorked = 0;
      let employeesAtLimit = 0;

      for (const employee of monthlyLoad) {
        if (employee.totalMonthHours > 0) {
          totalEmployeesWithHours++;
          totalHoursWorked += employee.totalMonthHours;
        }

        // Check if employee exceeded 40 hours in any week
        const hasWeekAtLimit = employee.weeks.some(
          (week) => week.remainingHours <= 0
        );
        if (hasWeekAtLimit) {
          employeesAtLimit++;
        }
      }

      const averageWeeklyHours =
        totalEmployeesWithHours > 0
          ? (
              totalHoursWorked /
              (totalEmployeesWithHours * weeks.length)
            ).toFixed(2)
          : 0;

      return responses.success(
        {
          viewType: 'monthly',
          year: year,
          month: month,
          monthName: monthInfo.monthName,
          weeks: weeks,
          summary: {
            totalEmployees: managerEmployees.length,
            totalEmployeesWithHours: totalEmployeesWithHours,
            employeesAtLimit: employeesAtLimit,
            totalMonthHoursWorked: totalHoursWorked.toFixed(2),
            averageWeeklyHours: parseFloat(averageWeeklyHours),
            weeksInMonth: weeks.length,
          },
          employeeLoad: monthlyLoad,
          filters: {
            minHoursAvailable: minHoursAvailable,
          },
        },
        `Monthly employee load retrieved successfully for ${monthInfo.monthName} ${year}`
      );
    } else {
      // Weekly view (existing functionality)
      // Calculate week start date based on offset
      const today = new Date();
      const currentWeekStart = getWeekStartDate(today);
      const targetWeekStart = new Date(currentWeekStart);
      targetWeekStart.setDate(currentWeekStart.getDate() + weekOffset * 7);

      // Get weekly hours summary for manager's employees (with discrepancy check)
      const weeklyHoursSummary = await getDetailedWeeklyHoursSummary(
        targetWeekStart,
        managerEmployees
      );

      // Get employees available for additional hours (using stored hours for now)
      const availableEmployees = await getAvailableEmployeesForHours(
        targetWeekStart,
        minHoursAvailable,
        managerEmployees
      );

      // Get additional statistics
      const totalEmployees = managerEmployees.length;
      const employeesWithHours = weeklyHoursSummary.length;
      const employeesAtLimit = weeklyHoursSummary.filter(
        (emp) => emp.remaining_hours <= 0
      ).length;
      const employeesAvailableForMore = availableEmployees.length;

      // Calculate average hours worked (using actual hours for accuracy)
      const totalHoursWorked = weeklyHoursSummary.reduce(
        (sum, emp) => sum + parseFloat(emp.actual_hours || emp.total_hours),
        0
      );
      const averageHours =
        employeesWithHours > 0
          ? (totalHoursWorked / employeesWithHours).toFixed(2)
          : 0;

      // Check for discrepancies between stored and actual hours
      const discrepancies = weeklyHoursSummary.filter(
        (emp) => emp.hours_discrepancy && emp.hours_discrepancy > 0.1
      );

      return responses.success(
        {
          viewType: 'weekly',
          weekStartDate: targetWeekStart.toISOString().split('T')[0],
          weekOffset: weekOffset,
          summary: {
            totalEmployees,
            employeesWithHours,
            employeesAtLimit,
            employeesAvailableForMore,
            totalHoursWorked: totalHoursWorked.toFixed(2),
            averageHours: parseFloat(averageHours),
            discrepanciesFound: discrepancies.length,
          },
          weeklyHours: weeklyHoursSummary,
          availableEmployees: availableEmployees,
          discrepancies: discrepancies.length > 0 ? discrepancies : undefined,
          filters: {
            minHoursAvailable: minHoursAvailable,
          },
        },
        discrepancies.length > 0
          ? `Weekly hours summary retrieved with ${discrepancies.length} discrepancy(ies) found`
          : 'Weekly hours summary retrieved successfully'
      );
    }
  } catch (err) {
    console.error('Get weekly hours error:', err);
    return responses.serverError(err.message);
  }
};
