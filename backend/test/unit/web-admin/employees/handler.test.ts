import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';

vi.mock('../../../../src/functions/web-admin/employees/service.js', () => ({
  listEmployees: vi.fn(),
}));

import { handler } from '../../../../src/functions/web-admin/employees/handler.js';
import { listEmployees } from '../../../../src/functions/web-admin/employees/service.js';

// ─── Factories ────────────────────────────────────────────────────────────────

function buildApiGwEvent(
  overrides: Partial<APIGatewayProxyEventV2WithJWTAuthorizer> & { method?: string } = {},
): APIGatewayProxyEventV2WithJWTAuthorizer {
  const method = overrides.method ?? 'GET';
  const routeKey = overrides.routeKey ?? `${method} /web-admin/employees`;
  return {
    version: '2.0',
    routeKey,
    rawPath: '/web-admin/employees',
    rawQueryString: '',
    headers: { authorization: 'Bearer test-token' },
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      authorizer: {
        jwt: { claims: { 'cognito:groups': 'WebAdmin', sub: 'admin-sub' }, scopes: null },
      },
      domainName: 'test.execute-api.us-east-1.amazonaws.com',
      domainPrefix: 'test',
      http: {
        method,
        path: '/web-admin/employees',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test',
      },
      requestId: 'test-id',
      routeKey,
      stage: '$default',
      time: '01/Jan/2025:00:00:00 +0000',
      timeEpoch: 1735689600000,
    },
    isBase64Encoded: false,
    body: null,
    pathParameters: {},
    ...overrides,
  } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;
}

const sampleEmployee = {
  employee_id: 'emp-1',
  first_name: 'Jane',
  last_name: 'Doe',
  email: 'jane@example.com',
  phone: '+1-555-0000',
  org_id: 'org-1',
  org_name: 'Acme Corp',
  status: 'CONFIRMED',
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('web-admin/employees handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── OPTIONS ──────────────────────────────────────────────────────────────

  describe('OPTIONS /web-admin/employees', () => {
    it('returns 200 for preflight', async () => {
      const res = await handler(buildApiGwEvent({ method: 'OPTIONS' }));
      expect(res.statusCode).toBe(200);
    });
  });

  // ── GET /web-admin/employees ──────────────────────────────────────────────

  describe('GET /web-admin/employees', () => {
    it('returns 200 with employee list on success', async () => {
      vi.mocked(listEmployees).mockResolvedValue([sampleEmployee]);

      const res = await handler(buildApiGwEvent({ method: 'GET' }));

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body as string)).toEqual([sampleEmployee]);
      expect(listEmployees).toHaveBeenCalledOnce();
    });

    it('returns 200 with empty array when no employees exist', async () => {
      vi.mocked(listEmployees).mockResolvedValue([]);

      const res = await handler(buildApiGwEvent({ method: 'GET' }));

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body as string)).toEqual([]);
    });

    it('returns 500 when listEmployees throws', async () => {
      vi.mocked(listEmployees).mockRejectedValue(new Error('DynamoDB failure'));

      const res = await handler(buildApiGwEvent({ method: 'GET' }));

      expect(res.statusCode).toBe(500);
    });
  });
});
