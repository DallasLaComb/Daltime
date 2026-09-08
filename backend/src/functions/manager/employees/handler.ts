import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
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
  getEmployeeAvailabilityForManager,
  getEmployeeAvailabilityOverridesForManager,
} from './service.js';

const cognitoClient = new CognitoIdentityProviderClient({});

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const method = event.requestContext.http.method;
  const employeeId = event.pathParameters?.employeeId;

  if (method === 'OPTIONS') return ok('');

  setRequestOrigin(event.headers?.['origin']);

  const callerSub = getCallerSub(event);

  const path = event.rawPath;

  try {
    if (method === 'GET' && path.endsWith('/availability/overrides')) {
      if (!employeeId) return badRequest('employeeId path parameter is required');
      return ok(await getEmployeeAvailabilityOverridesForManager(callerSub, employeeId));
    }

    if (method === 'GET' && path.endsWith('/availability')) {
      if (!employeeId) return badRequest('employeeId path parameter is required');
      return ok(await getEmployeeAvailabilityForManager(callerSub, employeeId));
    }

    if (method === 'GET') {
      return ok(await listEmployees(callerSub, cognitoClient));
    }

    if (method === 'POST') {
      if (!event.body) return badRequest('Request body is required');
      let body: {
        email: string;
        first_name: string;
        last_name: string;
        phone?: string;
        temp_password: string;
      };
      try {
        body = JSON.parse(event.body);
      } catch {
        return badRequest('Invalid JSON body');
      }
      return created(await createEmployee(callerSub, body, cognitoClient));
    }

    if (method === 'PUT') {
      if (!employeeId) return badRequest('employeeId path parameter is required');
      if (!event.body) return badRequest('Request body is required');
      let body: { first_name?: string; last_name?: string; phone?: string };
      try {
        body = JSON.parse(event.body);
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
    console.error('Unhandled error in manager employees handler:', err);
    return internalError('An unexpected error occurred');
  }
};
