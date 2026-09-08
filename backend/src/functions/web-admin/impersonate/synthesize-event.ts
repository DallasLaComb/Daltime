import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';

/**
 * Build the synthetic event passed to a real role handler when Web-Admin is
 * impersonating a user.
 *
 * Why: every real handler resolves its caller via `getCallerSub(event)`,
 * which reads `event.requestContext.authorizer.jwt.claims.sub` first. To
 * make impersonation transparent to the real handler (no special-casing
 * required inside org-admin/manager/employee handlers), we clone the
 * original event and overwrite that claim with the impersonated userId,
 * and rewrite the path/pathParameters/rawPath to look exactly like a direct
 * call to that real route — the real handler can't tell the difference.
 *
 * We also overwrite `cognito:groups` with the impersonated user's role so
 * that any downstream handler calling `getCallerGroups` sees the impersonated
 * user's group, not the WebAdmin's group. Without this, a handler that checks
 * group membership (e.g. to gate manager-only actions) would see 'WebAdmin'
 * as the caller's group and potentially behave incorrectly or grant elevated
 * access to the impersonated identity.
 *
 * The Web-Admin's own JWT is still what was verified by API Gateway's
 * authorizer before this Lambda ran, so authentication is unaffected — only
 * the *identity the downstream business logic sees* is substituted, and
 * only after this Lambda's own authn/authz already accepted the caller.
 */
export function synthesizeImpersonatedEvent(
  originalEvent: APIGatewayProxyEventV2WithJWTAuthorizer,
  impersonatedUserId: string,
  realPath: string,
  pathParams: Record<string, string>,
  impersonatedUserRole: string,
): APIGatewayProxyEventV2WithJWTAuthorizer {
  const rawPathPrefix = originalEvent.rawPath.split(`/${impersonatedUserId}/`)[0];

  return {
    ...originalEvent,
    rawPath: `${rawPathPrefix}/${impersonatedUserId}/${realPath}`,
    pathParameters: { ...pathParams },
    requestContext: {
      ...originalEvent.requestContext,
      authorizer: {
        ...originalEvent.requestContext.authorizer,
        jwt: {
          ...originalEvent.requestContext.authorizer.jwt,
          claims: {
            ...originalEvent.requestContext.authorizer.jwt.claims,
            sub: impersonatedUserId,
            'cognito:groups': impersonatedUserRole,
          },
        },
      },
    },
  };
}
