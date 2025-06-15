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
          'Access denied. Only employees can post shift availability.'
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

    // Verify the assignment belongs to this employee and validate conditions
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
          au_manager.firstname as manager_firstname,
          au_manager.lastname as manager_lastname,
          l.locationname,
          c.companyname
        FROM public.shiftassignment sa
        INNER JOIN public.shift s ON sa.shiftid = s.shiftid
        LEFT JOIN public.appuser au_manager ON s.managerid = au_manager.userid
        LEFT JOIN public.location l ON s.locationid = l.locationid
        LEFT JOIN public.company c ON s.companyid = c.companyid
        WHERE sa.shiftassignmentid = $1 AND sa.employeeid = $2
      `;

      const assignmentResult = await assignmentClient.query(assignmentQuery, [
        assignmentId,
        employeeUserId,
      ]);

      if (assignmentResult.rows.length === 0) {
        return responses.notFound(
          'Assignment not found or does not belong to this employee'
        );
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
      return responses.badRequest(
        'Cannot make past or current day shifts available to others'
      );
    }

    // Check if assignment is currently assigned
    if (assignment.status !== 'assigned') {
      return responses.badRequest(
        `Cannot make shift available. Current status is "${assignment.status}". Only assigned shifts can be made available.`
      );
    }

    // Get employee information for ownership history
    const employeeInfoClient = await pool.connect();
    let employeeInfo = {};

    try {
      const employeeQuery = `
        SELECT firstname, lastname, email
        FROM public.appuser
        WHERE userid = $1
      `;

      const employeeResult = await employeeInfoClient.query(employeeQuery, [
        employeeUserId,
      ]);

      if (employeeResult.rows.length > 0) {
        const emp = employeeResult.rows[0];
        employeeInfo = {
          id: employeeUserId,
          firstName: emp.firstname,
          lastName: emp.lastname,
          email: emp.email
        };
      }
    } finally {
      employeeInfoClient.release();
    }

    // Update the assignment status to 'available' and initialize ownership history
    const updateClient = await pool.connect();
    let updatedAssignment;

    try {
      await updateClient.query('BEGIN');

      // Initialize ownership history with current employee as the original owner
      const ownershipHistory = [
        {
          ...employeeInfo,
          transferredAt: new Date().toISOString()
        }
      ];

      const updateQuery = `
        UPDATE public.shiftassignment 
        SET 
          status = 'available',
          ownership_history = $3,
          notes = CASE 
            WHEN notes IS NULL OR notes = '' THEN 'Made available by employee for other coworkers'
            ELSE notes || ' - Made available by employee for other coworkers'
          END,
          lastupdated = NOW()
        WHERE shiftassignmentid = $1 AND employeeid = $2
        RETURNING *;
      `;

      const updateResult = await updateClient.query(updateQuery, [
        assignmentId,
        employeeUserId,
        JSON.stringify(ownershipHistory),
      ]);

      if (updateResult.rows.length === 0) {
        await updateClient.query('ROLLBACK');
        return responses.badRequest('Failed to update assignment status');
      }

      updatedAssignment = updateResult.rows[0];

      // Update shift fill status since we now have an available spot
      // (even though technically still assigned to original employee)
      const shiftUpdateQuery = `
        UPDATE public.shift 
        SET 
          fillstatus = CASE 
            WHEN COALESCE(active_assignments.assigned_count, 0) >= shift.requiredheadcount THEN 'fully_staffed'
            WHEN COALESCE(active_assignments.assigned_count, 0) > 0 THEN 'partially_staffed'
            ELSE 'unstaffed'
          END,
          lastupdated = NOW()
        FROM (
          SELECT 
            s.shiftid,
            s.requiredheadcount,
            COALESCE(sa_count.assigned_count, 0) as assigned_count
          FROM public.shift s
          LEFT JOIN (
            SELECT 
              shiftid, 
              COUNT(*) as assigned_count
            FROM public.shiftassignment 
            WHERE status = 'assigned'
            GROUP BY shiftid
          ) sa_count ON s.shiftid = sa_count.shiftid
          WHERE s.shiftid = $1
        ) active_assignments
        WHERE shift.shiftid = active_assignments.shiftid
        AND shift.shiftid = $1
      `;

      await updateClient.query(shiftUpdateQuery, [assignment.shiftid]);

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
      previousStatus: 'assigned',
      newStatus: 'available',
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
      message: 
        'Shift has been made available for other coworkers to take. You are still assigned but the shift is now open for coverage.',
    };

    return responses.success(
      responseData,
      'Shift successfully made available for other coworkers'
    );
  } catch (err) {
    console.error('Post shift error:', err);
    return responses.serverError(err.message);
  }
};
