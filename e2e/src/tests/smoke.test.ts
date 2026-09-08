/**
 * DalTime post-deploy smoke tests.
 *
 * Covers the 7 checks described in story #277:
 *   1.  Frontend loads (CloudFront / S3 serving index.html)
 *   2.  Health endpoint returns {"status":"ok"} with HTTP 200
 *   3.  WebAdmin authenticated call — GET /web-admin/employees (+ 401 without token)
 *   4.  OrgAdmin authenticated call — GET /org-admin/profile
 *   5.  Manager authenticated call — GET /manager/profile (first_name + last_name)
 *   6.  Employee authenticated call — GET /employee/profile
 *   7.  Role isolation (adversarial) — Manager token rejected on /employee/profile (403)
 *
 * All calls are read-only (GET).  No state is mutated.
 * Tokens are obtained fresh per test — no caching between runs.
 *
 * If any required env var is missing the suite fails at import time (see config.ts).
 * If any test fails vitest exits non-zero, which fails the CD workflow step.
 *
 * Seeded test users (see backend/scripts/seed-dev.mjs):
 *   WebAdmin  robot-dev@daltime.com
 *   OrgAdmin  alex.admin@sunsetcafe.dev
 *   Manager   morgan.manager@sunsetcafe.dev
 *   Employee  sam.smith@sunsetcafe.dev
 */

import { describe, it, expect } from 'vitest';
import { fetch } from 'undici';
import {
  FRONTEND_BASE_URL,
  API_BASE_URL,
  COGNITO_CLIENT_ID,
  COGNITO_USER_POOL_ID,
  COGNITO_REGION,
  E2E_SEED_USER_PASSWORD,
} from '../config.js';
import { getCognitoToken } from '../auth.js';

// ── Seeded user roster (source of truth: backend/scripts/seed-dev.mjs) ────────

const USERS = {
  webAdmin: 'robot-dev@daltime.com',
  orgAdmin: 'alex.admin@sunsetcafe.dev',
  manager: 'morgan.manager@sunsetcafe.dev',
  employee: 'sam.smith@sunsetcafe.dev',
} as const;

// ── Shared auth helper ────────────────────────────────────────────────────────

async function getToken(email: string): Promise<string> {
  return getCognitoToken(
    email,
    E2E_SEED_USER_PASSWORD,
    COGNITO_CLIENT_ID,
    COGNITO_USER_POOL_ID,
    COGNITO_REGION,
  );
}

// ── Test 1 — Frontend loads ───────────────────────────────────────────────────

describe('Smoke: Frontend', () => {
  it('GET / returns HTTP 200 with a non-empty body', async () => {
    const url = FRONTEND_BASE_URL.replace(/\/$/, '') + '/';
    const res = await fetch(url);

    expect(
      res.status,
      `Frontend returned ${res.status} — expected 200. ` +
        `Check CloudFront distribution and S3 bucket policy. URL: ${url}`,
    ).toBe(200);

    const body = await res.text();
    expect(
      body.length,
      `Frontend body is empty — the build artifact or S3 object may be missing. URL: ${url}`,
    ).toBeGreaterThan(0);
  });
});

// ── Test 2 — Health endpoint ──────────────────────────────────────────────────

describe('Smoke: Health endpoint', () => {
  it('GET /health returns HTTP 200 with {"status":"ok"} and application/json', async () => {
    const url = `${API_BASE_URL}/health`;
    const res = await fetch(url);

    expect(
      res.status,
      `Health endpoint returned ${res.status} — expected 200. ` +
        `This means the Lambda or API Gateway is not alive. URL: ${url}`,
    ).toBe(200);

    const contentType = res.headers.get('content-type') ?? '';
    expect(
      contentType,
      `Health endpoint did not return application/json — got "${contentType}". ` +
        `This may be an API Gateway error page (HTML) rather than the Lambda response.`,
    ).toContain('application/json');

    const raw = await res.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(
        `Health endpoint response is not valid JSON: "${raw}". ` +
          `This may indicate an API Gateway error page or a malformed Lambda response.`,
      );
    }

    expect(
      parsed,
      `Health endpoint body does not match expected shape. ` +
        `Got: ${JSON.stringify(parsed)}. Expected: {"status":"ok"}`,
    ).toStrictEqual({ status: 'ok' });
  });
});

// ── Test 3 — WebAdmin authenticated call ─────────────────────────────────────

