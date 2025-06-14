// shared/db/db.js

const { Pool } = require('pg');
require('dotenv').config();

const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL;

// Create the pool once for Lambda reuse
const pool = new Pool({
  connectionString: SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false }, // Will have to change this for production
});

module.exports = { pool };
