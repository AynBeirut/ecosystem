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
import { useRestaurantDemoOptional } from '@/context/RestaurantDemoContext';

export function peekCachedStoreProfile(storeId: string | null): StoreProfile | null {
  if (!storeId) return null;
  return peekCachedGrabioStoreProfile(storeId) as StoreProfile | null;
}

function cacheStoreProfile(storeId: string, profile: StoreProfile): void {
  setCachedGrabioStoreProfile(storeId, profile as GrabioStoreProfile);
}

export function useStoreEntitlements() {
  const restaurantDemo = useRestaurantDemoOptional();
  const { user } = useAuth();
  const firestoreStoreId = user ? getActualStoreId(user) : null;
  const storeId = restaurantDemo?.sessionId ?? firestoreStoreId;

  const [profile, setProfile] = useState<StoreProfile | null>(() =>
    restaurantDemo ? restaurantDemo.profile : peekCachedStoreProfile(firestoreStoreId),
  );
  const [loading, setLoading] = useState(() =>
    restaurantDemo ? restaurantDemo.loading : Boolean(firestoreStoreId && !peekCachedStoreProfile(firestoreStoreId)),
  );

  const load = useCallback(
    async (options?: { silent?: boolean; fromServer?: boolean }) => {
      if (restaurantDemo) return;
      if (!firestoreStoreId) {
        setProfile(null);
        setLoading(false);
        return;
      }
      if (!options?.silent) setLoading(true);
      try {
        const ref = doc(getFirestore(), 'storeProfiles', firestoreStoreId);
        const snap = options?.fromServer
          ? await getDocFromServer(ref).catch(() => getDoc(ref))
          : await getDoc(ref);
        setProfile(snap.exists() ? (snap.data() as StoreProfile) : null);
        if (snap.exists()) {
          cacheStoreProfile(firestoreStoreId, snap.data() as StoreProfile);
        } else {
          clearCachedGrabioStoreProfile(firestoreStoreId);
        }
      } finally {
        setLoading(false);
      }
    },
    [firestoreStoreId, restaurantDemo],
  );

  useEffect(() => {
    if (restaurantDemo) {
      setProfile(restaurantDemo.profile);
      setLoading(restaurantDemo.loading);
      return;
    }
    if (!firestoreStoreId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const cached = peekCachedStoreProfile(firestoreStoreId);
    if (cached) {
      setProfile(cached);
      setLoading(false);
      void load({ silent: true });
      return;
    }
    setLoading(true);
    void load({ silent: false });
  }, [load, firestoreStoreId, restaurantDemo, restaurantDemo?.loading, restaurantDemo?.profile]);

  useEffect(() => {
    if (restaurantDemo) return;
    const onProfileUpdated = () => {
      void load({ silent: true, fromServer: true });
    };
    window.addEventListener('grabio:store-profile-updated', onProfileUpdated);
    return () => window.removeEventListener('grabio:store-profile-updated', onProfileUpdated);
  }, [load, restaurantDemo]);

  const entitlements = useMemo<StoreEntitlements | null>(() => {
    if (restaurantDemo) return restaurantDemo.entitlements;
    return resolveStoreEntitlements(profile);
  }, [profile, restaurantDemo]);

  const resolvedProfile = restaurantDemo ? restaurantDemo.profile : profile;

  const canUse = useCallback(
    (moduleId: string) => Boolean(entitlements?.modules[moduleId]),
    [entitlements],
  );

  return {
    profile: resolvedProfile,
    entitlements,
    loading: restaurantDemo ? restaurantDemo.loading : loading,
    storeId,
    canUse,
    reload: load,
  };
}
