import { useEffect, useState, useMemo, useCallback } from 'react';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import { resolveStoreEntitlements, type StoreEntitlements } from '@/lib/entitlements';
import type { StoreProfile } from '@/types/storeProfile';

export function useStoreEntitlements() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<StoreProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const storeId = user ? getActualStoreId(user) : null;

  const load = useCallback(async () => {
    if (!storeId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const snap = await getDoc(doc(getFirestore(), 'storeProfiles', storeId));
      setProfile(snap.exists() ? (snap.data() as StoreProfile) : null);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const entitlements = useMemo<StoreEntitlements | null>(
    () => resolveStoreEntitlements(profile),
    [profile],
  );

  const canUse = useCallback(
    (moduleId: string) => Boolean(entitlements?.modules[moduleId]),
    [entitlements],
  );

  return { profile, entitlements, loading, storeId, canUse, reload: load };
}
