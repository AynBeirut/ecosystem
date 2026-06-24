import { getApiBaseUrl } from '@/lib/apiBase';

export interface PublicProductStockItem {
  productId: string;
  availableStock: number;
  inStock: boolean;
}

export async function fetchPublicProductStock(
  storeId: string,
  productIds: string[],
): Promise<PublicProductStockItem[]> {
  if (!storeId || productIds.length === 0) return [];

  const res = await fetch(`${getApiBaseUrl()}/public/product-stock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storeId, productIds }),
  });

  const data = (await res.json()) as {
    success?: boolean;
    items?: PublicProductStockItem[];
    error?: string;
  };

  if (!res.ok || !data.success || !Array.isArray(data.items)) {
    throw new Error(data.error || `Stock API failed (${res.status})`);
  }

  return data.items;
}
