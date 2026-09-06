import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v2/scheduler';
import {
  buildVisitReminder,
  formatVisitTimeLabel,
  isWithinWorkHours,
} from '../services/smartAssistantCopy';
import { sendPersonalizedPush, userIdsForAssignedRep } from '../services/teamMembers';

const db = admin.firestore();

const REMINDER_WINDOW_MS = 15 * 60 * 1000;

function dueSoon(followUpAt: string, now: Date): boolean {
  const t = new Date(followUpAt).getTime();
  if (Number.isNaN(t)) return false;
  const diff = t - now.getTime();
  return diff <= REMINDER_WINDOW_MS && diff >= -REMINDER_WINDOW_MS;
}

/**
 * Every 5 minutes (work hours): personalized CRM visit reminders to assigned rep only.
 */
export const checkCrmVisitReminders = functions.onSchedule(
  {
    schedule: 'every 5 minutes',
    timeZone: 'Asia/Beirut',
    memory: '256MiB',
  },
  async () => {
    const now = new Date();
    if (!isWithinWorkHours(now)) {
      console.log('CRM visit reminders skipped — outside work hours.');
      return;
    }

    const storesSnap = await db.collection('storeProfiles').get();
    let sent = 0;

    for (const storeDoc of storesSnap.docs) {
      const storeId = storeDoc.id;
      const customersSnap = await db.collection('customers').where('storeId', '==', storeId).get();

      for (const custDoc of customersSnap.docs) {
        const data = custDoc.data();
        const followUpAt = String(data.nextFollowUpAt || '');
        if (!followUpAt || !dueSoon(followUpAt, now)) continue;

        const reminderKey = `crmVisitReminderSent_${followUpAt.slice(0, 16)}`;
        if (data[reminderKey]) continue;

        const clientName = String(data.name || 'your client');
        const assignedRepId = String(data.assignedRepId || '');
        if (!assignedRepId) continue;

        const recipients = await userIdsForAssignedRep(storeId, assignedRepId);
        const whenLabel = formatVisitTimeLabel(followUpAt);

        for (const recipient of recipients) {
          const { title, body } = buildVisitReminder(recipient.displayName, clientName, whenLabel);
          const ok = await sendPersonalizedPush(recipient.userId, title, body, {
            type: 'crm_visit_reminder',
            customerId: custDoc.id,
            followUpAt,
            storeId,
          });
          if (ok) sent += 1;
        }

        await custDoc.ref.set({ [reminderKey]: now.toISOString() }, { merge: true });
      }
    }

    console.log(`CRM visit reminders sent: ${sent}`);
  },
);
