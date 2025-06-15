// Helper functions for weekly hour tracking
const { pool } = require('/opt/nodejs/poolLayer');

/**
 * Get the start of the week (Monday) for a given date
 */
function getWeekStartDate(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * Get all weeks in a month (up to 5 weeks)
 */
function getMonthWeeks(year, month) {
  const weeks = [];

  // Start with the first day of the month
  const firstDay = new Date(year, month - 1, 1);

  // Get the Monday of the week containing the first day
  let currentWeekStart = getWeekStartDate(firstDay);

  // If the first week starts in the previous month, we still include it
  const lastDayOfMonth = new Date(year, month, 0); // Last day of the month

  let weekNumber = 1;
  while (weekNumber <= 5 && currentWeekStart <= lastDayOfMonth) {
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6); // Sunday

    // Check if this week has any days in the target month
    const weekHasDaysInMonth =
      (currentWeekStart.getMonth() === month - 1 &&
        currentWeekStart.getFullYear() === year) ||
      (weekEnd.getMonth() === month - 1 && weekEnd.getFullYear() === year) ||
      (currentWeekStart < firstDay && weekEnd >= firstDay);

    if (weekHasDaysInMonth) {
      weeks.push({
        weekNumber: weekNumber,
        startDate: new Date(currentWeekStart),
        endDate: new Date(weekEnd),
        label: `Week ${weekNumber}`,
      });
      weekNumber++;
    }

    // Move to next week
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
  }

  return weeks;
}

/**
 * Get current month and year from date or use current date
 */
function getCurrentMonthYear(date = null) {
  const d = date ? new Date(date) : new Date();
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1, // JavaScript months are 0-indexed
    monthName: d.toLocaleString('default', { month: 'long' }),
  };
}

/**
 * Calculate hours between two time strings (HH:MM:SS format)
 */
function calculateShiftHours(startTime, endTime) {
  const start = new Date(`2000-01-01T${startTime}`);
  const end = new Date(`2000-01-01T${endTime}`);

  if (end <= start) {
    throw new Error('End time must be after start time');
  }

  const diffMs = end - start;
  return diffMs / (1000 * 60 * 60); // Convert to hours
}

/**
 * Get current weekly hours for an employee
 */
async function getEmployeeWeeklyHours(employeeId, weekStartDate) {
  const client = await pool.connect();
  try {
    const query = `
      SELECT total_hours 
      FROM public.employee_weekly_hours 
      WHERE employeeid = $1 AND week_start_date = $2
    `;

    const result = await client.query(query, [employeeId, weekStartDate]);
    return result.rows.length > 0 ? parseFloat(result.rows[0].total_hours) : 0;
  } finally {
    client.release();
  }
}

/**
 * Update or insert weekly hours for an employee
 */
