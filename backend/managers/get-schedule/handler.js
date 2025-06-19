const { createClient } = require('@supabase/supabase-js');
const { pool } = require('/opt/nodejs/poolLayer');
const { responses } = require('/opt/nodejs/headersUtil');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

console.log('Simple test handler initializing...');
console.log('Environment check:', {
  hasSupabaseUrl: !!SUPABASE_URL,
  hasSupabaseServiceRole: !!SUPABASE_SERVICE_ROLE,
  hasSupabaseDbUrl: !!process.env.SUPABASE_DB_URL,
});

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

exports.handler = async (event) => {
  console.log('=== ENVIRONMENT DEBUG HANDLER ===');
  console.log('Event method:', event.httpMethod);

  // Log environment variables (safely)
  console.log('Environment Variables Status:');
  console.log(
    'SUPABASE_URL:',
    process.env.SUPABASE_URL
      ? 'SET (length: ' + process.env.SUPABASE_URL.length + ')'
      : 'NOT SET'
  );
  console.log(
    'SUPABASE_SERVICE_ROLE:',
    process.env.SUPABASE_SERVICE_ROLE
      ? 'SET (length: ' + process.env.SUPABASE_SERVICE_ROLE.length + ')'
      : 'NOT SET'
  );
  console.log(
    'SUPABASE_DB_URL:',
    process.env.SUPABASE_DB_URL
      ? 'SET (length: ' + process.env.SUPABASE_DB_URL.length + ')'
      : 'NOT SET'
  );
  console.log('CORS_ORIGIN:', process.env.CORS_ORIGIN ? 'SET' : 'NOT SET');

  try {
    // Test Supabase client creation
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE) {
      console.log('Attempting to create Supabase client...');
      const testClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
      console.log('Supabase client created successfully');
    } else {
      console.log(
        'Cannot create Supabase client - missing URL or service role'
      );
    }

    // Test database connection if DB URL exists
    if (process.env.SUPABASE_DB_URL) {
      console.log('Testing database connection...');
      const testClient = await pool.connect();
      try {
        const testResult = await testClient.query('SELECT 1 as test');
        console.log('Database connection successful:', testResult.rows[0]);
      } finally {
        testClient.release();
      }
    } else {
      console.log('No SUPABASE_DB_URL found - cannot test database connection');
    }

    const result = {
      timestamp: new Date().toISOString(),
      environment: {
        hasSupabaseUrl: !!SUPABASE_URL,
        hasSupabaseServiceRole: !!SUPABASE_SERVICE_ROLE,
        hasSupabaseDbUrl: !!process.env.SUPABASE_DB_URL,
        nodeVersion: process.version,
        platform: process.platform,
      },
      event: {
        httpMethod: event.httpMethod,
        hasHeaders: !!event.headers,
        hasAuth: !!(
          event.headers?.authorization || event.headers?.Authorization
        ),
        queryParams: event.queryStringParameters,
      },
    };

    console.log('Returning success response');
    return responses.success(result, 'Environment debug handler working');
  } catch (err) {
    console.error('=== ERROR IN DEBUG HANDLER ===');
    console.error('Error name:', err.name);
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);

    return responses.serverError(`Debug handler error: ${err.message}`);
  }
};
