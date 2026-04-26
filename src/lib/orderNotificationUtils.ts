export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'skipped';

export function canRetryNotification(status: NotificationStatus): boolean {
  return status === 'failed';
}

export function normalizeNotificationStatus(value: string): NotificationStatus {
  if (value === 'sent' || value === 'failed' || value === 'skipped') return value;
  return 'pending';
}
