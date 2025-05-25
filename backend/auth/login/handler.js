const axios = require("axios");
require("dotenv").config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

exports.handler = async (event) => {
  const { email, password } = JSON.parse(event.body);

  try {
    const response = await axios.post(
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        email,
        password,
      },
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE,
          "Content-Type": "application/json",
        },
      }
    );

    const { access_token, refresh_token, user, expires_in } = response.data;

    return {
      statusCode: 200,
      body: JSON.stringify({
        access_token,
        refresh_token,
        expires_in,
        user,
      }),
    };
  } catch (error) {
    return {
      statusCode: error.response?.status || 500,
      body: JSON.stringify({
        error: error.response?.data?.msg || error.message,
        detail: error.response?.data,
      }),
    };
  }
};
