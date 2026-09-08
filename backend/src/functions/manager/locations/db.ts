import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../../shared/dynamo.js';
import type { Location } from '../../shared/models/manager/location.model.js';

export async function getCallerLookup(
  userId: string,
): Promise<{ org_id: string; manager_id: string } | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: 'METADATA' },
    }),
  );
  if (!result.Item) return null;
  return result.Item as { org_id: string; manager_id: string };
}

export async function listLocations(orgId: string): Promise<Location[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `ORG#${orgId}`,
        ':prefix': 'LOCATION#',
      },
    }),
  );
  return (result.Items ?? []) as Location[];
}

export async function getLocation(orgId: string, locationId: string): Promise<Location | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORG#${orgId}`, SK: `LOCATION#${locationId}` },
    }),
  );
  return (result.Item as Location) ?? null;
}
