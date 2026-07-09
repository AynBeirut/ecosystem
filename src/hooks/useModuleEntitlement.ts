import { useMemo } from 'react';
import { useStoreEntitlements } from '@/hooks/useStoreEntitlements';
import { canUseModule } from '@/lib/entitlements';

export function useModuleEntitlement(moduleId: string) {
  const { profile, loading, storeId, entitlements } = useStoreEntitlements();

  const enabled = useMemo(
    () => canUseModule(profile, moduleId),
    [profile, moduleId],
  );

  return {
    enabled,
    loading,
    profile,
    storeId,
    entitlements,
    source: entitlements?.source ?? 'legacy',
  };
}
