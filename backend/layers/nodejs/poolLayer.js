const { Pool } = require('pg');

// Create the pool once for Lambda reuse
const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false }, // For Supabase connections
});

module.exports = { pool };
