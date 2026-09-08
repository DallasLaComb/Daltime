import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { getCallerSub } from '../../shared/auth.js';
import {
  ok,
  created,
  noContent,
  badRequest,
  setRequestOrigin,
  parseBody,
} from '../../shared/response.js';
import { mapHandlerError } from '../../shared/errors.js';
import {
  listEmployees,
  createEmployee,
  updateEmployee,
  disableEmployee,
  enableEmployee,
  getEmployeeAvailabilityForManager,
  getEmployeeAvailabilityOverridesForManager,
} from './service.js';

const cognitoClient = new CognitoIdentityProviderClient({});

async function handleGet(callerSub: string, path: string, employeeId: string | undefined) {
  if (path.endsWith('/availability/overrides')) {
    if (!employeeId) return badRequest('employeeId path parameter is required');
    return ok(await getEmployeeAvailabilityOverridesForManager(callerSub, employeeId));
  }
  if (path.endsWith('/availability')) {
    if (!employeeId) return badRequest('employeeId path parameter is required');
    return ok(await getEmployeeAvailabilityForManager(callerSub, employeeId));
  }
  return ok(await listEmployees(callerSub, cognitoClient));
}

async function handlePost(callerSub: string, rawBody: string | undefined) {
  const parsed = parseBody<{
    email: string;
    first_name: string;
    last_name: string;
    phone?: string;
    temp_password: string;
  }>(rawBody);
  if (!parsed.ok) return parsed.response;
  return created(await createEmployee(callerSub, parsed.data, cognitoClient));
}

async function handlePut(
  callerSub: string,
  employeeId: string | undefined,
  rawBody: string | undefined,
) {
  if (!employeeId) return badRequest('employeeId path parameter is required');
  const parsed = parseBody<{ first_name?: string; last_name?: string; phone?: string }>(rawBody);
  if (!parsed.ok) return parsed.response;
  return ok(await updateEmployee(callerSub, employeeId, parsed.data, cognitoClient));
}

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const method = event.requestContext.http.method;
  const employeeId = event.pathParameters?.employeeId;

  if (method === 'OPTIONS') return ok('');

  setRequestOrigin(event.headers?.['origin']);

  const callerSub = getCallerSub(event);

  try {
    if (method === 'GET') return await handleGet(callerSub, event.rawPath, employeeId);
    if (method === 'POST') return await handlePost(callerSub, event.body);
    if (method === 'PUT') return await handlePut(callerSub, employeeId, event.body);
    if (method === 'DELETE') {
      if (!employeeId) return badRequest('employeeId path parameter is required');
      await disableEmployee(callerSub, employeeId, cognitoClient);
      return noContent();
    }
    if (method === 'PATCH') {
      if (!employeeId) return badRequest('employeeId path parameter is required');
      await enableEmployee(callerSub, employeeId, cognitoClient);
      return noContent();
    }
    return badRequest(`Unhandled route: ${method} ${event.rawPath}`);
  } catch (err) {
    return mapHandlerError(err, 'manager employees handler');
  }
};
