import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../../shared/dynamo.js';
import type {
  EmployeeAvailability,
  EmployeeAvailabilityOverrides,
} from '../../shared/models/employee/availability.model.js';
import type { Employee } from '../../shared/models/org-admin/employee.model.js';

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

export async function getEmployee(orgId: string, employeeId: string): Promise<Employee | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORG#${orgId}`, SK: `EMPLOYEE#${employeeId}` },
    }),
  );
  return (result.Item as Employee) ?? null;
}

export async function listEmployeesByManager(
  orgId: string,
  managerId: string,
): Promise<Employee[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      FilterExpression: 'manager_id = :managerId',
      ExpressionAttributeValues: {
        ':pk': `ORG#${orgId}`,
        ':skPrefix': 'EMPLOYEE#',
        ':managerId': managerId,
      },
    }),
  );
  return (result.Items ?? []) as Employee[];
}

export async function createEmployee(employee: Employee): Promise<void> {
  const primary: Employee = {
    ...employee,
    GSI1PK: 'EMPLOYEE',
    GSI1SK: employee.created_at,
  };

  const reverseLookup = {
    PK: `USER#${employee.employee_id}`,
    SK: 'METADATA',
    employee_id: employee.employee_id,
    email: employee.email,
    first_name: employee.first_name,
    last_name: employee.last_name,
    org_id: employee.org_id,
    status: employee.status,
    created_at: employee.created_at,
  };

  await Promise.all([
    docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: primary })),
    docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: reverseLookup })),
  ]);
}

export async function updateEmployee(
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

  const reverseParts: string[] = ['#updated_at = :updated_at'];
  const reverseNames: Record<string, string> = { '#updated_at': 'updated_at' };
  const reverseValues: Record<string, unknown> = { ':updated_at': updatedAt };

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

export async function disableEmployee(orgId: string, employeeId: string): Promise<void> {
  const now = new Date().toISOString();
  await Promise.all([
    docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: `ORG#${orgId}`, SK: `EMPLOYEE#${employeeId}` },
        UpdateExpression: 'SET #status = :status, #updated_at = :now',
        ExpressionAttributeNames: { '#status': 'status', '#updated_at': 'updated_at' },
        ExpressionAttributeValues: { ':status': 'DISABLED', ':now': now },
      }),
    ),
    docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: `USER#${employeeId}`, SK: 'METADATA' },
        UpdateExpression: 'SET #status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': 'DISABLED' },
      }),
    ),
  ]);
}

export async function getEmployeeAvailability(
  employeeId: string,
): Promise<EmployeeAvailability | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${employeeId}`, SK: 'AVAILABILITY' },
    }),
  );
  return (result.Item as EmployeeAvailability) ?? null;
}

export async function getEmployeeAvailabilityOverrides(
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

export async function enableEmployee(orgId: string, employeeId: string): Promise<void> {
  const now = new Date().toISOString();
  await Promise.all([
    docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: `ORG#${orgId}`, SK: `EMPLOYEE#${employeeId}` },
        UpdateExpression: 'SET #status = :status, #updated_at = :now',
        ExpressionAttributeNames: { '#status': 'status', '#updated_at': 'updated_at' },
        ExpressionAttributeValues: { ':status': 'CONFIRMED', ':now': now },
      }),
    ),
    docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: `USER#${employeeId}`, SK: 'METADATA' },
        UpdateExpression: 'SET #status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': 'CONFIRMED' },
      }),
    ),
  ]);
}
