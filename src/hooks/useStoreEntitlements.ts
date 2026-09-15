import { useEffect, useState, useMemo, useCallback } from 'react';
import { getFirestore, doc, getDoc, getDocFromServer } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import { resolveStoreEntitlements, type StoreEntitlements } from '@/lib/entitlements';
import type { StoreProfile } from '@/types/storeProfile';
import {
  peekCachedGrabioStoreProfile,
  setCachedGrabioStoreProfile,
  clearCachedGrabioStoreProfile,
} from '../../vendor/beirut-finance-flow-main/src/lib/grabio/storeProfileCache';
import type { GrabioStoreProfile } from '../../vendor/beirut-finance-flow-main/src/lib/grabio/types';

export function peekCachedStoreProfile(storeId: string | null): StoreProfile | null {
  if (!storeId) return null;
  return peekCachedGrabioStoreProfile(storeId) as StoreProfile | null;
}

function cacheStoreProfile(storeId: string, profile: StoreProfile): void {
  setCachedGrabioStoreProfile(storeId, profile as GrabioStoreProfile);
}

export function useStoreEntitlements() {
  const { user } = useAuth();
  const storeId = user ? getActualStoreId(user) : null;
  const [profile, setProfile] = useState<StoreProfile | null>(() => peekCachedStoreProfile(storeId));
  const [loading, setLoading] = useState(() => Boolean(storeId && !peekCachedStoreProfile(storeId)));

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
        cacheStoreProfile(storeId, snap.data() as StoreProfile);
      } else {
        clearCachedGrabioStoreProfile(storeId);
      }
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    if (!storeId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const cached = peekCachedStoreProfile(storeId);
    if (cached) {
      setProfile(cached);
      setLoading(false);
      void load({ silent: true });
      return;
    }
    setLoading(true);
    void load({ silent: false });
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
