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
  notFound,
  conflict,
  forbidden,
  internalError,
  setRequestOrigin,
} from '../../shared/response.js';
import {
  ValidationError,
  ConflictError,
  NotFoundError,
  ForbiddenError,
  listEmployees,
  createEmployee,
  updateEmployee,
  disableEmployee,
  enableEmployee,
} from './service.js';

const cognitoClient = new CognitoIdentityProviderClient({});

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const method = event.requestContext.http.method;
  const employeeId = event.pathParameters?.employeeId;

  if (method === 'OPTIONS') return ok('');

  setRequestOrigin(event.headers?.['origin']);

  const callerSub = getCallerSub(event);

  try {
    if (method === 'GET') {
      return ok(await listEmployees(callerSub, cognitoClient));
    }

    if (method === 'POST') {
      if (!event.body) return badRequest('Request body is required');
      let body: CreateEmployeeBody;
      try {
        body = JSON.parse(event.body) as CreateEmployeeBody;
      } catch {
        return badRequest('Invalid JSON body');
      }
      return created(await createEmployee(callerSub, body, cognitoClient));
    }

    if (method === 'PUT') {
      if (!employeeId) return badRequest('employeeId path parameter is required');
      if (!event.body) return badRequest('Request body is required');
      let body: UpdateEmployeeBody;
      try {
        body = JSON.parse(event.body) as UpdateEmployeeBody;
      } catch {
        return badRequest('Invalid JSON body');
      }
      return ok(await updateEmployee(callerSub, employeeId, body, cognitoClient));
    }

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
    if (err instanceof ValidationError) return badRequest((err as Error).message);
    if (err instanceof ConflictError) return conflict((err as Error).message);
    if (err instanceof NotFoundError) return notFound((err as Error).message);
    if (err instanceof ForbiddenError) return forbidden((err as Error).message);
    console.error('Unhandled error in employees handler:', err);
    return internalError('An unexpected error occurred');
  }
};
