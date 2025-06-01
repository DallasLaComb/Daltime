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

  let email, password, firstName, lastName, role, managers, company;

  try {
    const parsed = JSON.parse(event.body);
    email = parsed.email;
    password = parsed.password;
    firstName = parsed.firstName;
    lastName = parsed.lastName;
    role = parsed.role;
    managers = parsed.managers || [];
    company = parsed.company;

    if (!email || !password || !firstName || !lastName || !role || !company) {
      throw new Error("Missing required fields.");
    }

    if (role === "employee" && managers.length === 0) {
      throw new Error("Employees must have at least one manager.");
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

    const userId = response.data.id;

    await axios.post(
      `${SUPABASE_URL}/rest/v1/profiles`,
      {
        id: userId,
        email,
        first_name: firstName,
        last_name: lastName,
        role,
        company,
        managers,
      },
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
      }
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: "User and profile created successfully",
        user: response.data,
      }),
    };
  } catch (error) {
    console.error(
      "Registration failed:",
      error.response?.data || error.message
    ); // helpful for debugging
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
