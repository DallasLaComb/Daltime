const { createClient } = require('@supabase/supabase-js');
const { responses } = require('/opt/nodejs/headersUtil');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

exports.handler = async (event) => {
  try {
    const authHeader =
      event.headers?.authorization || event.headers?.Authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('DEBUG: Missing or malformed Authorization header');
      return responses.unauthorized('Authorization token required');
    }

    const token = authHeader.split(' ')[1];

    // Get the user information using the access token
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    console.log('DEBUG getUser result:', { user, userError });

    if (userError || !user) {
      console.log('DEBUG unauthorized triggered:', { user, userError });
      return responses.unauthorized('Invalid or expired token');
    }

    // Fetch the user's role from the appuser table
    const { data: roleData, error: roleError } = await supabase
      .from('appuser')
      .select('role')
      .eq('userid', user.id)
      .single();

    console.log('DEBUG role query result:', { roleData, roleError });

    if (roleError) {
      console.error('Error fetching user role:', roleError);
      return responses.serverError('Failed to retrieve user role');
    }

    return responses.success(
      {
        user: {
          id: user.id,
          email: user.email,
          email_confirmed_at: user.email_confirmed_at,
          created_at: user.created_at,
          updated_at: user.updated_at,
          user_metadata: user.user_metadata,
          role: roleData.role,
        },
      },
      'User retrieved successfully'
    );
  } catch (err) {
    console.error('Get user error:', err);
    return responses.serverError(err.message);
  }
};
