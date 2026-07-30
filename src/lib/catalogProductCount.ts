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
