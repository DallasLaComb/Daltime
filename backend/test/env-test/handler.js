const { responses } = require('/opt/nodejs/headersUtil');
require('dotenv').config();

exports.handler = async (event) => {
  console.log('=== PRODUCTION ENVIRONMENT TEST ===');

  try {
    // Environment Variables Test
    const envStatus = {
      SUPABASE_URL: process.env.SUPABASE_URL ? 'SET' : 'NOT SET',
      SUPABASE_SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE
        ? 'SET'
        : 'NOT SET',
      SUPABASE_DB_URL: process.env.SUPABASE_DB_URL ? 'SET' : 'NOT SET',
      CORS_ORIGIN: process.env.CORS_ORIGIN ? 'SET' : 'NOT SET',
    };

    console.log('Environment Variables Status:', envStatus);

    let dbTestResult = null;

    // Test database connection
    if (process.env.SUPABASE_DB_URL) {
      console.log('Testing database connection...');
      try {
        const { Pool } = require('pg');
        const pool = new Pool({
          connectionString: process.env.SUPABASE_DB_URL,
          ssl: { rejectUnauthorized: false },
        });

        const result = await pool.query('SELECT 1 as test, NOW() as timestamp');
        console.log('Database connection test: SUCCESS');
        console.log('Test result:', result.rows[0]);

        dbTestResult = {
          success: true,
          data: result.rows[0],
          message: 'Database connection successful',
        };

        await pool.end();
      } catch (dbError) {
        console.error('Database connection test: FAILED');
        console.error('Error:', dbError.message);

        dbTestResult = {
          success: false,
          error: dbError.message,
          message: 'Database connection failed',
        };
      }
    } else {
      console.log('Database connection test: SKIPPED (no DB_URL)');
      dbTestResult = {
        success: false,
        message: 'No SUPABASE_DB_URL found',
      };
    }

    const testResults = {
      timestamp: new Date().toISOString(),
      environment: envStatus,
      databaseTest: dbTestResult,
      lambdaInfo: {
        functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
        functionVersion: process.env.AWS_LAMBDA_FUNCTION_VERSION,
        region: process.env.AWS_REGION,
        runtime: process.env.AWS_EXECUTION_ENV,
      },
    };

    console.log('Test Results:', JSON.stringify(testResults, null, 2));

    return responses.success(testResults, 'Environment test completed');
  } catch (err) {
    console.error('=== ERROR IN ENVIRONMENT TEST ===');
    console.error('Error details:', {
      message: err.message,
      stack: err.stack,
      name: err.name,
    });

    return responses.serverError(`Environment test error: ${err.message}`);
  }
};
