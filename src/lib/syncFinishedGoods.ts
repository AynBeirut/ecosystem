/**
 * Finished Goods Sync Utility
 * 
 * Recalculates quantitySold from actual delivered/completed orders
 * Fixes data corruption from deleted orders, voided payments, etc.
 */

import { getFirestore, collection, query, where, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';

interface SyncResult {
  success: boolean;
  productsUpdated: number;
  changes: Array<{
    productId: string;
    productName: string;
    oldQuantitySold: number;
    newQuantitySold: number;
    difference: number;
  }>;
  errors: string[];
}

export async function syncFinishedGoodsSoldQuantities(storeId: string, userId: string, userName: string): Promise<SyncResult> {
  const db = getFirestore();
  const result: SyncResult = {
    success: false,
    productsUpdated: 0,
    changes: [],
    errors: [],
  };

  try {
    console.log('🔄 Starting sync of sold quantities...');

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
      
      // Only count delivered or completed orders
      if (order.status === 'delivered' || order.status === 'completed') {
        order.items?.forEach((item: { productId?: string; composedProductId?: string; productName?: string; quantity?: number }) => {
          const productId = item.productId;
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

    // Step 4: Update each finished goods entry
    const batch = writeBatch(db);
    let batchCount = 0;

    for (const fgDoc of fgSnapshot.docs) {
      const fgData = fgDoc.data();
      const productId = fgData.productId || fgData.composedProductId;
      
      if (!productId) continue;

      const actualData = actualSoldQuantities.get(productId);
      const actualQuantitySold = actualData?.quantity || 0;
      const currentQuantitySold = fgData.quantitySold || 0;
      const difference = currentQuantitySold - actualQuantitySold;

      // Only update if there's a difference
      if (Math.abs(difference) > 0.001) {
        const newBalance = (fgData.currentBalance || 0) + difference;
        const newTotalValue = newBalance * (fgData.costPrice || 0);

        // Create sync transaction record
        const syncTransaction = {
          id: `TXN-SYNC-${Date.now()}-${productId}`,
          date: new Date().toISOString(),
          actionType: 'adjustment' as const,
          quantity: difference, // Positive = adding back, negative = reducing further
          unitCost: fgData.costPrice || 0,
          totalCost: Math.abs(difference) * (fgData.costPrice || 0),
          reason: `Data sync: Recalculated from orders. Was ${currentQuantitySold}, should be ${actualQuantitySold}`,
          referenceId: 'SYNC',
          referenceNumber: `SYNC-${new Date().toISOString().slice(0, 10)}`,
          userId: userId,
          userName: userName,
        };

        batch.update(doc(db, 'finishedGoodsInventory', fgDoc.id), {
          quantitySold: actualQuantitySold,
          currentBalance: newBalance,
          totalValue: newTotalValue,
          transactions: [...(fgData.transactions || []), syncTransaction],
          lastSyncDate: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        result.changes.push({
          productId,
          productName: fgData.productName || fgData.name || actualData?.productName || 'Unknown',
          oldQuantitySold: currentQuantitySold,
          newQuantitySold: actualQuantitySold,
          difference,
        });

        batchCount++;

        // Firebase batches have a limit of 500 operations
        if (batchCount >= 500) {
          await batch.commit();
          console.log(`  ✓ Committed batch of ${batchCount} updates`);
          batchCount = 0;
        }
      }
    }

    // Commit remaining updates
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
