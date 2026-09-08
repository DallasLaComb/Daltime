/**
 * Centralised config for the DalTime E2E / smoke suite.
 *
 * All process.env reads happen here — nowhere else in the suite should
 * reference process.env directly.  Missing required variables throw at
 * import time so the test run fails immediately with an actionable message
 * rather than a confusing auth error mid-run.
 */

function require(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `[e2e/config] Missing required environment variable: ${name}. ` +
        `Set it in your shell or in a .env file before running the suite. ` +
        `See e2e/README.md for the full list of required variables.`,
    );
  }
  return value;
}

/** Base URL for the CloudFront-served Angular frontend, e.g. https://dev.daltime.com */
export const FRONTEND_BASE_URL: string = require('FRONTEND_BASE_URL');

/**
 * Base URL for the API Gateway endpoint, e.g.
 * https://abc123.execute-api.us-east-1.amazonaws.com
 * — no trailing slash.
 */
export const API_BASE_URL: string = require('API_BASE_URL');

/** Cognito User Pool App Client ID (not the secret). */
export const COGNITO_CLIENT_ID: string = require('COGNITO_CLIENT_ID');

/** Cognito User Pool ID, e.g. us-east-1_xxxxxxxx */
export const COGNITO_USER_POOL_ID: string = require('COGNITO_USER_POOL_ID');

/** AWS region where the Cognito User Pool lives, e.g. us-east-1 */
export const COGNITO_REGION: string = require('COGNITO_REGION');

/**
 * Shared password for all seeded smoke-test users.
 * Stored in GitHub Actions as a secret named E2E_SEED_USER_PASSWORD.
 * Never hardcode this value.
 */
export const E2E_SEED_USER_PASSWORD: string = require('E2E_SEED_USER_PASSWORD');
