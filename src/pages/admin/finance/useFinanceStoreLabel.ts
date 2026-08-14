import { useAuth } from '@/context/useAuth';
import { peekCachedStoreProfile, useStoreEntitlements } from '@/hooks/useStoreEntitlements';
import { getActualStoreId } from '@/lib/storeUtils';
import type { StoreProfile } from '@/types/storeProfile';

type StoreProfileLike = StoreProfile & { storeName?: string };

function pickStoreLabel(profile: StoreProfileLike | null | undefined): string {
  if (!profile) return '';
  return (
    profile.name?.trim() ||
    profile.storeName?.trim() ||
    profile.financeDocumentSettings?.documentCompanyName?.trim() ||
    ''
  );
}

/** Store display name for finance nav — uses cached profile so it shows immediately. */
export function useFinanceStoreLabel(): string {
  const { user } = useAuth();
  const { profile, storeId } = useStoreEntitlements();
  const resolvedStoreId = storeId ?? (user ? getActualStoreId(user) : null);
  const cached = peekCachedStoreProfile(resolvedStoreId);
  return pickStoreLabel(profile as StoreProfileLike | null) || pickStoreLabel(cached as StoreProfileLike | null) || '';
}
