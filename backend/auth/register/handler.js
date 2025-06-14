// lambdas/auth/register.js

const { createClient } = require('@supabase/supabase-js');
const { createAppUser } = require('../../shared/db/createAppUser'); 
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
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: authError.message }),
      };
    }

    const appUser = await createAppUser({
      userId: authData.user.id,
      email,
      firstName,
      lastName,
      phoneNumber,
      role,
      companyId,
    });

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        message: 'User registered successfully',
        user: appUser,
      }),
    };
  } catch (err) {
    console.error('Registration error:', err);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: err.message,
      }),
    };
  }
};
