import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../../shared/dynamo.js';
import type { EmployeeAvailabilityOverrides } from '../../shared/models/employee/availability.model.js';

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

export async function getAvailabilityOverrides(
  employeeId: string,
): Promise<EmployeeAvailabilityOverrides | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${employeeId}`, SK: 'AVAILABILITY_OVERRIDES' },
    }),
  );
  return (result.Item as EmployeeAvailabilityOverrides) ?? null;
}

export async function upsertAvailabilityOverrides(
  record: EmployeeAvailabilityOverrides,
): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: record,
    }),
  );
}
