import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';

/**
 * Extract the caller's Cognito sub from the event.
 *
 * Production: API Gateway injects verified claims into
 * event.requestContext.authorizer.jwt.claims before Lambda is invoked.
 *
 * SAM local: JWT authorizer claims are not injected, so we decode the
 * Authorization header directly as a fallback (no signature verification
 * needed — the token is only used to identify the caller locally).
 */
export function getCallerSub(event: APIGatewayProxyEventV2WithJWTAuthorizer): string {
  const fromClaims = event.requestContext?.authorizer?.jwt?.claims?.['sub'];
  if (fromClaims) return fromClaims as string;

  const authHeader = event.headers?.['authorization'] ?? event.headers?.['Authorization'] ?? '';
  if (!authHeader.startsWith('Bearer ')) return '';

  try {
    const payload = JSON.parse(
      Buffer.from(authHeader.slice(7).split('.')[1], 'base64url').toString(),
    );
    return (payload['sub'] as string) ?? '';
  } catch {
    return '';
  }
}
