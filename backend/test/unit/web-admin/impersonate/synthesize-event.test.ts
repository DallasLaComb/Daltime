import { describe, it, expect } from 'vitest';
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { synthesizeImpersonatedEvent } from '../../../../src/functions/web-admin/impersonate/synthesize-event.js';

// Verifies the event clone the impersonation proxy hands to a real role
// handler: the impersonated userId must end up as the resolved caller sub,
// and the path/pathParameters must look exactly like a direct call to the
// real route, with no other request data altered.

function buildEvent(): APIGatewayProxyEventV2WithJWTAuthorizer {
  return {
    version: '2.0',
    routeKey: 'GET /web-admin/impersonate/{userId}/{proxy+}',
    rawPath: '/web-admin/impersonate/imp-user-1/manager/shifts/abc123',
    rawQueryString: 'month=2026-07',
    headers: { authorization: 'Bearer web-admin-token', origin: 'http://localhost:4200' },
    queryStringParameters: { month: '2026-07' },
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      authorizer: {
        jwt: { claims: { sub: 'web-admin-sub-1' }, scopes: null },
      },
      domainName: 'test.execute-api.us-east-1.amazonaws.com',
      domainPrefix: 'test',
      http: {
        method: 'GET',
        path: '/web-admin/impersonate/imp-user-1/manager/shifts/abc123',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test',
      },
      requestId: 'test-id',
      routeKey: 'GET /web-admin/impersonate/{userId}/{proxy+}',
      stage: '$default',
      time: '01/Jan/2026:00:00:00 +0000',
      timeEpoch: 1735689600000,
    },
    isBase64Encoded: false,
    body: null,
    pathParameters: { userId: 'imp-user-1', proxy: 'manager/shifts/abc123' },
  } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;
}

describe('synthesizeImpersonatedEvent', () => {
  it('substitutes the impersonated userId for the caller sub in the JWT claims', () => {
    const synthetic = synthesizeImpersonatedEvent(
      buildEvent(),
      'imp-user-1',
      'manager/shifts/abc123',
      { shiftId: 'abc123' },
      'Manager',
    );

    expect(synthetic.requestContext.authorizer.jwt.claims['sub']).toBe('imp-user-1');
  });

  it('replaces pathParameters with only the real route params (drops userId/proxy)', () => {
    const synthetic = synthesizeImpersonatedEvent(
      buildEvent(),
      'imp-user-1',
      'manager/shifts/abc123',
      { shiftId: 'abc123' },
      'Manager',
    );

    expect(synthetic.pathParameters).toEqual({ shiftId: 'abc123' });
  });

  it('rewrites rawPath to the real-route-shaped path', () => {
    const synthetic = synthesizeImpersonatedEvent(
      buildEvent(),
      'imp-user-1',
      'manager/shifts/abc123',
      { shiftId: 'abc123' },
      'Manager',
    );

    expect(synthetic.rawPath).toBe('/web-admin/impersonate/imp-user-1/manager/shifts/abc123');
  });

  it('preserves the HTTP method, body, and query string unrelated to identity', () => {
    const original = buildEvent();
    const synthetic = synthesizeImpersonatedEvent(original, 'imp-user-1', 'manager/shifts/abc123', {
      shiftId: 'abc123',
    }, 'Manager');

    expect(synthetic.requestContext.http.method).toBe('GET');
    expect(synthetic.queryStringParameters).toEqual({ month: '2026-07' });
    expect(synthetic.body).toBe(original.body);
  });

  it('does not mutate the original event object', () => {
    const original = buildEvent();
    synthesizeImpersonatedEvent(original, 'imp-user-1', 'manager/shifts/abc123', {
      shiftId: 'abc123',
    }, 'Manager');

    expect(original.requestContext.authorizer.jwt.claims['sub']).toBe('web-admin-sub-1');
    expect(original.pathParameters).toEqual({
      userId: 'imp-user-1',
      proxy: 'manager/shifts/abc123',
    });
  });

  it("synthesized event's sub is the impersonated user's sub, not the web-admin's sub", () => {
    // The downstream real-role handler resolves its caller via getCallerSub, which reads
    // requestContext.authorizer.jwt.claims.sub. This test explicitly confirms that claim
    // is the impersonated user's identity (not the web-admin's sub) in the synthesized event.
    const original = buildEvent(); // has sub: 'web-admin-sub-1'
    const synthetic = synthesizeImpersonatedEvent(
      original,
      'imp-user-1',
      'manager/shifts/abc123',
      { shiftId: 'abc123' },
      'Manager',
    );

    // Impersonated sub is present.
    expect(synthetic.requestContext.authorizer.jwt.claims['sub']).toBe('imp-user-1');
    // Web-admin's own sub is NOT the sub the downstream handler will see.
    expect(synthetic.requestContext.authorizer.jwt.claims['sub']).not.toBe('web-admin-sub-1');
  });

  it("sets cognito:groups to the impersonated user's role, not the WebAdmin's group", () => {
    // Without overwriting cognito:groups, a downstream handler calling
    // getCallerGroups would see 'WebAdmin' (the caller who originally hit the
    // impersonate Lambda) rather than the impersonated user's actual role.
    // This would let manager-only or employee-only checks misbehave.
    const original = buildEvent(); // original has no cognito:groups claim set
    const synthetic = synthesizeImpersonatedEvent(
      original,
      'imp-user-1',
      'manager/shifts/abc123',
      { shiftId: 'abc123' },
      'Manager',
    );

    expect(synthetic.requestContext.authorizer.jwt.claims['cognito:groups']).toBe('Manager');
    expect(synthetic.requestContext.authorizer.jwt.claims['cognito:groups']).not.toBe('WebAdmin');
  });

  it("sets cognito:groups to 'Employee' when impersonating via an employee route", () => {
    const synthetic = synthesizeImpersonatedEvent(
      buildEvent(),
      'imp-user-1',
      'employee/shifts',
      {},
      'Employee',
    );

    expect(synthetic.requestContext.authorizer.jwt.claims['cognito:groups']).toBe('Employee');
  });

  it("sets cognito:groups to 'OrgAdmin' when impersonating via an org-admin route", () => {
    const synthetic = synthesizeImpersonatedEvent(
      buildEvent(),
      'imp-user-1',
      'org-admin/profile',
      {},
      'OrgAdmin',
    );

    expect(synthetic.requestContext.authorizer.jwt.claims['cognito:groups']).toBe('OrgAdmin');
  });
});
