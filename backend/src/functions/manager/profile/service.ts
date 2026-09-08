import {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { stripKeys } from '../../shared/dynamo.js';
import * as db from './db.js';

export class ValidationError extends Error {}
export class ForbiddenError extends Error {}
export class NotFoundError extends Error {}

const USER_POOL_ID = process.env['USER_POOL_ID']!;

async function resolveCallerOrg(sub: string): Promise<{ org_id: string }> {
  const lookup = await db.getCallerLookup(sub);
  if (!lookup) throw new ForbiddenError('Caller organization could not be resolved');
  return lookup;
}

export async function getProfile(callerSub: string, cognitoClient: CognitoIdentityProviderClient) {
  const { org_id } = await resolveCallerOrg(callerSub);

  const record = await db.getManagerRecord(org_id, callerSub);
  if (!record) throw new NotFoundError('Profile not found');

  let status = record.status;
  try {
    const user = await cognitoClient.send(
      new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: record.email }),
    );
    status = user.UserStatus ?? status;
  } catch {
    // Non-fatal — return DB status if Cognito call fails
  }

  return { ...stripKeys(record), status };
}

export async function updateProfile(
  callerSub: string,
  body: { first_name?: string; last_name?: string; phone?: string },
) {
  const hasFields =
    body.first_name !== undefined || body.last_name !== undefined || body.phone !== undefined;
  if (!hasFields) throw new ValidationError('At least one field must be provided');

  if (body.first_name !== undefined && !body.first_name.trim()) {
    throw new ValidationError('first_name cannot be empty');
  }
  if (body.last_name !== undefined && !body.last_name.trim()) {
    throw new ValidationError('last_name cannot be empty');
  }

  const { org_id } = await resolveCallerOrg(callerSub);

  const fields: { first_name?: string; last_name?: string; phone?: string } = {};
  if (body.first_name !== undefined) fields.first_name = body.first_name.trim();
  if (body.last_name !== undefined) fields.last_name = body.last_name.trim();
  if (body.phone !== undefined) fields.phone = body.phone.trim();

  const updated = await db.updateManagerRecord(org_id, callerSub, fields, new Date().toISOString());
  if (!updated) throw new NotFoundError('Profile not found');
  return stripKeys(updated);
}
