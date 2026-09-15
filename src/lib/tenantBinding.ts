import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  limit,
  query,
  where,
  type Firestore,
} from 'firebase/firestore';

export type ResolvedSubAccountBinding = {
  subAccountId: string;
  storeId: string;
  subAccountRole: string;
  name?: string;
  permissions?: string[];
};

type SubAccountDoc = {
  storeId?: string;
  role?: string;
  name?: string;
  permissions?: string[];
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function mapSubAccountDoc(subAccountId: string, sub: SubAccountDoc): ResolvedSubAccountBinding | null {
  const storeId = typeof sub.storeId === 'string' ? sub.storeId.trim() : '';
  if (!storeId) return null;
  const subAccountRole = String(sub.role || 'sales');
  const name = String(sub.name || '').trim() || undefined;
  const permissions = Array.isArray(sub.permissions) ? sub.permissions : undefined;
  return { subAccountId, storeId, subAccountRole, name, permissions };
}

async function getSubAccountDocPreferServer(db: Firestore, subAccountId: string) {
  const ref = doc(db, 'subAccounts', subAccountId);
  try {
    return await getDocFromServer(ref);
  } catch {
    return getDoc(ref);
  }
}

/**
 * Resolver hint only — never treat activeStoreId as canonical when users.subAccountId is set
 * (multi-store emails often carry a stale activeStoreId from another tenant).
 */
export function storeIdHintFromUserProfile(data: {
  subAccountId?: string;
  storeId?: string;
  primaryStoreId?: string;
  activeStoreId?: string;
}): string {
  const subAccountId = typeof data.subAccountId === 'string' ? data.subAccountId.trim() : '';
  const storeId = typeof data.storeId === 'string' ? data.storeId.trim() : '';
  const primary = typeof data.primaryStoreId === 'string' ? data.primaryStoreId.trim() : '';
  const active = typeof data.activeStoreId === 'string' ? data.activeStoreId.trim() : '';
  if (subAccountId) {
    return storeId || primary || '';
  }
  return storeId || primary || active;
}

/**
 * Canonical binding: users.subAccountId → subAccounts doc → subAccounts.storeId.
 * Email lookup is store-scoped when possible; never picks docs[0] when multiple rows lack store hint.
 */
export async function resolveSubAccountBinding(
  db: Firestore,
  opts: {
    subAccountId?: string;
    email?: string | null;
    storeIdHint?: string;
  },
): Promise<ResolvedSubAccountBinding | null> {
  const normalizedEmail = normalizeEmail(opts.email || '');
  const storeIdHint = (opts.storeIdHint || '').trim();
  const subAccountId = (opts.subAccountId || '').trim();

  if (subAccountId) {
    const subSnap = await getSubAccountDocPreferServer(db, subAccountId);
    if (subSnap.exists()) {
      const mapped = mapSubAccountDoc(subSnap.id, subSnap.data() as SubAccountDoc);
      if (mapped) {
        return mapped;
      }
    }
  }

  if (normalizedEmail && storeIdHint) {
    const scopedSnap = await getDocs(
      query(
        collection(db, 'subAccounts'),
        where('storeId', '==', storeIdHint),
        where('email', '==', normalizedEmail),
        limit(1),
      ),
    );
    if (!scopedSnap.empty) {
      const subDoc = scopedSnap.docs[0];
      const mapped = mapSubAccountDoc(subDoc.id, subDoc.data() as SubAccountDoc);
      if (mapped) return mapped;
    }
  }

  if (normalizedEmail) {
    const emailSnap = await getDocs(
      query(collection(db, 'subAccounts'), where('email', '==', normalizedEmail), limit(10)),
    );
    if (!emailSnap.empty) {
      if (emailSnap.size > 1 && !storeIdHint) {
        return null;
      }
      const pick =
        (storeIdHint
          ? emailSnap.docs.find((d) => (d.data() as SubAccountDoc).storeId === storeIdHint)
          : undefined) || (emailSnap.size === 1 ? emailSnap.docs[0] : undefined);
      if (pick) {
        const mapped = mapSubAccountDoc(pick.id, pick.data() as SubAccountDoc);
        if (mapped) return mapped;
      }
    }
  }

  return null;
}
