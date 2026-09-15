import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import type {
  WordPressProvisioningInput,
  WordPressProvisioningRequest,
  WordPressProvisioningStatus,
} from '@/types/wordpressProvisioning';
import { getApiBaseUrl } from '@/lib/apiBase';
import {
  buildWordPressDemoStagingDomain,
  isWordPressDemoStagingDomain,
} from '@/lib/wordpressDemoStaging';

const COLLECTION = 'wordpressProvisioningRequests';

export async function isGrabioOpsUser(uid: string): Promise<boolean> {
  const snap = await getDoc(doc(getFirestore(), 'platformConfig', 'grabio'));
  if (!snap.exists()) return false;
  const opsUids = snap.data()?.opsUids;
  return Array.isArray(opsUids) && opsUids.includes(uid);
}

export async function createWordPressProvisioningRequest(
  storeId: string,
  ownerUid: string,
  input: WordPressProvisioningInput,
): Promise<string> {
  const normalizedOwnerUid = String(ownerUid || '').trim();
  if (!normalizedOwnerUid) {
    throw new Error('Sign in again to continue');
  }
  const requestKind = input.requestKind || 'production';
  const timestamp = new Date().toISOString();

  let preferredDomain = input.preferredDomain?.trim() || null;
  let stagingDomain = input.stagingDomain?.trim() || null;

  if (requestKind === 'builder_demo') {
    if (!stagingDomain) {
      throw new Error('Staging domain is required for demo WordPress');
    }
    if (preferredDomain && !isWordPressDemoStagingDomain(preferredDomain)) {
      throw new Error('Demo WordPress cannot use a client domain — staging URL only until transfer');
    }
    preferredDomain = stagingDomain;
  }

  const ref = await addDoc(collection(getFirestore(), COLLECTION), {
    storeId,
    ownerUid: normalizedOwnerUid,
    requestKind,
    businessName: input.businessName.trim(),
    contactEmail: input.contactEmail.trim(),
    preferredDomain,
    stagingDomain: requestKind === 'builder_demo' ? stagingDomain : null,
    notes: input.notes?.trim() || null,
    status: 'pending',
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  return ref.id;
}

export function buildDemoWordPressStagingDomain(slug: string, demoId: string): string {
  return buildWordPressDemoStagingDomain(slug, demoId);
}

export async function getWordPressProvisioningRequest(
  requestId: string,
): Promise<WordPressProvisioningRequest | null> {
  const snap = await getDoc(doc(getFirestore(), COLLECTION, requestId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<WordPressProvisioningRequest, 'id'>) };
}

export function subscribeWordPressProvisioningRequest(
  requestId: string,
  callback: (request: WordPressProvisioningRequest | null) => void,
): Unsubscribe {
  return onSnapshot(doc(getFirestore(), COLLECTION, requestId), (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    callback({ id: snap.id, ...(snap.data() as Omit<WordPressProvisioningRequest, 'id'>) });
  });
}

export async function listWordPressRequestsForStore(
  storeId: string,
): Promise<WordPressProvisioningRequest[]> {
  const q = query(
    collection(getFirestore(), COLLECTION),
    where('storeId', '==', storeId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WordPressProvisioningRequest, 'id'>) }));
}

export async function listAllWordPressRequests(): Promise<WordPressProvisioningRequest[]> {
  const q = query(collection(getFirestore(), COLLECTION), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WordPressProvisioningRequest, 'id'>) }));
}

export async function updateWordPressRequestStatus(
  requestId: string,
  status: WordPressProvisioningStatus,
  opsNotes?: string,
): Promise<void> {
  const timestamp = new Date().toISOString();
  await updateDoc(doc(getFirestore(), COLLECTION, requestId), {
    status,
    opsNotes: opsNotes?.trim() || null,
    updatedAt: timestamp,
    ...(status === 'completed' ? { completedAt: timestamp } : {}),
  });
}

export async function fetchBuilderDemoWordPressCredentials(
  requestId: string,
  idToken: string,
): Promise<{ wpAdminUrl: string; wpUsername: string; wpPassword: string; hostingDomain: string }> {
  const response = await fetch(`${getApiBaseUrl()}/wordpress/provisioning/demo-credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ requestId }),
  });
  const payload = (await response.json()) as {
    wpAdminUrl?: string;
    wpUsername?: string;
    wpPassword?: string;
    hostingDomain?: string;
    error?: string;
  };
  if (!response.ok || !payload.wpAdminUrl || !payload.wpUsername || !payload.wpPassword) {
    throw new Error(payload.error || 'Demo credentials are not ready yet');
  }
  return {
    wpAdminUrl: payload.wpAdminUrl,
    wpUsername: payload.wpUsername,
    wpPassword: payload.wpPassword,
    hostingDomain: payload.hostingDomain || '',
  };
}

export async function testWordPressProvisioningDns(
  requestId: string,
  idToken: string,
): Promise<{ dnsOk: boolean; emailSent: boolean; message: string }> {
  const response = await fetch(`${getApiBaseUrl()}/wordpress/provisioning/test-dns`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ requestId }),
  });
  const payload = (await response.json()) as {
    success?: boolean;
    dnsOk?: boolean;
    emailSent?: boolean;
    message?: string;
    error?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error || payload.message || 'DNS test failed');
  }
  return {
    dnsOk: Boolean(payload.dnsOk),
    emailSent: Boolean(payload.emailSent),
    message: payload.message || (payload.dnsOk ? 'DNS verified' : 'DNS not ready yet'),
  };
}
