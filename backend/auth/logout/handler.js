const { createClient } = require('@supabase/supabase-js');
const { responses } = require('/opt/nodejs/headersUtil');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

exports.handler = async (event) => {
  try {
    const authHeader =
      event.headers?.authorization || event.headers?.Authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return responses.unauthorized('Authorization token required');
    }

    const token = authHeader.split(' ')[1];

    if (!token || token.split('.').length !== 3) {
      return responses.unauthorized('Invalid token format');
    }

    // Validate the token first
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser(token);

    if (userError || !user) {
      console.error('User validation error:', userError);
      return responses.unauthorized('Invalid or expired token');
    }

    // Basic logout - just validate the token
    // Frontend will handle clearing cookies/local storage
    console.log('User logged out successfully:', user.email);

    return responses.success(null, 'Sign out successful');
  } catch (err) {
    console.error('Logout error:', err);
    return responses.serverError(err.message);
  }
};
