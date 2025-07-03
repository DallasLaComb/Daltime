// lambdas/auth/register.js

const { createClient } = require('@supabase/supabase-js');
const { pool } = require('/opt/nodejs/poolLayer');
const { responses } = require('/opt/nodejs/headersUtil');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const {
      email,
      password,
      firstName,
      lastName,
      phoneNumber,
      role,
      companyId,
    } = body;

    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError) {
      console.error('Supabase Auth error:', authError);
      return responses.badRequest(authError.message);
    }

    // Create app user in database
    const client = await pool.connect();
    const insertQuery = `
      INSERT INTO public.appuser (userid, companyid, firstname, lastname, phonenumber, email, role)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;

    const values = [
      authData.user.id,
      companyId,
      firstName,
      lastName,
      parseInt(phoneNumber),
      email,
      role,
    ];

    let appUser;
    try {
      const result = await client.query(insertQuery, values);
      appUser = result.rows[0];
    } finally {
      client.release();
    }

    return responses.created(appUser, 'User registered successfully');
  } catch (err) {
    console.error('Registration error:', err);
    return responses.serverError(err.message);
  }
};
