import * as admin from 'firebase-admin';

function getDb() {
  return admin.firestore();
}

type OrderItemLike = {
  productId?: string;
  composedProductId?: string;
  id?: string;
  quantity?: number | string;
};

function resolveOrderItemProductKey(item: OrderItemLike): string {
  return (item.productId || item.composedProductId || item.id || '').toString().trim();
}

const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export type ResolvedCogsLine = {
  productKey: string;
  quantity: number;
  unitCost: number;
};

/** Resolve FG weighted-average cost at deduction time (same as inventory subledger). */
export async function resolveOrderCogsLines(
  storeId: string,
  items: OrderItemLike[],
): Promise<ResolvedCogsLine[]> {
  const fgSnap = await getDb().collection('finishedGoodsInventory').where('storeId', '==', storeId).get();
  const lines: ResolvedCogsLine[] = [];

  for (const item of items) {
    const productKey = resolveOrderItemProductKey(item);
    const qtyRaw = typeof item.quantity === 'number' ? item.quantity : Number(item.quantity || 0);
    const quantity = Number.isFinite(qtyRaw) ? qtyRaw : 0;
    if (!productKey || quantity <= 0) continue;

    const fgDoc = fgSnap.docs.find((d: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = d.data() || {};
      return data.productId === productKey || data.composedProductId === productKey;
    });

    let unitCost = 0;
    if (fgDoc) {
      unitCost = round2(Number(fgDoc.data()?.costPrice || 0));
    } else {
      const prodSnap = await getDb().collection('products').doc(productKey).get();
      unitCost = round2(Number(prodSnap.data()?.costPrice || 0));
    }

    lines.push({ productKey, quantity, unitCost });
  }

  return lines;
}

export function orderDateFromData(orderData: Record<string, unknown>): string {
  const raw = orderData.createdAt;
  if (raw && typeof raw === 'object' && 'toDate' in raw && typeof (raw as { toDate: () => Date }).toDate === 'function') {
    return (raw as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof raw === 'string' && raw) return raw;
  return new Date().toISOString();
}

export function orderTotalFromData(orderData: Record<string, unknown>): number {
  return round2(Number(orderData.total || orderData.amountPaid || 0));
}
