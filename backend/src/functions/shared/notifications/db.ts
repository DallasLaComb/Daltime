import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../dynamo.js';
import type { Notification } from '../models/notifications/notification.model.js';

/** Query all notifications for a recipient, newest first. */
export async function queryNotificationsByUser(sub: string): Promise<Notification[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${sub}`,
        ':prefix': 'NOTIFICATION#',
      },
      ScanIndexForward: false,
    }),
  );
  return (result.Items ?? []) as Notification[];
}

/** Query only unread notifications for a recipient. */
export async function queryUnreadNotificationsByUser(sub: string): Promise<Notification[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      FilterExpression: '#read = :unread',
      ExpressionAttributeNames: { '#read': 'read' },
      ExpressionAttributeValues: {
        ':pk': `USER#${sub}`,
        ':prefix': 'NOTIFICATION#',
        ':unread': false,
      },
      ScanIndexForward: false,
    }),
  );
  return (result.Items ?? []) as Notification[];
}

/** Get a single notification, scoped to the recipient's own partition. */
export async function getNotification(sub: string, sk: string): Promise<Notification | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${sub}`, SK: sk },
    }),
  );
  return (result.Item as Notification) ?? null;
}

/** Persist a new notification record. */
export async function putNotification(record: Notification): Promise<void> {
  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: record }));
}

/** Mark a single notification (identified by recipient + SK) as read. */
export async function updateNotificationRead(sub: string, sk: string): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${sub}`, SK: sk },
      UpdateExpression: 'SET #read = :read',
      ExpressionAttributeNames: { '#read': 'read' },
      ExpressionAttributeValues: { ':read': true },
    }),
  );
}