async function updateEmployeeWeeklyHours(
  employeeId,
  weekStartDate,
  additionalHours
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get current hours
    const currentHours = await getEmployeeWeeklyHours(
      employeeId,
      weekStartDate
    );
    const newTotal = currentHours + additionalHours;

    // Upsert the record
    const upsertQuery = `
      INSERT INTO public.employee_weekly_hours (employeeid, week_start_date, total_hours, updatedat)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (employeeid, week_start_date)
      DO UPDATE SET 
        total_hours = $3,
        updatedat = NOW()
      RETURNING *
    `;

    const result = await client.query(upsertQuery, [
      employeeId,
      weekStartDate,
      newTotal,
    ]);

    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Check if an employee can work additional hours without exceeding the weekly limit
 */
async function canEmployeeWorkAdditionalHours(
  employeeId,
  shiftDate,
  shiftStartTime,
  shiftEndTime,
  maxWeeklyHours = 40
) {
  try {
    const weekStartDate = getWeekStartDate(shiftDate);
    const currentWeeklyHours = await getEmployeeWeeklyHours(
      employeeId,
      weekStartDate
    );
    const shiftHours = calculateShiftHours(shiftStartTime, shiftEndTime);

    const totalHoursAfterShift = currentWeeklyHours + shiftHours;

    return {
      canWork: totalHoursAfterShift <= maxWeeklyHours,
      currentHours: currentWeeklyHours,
      shiftHours: shiftHours,
      totalAfterShift: totalHoursAfterShift,
      remainingHours: Math.max(0, maxWeeklyHours - currentWeeklyHours),
      weekStartDate: weekStartDate,
    };
  } catch (error) {
    console.error('Error checking employee weekly hours:', error);
    return {
      canWork: false,
      error: error.message,
    };
  }
}

/**
 * Get weekly hours summary for all employees for a specific week
 */
async function getWeeklyHoursSummary(weekStartDate, managerEmployees = null) {
  const client = await pool.connect();
  try {
    let query = `
      SELECT 
        ewh.employeeid,
        au.firstname,
        au.lastname,
        au.email,
        ewh.total_hours,
        (40 - ewh.total_hours) as remaining_hours,
        ewh.week_start_date
      FROM public.employee_weekly_hours ewh
      INNER JOIN public.appuser au ON ewh.employeeid = au.userid
      WHERE ewh.week_start_date = $1
    `;

    const params = [weekStartDate];

    // If manager employees are provided, filter by them
    if (managerEmployees && managerEmployees.length > 0) {
      query += ` AND ewh.employeeid = ANY($2::uuid[])`;
      params.push(managerEmployees);
    }

    query += ` ORDER BY ewh.total_hours DESC, au.lastname, au.firstname`;

    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Get employees who can work additional hours (for managers to see availability)
 */
async function getAvailableEmployeesForHours(
  weekStartDate,
  minHoursNeeded,
  managerEmployees,
  maxWeeklyHours = 40
) {
  const client = await pool.connect();
  try {
    const query = `
      SELECT 
        au.userid,
        au.firstname,
        au.lastname,
        au.email,
        COALESCE(ewh.total_hours, 0) as current_hours,
        (${maxWeeklyHours} - COALESCE(ewh.total_hours, 0)) as available_hours
      FROM public.appuser au
      LEFT JOIN public.employee_weekly_hours ewh ON au.userid = ewh.employeeid AND ewh.week_start_date = $1
      WHERE au.userid = ANY($2::uuid[])
      AND au.role = 'employee'
      AND (${maxWeeklyHours} - COALESCE(ewh.total_hours, 0)) >= $3
      ORDER BY COALESCE(ewh.total_hours, 0) ASC, au.lastname, au.firstname
    `;

    const result = await client.query(query, [
      weekStartDate,
      managerEmployees,
      minHoursNeeded,
    ]);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Calculate actual weekly hours from shift assignments (for verification/debugging)
 */
async function calculateActualWeeklyHours(employeeId, weekStartDate) {
  const client = await pool.connect();
  try {
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6); // Sunday of the same week

    const query = `
      SELECT 
        sa.starttime,
        sa.endtime,
        s.date
      FROM public.shiftassignment sa
      INNER JOIN public.shift s ON sa.shiftid = s.shiftid
      WHERE sa.employeeid = $1 
      AND sa.status = 'assigned'
      AND s.date >= $2 
      AND s.date <= $3
    `;

    const result = await client.query(query, [
      employeeId,
      weekStartDate,
      weekEndDate,
    ]);

    let totalHours = 0;
    for (const row of result.rows) {
      try {
        const shiftHours = calculateShiftHours(row.starttime, row.endtime);
        totalHours += shiftHours;
      } catch (error) {
        console.error(
          `Error calculating hours for shift on ${row.date}:`,
          error
        );
      }
    }

    return {
      totalHours: totalHours,
      shifts: result.rows,
      weekStartDate: weekStartDate,
      weekEndDate: weekEndDate,
    };
  } finally {
    client.release();
  }
}

/**
 * Get comprehensive weekly hours summary including both stored and calculated values
 */
async function getDetailedWeeklyHoursSummary(
  weekStartDate,
  managerEmployees = null
) {
  const client = await pool.connect();
  try {
    let query = `
      SELECT 
        ewh.employeeid,
        au.firstname,
        au.lastname,
        au.email,
        ewh.total_hours as stored_hours,
        (40 - ewh.total_hours) as remaining_hours,
        ewh.week_start_date,
        ewh.updatedat
      FROM public.employee_weekly_hours ewh
      INNER JOIN public.appuser au ON ewh.employeeid = au.userid
      WHERE ewh.week_start_date = $1
    `;

    const params = [weekStartDate];

    // If manager employees are provided, filter by them
    if (managerEmployees && managerEmployees.length > 0) {
      query += ` AND ewh.employeeid = ANY($2::uuid[])`;
      params.push(managerEmployees);
    }

    query += ` ORDER BY ewh.total_hours DESC, au.lastname, au.firstname`;

    const result = await client.query(query, params);

    // Calculate actual hours for each employee
    const detailedSummary = [];
    for (const row of result.rows) {
      const actualHours = await calculateActualWeeklyHours(
        row.employeeid,
        weekStartDate
      );
      detailedSummary.push({
        ...row,
        actual_hours: actualHours.totalHours,
        hours_discrepancy: Math.abs(row.stored_hours - actualHours.totalHours),
        shifts_count: actualHours.shifts.length,
        total_hours: row.stored_hours, // Keep original field name for compatibility
        actual_remaining_hours: 40 - actualHours.totalHours,
      });
    }

    return detailedSummary;
  } finally {
    client.release();
  }
}

/**
 * Get monthly employee load showing hours for each week of the month
 */
async function getMonthlyEmployeeLoad(year, month, managerEmployees = null) {
  const weeks = getMonthWeeks(year, month);
  const monthlyLoad = [];

  // Get all employees we need to track
  const client = await pool.connect();
  try {
    let employeesQuery = `
      SELECT DISTINCT au.userid, au.firstname, au.lastname, au.email
      FROM public.appuser au
      WHERE au.role = 'employee'
    `;

    const params = [];
    if (managerEmployees && managerEmployees.length > 0) {
      employeesQuery += ` AND au.userid = ANY($1::uuid[])`;
      params.push(managerEmployees);
    }

    employeesQuery += ` ORDER BY au.lastname, au.firstname`;

    const employeesResult = await client.query(employeesQuery, params);
    const employees = employeesResult.rows;

    // For each employee, get their hours for each week
    for (const employee of employees) {
      const employeeLoad = {
        employeeId: employee.userid,
        firstName: employee.firstname,
        lastName: employee.lastname,
        email: employee.email,
        weeks: [],
        totalMonthHours: 0,
        averageWeeklyHours: 0,
      };

      let totalHours = 0;
      let weeksWithHours = 0;

      for (const week of weeks) {
        const actualHours = await calculateActualWeeklyHours(
          employee.userid,
          week.startDate
        );
        const storedHours = await getEmployeeWeeklyHours(
          employee.userid,
          week.startDate
        );

        const weekData = {
          weekNumber: week.weekNumber,
          weekLabel: week.label,
          startDate: week.startDate.toISOString().split('T')[0],
          endDate: week.endDate.toISOString().split('T')[0],
          storedHours: storedHours,
          actualHours: actualHours.totalHours,
          hoursDiscrepancy: Math.abs(storedHours - actualHours.totalHours),
          shiftsCount: actualHours.shifts.length,
          remainingHours: Math.max(0, 40 - actualHours.totalHours),
        };

        employeeLoad.weeks.push(weekData);
        totalHours += actualHours.totalHours;
        if (actualHours.totalHours > 0) {
          weeksWithHours++;
        }
      }

      employeeLoad.totalMonthHours = totalHours;
      employeeLoad.averageWeeklyHours =
        weeksWithHours > 0 ? totalHours / weeksWithHours : 0;

      monthlyLoad.push(employeeLoad);
    }

    return monthlyLoad;
  } finally {
    client.release();
  }
}

module.exports = {
  getWeekStartDate,
  calculateShiftHours,
  getEmployeeWeeklyHours,
  updateEmployeeWeeklyHours,
  canEmployeeWorkAdditionalHours,
  getWeeklyHoursSummary,
  getAvailableEmployeesForHours,
  calculateActualWeeklyHours,
  getDetailedWeeklyHoursSummary,
  getMonthWeeks,
  getCurrentMonthYear,
  getMonthlyEmployeeLoad,
};
