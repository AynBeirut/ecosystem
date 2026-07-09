import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import type {
  WordPressProvisioningInput,
  WordPressProvisioningRequest,
  WordPressProvisioningStatus,
} from '@/types/wordpressProvisioning';

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
  const timestamp = new Date().toISOString();
  const ref = await addDoc(collection(getFirestore(), COLLECTION), {
    storeId,
    ownerUid,
    businessName: input.businessName.trim(),
    contactEmail: input.contactEmail.trim(),
    preferredDomain: input.preferredDomain?.trim() || null,
    notes: input.notes?.trim() || null,
    status: 'pending',
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  return ref.id;
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
