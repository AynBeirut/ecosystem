import firestore from '@react-native-firebase/firestore';
import type { Product } from '../types';
import { readCache, writeCache } from './crmDataCache';
import { applyDisplayStock, loadFinishedGoodsStockMap } from './inventoryStock';

export function getProductSalePrice(data: Record<string, unknown>): number {
  const n = Number(data.sellingPrice ?? data.price ?? data.ownerReferencePrice ?? 0);
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function mapPosProduct(id: string, data: Record<string, unknown>): Product | null {
  const price = getProductSalePrice(data);
  if (price <= 0) return null;
  return {
    id,
    name: String(data.name || 'Product'),
    description: data.description ? String(data.description) : undefined,
    price,
    currency: data.currency ? String(data.currency) : 'USD',
    image: data.image ? String(data.image) : undefined,
    imageUrl: data.imageUrl ? String(data.imageUrl) : undefined,
    storeId: String(data.storeId || ''),
    productType: (data.productType as Product['productType']) || 'simple',
    inStock: data.inStock !== false,
    stock: typeof data.stock === 'number' ? data.stock : undefined,
    lowStockThreshold: typeof data.lowStockThreshold === 'number' ? data.lowStockThreshold : undefined,
    unit: data.unit ? String(data.unit) : undefined,
  };
}

/** All sellable store products — matches web V·POS (no inStock filter). */
export async function loadPosProducts(storeId: string): Promise<Product[]> {
  const [snap, fgMap] = await Promise.all([
    firestore().collection('products').where('storeId', '==', storeId).get(),
    loadFinishedGoodsStockMap(storeId),
  ]);
  const rows = snap.docs
    .map((d) => mapPosProduct(d.id, d.data() as Record<string, unknown>))
    .filter(Boolean) as Product[];
  const withStock = applyDisplayStock(rows, fgMap);
  withStock.sort((a, b) => a.name.localeCompare(b.name));
  return withStock;
}

export async function loadPosProductsCached(storeId: string, force = false): Promise<Product[]> {
  const cacheKey = `pos:${storeId}`;
  if (!force) {
    const hit = readCache<Product[]>(cacheKey);
    if (hit) return hit;
  }
  const rows = await loadPosProducts(storeId);
  writeCache(cacheKey, rows);
  return rows;
}

/** One-shot load with 3 min cache — avoids heavy live product listener on POS tab. */
export function subscribePosProducts(
  storeId: string,
  onData: (products: Product[]) => void,
  onError?: (err: Error) => void,
): () => void {
  let cancelled = false;
  void loadPosProductsCached(storeId)
    .then((rows) => {
      if (!cancelled) onData(rows);
    })
    .catch((err) => onError?.(err instanceof Error ? err : new Error(String(err))));

  return () => {
    cancelled = true;
  };
}
