import firestore from '@react-native-firebase/firestore';
import type { Product } from '../types';

/** productId → on-hand qty from finishedGoodsInventory (matches web AdminProducts). */
export type FinishedGoodsStockMap = Record<string, number>;

export async function loadFinishedGoodsStockMap(storeId: string): Promise<FinishedGoodsStockMap> {
  const snap = await firestore()
    .collection('finishedGoodsInventory')
    .where('storeId', '==', storeId)
    .get();
  const map: FinishedGoodsStockMap = {};
  snap.docs.forEach((doc) => {
    const data = doc.data();
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

/** Same rule as web: finished goods balance wins, else products.stock. */
export function resolveDisplayStock(
  product: Pick<Product, 'id' | 'productType' | 'stock'>,
  fgMap: FinishedGoodsStockMap,
): number | undefined {
  if (product.productType === 'service') return undefined;
  if (fgMap[product.id] !== undefined) return fgMap[product.id];
  return typeof product.stock === 'number' ? product.stock : undefined;
}

export function applyDisplayStock<T extends Product>(products: T[], fgMap: FinishedGoodsStockMap): T[] {
  return products.map((product) => {
    const stock = resolveDisplayStock(product, fgMap);
    return stock !== undefined ? { ...product, stock } : product;
  });
}
