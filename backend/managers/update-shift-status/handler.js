const { createClient } = require('@supabase/supabase-js');
const { pool } = require('/opt/nodejs/poolLayer');
const { responses } = require('/opt/nodejs/headersUtil');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

/**
 * Updates shift fill status based on current assignments
 * Can be called after scheduling or manual assignment changes
 */
async function updateShiftFillStatus(shiftId, pool) {
  const client = await pool.connect();

  try {
    const updateQuery = `
      UPDATE public.shift 
      SET 
        fillstatus = CASE 
          WHEN COALESCE(assignments.assigned_count, 0) >= shift.requiredheadcount THEN 'fully_staffed'
          WHEN COALESCE(assignments.assigned_count, 0) > 0 THEN 'partially_staffed'
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
          WHERE status IN ('assigned', 'available')
          GROUP BY shiftid
        ) sa_count ON s.shiftid = sa_count.shiftid
        WHERE s.shiftid = $1
      ) assignments
      WHERE shift.shiftid = assignments.shiftid
      AND shift.shiftid = $1
      RETURNING 
        shift.*,
        CASE 
          WHEN assignments.assigned_count >= shift.requiredheadcount THEN 'fully_staffed'
          WHEN assignments.assigned_count > 0 THEN 'partially_staffed'
          ELSE 'unstaffed'
        END as new_fill_status,
        assignments.assigned_count as current_assigned_count;
    `;

    const result = await client.query(updateQuery, [shiftId]);
    return result.rows[0];
  } finally {
    client.release();
  }
}

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
          'Access denied. Only managers can update shift status.'
        );
      }

      managerUserId = userResult.rows[0].userid;
    } finally {
      client.release();
    }

    // Parse request body
    const body = event.body ? JSON.parse(event.body) : {};
    const { shiftId, action } = body;

    if (!shiftId) {
      return responses.badRequest('Shift ID is required');
    }

    // Verify the shift belongs to this manager
    const verifyClient = await pool.connect();
    try {
      const verifyQuery = `
        SELECT shiftid 
        FROM public.shift 
        WHERE shiftid = $1 AND managerid = $2
      `;

      const verifyResult = await verifyClient.query(verifyQuery, [
        shiftId,
        managerUserId,
      ]);

      if (verifyResult.rows.length === 0) {
        return responses.notFound('Shift not found or access denied');
      }
    } finally {
      verifyClient.release();
    }

    let result;

    if (action === 'update_status') {
      // Update fill status for a specific shift
      result = await updateShiftFillStatus(shiftId, pool);

      return responses.success(
        {
          shiftId: result.shiftid,
          previousStatus: result.fillstatus,
          newStatus: result.new_fill_status,
          currentAssignedCount: result.current_assigned_count,
          requiredHeadcount: result.requiredheadcount,
          lastUpdated: result.lastupdated,
        },
        'Shift fill status updated successfully'
      );
    } else if (action === 'update_all_shifts') {
      // Update fill status for all shifts belonging to this manager
      const updateAllClient = await pool.connect();

      try {
        const updateAllQuery = `
          UPDATE public.shift 
          SET 
            fillstatus = CASE 
              WHEN COALESCE(assignments.assigned_count, 0) >= shift.requiredheadcount THEN 'fully_staffed'
              WHEN COALESCE(assignments.assigned_count, 0) > 0 THEN 'partially_staffed'
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
              WHERE status IN ('assigned', 'available')
              GROUP BY shiftid
            ) sa_count ON s.shiftid = sa_count.shiftid
            WHERE s.managerid = $1
          ) assignments
          WHERE shift.shiftid = assignments.shiftid
          AND shift.managerid = $1
          RETURNING 
            shift.shiftid,
            shift.fillstatus,
            assignments.assigned_count as current_assigned_count,
            shift.requiredheadcount;
        `;

        const updateAllResult = await updateAllClient.query(updateAllQuery, [
          managerUserId,
        ]);

        const summary = updateAllResult.rows.reduce(
          (acc, row) => {
            acc.totalShifts++;
            acc[row.fillstatus] = (acc[row.fillstatus] || 0) + 1;
            return acc;
          },
          {
            totalShifts: 0,
            fully_staffed: 0,
            partially_staffed: 0,
            unstaffed: 0,
          }
        );

        return responses.success(
          {
            updatedShifts: updateAllResult.rows.length,
            summary,
          },
          'All shift fill statuses updated successfully'
        );
      } finally {
        updateAllClient.release();
      }
    } else {
      return responses.badRequest(
        'Invalid action. Use "update_status" or "update_all_shifts"'
      );
    }
  } catch (err) {
    console.error('Update shift status error:', err);
    return responses.serverError(err.message);
  }
};

// Export the utility function for use in other handlers
exports.updateShiftFillStatus = updateShiftFillStatus;
