import * as admin from 'firebase-admin';

const db = admin.firestore();

type OrderItemLike = {
  productId?: string;
  composedProductId?: string;
  id?: string;
  quantity?: number | string;
};

type ProductStockTransactionLike = {
  idempotencyKey?: string;
};

function resolveOrderItemProductKey(item: OrderItemLike): string {
  return (item.productId || item.composedProductId || item.id || '').toString().trim();
}

export async function applyPaidOrderInventoryDeduction(
  orderId: string,
  paymentSource: 'whish' | 'stripe' | 'square' | 'omt' | 'bob' | 'manual' = 'manual'
): Promise<{ updated: number; skippedAlreadyApplied: number; missingMatches: number }> {
  const orderRef = db.collection('orders').doc(orderId);
  const orderSnap = await orderRef.get();

  if (!orderSnap.exists) {
    return { updated: 0, skippedAlreadyApplied: 0, missingMatches: 0 };
  }

  const orderData = orderSnap.data() || {};
  const storeId = typeof orderData.storeId === 'string' ? orderData.storeId : '';
  const items = Array.isArray(orderData.items) ? (orderData.items as OrderItemLike[]) : [];

  if (!storeId || items.length === 0) {
    return { updated: 0, skippedAlreadyApplied: 0, missingMatches: 0 };
  }

  const fgSnapshot = await db.collection('finishedGoodsInventory').where('storeId', '==', storeId).get();

  const nowIso = new Date().toISOString();
  const batch = db.batch();
  let updates = 0;
  let skippedAlreadyApplied = 0;
  let missingMatches = 0;

  for (const item of items) {
    const productKey = resolveOrderItemProductKey(item);
    const qtyRaw = typeof item.quantity === 'number' ? item.quantity : Number(item.quantity || 0);
    const quantity = Number.isFinite(qtyRaw) ? qtyRaw : 0;

    if (!productKey || quantity <= 0) continue;

    const matchingFG = fgSnapshot.empty
      ? undefined
      : fgSnapshot.docs.find((docSnap: FirebaseFirestore.QueryDocumentSnapshot) => {
      const fgData = docSnap.data() || {};
      return fgData.productId === productKey || fgData.composedProductId === productKey;
    });

    const idempotencyKey = `payment-paid:${orderId}:${productKey}`;

    if (!matchingFG) {
      const productRef = db.collection('products').doc(productKey);
      const productSnap = await productRef.get();

      if (!productSnap.exists) {
        missingMatches += 1;
        continue;
      }

      const productData = productSnap.data() || {};
      const productType = typeof productData.productType === 'string' ? productData.productType : '';
      const isSimpleProduct = !productType || productType === 'simple';
      if (!isSimpleProduct) {
        missingMatches += 1;
        continue;
      }

      const stockTransactions = Array.isArray(productData.stockTransactions)
        ? (productData.stockTransactions as ProductStockTransactionLike[])
        : [];
      const alreadyAppliedSimple = stockTransactions.some((tx) => tx?.idempotencyKey === idempotencyKey);
      if (alreadyAppliedSimple) {
        skippedAlreadyApplied += 1;
        continue;
      }

      const currentStock = Number(productData.stock || 0);
      const safeCurrentStock = Number.isFinite(currentStock) ? currentStock : 0;
      const newStock = Math.max(0, safeCurrentStock - quantity);

      const stockTransaction = {
        id: `SIMPLE-TXN-PAID-${Date.now()}-${productKey}`,
        date: nowIso,
        actionType: 'sold',
        quantity: -quantity,
        reason: `Online payment confirmed: Order ${orderData.invoiceNumber || orderId}`,
        referenceId: orderId,
        referenceNumber: orderData.invoiceNumber || orderId,
        userId: 'system',
        userName: 'System',
        idempotencyKey,
      };

      batch.update(productRef, {
        stock: newStock,
        inStock: newStock > 0,
        stockTransactions: [...stockTransactions, stockTransaction],
        updatedAt: nowIso,
      });

      updates += 1;
      continue;
    }

    const fgData = matchingFG.data() || {};
    const transactions = Array.isArray(fgData.transactions) ? fgData.transactions : [];
    const alreadyApplied = transactions.some((tx: any) => tx?.idempotencyKey === idempotencyKey);

    if (alreadyApplied) {
      skippedAlreadyApplied += 1;
      continue;
    }

    const currentBalance = Number(fgData.currentBalance || 0);
    const quantitySold = Number(fgData.quantitySold || 0);
    const costPrice = Number(fgData.costPrice || 0);
    const newBalance = Math.max(0, currentBalance - quantity);
    const newQuantitySold = quantitySold + quantity;
    const newTotalValue = newBalance * costPrice;

    const saleTransaction = {
      id: `TXN-PAID-${Date.now()}-${productKey}`,
      date: nowIso,
      actionType: 'sold',
      quantity: -quantity,
      unitCost: costPrice,
      totalCost: costPrice * quantity,
      reason: `Online payment confirmed: Order ${orderData.invoiceNumber || orderId}`,
      referenceId: orderId,
      referenceNumber: orderData.invoiceNumber || orderId,
      userId: 'system',
      userName: 'System',
      idempotencyKey,
    };

    batch.update(matchingFG.ref, {
      currentBalance: newBalance,
      quantitySold: newQuantitySold,
      totalValue: newTotalValue,
      transactions: [...transactions, saleTransaction],
      updatedAt: nowIso,
    });

    updates += 1;
  }

  if (updates > 0) {
    await batch.commit();
  }

  if (updates > 0 || skippedAlreadyApplied > 0) {
    await orderRef.update({
      inventoryDeductedAt: nowIso,
      inventoryDeductionSource: paymentSource,
      updatedAt: nowIso,
    });
  }

  return { updated: updates, skippedAlreadyApplied, missingMatches };
}
