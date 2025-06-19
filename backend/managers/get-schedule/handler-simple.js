const { createClient } = require('@supabase/supabase-js');
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
  console.log('=== SIMPLE TEST HANDLER START ===');
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    // Just return environment info for now
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

    console.log('Result:', JSON.stringify(result, null, 2));

    return responses.success(result, 'Test handler working');
  } catch (err) {
    console.error('=== ERROR IN TEST HANDLER ===');
    console.error('Error details:', {
      message: err.message,
      stack: err.stack,
      name: err.name,
    });

    return responses.serverError(`Test handler error: ${err.message}`);
  }
};
