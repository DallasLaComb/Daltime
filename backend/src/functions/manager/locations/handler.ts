import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { getCallerSub } from '../../shared/auth.js';
import {
  ok,
  badRequest,
  forbidden,
  internalError,
  setRequestOrigin,
} from '../../shared/response.js';
import { ForbiddenError, getLocations } from './service.js';

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const method = event.requestContext.http.method;

  if (method === 'OPTIONS') return ok('');

  setRequestOrigin(event.headers?.['origin']);

  const callerSub = getCallerSub(event);

  try {
    if (method === 'GET') {
      return ok(await getLocations(callerSub));
    }

    return badRequest(`Unhandled route: ${method} ${event.rawPath}`);
  } catch (err) {
    if (err instanceof ForbiddenError) return forbidden((err as Error).message);
    console.error('Unhandled error in manager locations handler:', err);
    return internalError('An unexpected error occurred');
  }
};
