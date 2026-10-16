import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { ANDROID_FINANCE_CHANNEL_ID, ensureAndroidNotificationChannel } from './pushNotifications';

function futureTrigger(date: Date): Notifications.NotificationTriggerInput | null {
  if (date.getTime() <= Date.now() + 60_000) return null;
  return { type: Notifications.SchedulableTriggerInputTypes.DATE, date };
}

function morningOnDay(iso: string, hour = 9): Date | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(hour, 0, 0, 0);
  if (d.getTime() <= Date.now() + 60_000) return null;
  return d;
}

export async function cancelFinanceNotification(identifier: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
    await Notifications.dismissNotificationAsync(identifier);
  } catch {
    // ignore
  }
}

async function scheduleAt(
  identifier: string,
  title: string,
  body: string,
  when: Date,
  data: Record<string, string>,
): Promise<void> {
  const trigger = futureTrigger(when);
  if (!trigger) return;
  await ensureAndroidNotificationChannel();
  await cancelFinanceNotification(identifier);
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title,
      body,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
      data,
      ...(Platform.OS === 'android' ? { channelId: ANDROID_FINANCE_CHANNEL_ID } : {}),
    },
    trigger,
  });
}

export async function scheduleTaskDueNotification(
  taskId: string,
  title: string,
  dueAt: string,
): Promise<void> {
  const when = new Date(dueAt);
  if (Number.isNaN(when.getTime())) return;
  await scheduleAt(
    `finance_task_${taskId}`,
    'Task due',
    `"${title}" is due now`,
    when,
    { type: 'finance_task_due', taskId, dueAt },
  );
}

export async function scheduleInvoiceDueNotification(
  invoiceId: string,
  clientName: string,
  dueDate: string,
): Promise<void> {
  const when = morningOnDay(dueDate, 9);
  if (!when) return;
  const label = clientName.trim() || 'Client';
  await scheduleAt(
    `finance_invoice_${invoiceId}`,
    'Invoice due today',
    `Unpaid invoice for ${label} is due today`,
    when,
    { type: 'finance_invoice_due', invoiceId, dueDate },
  );
}

export async function scheduleServiceTaskReminder(
  serviceTaskId: string,
  title: string,
  dueAt: string,
): Promise<void> {
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return;
  const remind = new Date(due.getTime() - 60 * 60 * 1000);
  await scheduleAt(
    `finance_service_task_${serviceTaskId}`,
    'Service task soon',
    `"${title}" starts in 1 hour`,
    remind,
    { type: 'finance_service_task', serviceTaskId, dueAt },
  );
}

export async function scheduleEstimateCallNotification(
  estimateId: string,
  clientName: string,
  callClientAt: string,
): Promise<void> {
  const when = morningOnDay(callClientAt, 9);
  if (!when) return;
  const label = clientName.trim() || 'client';
  await scheduleAt(
    `finance_estimate_call_${estimateId}`,
    'Call client',
    `Follow up with ${label} today`,
    when,
    { type: 'finance_estimate_call', estimateId, callClientAt },
  );
}
