import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth } from '@/lib/firebase';
import { generateSlug } from '@/lib/slugify';
import { getApiBaseUrl } from '@/lib/apiBase';
import { mergeBrandingIntoStoreProfile } from '@/lib/builderBrandingTransfer';
import { BUILDER_MAX_DEMO_SLOTS } from '@/lib/builderConstants';
import type {
  BuilderAccount,
  BuilderBusinessType,
  BuilderDemoBranding,
  BuilderDemoProduct,
  BuilderDemoStore,
  BuilderTransferResult,
  DemoStoreStatus,
} from '@/types/builder';

const db = getFirestore();

function nowIso(): string {
  return new Date().toISOString();
}

function isActiveDemoStatus(status: DemoStoreStatus | undefined): boolean {
  return status !== 'deleted' && status !== 'converted';
}

export async function getBuilderAccount(builderUid: string): Promise<BuilderAccount | null> {
  const snap = await getDoc(doc(db, 'builders', builderUid));
  return snap.exists() ? (snap.data() as BuilderAccount) : null;
}

export async function createBuilderAccount(
  builderUid: string,
  businessType: BuilderBusinessType,
): Promise<BuilderAccount> {
  const ref = doc(db, 'builders', builderUid);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    return existing.data() as BuilderAccount;
  }

  const timestamp = nowIso();
  const account: BuilderAccount = {
    businessType,
    demoSlotCount: BUILDER_MAX_DEMO_SLOTS,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await setDoc(ref, account);
  return account;
}

export async function listDemoStores(builderUid: string): Promise<BuilderDemoStore[]> {
  const snap = await getDocs(collection(db, 'builders', builderUid, 'demoStores'));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<BuilderDemoStore, 'id'>) }))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function countActiveDemoStores(builderUid: string): Promise<number> {
  const demos = await listDemoStores(builderUid);
  return demos.filter((d) => isActiveDemoStatus(d.status)).length;
}

export async function createDemoStore(builderUid: string, name: string): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Demo store name is required');
  }

  const activeCount = await countActiveDemoStores(builderUid);
  if (activeCount >= BUILDER_MAX_DEMO_SLOTS) {
    throw new Error(`Demo limit reached (${BUILDER_MAX_DEMO_SLOTS} active slots)`);
  }

  const demoRef = doc(collection(db, 'builders', builderUid, 'demoStores'));
  const timestamp = nowIso();
  const slug = generateSlug(trimmed);

  await setDoc(demoRef, {
    name: trimmed,
    status: 'draft',
    previewTokenHash: '',
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  await setDoc(doc(db, 'builders', builderUid, 'demoStores', demoRef.id, 'profile', 'branding'), {
    name: trimmed,
    slug,
    template: 'modern',
    description: '',
    slogan: '',
  } satisfies BuilderDemoBranding);

  return demoRef.id;
}

export async function getDemoBranding(
  builderUid: string,
  demoId: string,
): Promise<BuilderDemoBranding | null> {
  const snap = await getDoc(
    doc(db, 'builders', builderUid, 'demoStores', demoId, 'profile', 'branding'),
  );
  return snap.exists() ? (snap.data() as BuilderDemoBranding) : null;
}

export async function updateDemoBranding(
  builderUid: string,
  demoId: string,
  patch: Partial<BuilderDemoBranding>,
): Promise<void> {
  const ref = doc(db, 'builders', builderUid, 'demoStores', demoId, 'profile', 'branding');
  const existing = await getDoc(ref);
  const name = patch.name?.trim();
  const next: BuilderDemoBranding = {
    name: name || existing.data()?.name || 'Demo Store',
    slug: patch.slug?.trim() || (name ? generateSlug(name) : existing.data()?.slug || 'demo-store'),
    template: patch.template || existing.data()?.template || 'default',
    description: patch.description ?? existing.data()?.description ?? '',
    slogan: patch.slogan ?? existing.data()?.slogan ?? '',
    logo: patch.logo ?? existing.data()?.logo ?? '',
  };
  await setDoc(ref, next, { merge: true });
  await updateDoc(doc(db, 'builders', builderUid, 'demoStores', demoId), {
    name: next.name,
    updatedAt: nowIso(),
  });
}

export async function listDemoProducts(
  builderUid: string,
  demoId: string,
): Promise<BuilderDemoProduct[]> {
  const snap = await getDocs(
    collection(db, 'builders', builderUid, 'demoStores', demoId, 'products'),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BuilderDemoProduct, 'id'>) }));
}

export async function addDemoProduct(
  builderUid: string,
  demoId: string,
  input: { name: string; price: number; description?: string },
): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new Error('Product name is required');

  const productRef = doc(
    collection(db, 'builders', builderUid, 'demoStores', demoId, 'products'),
  );
  await setDoc(productRef, {
    name,
    description: input.description?.trim() || '',
    price: Number(input.price) || 0,
    image: '',
    category: 'General',
    createdAt: nowIso(),
  });
  await updateDoc(doc(db, 'builders', builderUid, 'demoStores', demoId), {
    updatedAt: nowIso(),
  });
  return productRef.id;
}

