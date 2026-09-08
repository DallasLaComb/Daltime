import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import {
  ok,
  created,
  noContent,
  badRequest,
  notFound,
  internalError,
  setRequestOrigin,
} from '../../shared/response.js';
import {
  ValidationError,
  NotFoundError,
  listImpersonatableUsers,
  getUserContext,
  getManagerShiftsNeeded,
  getOrgManagers,
  getOrgEmployees,
  getOrgLocations,
  getOrgMetadata,
  getManagerLocationAssignments,
  assignManagerLocation,
  removeManagerLocation,
  getEmployeeLocationAssignments,
  assignEmployeeLocation,
  removeEmployeeLocation,
  getEmployeeProfileProxy,
  getEmployeeAvailabilityProxy,
  upsertEmployeeAvailabilityProxy,
  getEmployeeAvailabilityOverridesProxy,
  upsertEmployeeAvailabilityOverridesProxy,
  getOrgAdminShiftsProxy,
  getManagerShiftsProxy,
  createManagerShiftProxy,
  updateManagerShiftProxy,
  removeManagerShiftProxy,
  getEmployeeShiftsProxy,
  generateDraftScheduleProxy,
  publishScheduleProxy,
  getDraftSummaryProxy,
} from './service.js';
import type {
  UpsertAvailabilityBody,
  UpsertOverridesBody,
} from '../../shared/models/employee/availability.model.js';

