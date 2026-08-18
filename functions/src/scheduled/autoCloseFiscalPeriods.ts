import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v2/scheduler';
import { autoCloseExpiredFiscalQuarters } from '../lib/ledger/periodLock';

const db = admin.firestore();

/**
 * Daily run (Beirut 00:05): auto-close fiscal quarters whose end date has passed.
 * Q1 Jan 1–Mar 30 · Q2 Apr 1–Jun 30 · Q3 Jul 1–Sep 30 · Q4 Oct 1–Dec 30.
 */
export const autoCloseFiscalPeriods = functions.onSchedule(
  {
    schedule: '5 0 * * *',
    timeZone: 'Asia/Beirut',
    memory: '256MiB',
  },
  async () => {
    const storesSnap = await db.collection('storeProfiles').limit(300).get();
    let closedCount = 0;

    for (const storeDoc of storesSnap.docs) {
      const storeId = storeDoc.id;
      try {
        const closed = await autoCloseExpiredFiscalQuarters(storeId, {
          userId: 'system',
          userEmail: 'auto-close@grabio.space',
        });
        closedCount += closed.length;
      } catch (err) {
        console.warn('[autoCloseFiscalPeriods] skipped store', storeId, err);
      }
    }

    console.log(`[autoCloseFiscalPeriods] closed ${closedCount} quarter(s)`);
  },
);
