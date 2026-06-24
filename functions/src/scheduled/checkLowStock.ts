import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v2/scheduler';
import { getFcmTokensForStoreOwner, sendFcmMulticast } from '../services/fcmTokens';

const db = admin.firestore();

/**
 * Daily scheduled job: check for low-stock products and push alert to each store owner.
 * Runs every day at 09:00 UTC.
 */
export const checkLowStockAlert = functions.onSchedule(
  {
    schedule: 'every day 09:00',
    timeZone: 'UTC',
    memory: '256MiB',
  },
  async (_event) => {
    console.log('📦 Running daily low stock alert check...');

    // Get all products with stock tracking
    const snap = await db.collection('products').where('inStock', '==', true).get();

    // Group low-stock products by storeId
    const byStore: Record<string, Array<{ name: string; stock: number; threshold: number; unit?: string }>> = {};

    snap.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const d = doc.data();
      const stock = Number(d.stock ?? -1);
      const threshold = Number(d.lowStockThreshold ?? 5);
      if (stock < 0 || stock > threshold) return; // not low
      const storeId: string = d.storeId || '';
      if (!storeId) return;
      if (!byStore[storeId]) byStore[storeId] = [];
      byStore[storeId].push({ name: d.name || doc.id, stock, threshold, unit: d.unit });
    });

    const storeIds = Object.keys(byStore);
    if (storeIds.length === 0) {
      console.log('No low stock items found.');
      return;
    }

    // Send FCM to each store owner
    for (const storeId of storeIds) {
      const items = byStore[storeId];
      const tokens = await getFcmTokensForStoreOwner(storeId);
      if (tokens.length === 0) continue;

      const itemList = items.map((i) => `${i.name}: ${i.stock} ${i.unit || 'units'}`).join(', ');
      const title = `⚠️ Low Stock Alert (${items.length} item${items.length > 1 ? 's' : ''})`;
      const body = items.length === 1
        ? `${items[0].name} is low: ${items[0].stock} ${items[0].unit || 'units'} remaining`
        : `${itemList.slice(0, 100)}${itemList.length > 100 ? '…' : ''}`;

      try {
        await sendFcmMulticast(tokens, title, body, { type: 'low_stock', storeId });
        console.log(`Sent low stock alert to store ${storeId} (${items.length} items)`);
      } catch (err) {
        console.warn(`Failed to send low stock alert for store ${storeId}:`, err);
      }
    }
  },
);