async function resolveTargetStoreId(clientUid: string): Promise<string> {
  const legacyRef = doc(db, 'storeProfiles', clientUid);
  const legacySnap = await getDoc(legacyRef);
  if (!legacySnap.exists()) {
    return clientUid;
  }
  return crypto.randomUUID();
}

/** Self-transfer: builder moves demo into their own real store (client SDK). */
export async function transferDemoToOwnStore(
  builderUid: string,
  demoId: string,
  clientUid: string,
  clientEmail: string,
): Promise<BuilderTransferResult> {
  if (builderUid !== clientUid) {
    throw new Error('Self-transfer requires the client UID to match your account. Use admin transfer for other clients.');
  }

  const demoRef = doc(db, 'builders', builderUid, 'demoStores', demoId);
  const demoSnap = await getDoc(demoRef);
  if (!demoSnap.exists()) {
    throw new Error('Demo store not found');
  }
  const demo = demoSnap.data() as BuilderDemoStore;
  if (demo.status === 'converted') {
    throw new Error('Demo already transferred');
  }

  const brandingSnap = await getDoc(
    doc(db, 'builders', builderUid, 'demoStores', demoId, 'profile', 'branding'),
  );
  const branding = brandingSnap.exists() ? (brandingSnap.data() as Record<string, unknown>) : {};
  if (!branding?.name && !demo.name) {
    throw new Error('Demo branding is missing');
  }

  const demoProducts = await listDemoProducts(builderUid, demoId);
  const storeId = await resolveTargetStoreId(clientUid);
  const timestamp = nowIso();

  const storePayload = mergeBrandingIntoStoreProfile(branding, {
    id: storeId,
    storeId,
    ownerId: clientUid,
    email: clientEmail,
    name: String(branding.name || demo.name),
    slug: String(branding.slug || generateSlug(String(branding.name || demo.name))),
    isDemo: false,
    subscriptionStatus: 'trial',
    subscriptionTier: 'trial',
    isTrialUser: true,
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp,
    transferredFromDemoId: demoId,
    transferredFromBuilderUid: builderUid,
  });

  const batch = writeBatch(db);
  batch.set(doc(db, 'storeProfiles', storeId), storePayload);

  const userRef = doc(db, 'users', clientUid);
  const userSnap = await getDoc(userRef);
  const ownedStoreIds = userSnap.exists()
    ? [...new Set([...(userSnap.data()?.ownedStoreIds || []), storeId])]
    : [storeId];

  batch.set(
    userRef,
    {
      ownedStoreIds,
      primaryStoreId: userSnap.data()?.primaryStoreId || storeId,
      activeStoreId: storeId,
      role: 'admin',
      updatedAt: timestamp,
    },
    { merge: true },
  );

  batch.set(
    doc(db, 'sellers', clientUid),
    {
      isSeller: true,
      role: 'admin',
      userId: clientUid,
      storeId,
      sellerSince: timestamp,
      updatedAt: timestamp,
    },
    { merge: true },
  );

  batch.update(demoRef, {
    status: 'converted',
    transferredStoreId: storeId,
    convertedAt: timestamp,
    updatedAt: timestamp,
  });

  await batch.commit();

  if (demoProducts.length > 0) {
    const productBatch = writeBatch(db);
    demoProducts.forEach((p) => {
      const productRef = doc(collection(db, 'products'));
      productBatch.set(productRef, {
        name: p.name,
        description: p.description || '',
        price: Number(p.price) || 0,
        image: p.image || '',
        category: p.category || 'General',
        storeId,
        inStock: true,
        stock: 10,
        deliveryTime: '1-3 days',
        productType: 'simple',
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    });
    await productBatch.commit();
  }

  return { storeId, productCount: demoProducts.length };
}

/** Transfer demo to any client UID — uses Cloud Function (Admin SDK). */
export async function transferDemoToClientStore(
  builderUid: string,
  demoId: string,
  clientUid: string,
): Promise<BuilderTransferResult> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error('Sign in required');
  }

  const resp = await fetch(`${getApiBaseUrl()}/builder/transfer-demo`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ builderUid, demoId, clientUid }),
  });

  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(body.error || `Transfer failed (${resp.status})`);
  }

  return {
    storeId: body.storeId,
    productCount: body.productCount ?? 0,
  };
}

export async function transferDemoStore(
  builderUid: string,
  demoId: string,
  clientUid: string,
  clientEmail: string,
): Promise<BuilderTransferResult> {
  if (builderUid === clientUid) {
    return transferDemoToOwnStore(builderUid, demoId, clientUid, clientEmail);
  }
  return transferDemoToClientStore(builderUid, demoId, clientUid);
}
