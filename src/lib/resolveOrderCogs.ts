import { collection, getDocs, getFirestore, query, where } from 'firebase/firestore';
import { isPlatformOrderCod, resolveOrderItemProductKey } from '@/lib/salesRules';
import type { OrderCogsLine } from '@/lib/platformGl';

const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

type OrderItemLike = {
  productId?: string;
  composedProductId?: string;
  id?: string;
  quantity?: number;
};

export async function resolveOrderCogsLines(
  storeId: string,
  items: OrderItemLike[],
): Promise<OrderCogsLine[]> {
  const db = getFirestore();
  const fgSnap = await getDocs(query(collection(db, 'finishedGoodsInventory'), where('storeId', '==', storeId)));
  const lines: OrderCogsLine[] = [];

  for (const item of items) {
    const productKey = resolveOrderItemProductKey(item);
    const quantity = round2(Number(item.quantity) || 0);
    if (!productKey || quantity <= 0) continue;

    const fgDoc = fgSnap.docs.find((d) => {
      const data = d.data();
      return data.productId === productKey || data.composedProductId === productKey;
    });

    let unitCost = 0;
    if (fgDoc) {
      unitCost = round2(Number(fgDoc.data().costPrice || 0));
    }

    lines.push({ productKey, quantity, unitCost });
  }

  return lines;
}

export function orderGlInputFromOrder(
  order: {
    id: string;
    storeId: string;
    total?: number;
    paymentMethod?: string;
    paymentStatus?: string;
    amountPaid?: number;
    invoiceNumber?: string;
    createdAt?: unknown;
  },
  cogsLines: OrderCogsLine[],
) {
  const date =
    order.createdAt && typeof order.createdAt === 'object' && 'toDate' in order.createdAt
      ? (order.createdAt as { toDate: () => Date }).toDate().toISOString()
      : new Date().toISOString();

  const isCod = isPlatformOrderCod(order);

  return {
    id: order.id,
    storeId: order.storeId,
    date,
    total: round2(Number(order.total) || 0),
    paymentMethod: order.paymentMethod || 'cash',
    invoiceNumber: order.invoiceNumber || order.id,
    cogsLines,
    isCashSale: !isCod && true,
    isCodDelivery: isCod,
  };
}
