import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v2/scheduler';
import { fetchUsdToLbpRateFromApi } from '../lib/money/exchangeRateFetch';

const db = admin.firestore();

/**
 * Refresh USD↔LBP for stores with exchangeRateMode=auto.
 * On failure: keep last good rate, set exchangeRateLastAutoStatus=error.
 */
export const fetchExchangeRates = functions.onSchedule(
  {
    schedule: 'every 6 hours',
    timeZone: 'Asia/Beirut',
    memory: '256MiB',
  },
  async () => {
    const now = new Date().toISOString();
    let rate: number;
    try {
      rate = await fetchUsdToLbpRateFromApi();
      console.log('[fetchExchangeRates] USD→LBP', rate);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Rate fetch failed';
      console.error('[fetchExchangeRates] fetch failed:', message);
      const snap = await db.collection('storeProfiles').where('exchangeRateMode', '==', 'auto').get();
      const batch = db.batch();
      snap.docs.forEach((docSnap: FirebaseFirestore.QueryDocumentSnapshot) => {
        batch.update(docSnap.ref, {
          exchangeRateLastAutoUpdatedAt: now,
          exchangeRateLastAutoStatus: 'error',
          exchangeRateLastAutoMessage: message,
        });
      });
      if (!snap.empty) await batch.commit();
      return;
    }

    const snap = await db.collection('storeProfiles').where('exchangeRateMode', '==', 'auto').get();
    if (snap.empty) {
      console.log('[fetchExchangeRates] no auto-mode stores');
      return;
    }

    const batch = db.batch();
    snap.docs.forEach((docSnap: FirebaseFirestore.QueryDocumentSnapshot) => {
      batch.update(docSnap.ref, {
        customExchangeRate: rate,
        usdToLbpRate: rate,
        exchangeRateLastAutoUpdatedAt: now,
        exchangeRateLastAutoStatus: 'success',
        exchangeRateLastAutoMessage: '',
      });
    });
    await batch.commit();
    console.log(`[fetchExchangeRates] updated ${snap.size} store(s)`);
  },
);
