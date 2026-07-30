import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { generateSlug } from '@/lib/slugify';
import type { AccountingTestSandbox, FreelancerTrack, PlatformFreelancer } from '@/types/career';
import type { SubAccount } from '@/types/subaccount';
import { createBuilderAccount } from '@/lib/builderService';

const db = getFirestore();
const ACCOUNTING_MAX_SANDBOXES = 3;

function nowIso(): string {
  return new Date().toISOString();
}

export async function getPlatformFreelancer(uid: string): Promise<PlatformFreelancer | null> {
  const snap = await getDoc(doc(db, 'platformFreelancers', uid));
  return snap.exists() ? (snap.data() as PlatformFreelancer) : null;
}

export async function createPlatformFreelancer(
  uid: string,
  input: {
    track: FreelancerTrack;
    displayName: string;
    email: string;
    phone?: string;
    portfolioUrl?: string;
  },
): Promise<PlatformFreelancer> {
  const timestamp = nowIso();
  const profile: PlatformFreelancer = {
    track: input.track,
    status: 'active',
    displayName: input.displayName.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone?.trim() || '',
    portfolioUrl: input.portfolioUrl?.trim() || '',
    clientStoreIds: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await setDoc(doc(db, 'platformFreelancers', uid), profile);
  await setDoc(
    doc(db, 'users', uid),
    {
      role: 'freelancer',
      freelancerTrack: input.track,
      name: profile.displayName,
      email: profile.email,
      updatedAt: timestamp,
    },
    { merge: true },
  );

  if (input.track === 'designer_builder') {
    await createBuilderAccount(uid, 'designer');
  }

  return profile;
}

export type FreelancerClient = {
  subAccountId: string;
  storeId: string;
  storeName: string;
  role: string;
  status: string;
};

export async function listFreelancerClients(email: string): Promise<FreelancerClient[]> {
  const normalized = email.trim().toLowerCase();
  const snap = await getDocs(
    query(collection(db, 'subAccounts'), where('email', '==', normalized)),
  );

  const clients: FreelancerClient[] = [];
  for (const subDoc of snap.docs) {
    const sub = { id: subDoc.id, ...(subDoc.data() as Omit<SubAccount, 'id'>) };
    let storeName = sub.storeId;
    try {
      const storeSnap = await getDoc(doc(db, 'storeProfiles', sub.storeId));
      if (storeSnap.exists()) {
        const data = storeSnap.data();
        storeName = String(data.storeName || data.name || sub.storeId);
      }
    } catch {
      /* rules may block until linked */
    }
    clients.push({
      subAccountId: sub.id,
      storeId: sub.storeId,
      storeName,
      role: sub.role,
      status: sub.status,
    });
  }

  return clients.sort((a, b) => a.storeName.localeCompare(b.storeName));
}

export async function syncFreelancerClientStoreIds(uid: string, email: string): Promise<string[]> {
  const clients = await listFreelancerClients(email);
  const storeIds = [...new Set(clients.map((c) => c.storeId))];
  await setDoc(
    doc(db, 'platformFreelancers', uid),
    { clientStoreIds: storeIds, updatedAt: nowIso() },
    { merge: true },
  );
  return storeIds;
}

export async function listAccountingSandboxes(uid: string): Promise<AccountingTestSandbox[]> {
  const snap = await getDocs(collection(db, 'accountingFreelancers', uid, 'testSandboxes'));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<AccountingTestSandbox, 'id'>) }))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function countActiveAccountingSandboxes(uid: string): Promise<number> {
  const sandboxes = await listAccountingSandboxes(uid);
  return sandboxes.filter((s) => s.status !== 'archived').length;
}

export async function createAccountingSandbox(uid: string, name: string, moduleFocus = ''): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Sandbox name is required');

  const active = await countActiveAccountingSandboxes(uid);
  if (active >= ACCOUNTING_MAX_SANDBOXES) {
    throw new Error(`Sandbox limit reached (${ACCOUNTING_MAX_SANDBOXES})`);
  }

  const timestamp = nowIso();
  const sandboxRef = doc(collection(db, 'accountingFreelancers', uid, 'testSandboxes'));
  const storeId = crypto.randomUUID();

  await setDoc(doc(db, 'accountingFreelancers', uid), {
    ownerUid: uid,
    sandboxSlotCount: ACCOUNTING_MAX_SANDBOXES,
    createdAt: timestamp,
    updatedAt: timestamp,
  }, { merge: true });

  await setDoc(sandboxRef, {
    name: trimmed,
    moduleFocus: moduleFocus.trim(),
    storeId,
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  await setDoc(doc(db, 'storeProfiles', storeId), {
    ownerId: uid,
    storeId,
    storeName: trimmed,
    name: trimmed,
    slug: generateSlug(trimmed),
    isDemo: true,
    isFreelancerSandbox: true,
    freelancerUid: uid,
    subscriptionStatus: 'trial',
    subscriptionTier: 'business',
    enabledModules: {
      invoicing: true,
      invoice_manager: true,
      marketplace: true,
      stock: true,
      payments: true,
      analytics: true,
    },
    status: 'online',
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return sandboxRef.id;
}

export { ACCOUNTING_MAX_SANDBOXES };
