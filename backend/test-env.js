// Quick test to check environment variables locally
require('dotenv').config();

console.log('Environment Variables Test:');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'NOT SET');
console.log(
  'SUPABASE_SERVICE_ROLE:',
  process.env.SUPABASE_SERVICE_ROLE ? 'SET' : 'NOT SET'
);
console.log(
  'SUPABASE_DB_URL:',
  process.env.SUPABASE_DB_URL ? 'SET' : 'NOT SET'
);

// Test database connection
const { Pool } = require('pg');

if (process.env.SUPABASE_DB_URL) {
  const pool = new Pool({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });

  pool
    .query('SELECT 1 as test')
    .then((result) => {
      console.log('Database connection test: SUCCESS');
      console.log('Test result:', result.rows[0]);
      pool.end();
    })
    .catch((error) => {
      console.error('Database connection test: FAILED');
      console.error('Error:', error.message);
      pool.end();
    });
} else {
  console.log('Database connection test: SKIPPED (no DB_URL)');
}
