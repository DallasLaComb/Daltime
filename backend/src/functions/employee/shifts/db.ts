import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME, getMetadataRecord } from '../../shared/dynamo.js';
import type { Shift } from '../../shared/models/manager/shift.model.js';

export async function getCallerLookup(
  userId: string,
): Promise<{ org_id: string; employee_id: string } | null> {
  return getMetadataRecord(userId);
}

export async function listShiftsByEmployee(
  orgId: string,
  employeeId: string,
  month: string,
): Promise<Shift[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      FilterExpression:
        'employee_id = :employeeId AND begins_with(#date, :month) AND (#status = :published OR attribute_not_exists(#status))',
      ExpressionAttributeNames: { '#date': 'date', '#status': 'status' },
      ExpressionAttributeValues: {
        ':pk': `ORG#${orgId}`,
        ':skPrefix': 'SHIFT#',
        ':employeeId': employeeId,
        ':month': month,
        ':published': 'published',
      },
    }),
  );
  return (result.Items ?? []) as Shift[];
}
