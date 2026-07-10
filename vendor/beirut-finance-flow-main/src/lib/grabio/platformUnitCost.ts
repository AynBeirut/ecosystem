import type { Product } from '@/context/AppContext';

/** productId → weighted-average unit cost from finishedGoodsInventory */
export type PlatformUnitCostMap = Record<string, number>;

export function buildFinishedGoodsCostMap(
  docs: Array<{ data: Record<string, unknown> }>,
): PlatformUnitCostMap {
  const map: PlatformUnitCostMap = {};
  for (const { data } of docs) {
    const productId = String(data.productId || data.composedProductId || '');
    const cost = Number(data.costPrice ?? 0);
    if (!productId || !Number.isFinite(cost) || cost <= 0) continue;
    map[productId] = cost;
  }
  return map;
}

/**
 * Matches platform AdminRevenue: FG weighted avg wins over products.costPrice,
 * then serviceCost for service lines.
 */
export function resolvePlatformUnitCost(
  productId: string | undefined,
  product: Pick<Product, 'rawPrice' | 'type' | 'serviceCost'> | undefined,
  fgCostMap: PlatformUnitCostMap,
): number {
  if (!productId) return 0;
  const fgCost = fgCostMap[productId] ?? 0;
  const productCost = product?.rawPrice ?? 0;
  const serviceCost = product?.serviceCost ?? 0;
  return Math.max(0, fgCost || productCost || serviceCost);
}

/** Overlay FG costs onto finance product rawPrice at load time. */
export function overlayPlatformCostsOnProducts(
  products: Product[],
  fgCostMap: PlatformUnitCostMap,
): Product[] {
  return products.map((p) => {
    const platformCost = resolvePlatformUnitCost(p.id, p, fgCostMap);
    if (platformCost > 0 && platformCost !== p.rawPrice) {
      return { ...p, rawPrice: platformCost };
    }
    return p;
  });
}

/** Display / valuation: prefer overlaid platform cost, fall back to composed BOM sum. */
export function resolveDisplayUnitCost(
  product: Product,
  calculateComposedFallback?: (p: Product) => number,
): number {
  if (product.rawPrice && product.rawPrice > 0) return product.rawPrice;
  if (product.type === 'composed' && calculateComposedFallback) {
    return calculateComposedFallback(product);
  }
  return product.rawPrice || product.serviceCost || 0;
}
