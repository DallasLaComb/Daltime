import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../../shared/dynamo.js';
import type { Employee } from '../../shared/models/org-admin/employee.model.js';

export async function getCallerLookup(
  employeeId: string,
): Promise<{ org_id: string; employee_id: string } | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${employeeId}`, SK: 'METADATA' },
    }),
  );
  if (!result.Item) return null;
  return result.Item as { org_id: string; employee_id: string };
}

export async function getEmployeeRecord(
  orgId: string,
  employeeId: string,
): Promise<Employee | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORG#${orgId}`, SK: `EMPLOYEE#${employeeId}` },
    }),
  );
  return (result.Item as Employee) ?? null;
}

export async function updateEmployeeRecord(
  orgId: string,
  employeeId: string,
  fields: { first_name?: string; last_name?: string; phone?: string },
  updatedAt: string,
): Promise<Employee | null> {
  const names: Record<string, string> = { '#updated_at': 'updated_at' };
  const values: Record<string, unknown> = { ':updated_at': updatedAt };
  const parts: string[] = ['#updated_at = :updated_at'];

  if (fields.first_name !== undefined) {
    names['#first_name'] = 'first_name';
    values[':first_name'] = fields.first_name;
    parts.push('#first_name = :first_name');
  }
  if (fields.last_name !== undefined) {
    names['#last_name'] = 'last_name';
    values[':last_name'] = fields.last_name;
    parts.push('#last_name = :last_name');
  }
  if (fields.phone !== undefined) {
    names['#phone'] = 'phone';
    values[':phone'] = fields.phone;
    parts.push('#phone = :phone');
  }

  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORG#${orgId}`, SK: `EMPLOYEE#${employeeId}` },
      UpdateExpression: `SET ${parts.join(', ')}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: 'ALL_NEW',
    }),
  );

  // Keep reverse-lookup record in sync (name fields only)
  const reverseNames: Record<string, string> = { '#updated_at': 'updated_at' };
  const reverseValues: Record<string, unknown> = { ':updated_at': updatedAt };
  const reverseParts: string[] = ['#updated_at = :updated_at'];

  if (fields.first_name !== undefined) {
    reverseNames['#first_name'] = 'first_name';
    reverseValues[':first_name'] = fields.first_name;
    reverseParts.push('#first_name = :first_name');
  }
  if (fields.last_name !== undefined) {
    reverseNames['#last_name'] = 'last_name';
    reverseValues[':last_name'] = fields.last_name;
    reverseParts.push('#last_name = :last_name');
  }

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${employeeId}`, SK: 'METADATA' },
      UpdateExpression: `SET ${reverseParts.join(', ')}`,
      ExpressionAttributeNames: reverseNames,
      ExpressionAttributeValues: reverseValues,
    }),
  );

  return (result.Attributes as Employee) ?? null;
}
