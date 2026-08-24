import { collection, doc, getDoc, getDocs, getFirestore, limit, query, where } from 'firebase/firestore';
import type { RawMaterial, Supplier } from '@/types/inventory';
import {
  markStoreNotTrial,
  vOpsCacheGet,
  vOpsCacheKey,
  vOpsCacheSet,
} from '@/lib/vOpsCache';

export type VPosProductLite = {
  id: string;
  name: string;
  category?: string;
  price: number;
  dataStatus?: string;
};

export type VMaterialLite = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  costPerUnit: number;
};

export type VSupplierLite = {
  id: string;
  name: string;
};

function salePrice(data: Record<string, unknown>): number {
  const n = Number(data.sellingPrice ?? data.price ?? data.ownerReferencePrice ?? 0);
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function mapProduct(id: string, data: Record<string, unknown>): VPosProductLite | null {
  if (data.vposMenuVisible === false) return null;
  const price = salePrice(data);
  if (price <= 0) return null;
  return {
    id,
    name: String(data.name || 'Product'),
    category: data.category ? String(data.category) : undefined,
    price,
    dataStatus: data.catalogDataStatus ? String(data.catalogDataStatus) : undefined,
  };
}

export async function loadVPosProducts(
  storeId: string,
  opts?: { force?: boolean },
): Promise<VPosProductLite[]> {
  const key = vOpsCacheKey('products', storeId);
  if (!opts?.force) {
    const cached = vOpsCacheGet<VPosProductLite[]>(key);
    if (cached) return cached;
  }

  const db = getFirestore();
  const snap = await getDocs(query(collection(db, 'products'), where('storeId', '==', storeId)));
  const rows = snap.docs
    .map((d) => mapProduct(d.id, d.data() as Record<string, unknown>))
    .filter(Boolean) as VPosProductLite[];
  rows.sort((a, b) => a.name.localeCompare(b.name));
  vOpsCacheSet(key, rows);
  return rows;
}

export async function loadVMaterials(
  storeId: string,
  opts?: { force?: boolean },
): Promise<VMaterialLite[]> {
  const key = vOpsCacheKey('materials', storeId);
  if (!opts?.force) {
    const cached = vOpsCacheGet<VMaterialLite[]>(key);
    if (cached) return cached;
  }

  const db = getFirestore();
  const snap = await getDocs(query(collection(db, 'rawMaterials'), where('storeId', '==', storeId)));
  const rows = snap.docs.map((d) => {
    const data = d.data() as Partial<RawMaterial>;
    return {
      id: d.id,
      name: String(data.name || 'Material'),
      sku: String(data.sku || ''),
      unit: String(data.unit || 'piece'),
      costPerUnit: Number(data.costPerUnit || 0),
    };
  });
  rows.sort((a, b) => a.name.localeCompare(b.name));
  vOpsCacheSet(key, rows);
  return rows;
}

export async function loadVSuppliers(
  storeId: string,
  opts?: { force?: boolean },
): Promise<VSupplierLite[]> {
  const key = vOpsCacheKey('suppliers', storeId);
  if (!opts?.force) {
    const cached = vOpsCacheGet<VSupplierLite[]>(key);
    if (cached) return cached;
  }

  const db = getFirestore();
  const snap = await getDocs(query(collection(db, 'suppliers'), where('storeId', '==', storeId)));
  const rows = snap.docs.map((d) => {
    const data = d.data() as Partial<Supplier>;
    return { id: d.id, name: String(data.name || 'Supplier') };
  });
  rows.sort((a, b) => a.name.localeCompare(b.name));
  vOpsCacheSet(key, rows);
  return rows;
}

export type VCustomerLite = {
  id: string;
  name: string;
  phone: string;
};

function digitsOnly(value: string): string {
  return String(value || '').replace(/\D/g, '');
}

export function phonesMatch(a: string, b: string): boolean {
  const da = digitsOnly(a);
  const db = digitsOnly(b);
  if (!da || !db) return false;
  if (da === db) return true;
  const short = da.length >= 8 ? da.slice(-8) : da;
  const other = db.length >= 8 ? db.slice(-8) : db;
  return short.length >= 7 && short === other;
}

export async function loadVCustomers(
  storeId: string,
  opts?: { force?: boolean },
): Promise<VCustomerLite[]> {
  const key = vOpsCacheKey('customers', storeId);
  if (!opts?.force) {
    const cached = vOpsCacheGet<VCustomerLite[]>(key);
    if (cached) return cached;
  }

  const db = getFirestore();
  const snap = await getDocs(query(collection(db, 'customers'), where('storeId', '==', storeId)));
  const rows = snap.docs
    .map((d) => {
      const data = d.data() as { name?: string; phone?: string };
      const name = String(data.name || '').trim();
      if (!name || name.toLowerCase() === 'walk-in') return null;
      return {
        id: d.id,
        name,
        phone: String(data.phone || '').trim(),
      };
    })
    .filter(Boolean) as VCustomerLite[];
  rows.sort((a, b) => a.name.localeCompare(b.name));
  vOpsCacheSet(key, rows);
  return rows;
}

export function findVCustomerByPhone(customers: VCustomerLite[], phone: string): VCustomerLite | null {
  const q = digitsOnly(phone);
  if (q.length < 7) return null;
  return customers.find((c) => phonesMatch(c.phone, phone)) || null;
}

export function findVCustomersByName(customers: VCustomerLite[], name: string, limit = 6): VCustomerLite[] {
  const q = name.trim().toLowerCase();
  if (q.length < 2) return [];
  return customers.filter((c) => c.name.toLowerCase().includes(q)).slice(0, limit);
}

async function warmNotTrialFlag(storeId: string): Promise<void> {
  if (vOpsCacheGet(vOpsCacheKey('notTrial', storeId))) return;
  const snap = await getDoc(doc(getFirestore(), 'storeProfiles', storeId));
  const tier = String(snap.data()?.subscriptionTier || '');
  if (tier && tier !== 'trial') markStoreNotTrial(storeId);
}

/** Warm caches while Daily Ops is visible. Non-blocking. */
export function preloadVOpsCatalogs(storeId: string): void {
  if (!storeId) return;
  void loadVPosProducts(storeId).catch(() => undefined);
  void loadVMaterials(storeId).catch(() => undefined);
  void loadVSuppliers(storeId).catch(() => undefined);
  void loadVCustomers(storeId).catch(() => undefined);
  void resolveCachedWalkInCustomer(storeId).catch(() => undefined);
  void warmNotTrialFlag(storeId).catch(() => undefined);
}

export async function resolveCachedWalkInCustomer(
  storeId: string,
): Promise<{ id: string; name: string; phone: string }> {
  const key = vOpsCacheKey('walkin', storeId);
  const cached = vOpsCacheGet<{ id: string; name: string; phone: string }>(key);
  if (cached) return cached;

  const db = getFirestore();
  const snap = await getDocs(
    query(
      collection(db, 'customers'),
      where('storeId', '==', storeId),
      where('name', '==', 'Walk-in'),
      limit(1),
    ),
  );

  if (!snap.empty) {
    const docSnap = snap.docs[0];
    const row = {
      id: docSnap.id,
      name: String(docSnap.data().name || 'Walk-in'),
      phone: String(docSnap.data().phone || ''),
    };
    vOpsCacheSet(key, row);
    return row;
  }

  const { addDoc } = await import('firebase/firestore');
  const ref = await addDoc(collection(db, 'customers'), {
    storeId,
    name: 'Walk-in',
    phone: '00000000',
    email: '',
    createdAt: new Date().toISOString(),
    notes: 'Default walk-in customer for V·POS',
  });
  const row = { id: ref.id, name: 'Walk-in', phone: '00000000' };
  vOpsCacheSet(key, row);
  return row;
}
