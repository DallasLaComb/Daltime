import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import type {
  CreateManagerBody,
  UpdateManagerBody,
} from '../../shared/models/org-admin/manager.model.js';
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
  listManagers,
  createManager,
  updateManager,
  disableManager,
  enableManager,
} from './service.js';

const cognitoClient = new CognitoIdentityProviderClient({});

async function handlePost(callerSub: string, rawBody: string | undefined) {
  const parsed = parseBody<CreateManagerBody>(rawBody);
  if (!parsed.ok) return parsed.response;
  return created(await createManager(callerSub, parsed.data, cognitoClient));
}

async function handlePut(
  callerSub: string,
  managerId: string | undefined,
  rawBody: string | undefined,
) {
  if (!managerId) return badRequest('managerId path parameter is required');
  const parsed = parseBody<UpdateManagerBody>(rawBody);
  if (!parsed.ok) return parsed.response;
  return ok(await updateManager(callerSub, managerId, parsed.data, cognitoClient));
}

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const method = event.requestContext.http.method;
  const managerId = event.pathParameters?.managerId;

  if (method === 'OPTIONS') return ok('');

  setRequestOrigin(event.headers?.['origin']);

  const callerSub = getCallerSub(event);

  try {
    if (method === 'GET') return ok(await listManagers(callerSub, cognitoClient));
    if (method === 'POST') return await handlePost(callerSub, event.body);
    if (method === 'PUT') return await handlePut(callerSub, managerId, event.body);
    if (method === 'DELETE') {
      if (!managerId) return badRequest('managerId path parameter is required');
      await disableManager(callerSub, managerId, cognitoClient);
      return noContent();
    }
    if (method === 'PATCH') {
      if (!managerId) return badRequest('managerId path parameter is required');
      await enableManager(callerSub, managerId, cognitoClient);
      return noContent();
    }
    return badRequest(`Unhandled route: ${method} ${event.rawPath}`);
  } catch (err) {
    return mapHandlerError(err, 'org-admin managers handler');
  }
};
