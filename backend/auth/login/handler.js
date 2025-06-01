const axios = require("axios");
require("dotenv").config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: "CORS preflight success" }),
    };
  }

  let email, password;

  try {
    const body = JSON.parse(event.body || "{}");
    email = body.email;
    password = body.password;
    console.log("Login input received:", { email, hasPassword: !!password });

    if (!email || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Email and password are required." }),
      };
    }
  } catch (err) {
    console.error("Error parsing body:", err.message);
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid JSON in request body." }),
    };
  }

  try {
    // Log environment variables to verify loading
    console.log("SUPABASE_ANON_KEY loaded:", !!SUPABASE_ANON_KEY);
    console.log("SUPABASE_SERVICE_ROLE loaded:", !!SUPABASE_SERVICE_ROLE);

    const response = await axios.post(
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      { email, password },
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const { access_token, refresh_token, user, expires_in } = response.data;

    const profileRes = await axios.get(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        },
      }
    );

    const profile = profileRes.data?.[0] || {};

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        token: access_token,
        refresh_token,
        expires_in,
        user: {
          ...user,
          ...profile,
        },
      }),
    };
  } catch (error) {
    console.error("Login failed:", error.response?.data || error.message);
    return {
      statusCode: error.response?.status || 500,
      headers,
      body: JSON.stringify({
        error: error.response?.data?.msg || error.message,
        detail: error.response?.data || null,
      }),
    };
  }
};
