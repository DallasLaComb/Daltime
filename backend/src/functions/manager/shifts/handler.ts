import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { getCallerSub } from '../../shared/auth.js';
import {
  ok,
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
  listShifts,
  createShift,
  updateShift,
  removeShift,
} from './service.js';

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const method = event.requestContext.http.method;
  const shiftId = event.pathParameters?.['shiftId'];

  if (method === 'OPTIONS') return ok('');

  setRequestOrigin(event.headers?.['origin']);

  const callerSub = getCallerSub(event);

  try {
    if (method === 'GET') {
      const month = event.queryStringParameters?.['month'];
      return ok(await listShifts(callerSub, month));
    }

    if (method === 'POST') {
      if (!event.body) return badRequest('Request body is required');
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(event.body) as Record<string, unknown>;
      } catch {
        return badRequest('Invalid JSON body');
      }
      return ok(await createShift(callerSub, body));
    }

    if (method === 'PUT' && shiftId) {
      if (!event.body) return badRequest('Request body is required');
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(event.body) as Record<string, unknown>;
      } catch {
        return badRequest('Invalid JSON body');
      }
      return ok(await updateShift(callerSub, shiftId, body));
    }

    if (method === 'DELETE' && shiftId) {
      await removeShift(callerSub, shiftId);
      return ok('');
    }

    return badRequest(`Unhandled route: ${method} ${event.rawPath}`);
  } catch (err) {
    if (err instanceof ValidationError) return badRequest((err as Error).message);
    if (err instanceof ForbiddenError) return forbidden((err as Error).message);
    if (err instanceof NotFoundError) return notFound((err as Error).message);
    console.error('Unhandled error in manager shifts handler:', err);
    return internalError('An unexpected error occurred');
  }
};
