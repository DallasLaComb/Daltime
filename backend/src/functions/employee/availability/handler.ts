import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { getCallerSub } from '../../shared/auth.js';
import { ok, badRequest, setRequestOrigin, parseBody } from '../../shared/response.js';
import type { UpsertAvailabilityBody } from '../../shared/models/employee/availability.model.js';
import { mapHandlerError } from '../../shared/errors.js';
import { getAvailability, upsertAvailability } from './service.js';

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
      const parsed = parseBody<UpsertAvailabilityBody>(event.body);
      if (!parsed.ok) return parsed.response;
      return ok(await upsertAvailability(callerSub, parsed.data));
    }

    return badRequest(`Unhandled route: ${method} ${event.rawPath}`);
  } catch (err) {
    return mapHandlerError(err, 'employee availability handler');
  }
};