const cognitoClient = new CognitoIdentityProviderClient({});

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const method = event.requestContext.http.method;
  const rawPath = event.rawPath;

  if (method === 'OPTIONS') {
    return ok('');
  }

  setRequestOrigin(event.headers?.['origin']);

  try {
    // ── GET /web-admin/impersonate/users?orgId=&role= ──────────────────────
    if (method === 'GET' && rawPath.endsWith('/impersonate/users')) {
      const orgId = event.queryStringParameters?.['orgId'];
      const role = event.queryStringParameters?.['role'];
      if (!orgId) return badRequest('orgId query parameter is required');
      if (!role) return badRequest('role query parameter is required');
      return ok(await listImpersonatableUsers(orgId, role));
    }

    // ── GET /web-admin/impersonate/{userId}/context ────────────────────────
    if (method === 'GET' && rawPath.endsWith('/context')) {
      const userId = event.pathParameters?.['userId'];
      if (!userId) return badRequest('userId path parameter is required');
      return ok(await getUserContext(userId, cognitoClient));
    }

    // ── Proxy routes — all need a valid userId ─────────────────────────────
    const userId = event.pathParameters?.['userId'];
    if (!userId) return badRequest('userId path parameter is required');

    // Derive the sub-path after /web-admin/impersonate/{userId}/
    // rawPath example: /web-admin/impersonate/abc-123/org-admin/managers
    const afterUserId = rawPath.split(`/impersonate/${userId}/`)[1] ?? '';

    // org-admin proxies
    if (method === 'GET' && afterUserId === 'org-admin/managers') {
      return ok(await getOrgManagers(userId));
    }
    if (method === 'GET' && afterUserId === 'org-admin/employees') {
      return ok(await getOrgEmployees(userId));
    }
    if (method === 'GET' && afterUserId === 'org-admin/locations') {
      return ok(await getOrgLocations(userId));
    }
    if (method === 'GET' && afterUserId === 'org-admin/organization') {
      return ok(await getOrgMetadata(userId));
    }

    // manager proxies
    if (method === 'GET' && afterUserId === 'manager/shifts-needed') {
      const month = event.queryStringParameters?.['month'];
      return ok(await getManagerShiftsNeeded(userId, month));
    }
    if (method === 'GET' && afterUserId === 'manager/employees') {
      return ok(await getOrgEmployees(userId));
    }
    if (method === 'GET' && afterUserId === 'manager/locations') {
      return ok(await getOrgLocations(userId));
    }

    // org-admin/managers/{managerId}/locations — GET + POST
    const managerLocationsMatch = afterUserId.match(/^org-admin\/managers\/([^/]+)\/locations$/);
    if (managerLocationsMatch) {
      const [, managerId] = managerLocationsMatch;
      if (method === 'GET') return ok(await getManagerLocationAssignments(userId, managerId));
      if (method === 'POST') {
        if (!event.body) return badRequest('Request body is required');
        let body: { location_id?: string };
        try {
          body = JSON.parse(event.body) as { location_id?: string };
        } catch {
          return badRequest('Invalid JSON body');
        }
        if (!body.location_id?.trim()) return badRequest('location_id is required');
        return created(await assignManagerLocation(userId, managerId, body.location_id));
      }
    }

    // org-admin/managers/{managerId}/locations/{locationId} — DELETE
    const managerLocationByIdMatch = afterUserId.match(
      /^org-admin\/managers\/([^/]+)\/locations\/([^/]+)$/,
    );
    if (managerLocationByIdMatch && method === 'DELETE') {
      const [, managerId, locationId] = managerLocationByIdMatch;
      await removeManagerLocation(userId, managerId, locationId);
      return noContent();
    }

    // org-admin/employees/{employeeId}/locations — GET + POST
    const employeeLocationsMatch = afterUserId.match(/^org-admin\/employees\/([^/]+)\/locations$/);
    if (employeeLocationsMatch) {
      const [, employeeId] = employeeLocationsMatch;
      if (method === 'GET') return ok(await getEmployeeLocationAssignments(userId, employeeId));
      if (method === 'POST') {
        if (!event.body) return badRequest('Request body is required');
        let body: { location_id?: string };
        try {
          body = JSON.parse(event.body) as { location_id?: string };
        } catch {
          return badRequest('Invalid JSON body');
        }
        if (!body.location_id?.trim()) return badRequest('location_id is required');
        return created(await assignEmployeeLocation(userId, employeeId, body.location_id));
      }
    }

    // org-admin/employees/{employeeId}/locations/{locationId} — DELETE
    const employeeLocationByIdMatch = afterUserId.match(
      /^org-admin\/employees\/([^/]+)\/locations\/([^/]+)$/,
    );
    if (employeeLocationByIdMatch && method === 'DELETE') {
      const [, employeeId, locationId] = employeeLocationByIdMatch;
      await removeEmployeeLocation(userId, employeeId, locationId);
      return noContent();
    }

    // employee/profile — GET
    if (method === 'GET' && afterUserId === 'employee/profile') {
      return ok(await getEmployeeProfileProxy(userId));
    }

    // employee/availability — GET + PUT
    if (afterUserId === 'employee/availability') {
      if (method === 'GET') return ok(await getEmployeeAvailabilityProxy(userId));
      if (method === 'PUT') {
        if (!event.body) return badRequest('Request body is required');
        let body: UpsertAvailabilityBody;
        try {
          body = JSON.parse(event.body) as UpsertAvailabilityBody;
        } catch {
          return badRequest('Invalid JSON body');
        }
        return ok(await upsertEmployeeAvailabilityProxy(userId, body));
      }
    }

    // employee/availability/overrides — GET + PUT
    if (afterUserId === 'employee/availability/overrides') {
      if (method === 'GET') return ok(await getEmployeeAvailabilityOverridesProxy(userId));
      if (method === 'PUT') {
        if (!event.body) return badRequest('Request body is required');
        let body: UpsertOverridesBody;
        try {
          body = JSON.parse(event.body) as UpsertOverridesBody;
        } catch {
          return badRequest('Invalid JSON body');
        }
        return ok(await upsertEmployeeAvailabilityOverridesProxy(userId, body));
      }
    }

    // org-admin/shifts — GET
    if (method === 'GET' && afterUserId.startsWith('org-admin/shifts')) {
      const month = event.queryStringParameters?.['month'];
      return ok(await getOrgAdminShiftsProxy(userId, month));
    }

    // manager/shifts/{shiftId} — PUT + DELETE
    const managerShiftByIdMatch = afterUserId.match(/^manager\/shifts\/([^/]+)$/);
    if (managerShiftByIdMatch) {
      const [, shiftId] = managerShiftByIdMatch;
      if (method === 'PUT') {
        if (!event.body) return badRequest('Request body is required');
        let body: Parameters<typeof updateManagerShiftProxy>[2];
        try {
          body = JSON.parse(event.body) as Parameters<typeof updateManagerShiftProxy>[2];
        } catch {
          return badRequest('Invalid JSON body');
        }
        return ok(await updateManagerShiftProxy(userId, shiftId, body));
      }
      if (method === 'DELETE') {
        await removeManagerShiftProxy(userId, shiftId);
        return noContent();
      }
    }

    // manager/shifts — GET + POST
    if (afterUserId === 'manager/shifts') {
      if (method === 'GET') {
        const month = event.queryStringParameters?.['month'];
        return ok(await getManagerShiftsProxy(userId, month));
      }
      if (method === 'POST') {
        if (!event.body) return badRequest('Request body is required');
        let body: Parameters<typeof createManagerShiftProxy>[1];
        try {
          body = JSON.parse(event.body) as Parameters<typeof createManagerShiftProxy>[1];
        } catch {
          return badRequest('Invalid JSON body');
        }
        return created(await createManagerShiftProxy(userId, body));
      }
    }

    // employee/shifts — GET
    if (method === 'GET' && afterUserId.startsWith('employee/shifts')) {
      const month = event.queryStringParameters?.['month'];
      return ok(await getEmployeeShiftsProxy(userId, month));
    }

    // manager/schedule/generate — POST
    if (method === 'POST' && afterUserId === 'manager/schedule/generate') {
      const month = event.queryStringParameters?.['month'];
      return ok(await generateDraftScheduleProxy(userId, month));
    }

    // manager/schedule/publish — POST
    if (method === 'POST' && afterUserId === 'manager/schedule/publish') {
      const month = event.queryStringParameters?.['month'];
      return ok(await publishScheduleProxy(userId, month));
    }

    // manager/schedule/drafts — GET
    if (method === 'GET' && afterUserId === 'manager/schedule/drafts') {
      const month = event.queryStringParameters?.['month'];
      return ok(await getDraftSummaryProxy(userId, month));
    }

    return badRequest(`Unhandled proxy route: ${method} ${rawPath}`);
  } catch (err) {
    if (err instanceof ValidationError) return badRequest((err as Error).message);
    if (err instanceof NotFoundError) return notFound((err as Error).message);
    console.error('Unhandled error in impersonate handler:', err);
    return internalError('An unexpected error occurred');
  }
};
