import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { CATALOG_PRODUCT_COUNT_VERSION, isCatalogCountableProductData } from '../lib/catalogProductCount';

const db = admin.firestore();

async function recountStoreCatalogProducts(storeId: string): Promise<void> {
  const normalized = String(storeId || '').trim();
  if (!normalized) return;

  const snap = await db.collection('products').where('storeId', '==', normalized).get();
  const count = snap.docs.filter((doc: FirebaseFirestore.QueryDocumentSnapshot) =>
    isCatalogCountableProductData(doc.data() as Record<string, unknown>),
  ).length;
  await db.collection('storeProfiles').doc(normalized).set(
    {
      catalogProductCount: count,
      catalogProductCountVersion: CATALOG_PRODUCT_COUNT_VERSION,
      catalogProductCountSyncedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

export const onCatalogProductWritten = onDocumentWritten(
  { document: 'products/{productId}', region: 'us-central1' },
  async (event) => {
    const before = event.data?.before?.data() as { storeId?: string } | undefined;
    const after = event.data?.after?.data() as { storeId?: string } | undefined;
    const storeIds = new Set<string>();
    if (before?.storeId) storeIds.add(String(before.storeId));
    if (after?.storeId) storeIds.add(String(after.storeId));
    await Promise.all([...storeIds].map((storeId) => recountStoreCatalogProducts(storeId)));
  },
);
