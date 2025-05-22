// shift-api/auth/login/handler.js
const axios = require("axios");
require("dotenv").config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

exports.handler = async (event) => {
  const { email, password } = JSON.parse(event.body);

  try {
    const response = await axios.post(
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      { email, password },
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    return {
      statusCode: 200,
      body: JSON.stringify(response.data),
    };
  } catch (error) {
    return {
      statusCode: error.response?.status || 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
