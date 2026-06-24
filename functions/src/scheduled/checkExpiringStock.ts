import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v2/scheduler';
import { sendExpiryAlertEmail } from '../services/emailService';
import { getFcmTokensForStoreOwner, sendFcmMulticast } from '../services/fcmTokens';

const db = admin.firestore();

interface ExpiryItem {
  name: string;
  type: string;
  expiryDate: string;
  daysLeft: number;
  docRef: FirebaseFirestore.DocumentReference;
}

function getDaysUntilExpiry(expiryDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  return Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Returns today's ISO date string (YYYY-MM-DD) used for deduplication.
 */
function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Scan a Firestore collection snapshot and return expiry items for a given storeId.
 * Skips items already notified today (expiryNotifiedAt === today).
 */
function collectExpiringItems(
  snap: FirebaseFirestore.QuerySnapshot,
  storeId: string,
  typeName: string,
  nameField: string,
  today: string
): ExpiryItem[] {
  const items: ExpiryItem[] = [];
  snap.forEach(docSnap => {
    const d = docSnap.data();
    if (d.storeId !== storeId) return;
    if (!d.expiryTracking || !d.expiryDate) return;
    if (d.expiryNotifiedAt === today) return; // already notified today

    const daysLeft = getDaysUntilExpiry(d.expiryDate as string);
    const threshold = (d.expiryAlertDays as number) ?? 30;
    if (daysLeft <= threshold) {
      items.push({
        name: (d[nameField] as string) || docSnap.id,
        type: typeName,
        expiryDate: d.expiryDate as string,
        daysLeft,
        docRef: db.collection(docSnap.ref.parent.id).doc(docSnap.id),
      });
    }
  });
  return items;
}

export const checkExpiringStock = functions.onSchedule(
  {
    schedule: 'every day 08:00',
    timeZone: 'UTC',
    memory: '256MiB',
  },
  async (_event) => {
    console.log('🔍 Starting expiry stock check...');
    const today = todayISODate();

    try {
      // Fetch all relevant collections in parallel
      const [rawSnap, simpleSnap, composedSnap, fgSnap, storesSnap] = await Promise.all([
        db.collection('rawMaterials').where('expiryTracking', '==', true).get(),
        db.collection('products').where('productType', '==', 'simple').where('expiryTracking', '==', true).get(),
        db.collection('products').where('productType', '==', 'composed').where('expiryTracking', '==', true).get(),
        db.collection('finishedGoodsInventory').where('expiryTracking', '==', true).get(),
        db.collection('storeProfiles').get(),
      ]);

      // Build a map of storeId → { storeName, ownerEmail }
      const storeMap: Record<string, { name: string; email: string }> = {};
      for (const storeDoc of storesSnap.docs) {
        const d = storeDoc.data();
        if (d.ownerEmail || d.email) {
          storeMap[storeDoc.id] = {
            name: d.name || storeDoc.id,
            email: d.ownerEmail || d.email || '',
          };
        }
      }

      // Also look up store owner emails from users collection if not on store profile
      const usersSnap = await db.collection('users').get();
      const userMap: Record<string, { email: string; storeId: string }> = {};
      usersSnap.forEach((u: any) => {
        const d = u.data();
        if (d.storeId && d.email) userMap[d.storeId] = { email: d.email, storeId: d.storeId };
      });
      // Merge: prefer storeMap email, fall back to userMap
      for (const [storeId, info] of Object.entries(storeMap)) {
        if (!info.email && userMap[storeId]) info.email = userMap[storeId].email;
      }
      // For stores only in userMap
      for (const [storeId, uEntry] of Object.entries(userMap)) {
        if (!storeMap[storeId]) storeMap[storeId] = { name: storeId, email: uEntry.email };
      }

      // Group expiring items by storeId
      const byStore: Record<string, ExpiryItem[]> = {};
      const addItems = (items: ExpiryItem[], targetStoreId: string) => {
        if (!byStore[targetStoreId]) byStore[targetStoreId] = [];
        byStore[targetStoreId].push(...items);
      };

      // Scan each collection per store
      const allStoreIds = new Set<string>();
      [rawSnap, simpleSnap, composedSnap, fgSnap].forEach(snap =>
        snap.forEach((d: any) => allStoreIds.add(d.data().storeId))
      );

      for (const storeId of allStoreIds) {
        addItems(collectExpiringItems(rawSnap, storeId, 'Raw Material', 'name', today), storeId);
        addItems(collectExpiringItems(simpleSnap, storeId, 'Product', 'name', today), storeId);
        addItems(collectExpiringItems(composedSnap, storeId, 'Composed Product', 'name', today), storeId);
        addItems(collectExpiringItems(fgSnap, storeId, 'Finished Good', 'productName', today), storeId);
      }

      let emailsSent = 0;

      for (const [storeId, items] of Object.entries(byStore)) {
        if (items.length === 0) continue;

        const store = storeMap[storeId];
        if (!store?.email) {
          console.warn(`No email found for store ${storeId}, skipping.`);
          continue;
        }

        // Send email
        await sendExpiryAlertEmail(
          store.email,
          store.name,
          items.map(i => ({ name: i.name, type: i.type, expiryDate: i.expiryDate, daysLeft: i.daysLeft }))
        );
        emailsSent++;

        // Also send FCM push notifications to store owner's tokens
        try {
          const tokens = await getFcmTokensForStoreOwner(storeId);
          if (tokens.length > 0) {
            const expiredCount = items.filter(i => i.daysLeft < 0).length;
            const soonCount = items.filter(i => i.daysLeft >= 0).length;
            await sendFcmMulticast(
              tokens,
              'Stock Expiry Alert',
              `${expiredCount} expired, ${soonCount} expiring soon in ${store.name}`,
              { storeId, type: 'expiry_alert' },
            );
          }
        } catch (fcmError) {
          console.warn(`FCM push failed for store ${storeId}:`, fcmError);
        }

        // Mark items as notified today (deduplication)
        const batch = db.batch();
        for (const item of items) {
          batch.update(item.docRef, { expiryNotifiedAt: today });
        }
        await batch.commit();
      }

      console.log(`✅ Expiry check done. Emails sent: ${emailsSent}`);

      // ── Low stock check ──────────────────────────────────────────────────────
      // Send FCM push if a simple product's stock is at or below its lowStockThreshold (default 5)
      try {
        const lowStockSnap = await db.collection('products')
          .where('productType', '==', 'simple')
          .where('inStock', '==', true)
          .get();

        const lowByStore: Record<string, string[]> = {};
        lowStockSnap.forEach((docSnap: FirebaseFirestore.QueryDocumentSnapshot) => {
          const d = docSnap.data();
          const stock: number = d.stock ?? 0;
          const threshold: number = d.lowStockThreshold ?? 5;
          if (stock <= threshold && d.storeId) {
            if (!lowByStore[d.storeId]) lowByStore[d.storeId] = [];
            lowByStore[d.storeId].push(d.name as string || docSnap.id);
          }
        });

        for (const [storeId, productNames] of Object.entries(lowByStore)) {
          const tokens = await getFcmTokensForStoreOwner(storeId);
          if (tokens.length === 0) continue;
          await sendFcmMulticast(
            tokens,
            '📦 Low Stock Alert',
            `${productNames.length} product${productNames.length > 1 ? 's are' : ' is'} running low`,
            { storeId, type: 'low_stock', products: productNames.slice(0, 5).join(',') },
          );
        }
      } catch (lowStockErr) {
        console.warn('Low stock FCM check failed:', lowStockErr);
      }
      // ────────────────────────────────────────────────────────────────────────
    } catch (error) {
      console.error('❌ Expiry stock check failed:', error);
    }
  }
);
