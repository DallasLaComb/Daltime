import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { getCallerSub } from '../../shared/auth.js';
import {
  ok,
  badRequest,
  forbidden,
  internalError,
  setRequestOrigin,
} from '../../shared/response.js';
import { ForbiddenError, listShifts } from './service.js';

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const method = event.requestContext.http.method;

  if (method === 'OPTIONS') return ok('');

  setRequestOrigin(event.headers?.['origin']);

  const callerSub = getCallerSub(event);

  try {
    if (method === 'GET') {
      const month = event.queryStringParameters?.['month'];
      return ok(await listShifts(callerSub, month));
    }

    return badRequest(`Unhandled route: ${method} ${event.rawPath}`);
  } catch (err) {
    if (err instanceof ForbiddenError) return forbidden((err as Error).message);
    console.error('Unhandled error in org-admin shifts handler:', err);
    return internalError('An unexpected error occurred');
  }
};
