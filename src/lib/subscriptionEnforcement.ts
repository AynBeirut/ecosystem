import {
  getDoc,
  doc,
  collection,
  query,
  where,
  getDocs,
  runTransaction,
  increment,
  Firestore,
} from 'firebase/firestore';

type Tier = 'trial' | 'starter' | 'pro' | 'business';

export type TrialOperationType = 'invoice' | 'purchase' | 'recipe' | 'sale';

export interface SubscriptionSnapshot {
  tier: Tier;
  productLimit: number | null;
  storageLimitMb: number | null;
  storageUsedMb: number;
  monthlyOperationsLimit: number | null;
  monthlyOperationsCount: number;
  operationsMonthKey: string | null;
}

function normalizeTier(rawTier: unknown): Tier {
  if (rawTier === 'trial' || rawTier === 'starter' || rawTier === 'pro' || rawTier === 'business') {
    return rawTier;
  }
  if (rawTier === 'premium') {
    return 'starter';
  }
  return 'starter';
}

function toNumber(value: unknown, fallback: number): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function getMonthKey(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
}

export async function getSubscriptionSnapshot(db: Firestore, storeId: string): Promise<SubscriptionSnapshot> {
  const profileSnap = await getDoc(doc(db, 'storeProfiles', storeId));
  const data = profileSnap.exists() ? profileSnap.data() : {};

  const tier = normalizeTier(data?.subscriptionTier);
  const productLimitRaw = data?.productLimit ?? data?.product_limit;
  const storageLimitRaw = data?.storageLimitMb ?? data?.storage_limit_mb;
  const monthlyOperationsLimitRaw = data?.monthlyOperationsLimit ?? data?.monthly_operations_limit;
  const storageUsedRaw = data?.storageUsedMb ?? data?.storage_usage_mb ?? data?.currentStorageUsageMb ?? 0;
  const monthlyOperationsCountRaw = data?.monthlyOperationsCount ?? data?.monthly_operations_count ?? 0;

  return {
    tier,
    productLimit: productLimitRaw === null || productLimitRaw === undefined ? null : toNumber(productLimitRaw, 0),
    storageLimitMb: storageLimitRaw === null || storageLimitRaw === undefined ? null : toNumber(storageLimitRaw, 0),
    storageUsedMb: toNumber(storageUsedRaw, 0),
    monthlyOperationsLimit: monthlyOperationsLimitRaw === null || monthlyOperationsLimitRaw === undefined
      ? null
      : toNumber(monthlyOperationsLimitRaw, 0),
    monthlyOperationsCount: toNumber(monthlyOperationsCountRaw, 0),
    operationsMonthKey: typeof data?.operationsMonthKey === 'string' ? data.operationsMonthKey : null,
  };
}

export async function assertCanCreateProduct(db: Firestore, storeId: string, productType: string): Promise<void> {
  const snapshot = await getSubscriptionSnapshot(db, storeId);

  if (snapshot.tier === 'trial' && productType === 'composed') {
    throw new Error('Trial plan allows simple products and services only. Upgrade to create composed products.');
  }

  if (snapshot.productLimit !== null) {
    const productsSnap = await getDocs(query(collection(db, 'products'), where('storeId', '==', storeId)));
    if (productsSnap.size >= snapshot.productLimit) {
      throw new Error(`Your plan limit is ${snapshot.productLimit} products. Upgrade to add more products.`);
    }
  }
}

export async function assertCanUploadBytes(db: Firestore, storeId: string, additionalBytes: number): Promise<void> {
  if (!Number.isFinite(additionalBytes) || additionalBytes <= 0) return;

  const snapshot = await getSubscriptionSnapshot(db, storeId);
  if (snapshot.storageLimitMb === null) return;

  const additionalMb = additionalBytes / (1024 * 1024);
  const projectedUsage = snapshot.storageUsedMb + additionalMb;

  if (projectedUsage > snapshot.storageLimitMb) {
    throw new Error(
      `Storage limit exceeded. Current usage: ${snapshot.storageUsedMb.toFixed(2)}MB, ` +
      `limit: ${snapshot.storageLimitMb}MB, attempted upload: ${additionalMb.toFixed(2)}MB.`
    );
  }
}

export async function trackStorageUsageAfterUpload(db: Firestore, storeId: string, uploadedBytes: number): Promise<void> {
  if (!Number.isFinite(uploadedBytes) || uploadedBytes <= 0) return;

  const addedMb = uploadedBytes / (1024 * 1024);
  await runTransaction(db, async (transaction) => {
    const profileRef = doc(db, 'storeProfiles', storeId);
    const profileSnap = await transaction.get(profileRef);
    const existingUsage = profileSnap.exists()
      ? toNumber(profileSnap.data()?.storageUsedMb ?? profileSnap.data()?.storage_usage_mb ?? 0, 0)
      : 0;

    const newUsage = existingUsage + addedMb;
    transaction.set(profileRef, {
      storageUsedMb: newUsage,
      storage_usage_mb: newUsage,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  });
}

export async function enforceAndConsumeTrialOperation(
  db: Firestore,
  storeId: string,
  operationType: TrialOperationType
): Promise<void> {
  const monthKey = getMonthKey();

  await runTransaction(db, async (transaction) => {
    const profileRef = doc(db, 'storeProfiles', storeId);
    const profileSnap = await transaction.get(profileRef);
    const profileData = profileSnap.exists() ? profileSnap.data() : {};

    const tier = normalizeTier(profileData?.subscriptionTier);
    if (tier !== 'trial') return;

    const limitRaw = profileData?.monthlyOperationsLimit ?? profileData?.monthly_operations_limit;
    const limit = toNumber(limitRaw, 30);
    if (limit <= 0) {
      throw new Error('Trial operations are not available on this account.');
    }

    const currentMonth = typeof profileData?.operationsMonthKey === 'string'
      ? profileData.operationsMonthKey
      : null;
    const currentCountRaw = profileData?.monthlyOperationsCount ?? profileData?.monthly_operations_count ?? 0;
    const currentCount = toNumber(currentCountRaw, 0);

    const nextCount = currentMonth === monthKey ? currentCount + 1 : 1;

    if (nextCount > limit) {
      throw new Error(`Trial monthly operation limit reached (${limit}/${limit}). Upgrade to continue.`);
    }

    transaction.set(profileRef, {
      monthlyOperationsLimit: limit,
      monthly_operations_limit: limit,
      monthlyOperationsCount: nextCount,
      monthly_operations_count: nextCount,
      operationsMonthKey: monthKey,
      lastTrialOperationType: operationType,
      lastTrialOperationAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    transaction.set(doc(collection(db, 'trialOperationUsage')), {
      storeId,
      monthKey,
      operationType,
      createdAt: new Date().toISOString(),
    });
  });
}
