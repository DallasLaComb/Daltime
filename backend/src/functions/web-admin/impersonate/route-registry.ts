import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { matchPath } from '../../shared/route-match.js';

/**
 * The real role-specific Lambda handler signature. Every handler in
 * org-admin/manager/employee already conforms to this shape (see
 * `ai/prompts/backend.md` vertical-slice convention), which is exactly what
 * makes generic in-process dispatch possible without touching any of them.
 */
type RealHandler = (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
) => Promise<APIGatewayProxyResultV2>;

/**
 * One entry per real Lambda function that owns a role-prefixed route tree.
 * `pathPattern` mirrors the API Gateway `Path` registered for that function
 * in infra/template.yaml — usually the function's own base prefix, since
 * each real handler already does its own internal method/sub-path dispatch
 * (see e.g. manager/employees/handler.ts, manager/schedule/handler.ts).
 * Adding a new real feature route only ever requires adding ONE entry here,
 * not a route per HTTP method/path — that is what eliminates the old
 * per-route impersonate whitelist.
 */
export interface ProxyRoute {
  pathPattern: string;
  loadHandler: () => Promise<RealHandler>;
}

// Lazy dynamic imports keep this registry from forcing every role handler's
// transitive dependency graph (DynamoDB clients, Cognito clients, etc.) to be
// initialised on every impersonate cold start — only the matched route's
// module is loaded per invocation.
export const PROXY_ROUTES: ProxyRoute[] = [
  // ── org-admin ──────────────────────────────────────────────────────────
  {
    pathPattern: 'org-admin/profile',
    loadHandler: async () => (await import('../../org-admin/profile/handler.js')).handler,
  },
  {
    pathPattern: 'org-admin/organization',
    loadHandler: async () => (await import('../../org-admin/organization/handler.js')).handler,
  },
  {
    pathPattern: 'org-admin/managers',
    loadHandler: async () => (await import('../../org-admin/managers/handler.js')).handler,
  },
  {
    pathPattern: 'org-admin/managers/{managerId}',
    loadHandler: async () => (await import('../../org-admin/managers/handler.js')).handler,
  },
  {
    pathPattern: 'org-admin/managers/{managerId}/locations',
    loadHandler: async () => (await import('../../org-admin/manager-locations/handler.js')).handler,
  },
  {
    pathPattern: 'org-admin/managers/{managerId}/locations/{locationId}',
    loadHandler: async () => (await import('../../org-admin/manager-locations/handler.js')).handler,
  },
  {
    pathPattern: 'org-admin/employees',
    loadHandler: async () => (await import('../../org-admin/employees/handler.js')).handler,
  },
  {
    pathPattern: 'org-admin/employees/{employeeId}',
    loadHandler: async () => (await import('../../org-admin/employees/handler.js')).handler,
  },
  {
    pathPattern: 'org-admin/employees/{employeeId}/locations',
    loadHandler: async () =>
      (await import('../../org-admin/employee-locations/handler.js')).handler,
  },
  {
    pathPattern: 'org-admin/employees/{employeeId}/locations/{locationId}',
    loadHandler: async () =>
      (await import('../../org-admin/employee-locations/handler.js')).handler,
  },
  {
    pathPattern: 'org-admin/locations',
    loadHandler: async () => (await import('../../org-admin/locations/handler.js')).handler,
  },
  {
    pathPattern: 'org-admin/locations/{locationId}',
    loadHandler: async () => (await import('../../org-admin/locations/handler.js')).handler,
  },
  {
    pathPattern: 'org-admin/shifts',
    loadHandler: async () => (await import('../../org-admin/shifts/handler.js')).handler,
  },
  {
    pathPattern: 'org-admin/notifications',
    loadHandler: async () => (await import('../../shared/notifications/handler.js')).handler,
  },
  {
    pathPattern: 'org-admin/notifications/{notificationId}',
    loadHandler: async () => (await import('../../shared/notifications/handler.js')).handler,
  },

  // ── manager ────────────────────────────────────────────────────────────
  {
    pathPattern: 'manager/profile',
    loadHandler: async () => (await import('../../manager/profile/handler.js')).handler,
  },
  {
    pathPattern: 'manager/locations',
    loadHandler: async () => (await import('../../manager/locations/handler.js')).handler,
  },
  {
    pathPattern: 'manager/shifts-needed',
    loadHandler: async () => (await import('../../manager/shifts-needed/handler.js')).handler,
  },
  {
    pathPattern: 'manager/shifts-needed/{shiftId}',
    loadHandler: async () => (await import('../../manager/shifts-needed/handler.js')).handler,
  },
  {
    pathPattern: 'manager/shifts',
    loadHandler: async () => (await import('../../manager/shifts/handler.js')).handler,
  },
  {
    pathPattern: 'manager/shifts/{shiftId}',
    loadHandler: async () => (await import('../../manager/shifts/handler.js')).handler,
  },
  {
    pathPattern: 'manager/schedule/generate',
    loadHandler: async () => (await import('../../manager/schedule/handler.js')).handler,
  },
  {
    pathPattern: 'manager/schedule/publish',
    loadHandler: async () => (await import('../../manager/schedule/handler.js')).handler,
  },
  {
    pathPattern: 'manager/schedule/drafts',
    loadHandler: async () => (await import('../../manager/schedule/handler.js')).handler,
  },
  {
    pathPattern: 'manager/schedule/meta',
    loadHandler: async () => (await import('../../manager/schedule/handler.js')).handler,
  },
  {
    pathPattern: 'manager/employees',
    loadHandler: async () => (await import('../../manager/employees/handler.js')).handler,
  },
  {
    pathPattern: 'manager/employees/{employeeId}',
    loadHandler: async () => (await import('../../manager/employees/handler.js')).handler,
  },
  {
    pathPattern: 'manager/employees/{employeeId}/availability',
    loadHandler: async () => (await import('../../manager/employees/handler.js')).handler,
  },
  {
    pathPattern: 'manager/employees/{employeeId}/availability/overrides',
    loadHandler: async () => (await import('../../manager/employees/handler.js')).handler,
  },
  {
    pathPattern: 'manager/notifications',
    loadHandler: async () => (await import('../../shared/notifications/handler.js')).handler,
  },
  {
    pathPattern: 'manager/notifications/{notificationId}',
    loadHandler: async () => (await import('../../shared/notifications/handler.js')).handler,
  },

  // ── employee ───────────────────────────────────────────────────────────
  {
    pathPattern: 'employee/profile',
    loadHandler: async () => (await import('../../employee/profile/handler.js')).handler,
  },
  {
    pathPattern: 'employee/availability',
    loadHandler: async () => (await import('../../employee/availability/handler.js')).handler,
  },
  {
    pathPattern: 'employee/availability/overrides',
    loadHandler: async () =>
      (await import('../../employee/availability-overrides/handler.js')).handler,
  },
  {
    pathPattern: 'employee/shifts',
    loadHandler: async () => (await import('../../employee/shifts/handler.js')).handler,
  },
  {
    pathPattern: 'employee/notifications',
    loadHandler: async () => (await import('../../shared/notifications/handler.js')).handler,
  },
  {
    pathPattern: 'employee/notifications/{notificationId}',
    loadHandler: async () => (await import('../../shared/notifications/handler.js')).handler,
  },
];

/**
 * Resolve which real handler (and extracted path params) a given
 * `{role}/...` sub-path corresponds to. Returns null if no registered
 * route matches — the caller (the impersonate handler) turns that into a
 * 400, never a silent 500.
 */
export function resolveProxyRoute(
  afterUserId: string,
): { route: ProxyRoute; pathParams: Record<string, string> } | null {
  for (const route of PROXY_ROUTES) {
    const pathParams = matchPath(route.pathPattern, afterUserId);
    if (pathParams) return { route, pathParams };
  }
  return null;
}
