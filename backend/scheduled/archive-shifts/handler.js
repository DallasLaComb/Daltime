const { pool } = require('/opt/nodejs/poolLayer');
const { responses } = require('/opt/nodejs/headersUtil');

exports.handler = async (event) => {
  console.log('🗄️ Starting monthly shift archiving process...');
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    // Calculate archive cutoff date (first day of current month)
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const archiveCutoff = new Date(currentYear, currentMonth, 1);
    
    console.log(`📅 Current date: ${now.toISOString().split('T')[0]}`);
    console.log(`📅 Archive cutoff: ${archiveCutoff.toISOString().split('T')[0]}`);
    console.log(`📦 Archiving all shifts before ${archiveCutoff.toISOString().split('T')[0]}`);
    
    // Step 1: Find shifts to archive (anything before current month)
    const shiftsToArchiveQuery = `
      SELECT 
        s.*,
        COALESCE(assignments.assigned_count, 0) as current_assigned_count
      FROM public.shift s
      LEFT JOIN (
        SELECT 
          shiftid, 
          COUNT(*) as assigned_count
        FROM public.shiftassignment 
        WHERE status != 'cancelled'
        GROUP BY shiftid
      ) assignments ON s.shiftid = assignments.shiftid
      WHERE s.date < $1
      ORDER BY s.date, s.starttime
    `;
    
    const shiftsResult = await client.query(shiftsToArchiveQuery, [archiveCutoff]);
    const shiftsToArchive = shiftsResult.rows;
    
    console.log(`📋 Found ${shiftsToArchive.length} shifts to archive`);
    
    if (shiftsToArchive.length === 0) {
      await client.query('COMMIT');
      console.log('✅ No shifts to archive this month');
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'No shifts to archive this month',
          archived: {
            shifts: 0,
            assignments: 0
          }
        })
      };
    }
    
    // Step 2: Find assignments to archive (for the shifts being archived)
    const shiftIds = shiftsToArchive.map(s => s.shiftid);
    const assignmentsToArchiveQuery = `
      SELECT sa.*
      FROM public.shiftassignment sa
      WHERE sa.shiftid = ANY($1::uuid[])
      ORDER BY sa.assignedat
    `;
    
    const assignmentsResult = await client.query(assignmentsToArchiveQuery, [shiftIds]);
    const assignmentsToArchive = assignmentsResult.rows;
    
    console.log(`📋 Found ${assignmentsToArchive.length} shift assignments to archive`);
    
    // Step 3: Archive shift assignments first (due to foreign key dependency)
    if (assignmentsToArchive.length > 0) {
      console.log('📦 Archiving shift assignments...');
      
      for (let i = 0; i < assignmentsToArchive.length; i++) {
        const assignment = assignmentsToArchive[i];
        
        const insertArchivedAssignmentQuery = `
          INSERT INTO public.archived_shiftassignment (
            shiftassignmentid, shiftid, employeeid, assignedat, 
            status, starttime, endtime, notes, archivedat
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          ON CONFLICT (shiftassignmentid) DO NOTHING
        `;
        
        await client.query(insertArchivedAssignmentQuery, [
          assignment.shiftassignmentid,
          assignment.shiftid,
          assignment.employeeid,
          assignment.assignedat,
          assignment.status,
          assignment.starttime,
          assignment.endtime,
          assignment.notes
        ]);
        
        if ((i + 1) % 50 === 0) {
          console.log(`   Archived ${i + 1}/${assignmentsToArchive.length} assignments`);
        }
      }
      
      console.log(`✅ Archived ${assignmentsToArchive.length} shift assignments`);
    }
    
    // Step 4: Archive shifts
    console.log('📦 Archiving shifts...');
    
    for (let i = 0; i < shiftsToArchive.length; i++) {
      const shift = shiftsToArchive[i];
      
      // Determine archive reason
      const isFullyStaffed = shift.current_assigned_count >= shift.requiredheadcount;
      const archiveReason = isFullyStaffed ? 'completed_fully_staffed' : 'completed_understaffed';
      
      const insertArchivedShiftQuery = `
        INSERT INTO public.archived_shift (
          shiftid, companyid, locationid, managerid, date, 
          starttime, endtime, notes, requiredheadcount, createdat,
          archivedat, archive_reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11)
        ON CONFLICT (shiftid) DO NOTHING
      `;
      
      await client.query(insertArchivedShiftQuery, [
        shift.shiftid,
        shift.companyid,
        shift.locationid,
        shift.managerid,
        shift.date,
        shift.starttime,
        shift.endtime,
        shift.notes,
        shift.requiredheadcount,
        shift.createdat,
        archiveReason
      ]);
      
      if ((i + 1) % 50 === 0) {
        console.log(`   Archived ${i + 1}/${shiftsToArchive.length} shifts`);
      }
    }
    
    console.log(`✅ Archived ${shiftsToArchive.length} shifts`);
    
    // Step 5: Delete original assignments
    if (assignmentsToArchive.length > 0) {
      console.log('🗑️ Removing original shift assignments...');
      
      const deleteAssignmentsQuery = `
        DELETE FROM public.shiftassignment 
        WHERE shiftid = ANY($1::uuid[])
      `;
      
      const deletedAssignments = await client.query(deleteAssignmentsQuery, [shiftIds]);
      console.log(`✅ Deleted ${deletedAssignments.rowCount} original assignments`);
    }
    
    // Step 6: Delete original shifts
    console.log('🗑️ Removing original shifts...');
    
    const deleteShiftsQuery = `
      DELETE FROM public.shift 
      WHERE shiftid = ANY($1::uuid[])
    `;
    
    const deletedShifts = await client.query(deleteShiftsQuery, [shiftIds]);
    console.log(`✅ Deleted ${deletedShifts.rowCount} original shifts`);
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('🎉 Monthly archiving completed successfully!');
    console.log(`📊 Archive Summary:`);
    console.log(`   • Shifts archived: ${shiftsToArchive.length}`);
    console.log(`   • Assignments archived: ${assignmentsToArchive.length}`);
    console.log(`   • Archive cutoff date: ${archiveCutoff.toISOString().split('T')[0]}`);
    
    // Verification
    const verificationQuery = `
      SELECT 
        (SELECT COUNT(*) FROM public.shift) as active_shifts,
        (SELECT COUNT(*) FROM public.archived_shift) as archived_shifts,
        (SELECT COUNT(*) FROM public.shiftassignment) as active_assignments,
        (SELECT COUNT(*) FROM public.archived_shiftassignment) as archived_assignments
    `;
    
    const verification = await client.query(verificationQuery);
    const stats = verification.rows[0];
    
    console.log(`📊 Post-archive stats:`);
    console.log(`   • Active shifts: ${stats.active_shifts}`);
    console.log(`   • Archived shifts: ${stats.archived_shifts}`);
    console.log(`   • Active assignments: ${stats.active_assignments}`);
    console.log(`   • Archived assignments: ${stats.archived_assignments}`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Monthly archiving completed successfully',
        archived: {
          shifts: shiftsToArchive.length,
          assignments: assignmentsToArchive.length
        },
        archiveCutoffDate: archiveCutoff.toISOString().split('T')[0],
        postArchiveStats: stats
      })
    };
    
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('❌ Archive process failed:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
        message: 'Monthly archiving failed'
      })
    };
    
  } finally {
    client.release();
  }
};
