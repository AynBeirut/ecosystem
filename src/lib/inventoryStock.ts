import { collection, getDocs, getFirestore, query, where } from 'firebase/firestore';

export type FinishedGoodsStockMap = Record<string, number>;

export async function loadFinishedGoodsStockMap(storeId: string): Promise<FinishedGoodsStockMap> {
  const snap = await getDocs(
    query(collection(getFirestore(), 'finishedGoodsInventory'), where('storeId', '==', storeId)),
  );
  const map: FinishedGoodsStockMap = {};
  snap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const key = String(data.productId || data.composedProductId || '').trim();
    if (!key) return;
    const balance =
      typeof data.currentBalance === 'number'
        ? data.currentBalance
        : typeof data.currentStock === 'number'
          ? data.currentStock
          : undefined;
    if (balance !== undefined) map[key] = balance;
  });
  return map;
}

export function resolveDisplayStock(
  product: { id: string; productType?: string; stock?: number },
  fgMap: FinishedGoodsStockMap,
): number | undefined {
  if (product.productType === 'service') return undefined;
  if (fgMap[product.id] !== undefined) return fgMap[product.id];
  return typeof product.stock === 'number' ? product.stock : undefined;
}
