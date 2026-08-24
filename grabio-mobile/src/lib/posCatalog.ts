import firestore from '@react-native-firebase/firestore';
import type { Product } from '../types';

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
  const snap = await firestore()
    .collection('products')
    .where('storeId', '==', storeId)
    .get();
  const rows = snap.docs
    .map((d) => mapPosProduct(d.id, d.data() as Record<string, unknown>))
    .filter(Boolean) as Product[];
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}

export function subscribePosProducts(
  storeId: string,
  onData: (products: Product[]) => void,
  onError?: (err: Error) => void,
): () => void {
  return firestore()
    .collection('products')
    .where('storeId', '==', storeId)
    .onSnapshot(
      (snap) => {
        if (!snap) {
          onData([]);
          return;
        }
        const rows = snap.docs
          .map((d) => mapPosProduct(d.id, d.data() as Record<string, unknown>))
          .filter(Boolean) as Product[];
        rows.sort((a, b) => a.name.localeCompare(b.name));
        onData(rows);
      },
      (err) => onError?.(err),
    );
}
