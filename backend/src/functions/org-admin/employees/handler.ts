import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import type {
  CreateEmployeeBody,
  UpdateEmployeeBody,
} from '../../shared/models/org-admin/employee.model.js';
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
} from './service.js';

const cognitoClient = new CognitoIdentityProviderClient({});

async function handlePost(callerSub: string, rawBody: string | undefined) {
  const parsed = parseBody<CreateEmployeeBody>(rawBody);
  if (!parsed.ok) return parsed.response;
  return created(await createEmployee(callerSub, parsed.data, cognitoClient));
}

async function handlePut(
  callerSub: string,
  employeeId: string | undefined,
  rawBody: string | undefined,
) {
  if (!employeeId) return badRequest('employeeId path parameter is required');
  const parsed = parseBody<UpdateEmployeeBody>(rawBody);
  if (!parsed.ok) return parsed.response;
  return ok(await updateEmployee(callerSub, employeeId, parsed.data, cognitoClient));
}

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const method = event.requestContext.http.method;
  const employeeId = event.pathParameters?.employeeId;

  if (method === 'OPTIONS') {
    setRequestOrigin(event.headers?.['origin']);
    return ok('');
  }

  setRequestOrigin(event.headers?.['origin']);

  const callerSub = getCallerSub(event);

  try {
    if (method === 'GET') return ok(await listEmployees(callerSub, cognitoClient));
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
    return mapHandlerError(err, 'org-admin employees handler');
  }
};
