import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { internalError, ok, setRequestOrigin } from '../../shared/response.js';
import { listEmployees } from './service.js';

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const method = event.requestContext.http.method;

  if (method === 'OPTIONS') {
    return ok('');
  }

  setRequestOrigin(event.headers?.['origin']);

  try {
    if (method === 'GET') {
      return ok(await listEmployees());
    }

    return internalError(`Unhandled route: ${method} ${event.rawPath}`);
  } catch (error) {
    console.error('Unhandled error in web-admin/employees handler:', error);
    return internalError('An unexpected error occurred');
  }
};
