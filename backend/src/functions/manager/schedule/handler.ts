import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { getCallerSub } from '../../shared/auth.js';
import { ok, badRequest, forbidden, setRequestOrigin } from '../../shared/response.js';
import { mapHandlerError } from '../../shared/errors.js';
import {
  generateDraftSchedule,
  publishSchedule,
  getDraftSummary,
  getScheduleMetaForCaller,
} from './service.js';

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const method = event.requestContext.http.method;
  const rawPath = event.rawPath;

  if (method === 'OPTIONS') {
    setRequestOrigin(event.headers?.['origin']);
    return ok('');
  }

  setRequestOrigin(event.headers?.['origin']);

  const callerSub = getCallerSub(event);
  if (!callerSub) return forbidden('Missing caller identity');

  const month = event.queryStringParameters?.['month'];

  try {
    // POST /manager/schedule/generate
    if (method === 'POST' && rawPath.endsWith('/generate')) {
      return ok(await generateDraftSchedule(callerSub, month));
    }

    // POST /manager/schedule/publish
    if (method === 'POST' && rawPath.endsWith('/publish')) {
      return ok(await publishSchedule(callerSub, month));
    }

    // GET /manager/schedule/drafts
    if (method === 'GET' && rawPath.endsWith('/drafts')) {
      return ok(await getDraftSummary(callerSub, month));
    }

    // GET /manager/schedule/meta
    if (method === 'GET' && rawPath.endsWith('/meta')) {
      return ok(await getScheduleMetaForCaller(callerSub, month));
    }

    return badRequest(`Unhandled route: ${method} ${rawPath}`);
  } catch (err) {
    return mapHandlerError(err, 'manager schedule handler');
  }
};