describe('Smoke: WebAdmin role', () => {
  it(
    'GET /web-admin/employees returns HTTP 200 with a non-empty body using a fresh WebAdmin token',
    async () => {
      const url = `${API_BASE_URL}/web-admin/employees`;
      const token = await getToken(USERS.webAdmin);

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(
        res.status,
        `WebAdmin route returned ${res.status} — expected 200. ` +
          `Verify the robot-dev@daltime.com user exists in the target Cognito pool ` +
          `and has the WebAdmin group assignment. URL: ${url}`,
      ).toBe(200);

      const body = await res.text();
      expect(
        body.length,
        `WebAdmin route returned an empty body — expected a JSON array or object. URL: ${url}`,
      ).toBeGreaterThan(0);
    },
  );

  it(
    'GET /web-admin/employees returns HTTP 401 when no token is provided (adversarial)',
    async () => {
      const url = `${API_BASE_URL}/web-admin/employees`;
      const res = await fetch(url);

      expect(
        res.status,
        `WebAdmin protected route returned ${res.status} without a token — expected 401. ` +
          `If this is 200, the JWT authorizer is misconfigured and the route is publicly accessible. ` +
          `URL: ${url}`,
      ).toBe(401);
    },
  );
});

// ── Test 4 — OrgAdmin authenticated call ─────────────────────────────────────

describe('Smoke: OrgAdmin role', () => {
  it(
    'GET /org-admin/profile returns HTTP 200 with a non-empty body using a fresh OrgAdmin token',
    async () => {
      const url = `${API_BASE_URL}/org-admin/profile`;
      const token = await getToken(USERS.orgAdmin);

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(
        res.status,
        `OrgAdmin route returned ${res.status} — expected 200. ` +
          `Verify alex.admin@sunsetcafe.dev exists in the target Cognito pool ` +
          `with the OrgAdmin group assignment. URL: ${url}`,
      ).toBe(200);

      const body = await res.text();
      expect(
        body.length,
        `OrgAdmin route returned an empty body — expected a JSON profile object. URL: ${url}`,
      ).toBeGreaterThan(0);
    },
  );
});

// ── Test 5 — Manager authenticated call ──────────────────────────────────────

describe('Smoke: Manager role', () => {
  it(
    'GET /manager/profile returns HTTP 200 with first_name and last_name fields',
    async () => {
      const url = `${API_BASE_URL}/manager/profile`;
      const token = await getToken(USERS.manager);

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(
        res.status,
        `Manager profile returned ${res.status} — expected 200. ` +
          `Verify morgan.manager@sunsetcafe.dev exists in the target Cognito pool ` +
          `with the Manager group assignment. URL: ${url}`,
      ).toBe(200);

      const raw = await res.text();
      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        throw new Error(
          `Manager profile response is not valid JSON: "${raw}". URL: ${url}`,
        );
      }

      expect(
        body,
        `Manager profile body is not an object. Got: ${JSON.stringify(body)}`,
      ).toBeTypeOf('object');

      const profile = body as Record<string, unknown>;
      expect(
        profile,
        `Manager profile missing "first_name" field. Body: ${JSON.stringify(profile)}`,
      ).toHaveProperty('first_name');
      expect(
        profile,
        `Manager profile missing "last_name" field. Body: ${JSON.stringify(profile)}`,
      ).toHaveProperty('last_name');
    },
  );
});

// ── Test 6 — Employee authenticated call ─────────────────────────────────────

describe('Smoke: Employee role', () => {
  it(
    'GET /employee/profile returns HTTP 200 with a non-empty body using a fresh Employee token',
    async () => {
      const url = `${API_BASE_URL}/employee/profile`;
      const token = await getToken(USERS.employee);

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(
        res.status,
        `Employee profile returned ${res.status} — expected 200. ` +
          `Verify sam.smith@sunsetcafe.dev exists in the target Cognito pool ` +
          `with the Employee group assignment. URL: ${url}`,
      ).toBe(200);

      const body = await res.text();
      expect(
        body.length,
        `Employee profile returned an empty body — expected a JSON profile object. URL: ${url}`,
      ).toBeGreaterThan(0);
    },
  );
});

// ── Test 7 — Role isolation (adversarial) ────────────────────────────────────

