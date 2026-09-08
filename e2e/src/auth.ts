/**
 * Cognito headless authentication helper for the DalTime E2E suite.
 *
 * Uses the USER_PASSWORD_AUTH flow — no browser, no PKCE, no redirect URI.
 * The Cognito App Client must have the USER_PASSWORD_AUTH flow enabled.
 *
 * Tokens are NOT cached.  Every call to getCognitoToken() performs a fresh
 * InitiateAuth request so each test run proves the deployed Cognito pool is
 * alive and the seeded user credentials are valid.
 */

import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';

/**
 * Obtain a fresh Cognito ID token for the given email/password pair.
 *
 * @param email       The Cognito username (email address) to authenticate.
 * @param password    The user's password (injected via E2E_SEED_USER_PASSWORD).
 * @param clientId    Cognito App Client ID.
 * @param userPoolId  Cognito User Pool ID (needed to target the correct pool).
 * @param region      AWS region, e.g. 'us-east-1'.
 * @returns           The raw IdToken string (JWT) to include as Authorization: Bearer <token>.
 * @throws            If authentication fails or the token is missing from the response.
 */
export async function getCognitoToken(
  email: string,
  password: string,
  clientId: string,
  // Accepted but not forwarded to InitiateAuthCommand — callers pass it explicitly
  // so they stay honest about which pool they target and avoid cross-env token reuse.
  _userPoolId: string,
  region: string,
): Promise<string> {

  const client = new CognitoIdentityProviderClient({ region });

  const command = new InitiateAuthCommand({
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: clientId,
    AuthParameters: {
      USERNAME: email,
      PASSWORD: password,
    },
  });

  const response = await client.send(command);

  const token = response.AuthenticationResult?.IdToken;
  if (!token) {
    throw new Error(
      `[e2e/auth] getCognitoToken: IdToken missing in Cognito response for ${email}. ` +
        `AuthenticationResult=${JSON.stringify(response.AuthenticationResult ?? null)}`,
    );
  }

  return token;
}
