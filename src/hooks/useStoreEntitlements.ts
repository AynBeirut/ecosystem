import { useEffect, useState, useMemo, useCallback } from 'react';
import { getFirestore, doc, getDoc, getDocFromServer } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import { resolveStoreEntitlements, type StoreEntitlements } from '@/lib/entitlements';
import type { StoreProfile } from '@/types/storeProfile';

const profileCache = new Map<string, StoreProfile>();

export function peekCachedStoreProfile(storeId: string | null): StoreProfile | null {
  if (!storeId) return null;
  return profileCache.get(storeId) ?? null;
}

export function useStoreEntitlements() {
  const { user } = useAuth();
  const storeId = user ? getActualStoreId(user) : null;
  const [profile, setProfile] = useState<StoreProfile | null>(() => peekCachedStoreProfile(storeId));
  const [loading, setLoading] = useState(() => Boolean(storeId && !profileCache.has(storeId)));

  const load = useCallback(async (options?: { silent?: boolean; fromServer?: boolean }) => {
    if (!storeId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    if (!options?.silent) setLoading(true);
    try {
      const ref = doc(getFirestore(), 'storeProfiles', storeId);
      const snap = options?.fromServer
        ? await getDocFromServer(ref).catch(() => getDoc(ref))
        : await getDoc(ref);
      setProfile(snap.exists() ? (snap.data() as StoreProfile) : null);
      if (snap.exists()) {
        profileCache.set(storeId, snap.data() as StoreProfile);
      } else {
        profileCache.delete(storeId);
      }
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    if (!storeId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const cached = profileCache.get(storeId);
    if (cached) {
      setProfile(cached);
      setLoading(false);
    }
    void load({ silent: Boolean(cached) });
  }, [load, storeId]);

  useEffect(() => {
    const onProfileUpdated = () => {
      void load({ silent: true, fromServer: true });
    };
    window.addEventListener('grabio:store-profile-updated', onProfileUpdated);
    return () => window.removeEventListener('grabio:store-profile-updated', onProfileUpdated);
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
