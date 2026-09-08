import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { getCallerSub } from '../../shared/auth.js';
import {
  ok,
  badRequest,
  forbidden,
  internalError,
  setRequestOrigin,
} from '../../shared/response.js';
import type { UpsertAvailabilityBody } from '../../shared/models/employee/availability.model.js';
import { ValidationError, ForbiddenError, getAvailability, upsertAvailability } from './service.js';

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const method = event.requestContext.http.method;

  if (method === 'OPTIONS') return ok('');

  setRequestOrigin(event.headers?.['origin']);

  const callerSub = getCallerSub(event);

  try {
    if (method === 'GET') {
      const availability = await getAvailability(callerSub);
      // Return null-safe: if no record exists yet, return an empty object so
      // the frontend knows to show an all-unavailable default state.
      return ok(availability ?? {});
    }

    if (method === 'PUT') {
      if (!event.body) return badRequest('Request body is required');
      let body: UpsertAvailabilityBody;
      try {
        body = JSON.parse(event.body) as UpsertAvailabilityBody;
      } catch {
        return badRequest('Invalid JSON body');
      }
      return ok(await upsertAvailability(callerSub, body));
    }

    return badRequest(`Unhandled route: ${method} ${event.rawPath}`);
  } catch (err) {
    if (err instanceof ValidationError) return badRequest((err as Error).message);
    if (err instanceof ForbiddenError) return forbidden((err as Error).message);
    console.error('Unhandled error in employee availability handler:', err);
    return internalError('An unexpected error occurred');
  }
};
