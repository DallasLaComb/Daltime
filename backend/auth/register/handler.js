const axios = require("axios");
require("dotenv").config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

exports.handler = async (event) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: "CORS preflight success" }),
    };
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Missing environment configuration." }),
    };
  }

  let email, password;
  try {
    const parsed = JSON.parse(event.body);
    email = parsed.email;
    password = parsed.password;

    if (!email || !password) {
      throw new Error("Email and password are required.");
    }
  } catch (err) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Invalid request body",
        detail: err.message,
      }),
    };
  }

  try {
    const response = await axios.post(
      `${SUPABASE_URL}/auth/v1/admin/users`,
      {
        email,
        password,
        email_confirm: true,
      },
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
          "Content-Type": "application/json",
        },
      }
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: "User created successfully",
        user: response.data,
      }),
    };
  } catch (error) {
    return {
      statusCode: error.response?.status || 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: error.response?.data?.msg || error.message,
        detail: error.response?.data || null,
      }),
    };
  }
};
