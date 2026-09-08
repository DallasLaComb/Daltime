import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { getCallerSub } from '../../shared/auth.js';
import {
  ok,
  badRequest,
  forbidden,
  notFound,
  internalError,
  setRequestOrigin,
} from '../../shared/response.js';
import {
  ValidationError,
  ForbiddenError,
  NotFoundError,
  getProfile,
  updateProfile,
} from './service.js';

const cognitoClient = new CognitoIdentityProviderClient({});

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const method = event.requestContext.http.method;

  if (method === 'OPTIONS') return ok('');

  setRequestOrigin(event.headers?.['origin']);

  const callerSub = getCallerSub(event);

  try {
    if (method === 'GET') {
      return ok(await getProfile(callerSub, cognitoClient));
    }

    if (method === 'PUT') {
      if (!event.body) return badRequest('Request body is required');
      let body: { first_name?: string; last_name?: string; phone?: string };
      try {
        body = JSON.parse(event.body) as {
          first_name?: string;
          last_name?: string;
          phone?: string;
        };
      } catch {
        return badRequest('Invalid JSON body');
      }
      return ok(await updateProfile(callerSub, body));
    }

    return badRequest(`Unhandled route: ${method} ${event.rawPath}`);
  } catch (err) {
    if (err instanceof ValidationError) return badRequest((err as Error).message);
    if (err instanceof ForbiddenError) return forbidden((err as Error).message);
    if (err instanceof NotFoundError) return notFound((err as Error).message);
    console.error('Unhandled error in employee profile handler:', err);
    return internalError('An unexpected error occurred');
  }
};
