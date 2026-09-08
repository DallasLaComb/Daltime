export type NotificationType = 'INFO' | 'APPROVAL' | 'REQUEST' | 'SHIFT';

export interface Notification {
  PK: string; // USER#<recipient_sub>
  SK: string; // NOTIFICATION#<created_at>#<raw_id>
  notification_id: string; // public composite id = `${created_at}#${raw_id}`
  recipient_sub: string;
  type: NotificationType;
  message: string;
  read: boolean;
  created_at: string; // ISO
}

export type PublicNotification = Omit<Notification, 'PK' | 'SK'>;
