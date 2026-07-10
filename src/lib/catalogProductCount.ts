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

export async function getCatalogProductCount(db: Firestore, storeId: string): Promise<number> {
  const profileSnap = await getDoc(doc(db, 'storeProfiles', storeId));
  const fromProfile = profileSnap.data()?.catalogProductCount;
  if (typeof fromProfile === 'number' && Number.isFinite(fromProfile)) {
    return fromProfile;
  }

  const productsSnap = await getDocs(
    query(collection(db, 'products'), where('storeId', '==', storeId)),
  );
  return productsSnap.size;
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
      updatedAt: new Date().toISOString(),
    });
  });
}
