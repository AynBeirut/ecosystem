/**
 * Finished Goods Sync Utility
 * 
 * Recalculates quantitySold from actual delivered/completed orders
 * Fixes data corruption from deleted orders, voided payments, etc.
 */

import { getFirestore, collection, query, where, getDocs, doc, writeBatch, addDoc } from 'firebase/firestore';
import { isCountedSaleStatus, resolveFinishedGoodsProductKey, resolveOrderItemProductKey } from '@/lib/salesRules';

interface SyncResult {
  success: boolean;
  dryRun: boolean;
  productsUpdated: number;
  backupId?: string;
  changes: Array<{
    productId: string;
    productName: string;
    oldQuantitySold: number;
    newQuantitySold: number;
    difference: number;
  }>;
  errors: string[];
}

interface SyncOptions {
  dryRun?: boolean;
  createBackup?: boolean;
}

export async function syncFinishedGoodsSoldQuantities(
  storeId: string,
  userId: string,
  userName: string,
  options: SyncOptions = {}
): Promise<SyncResult> {
  const db = getFirestore();
  const dryRun = options.dryRun ?? false;
  const createBackup = options.createBackup ?? !dryRun;

  const result: SyncResult = {
    success: false,
    dryRun,
    productsUpdated: 0,
    changes: [],
    errors: [],
  };

  try {
    console.log(`🔄 Starting ${dryRun ? 'DRY RUN' : 'APPLY'} sync of sold quantities...`);

    // Step 1: Get all delivered/completed orders
    const ordersQuery = query(
      collection(db, 'orders'),
      where('storeId', '==', storeId),
    );
    const ordersSnapshot = await getDocs(ordersQuery);

    // Step 2: Calculate actual sold quantities per product
    const actualSoldQuantities = new Map<string, { quantity: number; productName: string }>();

    ordersSnapshot.forEach((orderDoc) => {
      const order = orderDoc.data();
      
      // Count only canonical sale statuses
      if (isCountedSaleStatus(order.status)) {
        order.items?.forEach((item: { productId?: string; composedProductId?: string; productName?: string; quantity?: number }) => {
          const productId = resolveOrderItemProductKey(item);
          if (!productId) return;
          const current = actualSoldQuantities.get(productId) || { quantity: 0, productName: item.productName || 'Unknown' };
          current.quantity += item.quantity || 0;
          actualSoldQuantities.set(productId, current);
        });
      }
    });

    console.log(`📦 Found ${actualSoldQuantities.size} products with sales`);

    // Step 3: Get all finished goods
    const fgQuery = query(
      collection(db, 'finishedGoodsInventory'),
      where('storeId', '==', storeId)
    );
    const fgSnapshot = await getDocs(fgQuery);

    console.log(`🏭 Found ${fgSnapshot.size} finished goods entries`);

    // Step 4: Prepare pending changes
    const pendingChanges: Array<{
      fgDocId: string;
      productId: string;
      productName: string;
      oldQuantitySold: number;
      newQuantitySold: number;
      difference: number;
      oldCurrentBalance: number;
      newCurrentBalance: number;
      oldTotalValue: number;
      newTotalValue: number;
      oldTransactionsLength: number;
    }> = [];

    for (const fgDoc of fgSnapshot.docs) {
      const fgData = fgDoc.data();
      const productId = resolveFinishedGoodsProductKey(fgData);
      
      if (!productId) continue;

      const actualData = actualSoldQuantities.get(productId);
      const actualQuantitySold = actualData?.quantity || 0;
      const currentQuantitySold = fgData.quantitySold || 0;
      const difference = currentQuantitySold - actualQuantitySold;

      // Only update if there's a difference
      if (Math.abs(difference) > 0.001) {
        const newBalance = (fgData.currentBalance || 0) + difference;
        const newTotalValue = newBalance * (fgData.costPrice || 0);

        pendingChanges.push({
          fgDocId: fgDoc.id,
          productId,
          productName: fgData.productName || fgData.name || actualData?.productName || 'Unknown',
          oldQuantitySold: currentQuantitySold,
          newQuantitySold: actualQuantitySold,
          difference,
          oldCurrentBalance: fgData.currentBalance || 0,
          newCurrentBalance: newBalance,
          oldTotalValue: fgData.totalValue || 0,
          newTotalValue: newTotalValue,
          oldTransactionsLength: (fgData.transactions || []).length,
        });

        result.changes.push({
          productId,
          productName: fgData.productName || fgData.name || actualData?.productName || 'Unknown',
          oldQuantitySold: currentQuantitySold,
          newQuantitySold: actualQuantitySold,
          difference,
        });
      }
    }

    if (dryRun) {
      result.productsUpdated = result.changes.length;
      result.success = true;
      console.log(`\n✅ Dry run complete. Pending updates: ${result.productsUpdated}`);
      return result;
    }

    // Step 5: Create backup snapshot before any write
    if (createBackup && pendingChanges.length > 0) {
      const backupRef = await addDoc(collection(db, 'auditLogs'), {
        storeId,
        createdAt: new Date().toISOString(),
        action: 'backup',
        entityType: 'finished_goods_sync',
        entityId: `sync-${new Date().toISOString()}`,
        userId,
        userName,
        reason: 'Safe reconciliation before quantity sync',
        totalChanges: pendingChanges.length,
        snapshot: pendingChanges.map(change => ({
          fgDocId: change.fgDocId,
          productId: change.productId,
          productName: change.productName,
          oldQuantitySold: change.oldQuantitySold,
          oldCurrentBalance: change.oldCurrentBalance,
          oldTotalValue: change.oldTotalValue,
          oldTransactionsLength: change.oldTransactionsLength,
        })),
      });
      result.backupId = backupRef.id;
      console.log(`💾 Backup created: ${backupRef.id}`);
    }

    // Step 6: Apply pending changes in batches
    let batch = writeBatch(db);
    let batchCount = 0;
    const nowIso = new Date().toISOString();

    for (const change of pendingChanges) {
      const fgDocRef = doc(db, 'finishedGoodsInventory', change.fgDocId);
      const fgCurrentSnap = fgSnapshot.docs.find(d => d.id === change.fgDocId);
      const fgCurrentData = fgCurrentSnap?.data() || {};

      batch.update(fgDocRef, {
        quantitySold: change.newQuantitySold,
        currentBalance: change.newCurrentBalance,
        totalValue: change.newTotalValue,
        lastSyncDate: nowIso,
        syncMetadata: {
          previousQuantitySold: change.oldQuantitySold,
          syncedQuantitySold: change.newQuantitySold,
          syncedBy: userId,
          syncedByName: userName,
          syncedAt: nowIso,
        },
        updatedAt: nowIso,
      });

      batchCount++;

      if (batchCount >= 500) {
        await batch.commit();
        console.log(`  ✓ Committed batch of ${batchCount} updates`);
        batch = writeBatch(db);
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
      console.log(`  ✓ Committed final batch of ${batchCount} updates`);
    }

    result.productsUpdated = result.changes.length;
    result.success = true;

    console.log(`\n✅ Sync completed successfully!`);
    console.log(`   Products updated: ${result.productsUpdated}`);
    
    if (result.changes.length > 0) {
      console.log(`\n📊 Changes made:`);
      result.changes.forEach((change) => {
        const sign = change.difference > 0 ? '+' : '';
        console.log(`   ${change.productName}: ${change.oldQuantitySold} → ${change.newQuantitySold} (${sign}${change.difference.toFixed(2)})`);
      });
    } else {
      console.log(`   No discrepancies found - all quantities already correct!`);
    }

    return result;

  } catch (error: unknown) {
    console.error('❌ Sync failed:', error);
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    return result;
  }
}
