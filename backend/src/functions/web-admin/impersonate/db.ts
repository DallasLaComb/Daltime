import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../../shared/dynamo.js';

const ROLE_SK_PREFIX: Record<string, string> = {
  OrgAdmin: 'USER#',
  Manager: 'MANAGER#',
  Employee: 'EMPLOYEE#',
};

export interface UserRow {
  PK: string;
  SK: string;
  [key: string]: unknown;
}

/** List all primary records for a given org + role by querying PK = ORG#<orgId>. */
export async function listUsersByOrgAndRole(orgId: string, role: string): Promise<UserRow[]> {
  const skPrefix = ROLE_SK_PREFIX[role];
  if (!skPrefix) return [];

  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `ORG#${orgId}`,
        ':skPrefix': skPrefix,
      },
    }),
  );
  return (result.Items ?? []) as UserRow[];
}

/** Fetch the reverse-lookup record for any user role. */
export async function getUserReverseLookup(
  userId: string,
): Promise<Record<string, unknown> | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: 'METADATA' },
    }),
  );
  return (result.Item as Record<string, unknown>) ?? null;
}

/** List all managers for an org. */
export async function listManagersByOrg(orgId: string): Promise<Record<string, unknown>[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `ORG#${orgId}`,
        ':skPrefix': 'MANAGER#',
      },
    }),
  );
  return (result.Items ?? []) as Record<string, unknown>[];
}

/** List all employees for an org. */
export async function listEmployeesByOrg(orgId: string): Promise<Record<string, unknown>[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `ORG#${orgId}`,
        ':skPrefix': 'EMPLOYEE#',
      },
    }),
  );
  return (result.Items ?? []) as Record<string, unknown>[];
}

/** List all locations for an org. */
export async function listLocationsByOrg(orgId: string): Promise<Record<string, unknown>[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `ORG#${orgId}`,
        ':skPrefix': 'LOCATION#',
      },
    }),
  );
  return (result.Items ?? []) as Record<string, unknown>[];
}

/** Get the org METADATA record. */
export async function getOrgMetadata(orgId: string): Promise<Record<string, unknown> | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORG#${orgId}`, SK: 'METADATA' },
    }),
  );
  return (result.Item as Record<string, unknown>) ?? null;
}

/** Get any single item by PK + SK (used to verify manager/employee/location membership). */
export async function getItemByPkSk(
  pk: string,
  sk: string,
): Promise<Record<string, unknown> | null> {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { PK: pk, SK: sk } }),
  );
  return (result.Item as Record<string, unknown>) ?? null;
}

/** List all location assignments for a user (PK = USER#<userId>, SK begins_with LOCATION#). */
export async function listUserLocations(userId: string): Promise<Record<string, unknown>[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':prefix': 'LOCATION#',
      },
    }),
  );
  return (result.Items ?? []) as Record<string, unknown>[];
}

/** Get a single user–location assignment. */
export async function getUserLocation(
  userId: string,
  locationId: string,
): Promise<Record<string, unknown> | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: `LOCATION#${locationId}` },
    }),
  );
  return (result.Item as Record<string, unknown>) ?? null;
}

/** Write a user–location assignment record. */
export async function createUserLocation(item: Record<string, unknown>): Promise<void> {
  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
}

/** Delete a user–location assignment record. */
export async function deleteUserLocation(userId: string, locationId: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: `LOCATION#${locationId}` },
    }),
  );
}
