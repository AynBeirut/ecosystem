import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v2/scheduler';
import { getFcmTokensForStoreOwner, sendFcmMulticast } from '../services/fcmTokens';

const db = admin.firestore();
const DEFAULT_STORE_UTC_OFFSET = '+03:00';

type ReminderOrder = {
  storeId?: string;
  invoiceNumber?: string;
  customerName?: string;
  scheduledFor?: string;
  scheduledReminder1hSentAt?: string;
  scheduledReminder30mSentAt?: string;
  status?: string;
};

function parseScheduledFor(value: string, utcOffset = DEFAULT_STORE_UTC_OFFSET): Date | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  if (trimmed.includes('Z') || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const normalized = trimmed.length === 16 ? `${trimmed}:00${utcOffset}` : `${trimmed}${utcOffset}`;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getMinutesUntilScheduled(value: string, now: Date): number | null {
  const target = parseScheduledFor(value);
  if (!target) return null;
  return Math.round((target.getTime() - now.getTime()) / 60000);
}

function shouldSend1h(order: ReminderOrder, now: Date): boolean {
  if (!order.scheduledFor || order.scheduledReminder1hSentAt) return false;
  if (order.status && !['pending', 'confirmed'].includes(order.status)) return false;
  const mins = getMinutesUntilScheduled(order.scheduledFor, now);
  return mins !== null && mins <= 60 && mins > 30;
}

function shouldSend30m(order: ReminderOrder, now: Date): boolean {
  if (!order.scheduledFor || order.scheduledReminder30mSentAt) return false;
  if (order.status && !['pending', 'confirmed'].includes(order.status)) return false;
  const mins = getMinutesUntilScheduled(order.scheduledFor, now);
  return mins !== null && mins <= 30 && mins > 0;
}

/**
 * Every 5 minutes: push FCM reminders to store owners for scheduled orders
 * at 1 hour and 30 minutes before the scheduled time.
 */
export const checkScheduledOrderReminders = functions.onSchedule(
  {
    schedule: 'every 5 minutes',
    timeZone: 'Asia/Beirut',
    memory: '256MiB',
  },
  async () => {
    const now = new Date();
    const snap = await db
      .collection('orders')
      .where('status', 'in', ['pending', 'confirmed'])
      .get();

    const scheduledDocs = snap.docs.filter((docSnap: FirebaseFirestore.QueryDocumentSnapshot) => {
      const scheduledFor = docSnap.data().scheduledFor;
      return typeof scheduledFor === 'string' && scheduledFor.trim().length > 0;
    });

    if (scheduledDocs.length === 0) {
      console.log('No scheduled orders needing reminders.');
      return;
    }

    let sent1h = 0;
    let sent30m = 0;

    for (const docSnap of scheduledDocs) {
      const order = docSnap.data() as ReminderOrder;
      const storeId = order.storeId || '';
      if (!storeId || !order.scheduledFor) continue;

      const refLabel = order.invoiceNumber || docSnap.id.slice(-6).toUpperCase();
      const customer = order.customerName || 'Customer';
      const tokens = await getFcmTokensForStoreOwner(storeId);
      if (tokens.length === 0) continue;

      if (shouldSend1h(order, now)) {
        await sendFcmMulticast(
          tokens,
          '⏰ Scheduled order in 1 hour',
          `${refLabel} · ${customer} · ${order.scheduledFor}`,
          { storeId, type: 'scheduled_order_1h', orderId: docSnap.id },
        );
        await docSnap.ref.update({
          scheduledReminder1hSentAt: now.toISOString(),
          updatedAt: now.toISOString(),
        });
        sent1h += 1;
        continue;
      }

      if (shouldSend30m(order, now)) {
        await sendFcmMulticast(
          tokens,
          '🔔 Scheduled order in 30 minutes',
          `${refLabel} · ${customer} · ${order.scheduledFor}`,
          { storeId, type: 'scheduled_order_30m', orderId: docSnap.id },
        );
        await docSnap.ref.update({
          scheduledReminder30mSentAt: now.toISOString(),
          updatedAt: now.toISOString(),
        });
        sent30m += 1;
      }
    }

    console.log(`Scheduled order reminders sent: 1h=${sent1h}, 30m=${sent30m}`);
  },
);