describe('Smoke: Role isolation (adversarial)', () => {
  it(
    'Manager token is rejected on GET /employee/profile with HTTP 403',
    async () => {
      const url = `${API_BASE_URL}/employee/profile`;
      // Deliberately use the Manager token on an Employee-only route.
      const managerToken = await getToken(USERS.manager);

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${managerToken}` },
      });

      expect(
        res.status,
        `Role isolation check FAILED: Manager token was accepted on /employee/profile ` +
          `(got ${res.status}, expected 403). ` +
          `This means the Employee route is not enforcing role-scoped access control. ` +
          `URL: ${url}`,
      ).toBe(403);
    },
  );
});

// ── Test 8 — Manager availability endpoint ───────────────────────────────────
//
// Seeded employee under morgan.manager@sunsetcafe.dev:
//   Sam Smith  sam.smith@sunsetcafe.dev  sub=346854d8-6001-70a3-d37f-cb059a4d9146
//   (source of truth: docs/seed-users.md)
//
// Cross-org probe uses a fabricated UUID that does not exist in any seeded org.

const SEEDED_EMPLOYEE_ID = '346854d8-6001-70a3-d37f-cb059a4d9146';
// A UUID that does not belong to the seed org — used for cross-org / non-existent probes.
const FOREIGN_EMPLOYEE_ID = '00000000-dead-beef-0000-000000000000';

describe('Smoke: Manager availability endpoint — CORS preflight', () => {
  it(
    'OPTIONS /manager/employees/{employeeId}/availability returns HTTP 200 with Access-Control-Allow-Origin header',
    async () => {
      const url = `${API_BASE_URL}/manager/employees/${SEEDED_EMPLOYEE_ID}/availability`;

      const res = await fetch(url, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://dev.daltime.com',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'Authorization',
        },
      });

      expect(
        res.status,
        `OPTIONS preflight for availability returned ${res.status} — expected 200. ` +
          `This is the CORS regression this smoke test was added to catch. ` +
          `Check that OPTIONS /manager/employees/{employeeId}/availability is registered ` +
          `in infra/template.yaml. URL: ${url}`,
      ).toBe(200);

      const acao = res.headers.get('access-control-allow-origin');
      expect(
        acao,
        `OPTIONS preflight returned 200 but no Access-Control-Allow-Origin header. ` +
          `The Lambda OPTIONS branch must call setRequestOrigin() before returning ok(). ` +
          `URL: ${url}`,
      ).not.toBeNull();
    },
  );
});

describe('Smoke: Manager availability endpoint — authenticated GET', () => {
  it(
    'GET /manager/employees/{employeeId}/availability returns HTTP 200 with availability shape for a seeded employee',
    async () => {
      const url = `${API_BASE_URL}/manager/employees/${SEEDED_EMPLOYEE_ID}/availability`;
      const token = await getToken(USERS.manager);

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(
        res.status,
        `Manager availability GET returned ${res.status} — expected 200. ` +
          `Verify ${USERS.manager} is in the Manager Cognito group and that ` +
          `employee ${SEEDED_EMPLOYEE_ID} (sam.smith@sunsetcafe.dev) is seeded under that manager. ` +
          `URL: ${url}`,
      ).toBe(200);

      const raw = await res.text();
      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        throw new Error(
          `Manager availability GET response is not valid JSON: "${raw}". URL: ${url}`,
        );
      }

      expect(
        body,
        `Manager availability response is not an object. Got: ${JSON.stringify(body)}`,
      ).toBeTypeOf('object');

      const availability = body as Record<string, unknown>;
      expect(
        availability,
        `Manager availability response missing "employee_id" field. Body: ${JSON.stringify(availability)}`,
      ).toHaveProperty('employee_id');
      expect(
        availability,
        `Manager availability response missing "schedule" field. Body: ${JSON.stringify(availability)}`,
      ).toHaveProperty('schedule');
    },
  );

  it(
    'GET /manager/employees/{employeeId}/availability returns HTTP 401 when no auth token is provided',
    async () => {
      const url = `${API_BASE_URL}/manager/employees/${SEEDED_EMPLOYEE_ID}/availability`;

      const res = await fetch(url);

      expect(
        res.status,
        `Availability endpoint returned ${res.status} without a token — expected 401. ` +
          `If this is 200, the JWT authorizer is misconfigured and the route is publicly accessible. ` +
          `URL: ${url}`,
      ).toBe(401);
    },
  );

  it(
    'GET /manager/employees/{employeeId}/availability returns HTTP 403 or 404 for an employee from a different org (cross-org guard)',
    async () => {
      const url = `${API_BASE_URL}/manager/employees/${FOREIGN_EMPLOYEE_ID}/availability`;
      const token = await getToken(USERS.manager);

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const allowed = [403, 404];
      expect(
        allowed,
        `Cross-org guard FAILED: manager received ${res.status} for a foreign employeeId — ` +
          `expected 403 or 404 (no data leakage). ` +
          `If this is 200, the service is returning data for employees not owned by the caller. ` +
          `URL: ${url}  employeeId: ${FOREIGN_EMPLOYEE_ID}`,
      ).toContain(res.status);
    },
  );

  it(
    'GET /manager/employees/{employeeId}/availability returns HTTP 404 for a non-existent employeeId (not 500)',
    async () => {
      // Uses the same foreign ID — it does not exist in the seed org either.
      const url = `${API_BASE_URL}/manager/employees/${FOREIGN_EMPLOYEE_ID}/availability`;
      const token = await getToken(USERS.manager);

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(
        [403, 404],
        `Non-existent employeeId returned ${res.status} — expected 403 or 404, never 500. ` +
          `A 500 here means the handler is not guarding against missing employees gracefully. ` +
          `URL: ${url}  employeeId: ${FOREIGN_EMPLOYEE_ID}`,
      ).toContain(res.status);

      expect(
        res.status,
        `Non-existent employeeId returned 500 — the handler must map NotFoundError to 404, ` +
          `not let unhandled exceptions propagate. URL: ${url}`,
      ).not.toBe(500);
    },
  );
});
