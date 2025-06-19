const { Pool } = require('pg');

console.log('Pool layer initializing...');
console.log('Environment check:', {
  hasDbUrl: !!process.env.SUPABASE_DB_URL,
  dbUrlPreview: process.env.SUPABASE_DB_URL
    ? process.env.SUPABASE_DB_URL.substring(0, 20) + '...'
    : 'undefined',
});

// Create the pool once for Lambda reuse
const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false }, // For Supabase connections
});

// Test the pool connection
pool.on('error', (err) => {
  console.error('Pool error:', err);
});

module.exports = { pool };
//
