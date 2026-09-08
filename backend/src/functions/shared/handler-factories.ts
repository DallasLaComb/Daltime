import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { getCallerSub } from './auth.js';
import { ok, created, noContent, badRequest, setRequestOrigin, parseBody } from './response.js';
import { mapHandlerError } from './errors.js';

interface ShiftCrudService {
  listShifts(callerSub: string, month: string | undefined): Promise<unknown>;
  createShift(callerSub: string, data: Record<string, unknown>): Promise<unknown>;
  updateShift(callerSub: string, shiftId: string, data: Record<string, unknown>): Promise<unknown>;
  removeShift(callerSub: string, shiftId: string): Promise<unknown>;
}

export function createShiftCrudHandler(service: ShiftCrudService, handlerName: string) {
  async function handlePost(callerSub: string, rawBody: string | undefined) {
    const parsed = parseBody<Record<string, unknown>>(rawBody);
    if (!parsed.ok) return parsed.response;
    return ok(await service.createShift(callerSub, parsed.data));
  }

  async function handlePut(callerSub: string, shiftId: string, rawBody: string | undefined) {
    const parsed = parseBody<Record<string, unknown>>(rawBody);
    if (!parsed.ok) return parsed.response;
    return ok(await service.updateShift(callerSub, shiftId, parsed.data));
  }

  return async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
    const method = event.requestContext.http.method;
    const shiftId = event.pathParameters?.['shiftId'];

    if (method === 'OPTIONS') return ok('');

    setRequestOrigin(event.headers?.['origin']);

    const callerSub = getCallerSub(event);

    try {
      if (method === 'GET') {
        const month = event.queryStringParameters?.['month'];
        return ok(await service.listShifts(callerSub, month));
      }
      if (method === 'POST') return await handlePost(callerSub, event.body);
      if (method === 'PUT' && shiftId) return await handlePut(callerSub, shiftId, event.body);
      if (method === 'DELETE' && shiftId) {
        await service.removeShift(callerSub, shiftId);
        return ok('');
      }
      return badRequest(`Unhandled route: ${method} ${event.rawPath}`);
    } catch (err) {
      return mapHandlerError(err, handlerName);
    }
  };
}

// ─── Sub-entity locations (e.g. employee-locations, manager-locations) ───────

interface SubEntityLocationsService {
  listLocations(callerSub: string, entityId: string): Promise<unknown>;
  assignLocation(
    callerSub: string,
    entityId: string,
    body: { location_id?: string },
  ): Promise<unknown>;
  removeLocation(callerSub: string, entityId: string, locationId: string): Promise<unknown>;
}

/**
 * Creates a handler for sub-entity location assignment routes.
 *
 * Supports:
 *   GET    /{entityIdParam}                       → listLocations
 *   POST   /{entityIdParam}                       → assignLocation
 *   DELETE /{entityIdParam}/{locationIdParam}     → removeLocation
 *
 * @param service        Object with listLocations / assignLocation / removeLocation
 * @param entityIdParam  Path parameter key for the entity (e.g. 'employeeId', 'managerId')
 * @param handlerName    Label used in error reporting
 */
export function createSubEntityLocationsHandler(
  service: SubEntityLocationsService,
  entityIdParam: string,
  handlerName: string,
) {
  return async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
    const method = event.requestContext.http.method;
    const entityId = event.pathParameters?.[entityIdParam];
    const locationId = event.pathParameters?.['locationId'];

    if (method === 'OPTIONS') return ok('');

    setRequestOrigin(event.headers?.['origin']);

    const callerSub = getCallerSub(event);

    try {
      if (method === 'GET') {
        if (!entityId) return badRequest(`${entityIdParam} path parameter is required`);
        return ok(await service.listLocations(callerSub, entityId));
      }
      if (method === 'POST') {
        if (!entityId) return badRequest(`${entityIdParam} path parameter is required`);
        const parsed = parseBody<{ location_id?: string }>(event.body);
        if (!parsed.ok) return parsed.response;
        return created(await service.assignLocation(callerSub, entityId, parsed.data));
      }
      if (method === 'DELETE') {
        if (!entityId) return badRequest(`${entityIdParam} path parameter is required`);
        if (!locationId) return badRequest('locationId path parameter is required');
        await service.removeLocation(callerSub, entityId, locationId);
        return noContent();
      }
      return badRequest(`Unhandled route: ${method} ${event.rawPath}`);
    } catch (err) {
      return mapHandlerError(err, handlerName);
    }
  };
}

interface ProfileService {
  getProfile(callerSub: string, cognitoClient: CognitoIdentityProviderClient): Promise<unknown>;
  updateProfile(
    callerSub: string,
    body: { first_name?: string; last_name?: string; phone?: string },
  ): Promise<unknown>;
}

export function createProfileHandler(service: ProfileService, handlerName: string) {
  const cognitoClient = new CognitoIdentityProviderClient({});

  return async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
    const method = event.requestContext.http.method;

    if (method === 'OPTIONS') return ok('');

    setRequestOrigin(event.headers?.['origin']);

    const callerSub = getCallerSub(event);

    try {
      if (method === 'GET') {
        return ok(await service.getProfile(callerSub, cognitoClient));
      }

      if (method === 'PUT') {
        const parsed = parseBody<{ first_name?: string; last_name?: string; phone?: string }>(
          event.body,
        );
        if (!parsed.ok) return parsed.response;
        return ok(await service.updateProfile(callerSub, parsed.data));
      }

      return badRequest(`Unhandled route: ${method} ${event.rawPath}`);
    } catch (err) {
      return mapHandlerError(err, handlerName);
    }
  };
}
