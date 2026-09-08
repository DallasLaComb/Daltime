import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { getCallerSub } from '../../shared/auth.js';
import {
  ok,
  created,
  badRequest,
  notFound,
  forbidden,
  internalError,
  setRequestOrigin,
} from '../../shared/response.js';
import {
  ValidationError,
  ForbiddenError,
  NotFoundError,
  getLocations,
  createLocation,
  updateLocation,
  removeLocation,
} from './service.js';

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const method = event.requestContext.http.method;
  const locationId = event.pathParameters?.['locationId'];

  if (method === 'OPTIONS') return ok('');

  setRequestOrigin(event.headers?.['origin']);

  const callerSub = getCallerSub(event);

  try {
    if (method === 'GET') {
      return ok(await getLocations(callerSub));
    }

    if (method === 'POST') {
      if (!event.body) return badRequest('Request body is required');
      let body: { name?: string; address?: string };
      try {
        body = JSON.parse(event.body) as { name?: string; address?: string };
      } catch {
        return badRequest('Invalid JSON body');
      }
      return created(await createLocation(callerSub, body));
    }

    if (method === 'PUT' && locationId) {
      if (!event.body) return badRequest('Request body is required');
      let body: { name?: string; address?: string };
      try {
        body = JSON.parse(event.body) as { name?: string; address?: string };
      } catch {
        return badRequest('Invalid JSON body');
      }
      return ok(await updateLocation(callerSub, locationId, body));
    }

    if (method === 'DELETE' && locationId) {
      await removeLocation(callerSub, locationId);
      return ok('');
    }

    return badRequest(`Unhandled route: ${method} ${event.rawPath}`);
  } catch (err) {
    if (err instanceof ValidationError) return badRequest((err as Error).message);
    if (err instanceof ForbiddenError) return forbidden((err as Error).message);
    if (err instanceof NotFoundError) return notFound((err as Error).message);
    console.error('Unhandled error in org-admin locations handler:', err);
    return internalError('An unexpected error occurred');
  }
};
