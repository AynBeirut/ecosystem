export const CATALOG_PRODUCT_COUNT_VERSION = 2;

const EXCLUDED_PRODUCT_TYPES = new Set([
  'raw_material',
  'raw-material',
  'ingredient',
  'material',
  'component',
  'recipe_ingredient',
]);

export function isCatalogCountableProductData(data: Record<string, unknown> | undefined): boolean {
  if (!data) return false;

  const rawType = String(data.productType ?? data.type ?? '').trim().toLowerCase();
  const itemType = String(data.itemType ?? '').trim().toLowerCase();

  if (data.isSellable === false) return false;
  if (data.excludeFromCatalogCount === true) return false;
  if (itemType === 'raw_material' || itemType === 'ingredient') return false;
  if (EXCLUDED_PRODUCT_TYPES.has(rawType)) return false;

  return true;
}
