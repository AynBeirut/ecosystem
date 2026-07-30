import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v2/scheduler';
import { postJournalEntry } from '../lib/ledger/postingService';

const db = admin.firestore();

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function nextRunDate(frequency: string, from: string): string {
  const d = new Date(`${from.slice(0, 10)}T12:00:00.000Z`);
  if (frequency === 'monthly') d.setUTCMonth(d.getUTCMonth() + 1);
  else if (frequency === 'quarterly') d.setUTCMonth(d.getUTCMonth() + 3);
  else d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Daily run: post active recurring voucher templates whose nextRunDate <= today.
 */
export const runRecurringVouchers = functions.onSchedule(
  {
    schedule: '0 6 * * *',
    timeZone: 'Asia/Beirut',
    memory: '512MiB',
  },
  async () => {
    const today = todayIso();
    const storesSnap = await db.collection('stores').limit(200).get();
    let posted = 0;

    for (const storeDoc of storesSnap.docs) {
      const storeId = storeDoc.id;
      const templatesSnap = await db
        .collection('stores')
        .doc(storeId)
        .collection('recurringVoucherTemplates')
        .where('isActive', '==', true)
        .get();

      if (templatesSnap.empty) continue;

      const accountsSnap = await db.collection('stores').doc(storeId).collection('ledgerAccounts').get();
      const accountsById = new Map(
        accountsSnap.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => {
          const data = d.data();
          return [d.id, { id: d.id, ...data, isActive: data.isActive !== false }];
        }),
      );

      for (const tplDoc of templatesSnap.docs) {
        const tpl = tplDoc.data();
        const nextRun = String(tpl.nextRunDate || '').slice(0, 10);
        if (!nextRun || nextRun > today) continue;

        try {
          await postJournalEntry(
            {
              storeId,
              date: new Date().toISOString(),
              memo: String(tpl.memo || tpl.name || 'Recurring voucher'),
              sourceType: 'manual',
              sourceId: tplDoc.id,
              event: `recurring-${tpl.frequency || 'monthly'}`,
              createdBy: 'scheduler:runRecurringVouchers',
              voucherType: tpl.voucherType || 'JV',
              lines: Array.isArray(tpl.lines) ? tpl.lines : [],
            },
            accountsById as Map<string, { id: string; code: string; name: string; isActive: boolean }>,
          );
          await tplDoc.ref.set(
            {
              lastRunDate: today,
              nextRunDate: nextRunDate(String(tpl.frequency || 'monthly'), today),
              updatedAt: new Date().toISOString(),
            },
            { merge: true },
          );
          posted += 1;
        } catch (err) {
          console.error(`[runRecurringVouchers] store=${storeId} template=${tplDoc.id}`, err);
        }
      }
    }

    console.log(`[runRecurringVouchers] posted ${posted} template(s) as of ${today}`);
  },
);
