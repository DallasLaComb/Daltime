import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../../shared/dynamo.js';

export async function getCallerLookup(
  userId: string,
): Promise<{ org_id: string; user_id: string } | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: 'METADATA' },
    }),
  );
  if (!result.Item) return null;
  return result.Item as { org_id: string; user_id: string };
}

export async function getOrganization(orgId: string) {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORG#${orgId}`, SK: 'METADATA' },
    }),
  );
  return result.Item ?? null;
}

export async function updateOrganization(
  orgId: string,
  fields: { name: string; address: string; updated_at: string },
) {
  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORG#${orgId}`, SK: 'METADATA' },
      UpdateExpression: 'SET #name = :name, address = :address, updated_at = :updated_at',
      ExpressionAttributeNames: { '#name': 'name' },
      ExpressionAttributeValues: {
        ':name': fields.name,
        ':address': fields.address,
        ':updated_at': fields.updated_at,
      },
      ReturnValues: 'ALL_NEW',
    }),
  );
  return result.Attributes as Record<string, unknown>;
}
