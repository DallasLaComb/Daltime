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
          'Access denied. Only employees can claim available shifts.'
        );
      }

      employeeUserId = userResult.rows[0].userid;
    } finally {
      client.release();
    }

    // Parse and validate request body
    const body = JSON.parse(event.body || '{}');
    const { assignmentId } = body;

    // Validate required fields
    if (!assignmentId) {
      return responses.badRequest('Assignment ID is required');
    }

    // Get the available shift assignment and validate it
    const assignmentClient = await pool.connect();
    let assignment;

    try {
      const assignmentQuery = `
        SELECT 
          sa.shiftassignmentid,
          sa.shiftid,
          sa.employeeid,
          sa.status,
          sa.starttime,
          sa.endtime,
          sa.notes,
          sa.assignedat,
          s.date,
          s.starttime as shift_starttime,
          s.endtime as shift_endtime,
          s.managerid,
          s.requiredheadcount,
          au_current.firstname as current_employee_firstname,
          au_current.lastname as current_employee_lastname,
          au_manager.firstname as manager_firstname,
          au_manager.lastname as manager_lastname,
          l.locationname,
          c.companyname
        FROM public.shiftassignment sa
        INNER JOIN public.shift s ON sa.shiftid = s.shiftid
        INNER JOIN public.appuser au_current ON sa.employeeid = au_current.userid
        LEFT JOIN public.appuser au_manager ON s.managerid = au_manager.userid
        LEFT JOIN public.location l ON s.locationid = l.locationid
        LEFT JOIN public.company c ON s.companyid = c.companyid
        WHERE sa.shiftassignmentid = $1
      `;

      const assignmentResult = await assignmentClient.query(assignmentQuery, [
        assignmentId,
      ]);

      if (assignmentResult.rows.length === 0) {
        return responses.notFound('Assignment not found');
      }

      assignment = assignmentResult.rows[0];
    } finally {
      assignmentClient.release();
    }

    // Validate business rules
    const shiftDate = new Date(assignment.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if shift is in the future
    if (shiftDate <= today) {
      return responses.badRequest('Cannot claim past or current day shifts');
    }

    // Check if assignment is available
    if (assignment.status !== 'available') {
      return responses.badRequest(
        `Shift is not available for claiming. Current status is "${assignment.status}".`
      );
    }

    // Check if the requesting employee is the same as the current assignee
    if (assignment.employeeid === employeeUserId) {
      return responses.badRequest(
        'You cannot claim your own shift. Use the cancel available status instead.'
      );
    }

    // Verify both employees work for the same manager
    const managerValidationClient = await pool.connect();
    try {
      const managerValidationQuery = `
        SELECT COUNT(*) as count
        FROM public.manageremployeeassignment mea
        WHERE mea.managerid = $1 
        AND mea.employeeid = $2 
        AND mea.status = 'active'
      `;

      const validationResult = await managerValidationClient.query(
        managerValidationQuery,
        [assignment.managerid, employeeUserId]
      );

      if (parseInt(validationResult.rows[0].count) === 0) {
        return responses.forbidden(
          'You can only claim shifts from coworkers under the same manager.'
        );
      }
    } finally {
      managerValidationClient.release();
    }

    // Check for scheduling conflicts
    const conflictClient = await pool.connect();
    try {
      const conflictQuery = `
        SELECT sa.shiftassignmentid
        FROM public.shiftassignment sa
        INNER JOIN public.shift s ON sa.shiftid = s.shiftid
        WHERE sa.employeeid = $1
        AND s.date = $2
        AND (
          (sa.starttime <= $3 AND sa.endtime > $3) OR
          (sa.starttime < $4 AND sa.endtime >= $4) OR
          (sa.starttime >= $3 AND sa.endtime <= $4)
        )
        AND sa.status IN ('assigned', 'available')
      `;

      const conflictResult = await conflictClient.query(conflictQuery, [
        employeeUserId,
        assignment.date,
        assignment.shift_starttime,
        assignment.shift_endtime,
      ]);

      if (conflictResult.rows.length > 0) {
        return responses.badRequest(
          'You already have a shift assignment during this time period.'
        );
      }
    } finally {
      conflictClient.release();
    }

    // Get current ownership history and employee details
    const historyClient = await pool.connect();
    let ownershipHistory = [];
    let currentEmployeeInfo = {};
    let claimingEmployeeInfo = {};

    try {
      // Get current assignment with ownership history
      const historyQuery = `
        SELECT 
          sa.ownership_history,
          au_current.firstname as current_firstname,
          au_current.lastname as current_lastname,
          au_current.email as current_email,
          au_claiming.firstname as claiming_firstname,
          au_claiming.lastname as claiming_lastname,
          au_claiming.email as claiming_email
        FROM public.shiftassignment sa
        INNER JOIN public.appuser au_current ON sa.employeeid = au_current.userid
        INNER JOIN public.appuser au_claiming ON au_claiming.userid = $2
        WHERE sa.shiftassignmentid = $1
      `;

      const historyResult = await historyClient.query(historyQuery, [
        assignmentId,
        employeeUserId,
      ]);

      if (historyResult.rows.length > 0) {
        const row = historyResult.rows[0];

        // Parse existing ownership history or initialize as empty array
        try {
          if (row.ownership_history) {
            // Handle different data types from PostgreSQL JSON column
            if (typeof row.ownership_history === 'string') {
              ownershipHistory = JSON.parse(row.ownership_history);
            } else if (Array.isArray(row.ownership_history)) {
              ownershipHistory = row.ownership_history;
            } else if (typeof row.ownership_history === 'object') {
              // PostgreSQL might return JSON as an object, check if it's array-like
              ownershipHistory = Array.isArray(row.ownership_history)
                ? row.ownership_history
                : [];
            } else {
              ownershipHistory = [];
            }
          } else {
            ownershipHistory = [];
          }
        } catch (parseError) {
          console.error('Error parsing ownership history:', parseError);
          ownershipHistory = [];
        }

        // Double-check that ownershipHistory is an array before using array methods
        if (!Array.isArray(ownershipHistory)) {
          console.warn(
            'ownershipHistory is not an array, resetting to empty array:',
            typeof ownershipHistory,
            ownershipHistory
          );
          ownershipHistory = [];
        }

        currentEmployeeInfo = {
          id: assignment.employeeid,
          firstName: row.current_firstname,
          lastName: row.current_lastname,
          email: row.current_email,
        };

        claimingEmployeeInfo = {
          id: employeeUserId,
          firstName: row.claiming_firstname,
          lastName: row.claiming_lastname,
          email: row.claiming_email,
        };

        // Add current employee to history if not already present
        const currentEmployeeInHistory = ownershipHistory.find(
          (emp) => emp.id === assignment.employeeid
        );
        if (!currentEmployeeInHistory) {
          ownershipHistory.push({
            ...currentEmployeeInfo,
            transferredAt: new Date().toISOString(),
          });
        }
      }
    } finally {
      historyClient.release();
    }

    // Update the assignment to transfer it to the new employee
    const updateClient = await pool.connect();
    let updatedAssignment;

    try {
      await updateClient.query('BEGIN');

      const updateQuery = `
        UPDATE public.shiftassignment 
        SET 
          employeeid = $2,
          status = 'assigned',
          ownership_history = $3,
          notes = CASE 
            WHEN notes IS NULL OR notes = '' THEN $4
            ELSE notes || $5
          END,
          lastupdated = NOW()
        WHERE shiftassignmentid = $1
        RETURNING *;
      `;

      const newNoteText = `Claimed from ${currentEmployeeInfo.firstName} ${currentEmployeeInfo.lastName}`;
      const appendNoteText = ` - Claimed from ${currentEmployeeInfo.firstName} ${currentEmployeeInfo.lastName}`;

      const updateResult = await updateClient.query(updateQuery, [
        assignmentId,
        employeeUserId,
        ownershipHistory,
        newNoteText,
        appendNoteText,
      ]);

      if (updateResult.rows.length === 0) {
        await updateClient.query('ROLLBACK');
        return responses.badRequest('Failed to claim assignment');
      }

      updatedAssignment = updateResult.rows[0];

      await updateClient.query('COMMIT');
    } catch (error) {
      await updateClient.query('ROLLBACK');
      throw error;
    } finally {
      updateClient.release();
    }

    // Format response with comprehensive shift details
    const responseData = {
      assignmentId: updatedAssignment.shiftassignmentid,
      shiftId: assignment.shiftid,
      previousEmployee: currentEmployeeInfo,
      claimingEmployee: claimingEmployeeInfo,
      ownershipHistory: ownershipHistory,
      previousStatus: 'available',
      newStatus: 'assigned',
      date: assignment.date,
      startTime: assignment.shift_starttime,
      endTime: assignment.shift_endtime,
      location: assignment.locationname || 'No location specified',
      company: assignment.companyname || 'No company specified',
      manager: {
        firstName: assignment.manager_firstname,
        lastName: assignment.manager_lastname,
      },
      requiredHeadcount: assignment.requiredheadcount,
      updatedAt: updatedAssignment.lastupdated,
      notes: updatedAssignment.notes,
      transferCount: ownershipHistory.length,
      message: `Shift successfully claimed from ${currentEmployeeInfo.firstName} ${currentEmployeeInfo.lastName}! You are now assigned to this shift.`,
    };

    return responses.success(
      responseData,
      'Shift successfully claimed from coworker'
    );
  } catch (err) {
    console.error('Claim shift error:', err);
    return responses.serverError(err.message);
  }
};
