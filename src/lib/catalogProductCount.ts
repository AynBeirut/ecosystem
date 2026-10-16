import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  runTransaction,
  where,
  type Firestore,
} from 'firebase/firestore';

export const CATALOG_PRODUCT_COUNT_VERSION = 2;

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
  if (data.isSellable === false && EXCLUDED_PRODUCT_TYPES.has(rawType)) return true;
  if (itemType === 'raw_material' || itemType === 'ingredient') return true;
  return EXCLUDED_PRODUCT_TYPES.has(rawType);
}

/** Menu / V·POS / POS catalog — simple, composed, and services only (no ingredients). */
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

export function isCatalogCountableProductData(data: Record<string, unknown> | undefined): boolean {
  return isSellableMenuProduct(data);
}

export async function getCatalogProductCount(db: Firestore, storeId: string): Promise<number> {
  const profileSnap = await getDoc(doc(db, 'storeProfiles', storeId));
  const fromProfile = profileSnap.data()?.catalogProductCount;
  const version = profileSnap.data()?.catalogProductCountVersion;
  if (
    typeof fromProfile === 'number' &&
    Number.isFinite(fromProfile) &&
    version === CATALOG_PRODUCT_COUNT_VERSION
  ) {
    return fromProfile;
  }

  const productsSnap = await getDocs(
    query(collection(db, 'products'), where('storeId', '==', storeId)),
  );
  return productsSnap.docs.filter((productDoc) =>
    isCatalogCountableProductData(productDoc.data() as Record<string, unknown>),
  ).length;
}

export async function bumpCatalogProductCount(
  db: Firestore,
  storeId: string,
  delta: 1 | -1,
): Promise<void> {
  const profileRef = doc(db, 'storeProfiles', storeId);
  await runTransaction(db, async (tx) => {
    const profileSnap = await tx.get(profileRef);
    if (!profileSnap.exists()) {
      throw new Error('Store profile not found');
    }
    tx.update(profileRef, {
      catalogProductCount: increment(delta),
      catalogProductCountVersion: CATALOG_PRODUCT_COUNT_VERSION,
      updatedAt: new Date().toISOString(),
    });
  });
}
