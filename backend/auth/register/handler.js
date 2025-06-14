const { Pool } = require('pg');
require('dotenv').config();

const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL;

// Create the pool outside the handler for connection reuse
const pool = new Pool({
  connectionString: SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false }, // Adjust SSL for Production
});

exports.handler = async (event) => {
  try {
    const client = await pool.connect();
    // Test query to verify connection
    const res = await client.query(
      "SELECT NOW() as current_time, 'Database connection successful!' as message"
    );
    client.release();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        message: 'Database connection successful!',
        timestamp: res.rows[0].current_time,
        database_status: 'Connected',
      }),
    };
  } catch (err) {
    console.error('Database connection error:', err);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: 'Database connection failed',
        details: err.message,
      }),
    };
  }
};
