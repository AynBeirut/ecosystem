import type { Firestore } from 'firebase-admin/firestore';

export type StoreCommerceProfile = {
  isDemo?: boolean;
  subscriptionStatus?: string | null;
};

export type StoreCommerceCheck = {
  eligible: boolean;
  code:
    | 'OK'
    | 'MISSING_STORE_ID'
    | 'STORE_NOT_FOUND'
    | 'DEMO_STORE'
    | 'SUBSCRIPTION_INACTIVE';
  message: string;
};

const ACTIVE_STATUSES = new Set(['active', 'trial', 'grace', 'grace_period']);

/**
 * Pure eligibility check — used by server guards and unit tests.
 * Legacy stores without subscriptionStatus remain eligible unless isDemo or blocked.
 */
export function evaluateStoreCommerceEligibility(
  profile: StoreCommerceProfile | null | undefined,
  storeId?: string,
): StoreCommerceCheck {
  if (!storeId || !String(storeId).trim()) {
    return {
      eligible: false,
      code: 'MISSING_STORE_ID',
      message: 'Missing storeId',
    };
  }

  if (!profile) {
    return {
      eligible: false,
      code: 'STORE_NOT_FOUND',
      message: 'Store profile not found',
    };
  }

  if (profile.isDemo === true) {
    return {
      eligible: false,
      code: 'DEMO_STORE',
      message: 'Demo stores cannot accept commerce operations',
    };
  }

  const status = profile.subscriptionStatus;
  if (status === 'expired' || status === 'blocked') {
    return {
      eligible: false,
      code: 'SUBSCRIPTION_INACTIVE',
      message: `Store subscription status is ${status}`,
    };
  }

  if (status && !ACTIVE_STATUSES.has(status)) {
    return {
      eligible: false,
      code: 'SUBSCRIPTION_INACTIVE',
      message: `Store subscription status is ${status}`,
    };
  }

  return { eligible: true, code: 'OK', message: 'OK' };
}

export async function checkRealStoreForCommerce(
  db: Firestore,
  storeId: string,
): Promise<StoreCommerceCheck> {
  const normalized = String(storeId || '').trim();
  const snap = await db.collection('storeProfiles').doc(normalized).get();
  const profile = snap.exists ? (snap.data() as StoreCommerceProfile) : null;
  return evaluateStoreCommerceEligibility(profile, normalized);
}

export async function assertRealStoreForCommerce(
  db: Firestore,
  storeId: string,
): Promise<void> {
  const result = await checkRealStoreForCommerce(db, storeId);
  if (!result.eligible) {
    throw new Error(result.message);
  }
}

export function commerceGuardHttpStatus(code: StoreCommerceCheck['code']): number {
  switch (code) {
    case 'MISSING_STORE_ID':
      return 400;
    case 'STORE_NOT_FOUND':
      return 404;
    case 'DEMO_STORE':
    case 'SUBSCRIPTION_INACTIVE':
      return 403;
    default:
      return 403;
  }
}

/** Block subscription/billing writes on flagged demo profiles (allows missing profile for first activation). */
export async function assertNotDemoStoreProfile(
  db: Firestore,
  storeId: string,
): Promise<void> {
  const normalized = String(storeId || '').trim();
  if (!normalized) {
    throw new Error('Missing storeId');
  }
  const snap = await db.collection('storeProfiles').doc(normalized).get();
  if (snap.exists && (snap.data() as StoreCommerceProfile).isDemo === true) {
    throw new Error('Demo store profiles cannot receive subscription billing');
  }
}
