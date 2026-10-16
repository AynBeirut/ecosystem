export type TenantMismatchDetails = {
  canonicalStoreId: string;
  staleStoreId?: string;
  staleActiveStoreId?: string;
};

/**
 * When users.subAccountId is set, subAccounts.storeId is canonical (Rule 35).
 * Stale users.storeId / activeStoreId from another tenant → force sign-out.
 */
export function detectTenantMismatch(
  canonicalStoreId: string,
  userData: { storeId?: string; activeStoreId?: string; subAccountId?: string },
): TenantMismatchDetails | null {
  const subAccountId = typeof userData.subAccountId === 'string' ? userData.subAccountId.trim() : '';
  if (!subAccountId) return null;

  const canon = canonicalStoreId.trim();
  if (!canon) return null;

  const staleStore = typeof userData.storeId === 'string' ? userData.storeId.trim() : '';
  const staleActive = typeof userData.activeStoreId === 'string' ? userData.activeStoreId.trim() : '';

  if (staleStore && staleStore !== canon) {
    return { canonicalStoreId: canon, staleStoreId: staleStore };
  }
  if (staleActive && staleActive !== canon) {
    return { canonicalStoreId: canon, staleActiveStoreId: staleActive };
  }
  return null;
}
