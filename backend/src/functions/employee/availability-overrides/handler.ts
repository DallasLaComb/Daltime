import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { getCallerSub } from '../../shared/auth.js';
import {
  ok,
  badRequest,
  forbidden,
  internalError,
  setRequestOrigin,
} from '../../shared/response.js';
import type { UpsertOverridesBody } from '../../shared/models/employee/availability.model.js';
import {
  ValidationError,
  ForbiddenError,
  getAvailabilityOverrides,
  upsertAvailabilityOverrides,
} from './service.js';

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const method = event.requestContext.http.method;

  if (method === 'OPTIONS') return ok('');

  setRequestOrigin(event.headers?.['origin']);

  const callerSub = getCallerSub(event);

  try {
    if (method === 'GET') {
      const overrides = await getAvailabilityOverrides(callerSub);
      return ok(overrides ?? {});
    }

    if (method === 'PUT') {
      if (!event.body) return badRequest('Request body is required');
      let body: UpsertOverridesBody;
      try {
        body = JSON.parse(event.body) as UpsertOverridesBody;
      } catch {
        return badRequest('Invalid JSON body');
      }
      return ok(await upsertAvailabilityOverrides(callerSub, body));
    }

    return badRequest(`Unhandled route: ${method} ${event.rawPath}`);
  } catch (err) {
    if (err instanceof ValidationError) return badRequest((err as Error).message);
    if (err instanceof ForbiddenError) return forbidden((err as Error).message);
    console.error('Unhandled error in employee availability-overrides handler:', err);
    return internalError('An unexpected error occurred');
  }
};
