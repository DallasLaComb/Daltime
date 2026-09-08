import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { getCallerSub, getCallerGroups } from '../../shared/auth.js';
import {
  ok,
  created,
  noContent,
  badRequest,
  setRequestOrigin,
  parseBody,
} from '../../shared/response.js';
import { mapHandlerError, ForbiddenError } from '../../shared/errors.js';
import { listSwapShifts, postSwapShift, claimSwapShift, cancelSwapShift } from './service.js';

/**
 * Lambda handler for all /employee/swap-shifts routes:
 *
 *   GET    /employee/swap-shifts           — list available + own posted swaps
 *   POST   /employee/swap-shifts           — post a shift for swap
 *   POST   /employee/swap-shifts/{swapId}/claim — claim an open listing
 *   DELETE /employee/swap-shifts/{swapId} — cancel (unpost) a listing
 *   OPTIONS /employee/swap-shifts         — CORS preflight
 *   OPTIONS /employee/swap-shifts/{proxy+} — CORS preflight for parameterized routes
 *
 * All routes require the Employee Cognito group. The JWT authorizer verifies
 * the token signature but does NOT check group membership — that is done here
 * before any routing logic.
 */
export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  setRequestOrigin(event.headers?.['origin']);

  const method = event.requestContext.http.method;

  // CORS preflight — respond immediately before any auth/routing logic.
  if (method === 'OPTIONS') {
    return ok('');
  }

  try {
    // Enforce Employee role — API Gateway JWT authorizer only verifies token
    // validity, not group membership, so we must enforce it ourselves.
    if (!getCallerGroups(event).includes('Employee')) {
      throw new ForbiddenError('Employee role required');
    }

    const callerSub = getCallerSub(event);
    const rawPath = event.rawPath;

    if (method === 'GET') {
      // GET /employee/swap-shifts — list available swaps + own posted swaps.
      const result = await listSwapShifts(callerSub);
      return ok(result);
    }

    if (method === 'POST') {
      // Distinguish between POST /employee/swap-shifts and
      // POST /employee/swap-shifts/{swapId}/claim by inspecting rawPath.
      const claimMatch = rawPath.match(/^\/employee\/swap-shifts\/([^/]+)\/claim$/);
      if (claimMatch) {
        // POST /employee/swap-shifts/{swapId}/claim
        const swapId = claimMatch[1];
        const result = await claimSwapShift(callerSub, swapId ?? '');
        return ok(result);
      }

      // POST /employee/swap-shifts — post a shift for swap.
      const parsed = parseBody<Record<string, unknown>>(event.body);
      if (!parsed.ok) return parsed.response;
      const result = await postSwapShift(callerSub, parsed.data);
      return created(result);
    }

    if (method === 'DELETE') {
      // DELETE /employee/swap-shifts/{swapId}
      const swapId = event.pathParameters?.['swapId'] ?? event.pathParameters?.['proxy'];
      if (!swapId) return badRequest('swapId path parameter is required');
      await cancelSwapShift(callerSub, swapId);
      return noContent();
    }

    return badRequest(`Unhandled route: ${method} ${rawPath}`);
  } catch (err) {
    return mapHandlerError(err, 'employee swap-shifts handler');
  }
};
