import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { getCallerSub } from '../../shared/auth.js';
import {
  ok,
  created,
  noContent,
  badRequest,
  notFound,
  conflict,
  forbidden,
  internalError,
  setRequestOrigin,
} from '../../shared/response.js';
import {
  ValidationError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  listLocations,
  assignLocation,
  removeLocation,
} from './service.js';

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const method = event.requestContext.http.method;
  const managerId = event.pathParameters?.managerId;
  const locationId = event.pathParameters?.locationId;

  if (method === 'OPTIONS') return ok('');

  setRequestOrigin(event.headers?.['origin']);

  const callerSub = getCallerSub(event);

  try {
    if (method === 'GET') {
      if (!managerId) return badRequest('managerId path parameter is required');
      return ok(await listLocations(callerSub, managerId));
    }

    if (method === 'POST') {
      if (!managerId) return badRequest('managerId path parameter is required');
      if (!event.body) return badRequest('Request body is required');
      let body: { location_id?: string };
      try {
        body = JSON.parse(event.body) as { location_id?: string };
      } catch {
        return badRequest('Invalid JSON body');
      }
      return created(await assignLocation(callerSub, managerId, body));
    }

    if (method === 'DELETE') {
      if (!managerId) return badRequest('managerId path parameter is required');
      if (!locationId) return badRequest('locationId path parameter is required');
      await removeLocation(callerSub, managerId, locationId);
      return noContent();
    }

    return badRequest(`Unhandled route: ${method} ${event.rawPath}`);
  } catch (err) {
    if (err instanceof ValidationError) return badRequest((err as Error).message);
    if (err instanceof ConflictError) return conflict((err as Error).message);
    if (err instanceof NotFoundError) return notFound((err as Error).message);
    if (err instanceof ForbiddenError) return forbidden((err as Error).message);
    console.error('Unhandled error in manager-locations handler:', err);
    return internalError('An unexpected error occurred');
  }
};
