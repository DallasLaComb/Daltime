import { DeleteCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import {
  docClient,
  TABLE_NAME,
  getMetadataRecord,
  listOrgLocations,
  getOrgLocation,
} from '../../shared/dynamo.js';
import type { Location } from '../../shared/models/manager/location.model.js';

export async function getCallerLookup(
  userId: string,
): Promise<{ org_id: string; user_id: string } | null> {
  return getMetadataRecord(userId);
}

export async function listLocations(orgId: string): Promise<Location[]> {
  return listOrgLocations(orgId);
}

export async function getLocation(orgId: string, locationId: string): Promise<Location | null> {
  return getOrgLocation(orgId, locationId);
}

export async function createLocation(location: Location): Promise<void> {
  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: location }));
}

/**
 * Update mutable fields on a location record.
 * Pass `address: null` to remove the address attribute entirely.
 */
export async function updateLocation(
  orgId: string,
  locationId: string,
  fields: { name?: string; address?: string | null },
  updatedAt: string,
): Promise<Location | null> {
  const names: Record<string, string> = { '#updated_at': 'updated_at' };
  const values: Record<string, unknown> = { ':updated_at': updatedAt };
  const setParts: string[] = ['#updated_at = :updated_at'];
  const removeParts: string[] = [];

  if (fields.name !== undefined) {
    names['#name'] = 'name';
    values[':name'] = fields.name;
    setParts.push('#name = :name');
  }

  if (fields.address !== undefined) {
    names['#address'] = 'address';
    if (fields.address === null) {
      removeParts.push('#address');
    } else {
      values[':address'] = fields.address;
      setParts.push('#address = :address');
    }
  }

  const expressionParts = [`SET ${setParts.join(', ')}`];
  if (removeParts.length > 0) expressionParts.push(`REMOVE ${removeParts.join(', ')}`);

  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORG#${orgId}`, SK: `LOCATION#${locationId}` },
      UpdateExpression: expressionParts.join(' '),
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: 'ALL_NEW',
    }),
  );
  return (result.Attributes as Location) ?? null;
}

export async function deleteLocation(orgId: string, locationId: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORG#${orgId}`, SK: `LOCATION#${locationId}` },
    }),
  );
}
