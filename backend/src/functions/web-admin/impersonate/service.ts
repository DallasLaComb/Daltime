import type { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { AdminListGroupsForUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import * as db from './db.js';

import { ValidationError, NotFoundError } from '../../shared/errors.js';

const USER_POOL_ID = process.env.USER_POOL_ID!;

const VALID_ROLES = new Set(['OrgAdmin', 'Manager', 'Employee']);

export interface ImpersonateUserSummary {
  user_id: string;
  display_name: string;
  email: string;
  status: string;
  org_id: string;
}

export interface ImpersonateContext {
  user_id: string;
  role: 'OrgAdmin' | 'Manager' | 'Employee';
  display_name: string;
  email: string;
  org_id: string;
  status: string;
}

/** Resolve the Cognito group (role) for a given user sub. */
async function resolveRole(
  userId: string,
  cognitoClient: CognitoIdentityProviderClient,
): Promise<'OrgAdmin' | 'Manager' | 'Employee' | null> {
  const response = await cognitoClient.send(
    new AdminListGroupsForUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: userId,
    }),
  );
  const group = (response.Groups ?? []).find((g) => VALID_ROLES.has(g.GroupName ?? ''));
  if (!group?.GroupName) return null;
  return group.GroupName as 'OrgAdmin' | 'Manager' | 'Employee';
}

/** Build a display name from a raw DynamoDB row (handles both name and first_name/last_name). */
function buildDisplayName(row: Record<string, unknown>): string {
  if (typeof row['name'] === 'string' && row['name']) return row['name'];
  const first = typeof row['first_name'] === 'string' ? row['first_name'] : '';
  const last = typeof row['last_name'] === 'string' ? row['last_name'] : '';
  return `${first} ${last}`.trim() || 'Unknown';
}

/** List all users for an org + role that can be impersonated. */
export async function listImpersonatableUsers(
  orgId: string,
  role: string,
): Promise<ImpersonateUserSummary[]> {
  if (!orgId) throw new ValidationError('orgId is required');
  if (!VALID_ROLES.has(role)) {
    throw new ValidationError('role must be one of: OrgAdmin, Manager, Employee');
  }

  const rows = await db.listUsersByOrgAndRole(orgId, role);

  return rows.map((row) => {
    // SK is always "<ROLE>#<userId>" — extract the ID after the first "#"
    // This avoids ambiguity: employee records carry a manager_id field which
    // would otherwise be picked up before employee_id in a fallback chain.
    const skParts = row.SK.split('#');
    const userId = skParts.length >= 2 ? skParts.slice(1).join('#') : '';

    return {
      user_id: userId,
      display_name: buildDisplayName(row),
      email: (row['email'] as string) ?? '',
      status: (row['status'] as string) ?? '',
      org_id: (row['org_id'] as string) ?? orgId,
    };
  });
}

/** Fetch a user's full context (profile + role) for starting impersonation. */
export async function getUserContext(
  userId: string,
  cognitoClient: CognitoIdentityProviderClient,
): Promise<ImpersonateContext> {
  const row = await db.getUserReverseLookup(userId);
  if (!row) throw new NotFoundError('User not found');

  const role = await resolveRole(userId, cognitoClient);
  if (!role) throw new NotFoundError('User has no recognised role');

  return {
    user_id: userId,
    role,
    display_name: buildDisplayName(row),
    email: (row['email'] as string) ?? '',
    org_id: (row['org_id'] as string) ?? '',
    status: (row['status'] as string) ?? '',
  };
}
