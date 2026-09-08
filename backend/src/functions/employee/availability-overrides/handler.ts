import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { getCallerSub } from '../../shared/auth.js';
import { ok, badRequest, setRequestOrigin, parseBody } from '../../shared/response.js';
import type { UpsertOverridesBody } from '../../shared/models/employee/availability.model.js';
import { mapHandlerError } from '../../shared/errors.js';
import { getAvailabilityOverrides, upsertAvailabilityOverrides } from './service.js';

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const method = event.requestContext.http.method;

  if (method === 'OPTIONS') {
    setRequestOrigin(event.headers?.['origin']);
    return ok('');
  }

  setRequestOrigin(event.headers?.['origin']);

  const callerSub = getCallerSub(event);

  try {
    if (method === 'GET') {
      const overrides = await getAvailabilityOverrides(callerSub);
      return ok(overrides ?? {});
    }

    if (method === 'PUT') {
      const parsed = parseBody<UpsertOverridesBody>(event.body);
      if (!parsed.ok) return parsed.response;
      return ok(await upsertAvailabilityOverrides(callerSub, parsed.data));
    }

    return badRequest(`Unhandled route: ${method} ${event.rawPath}`);
  } catch (err) {
    return mapHandlerError(err, 'employee availability-overrides handler');
  }
};
