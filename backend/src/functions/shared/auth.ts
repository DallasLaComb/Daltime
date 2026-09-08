import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { ForbiddenError } from './errors.js';
import { getWebAdminLookup } from '../web-admin/shared/db.js';
import type { WebAdminCaller } from './models/web-admin/web-admin.model.js';

/**
 * Decode the JWT payload from the Authorization header without verifying its
 * signature. This is ONLY used as a SAM-local fallback (see callers below) —
 * in production, API Gateway's JWT authorizer has already verified the
 * signature before claims ever reach the Lambda, so re-verifying here would
 * be redundant. Never use this path to make an authorization decision in an
 * environment where API Gateway hasn't already validated the token.
 */
function decodeLocalJwtPayload(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Record<string, unknown> | null {
  const authHeader = event.headers?.['authorization'] ?? event.headers?.['Authorization'] ?? '';
  if (!authHeader.startsWith('Bearer ')) return null;

  try {
    return JSON.parse(
      Buffer.from(authHeader.slice(7).split('.')[1], 'base64url').toString(),
    ) as Record<string, unknown>;
  } catch {
    return null;
  }
}

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

  const payload = decodeLocalJwtPayload(event);
  return (payload?.['sub'] as string) ?? '';
}

/**
 * Extract the caller's Cognito group memberships (e.g. 'WebAdmin',
 * 'OrgAdmin', 'Manager', 'Employee') from the event, normalized to a
 * string array regardless of how the claim arrived.
 *
 * Production: API Gateway's JWT-claims-to-string-map flattening can deliver
 * 'cognito:groups' as either a real JSON array (rare) or a comma/space
 * joined string (the common case for HTTP API JWT authorizers) — we check
 * both shapes defensively rather than assuming one.
 *
 * SAM local: same Authorization-header decode fallback as getCallerSub, for
 * local-dev parity (the JWT authorizer claims object isn't populated when
 * running under `sam local start-api`).
 */
export function getCallerGroups(event: APIGatewayProxyEventV2WithJWTAuthorizer): string[] {
  const fromClaims = event.requestContext?.authorizer?.jwt?.claims?.['cognito:groups'];
  if (fromClaims !== undefined) return normalizeGroupsClaim(fromClaims);

  const payload = decodeLocalJwtPayload(event);
  return normalizeGroupsClaim(payload?.['cognito:groups']);
}

/**
 * Normalize the 'cognito:groups' claim to a string array no matter which
 * shape it arrived in: a real array, a comma/space-delimited string, or
 * missing entirely. Centralizing this avoids every caller needing to
 * re-derive the same defensive parsing.
 */
function normalizeGroupsClaim(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((g): g is string => typeof g === 'string' && g.length > 0);
  }
  if (typeof raw === 'string' && raw.length > 0) {
    return raw
      .split(/[,\s]+/)
      .map((g) => g.trim())
      .filter((g) => g.length > 0);
  }
  return [];
}

/**
 * Returns true if the caller belongs to the WebAdmin Cognito group.
 * Used to gate every web-admin/* handler so that any authenticated user
 * (not just a WebAdmin) can no longer reach web-admin-only data/actions —
 * the API Gateway JWT authorizer only verifies the token is well-signed and
 * from the right user pool, it does not check group membership, so each
 * handler must enforce this itself.
 */
export function isWebAdmin(event: APIGatewayProxyEventV2WithJWTAuthorizer): boolean {
  return getCallerGroups(event).includes('WebAdmin');
}

/**
 * Guard for every web-admin/* handler entrypoint: throws a ForbiddenError
 * (mapped to an HTTP 403 by mapHandlerError) if the caller is not a member
 * of the WebAdmin Cognito group. Call this immediately after the OPTIONS
 * short-circuit and before any routing/business logic, so a non-WebAdmin
 * caller never reaches a query or mutation — fail closed, not "filtered by
 * the frontend."
 */
export function requireWebAdmin(event: APIGatewayProxyEventV2WithJWTAuthorizer): void {
  if (!isWebAdmin(event)) {
    throw new ForbiddenError('WebAdmin role required');
  }
}

/**
 * Data-driven guard for web-admin/* handlers that enforces two layers of
 * authorization:
 *
 *   1. Cognito group check — same as `requireWebAdmin`. Throws ForbiddenError
 *      if the caller is not in the WebAdmin group.
 *   2. DynamoDB record check — resolves the caller's `USER#<sub>/METADATA`
 *      item via `getWebAdminLookup`. Throws ForbiddenError (fail closed) if
 *      no record is found, meaning the Cognito user exists but has not been
 *      provisioned as a WebAdmin in the application database. Also throws
 *      ForbiddenError if the record's status is DISABLED — disabling a
 *      WebAdmin in DynamoDB immediately blocks all API access without needing
 *      to revoke the Cognito user.
 *
 * Returns a `WebAdminCaller` containing `{ sub, web_admin_id, email, status }`
 * for the caller. Handlers should thread `web_admin_id` into every mutating
 * service call so that `modified_by_web_admin_id` can be stamped on affected
 * DynamoDB items for audit purposes.
 *
 * This function is async because it performs a DynamoDB GetItem. Call it
 * with `await` immediately after the OPTIONS short-circuit.
 */
export async function requireWebAdminWithLookup(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<WebAdminCaller> {
  // Step 1: Cognito group check — same fail-closed guard as requireWebAdmin.
  requireWebAdmin(event);

  // Step 2: Extract the caller's Cognito sub from verified JWT claims (or the
  // SAM-local fallback path handled inside getCallerSub).
  const sub = getCallerSub(event);

  // Step 3: DynamoDB lookup — fail closed if no provisioned record exists.
  const caller = await getWebAdminLookup(sub);
  if (!caller) {
    throw new ForbiddenError('WebAdmin record not found');
  }

  // Step 4: Reject callers with a DISABLED record — disabling in DynamoDB
  // takes effect immediately without a Cognito token revocation.
  if (caller.status !== 'ACTIVE') {
    throw new ForbiddenError('WebAdmin account is disabled');
  }

  // Step 5: Fail closed if the record exists but has no web_admin_id attribute.
  // TypeScript types web_admin_id as non-optional, but a DynamoDB item could
  // theoretically be stored without it (e.g. a partially-written record or a
  // data migration that never completed). Returning a caller with
  // web_admin_id === undefined would silently write null audit stamps on every
  // subsequent mutation — catching it here makes the failure explicit and
  // prevents corrupt audit data from reaching the database.
  if (!caller.web_admin_id) {
    throw new ForbiddenError('WebAdmin record is missing web_admin_id');
  }

  return caller;
}
