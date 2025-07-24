const { createClient } = require('@supabase/supabase-js');
const { responses } = require('/opt/nodejs/headersUtil');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { email, password } = body;

    if (!email || !password) {
      return responses.badRequest('Email and password are required');
    }

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError) {
      console.error('Login error:', authError);
      return responses.unauthorized(authError.message);
    }

    // Query the database for the user's role
    const { data: userData, error: userError } = await supabase
      .from('appuser') // Updated table name
      .select('role')
      .eq('userid', authData.user.id) // Updated column name to match UUID
      .single();

    if (userError) {
      console.error('Error fetching user role:', userError);
      return responses.serverError('Failed to fetch user role');
    }

    return responses.success(
      {
        access_token: authData.session.access_token,
        user: { ...authData.user, role: userData.role },
      },
      'Login successful'
    );
    console.log('Login response payload:', {
      access_token: authData.session.access_token,
      user: { ...authData.user, role: userData.role },
    });
  } catch (err) {
    console.error('Login error:', err);
    return responses.serverError(err.message);
  }
};
