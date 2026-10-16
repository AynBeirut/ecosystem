const EXCLUDED_PRODUCT_TYPES = new Set([
  'raw_material',
  'raw-material',
  'ingredient',
  'material',
  'component',
  'recipe_ingredient',
]);

export function isInventoryOnlyProductData(data: Record<string, unknown> | undefined): boolean {
  if (!data) return false;
  const rawType = String(data.productType ?? data.type ?? data.kind ?? '').trim().toLowerCase();
  const itemType = String(data.itemType ?? '').trim().toLowerCase();
  if (itemType === 'raw_material' || itemType === 'ingredient') return true;
  return EXCLUDED_PRODUCT_TYPES.has(rawType);
}

export function resolveSellableProductType(
  data: Record<string, unknown>,
): 'simple' | 'composed' | 'service' | 'raw_material' {
  const rawType = String(data.productType ?? data.type ?? data.kind ?? '').trim().toLowerCase();
  if (rawType === 'composed') return 'composed';
  if (rawType === 'service') return 'service';
  if (rawType === 'simple') return 'simple';
  if (isInventoryOnlyProductData(data)) return 'raw_material';
  const category = String(data.category || '').trim().toLowerCase();
  if (category === 'services' || category.startsWith('service')) return 'service';
  return 'simple';
}

export function isSellableMenuProduct(data: Record<string, unknown> | undefined): boolean {
  if (!data) return false;
  if (data.vposMenuVisible === false) return false;
  if (data.isSellable === false) return false;
  if (data.excludeFromCatalogCount === true) return false;
  const kind = resolveSellableProductType(data);
  return kind === 'simple' || kind === 'composed' || kind === 'service';
}

export function resolvePosIncomingCatalogKind(
  payload: Record<string, unknown>,
): 'menu' | 'inventory' {
  if (isInventoryOnlyProductData(payload)) return 'inventory';
  const explicit = String(payload.catalogRole || payload.sellable || '').trim().toLowerCase();
  if (explicit === 'inventory' || explicit === 'raw' || explicit === 'material') return 'inventory';
  if (explicit === 'menu' || explicit === 'sellable') return 'menu';
  return 'menu';
}
