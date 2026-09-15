import { doc, getDoc, getFirestore } from 'firebase/firestore';

/** Platform ops (Grabio owner) — same uid list as WordPress queue. */
export async function isGrabioOpsUser(uid: string | undefined | null): Promise<boolean> {
  if (!uid) return false;
  const snap = await getDoc(doc(getFirestore(), 'platformConfig', 'grabio'));
  if (!snap.exists()) return false;
  const opsUids = snap.data()?.opsUids;
  return Array.isArray(opsUids) && opsUids.includes(uid);
}
