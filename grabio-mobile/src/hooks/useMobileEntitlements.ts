import { useEffect, useState, useCallback } from 'react';
import firestore from '@react-native-firebase/firestore';
import { useResolvedStoreId } from './useResolvedStoreId';
import { canUseInvoiceManagerApp, canUseCrmMobile, canUseMobileModule, type MobileStoreProfile } from '../lib/entitlements';
import { useAuth } from '../context/AuthContext';

export function useMobileEntitlements() {
  const { user } = useAuth();
  const { storeId, loading: storeLoading } = useResolvedStoreId();
  const [profile, setProfile] = useState<MobileStoreProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!storeId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const snap = await firestore()
        .collection('storeProfiles')
        .doc(storeId)
        .get({ source: 'server' })
        .catch(() => firestore().collection('storeProfiles').doc(storeId).get());
      setProfile(snap.exists() ? (snap.data() as MobileStoreProfile) : null);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const canUse = useCallback(
    (moduleId: string) => {
      if (moduleId === 'invoice_manager') return canUseInvoiceManagerApp(profile);
      if (moduleId === 'crm') return canUseCrmMobile(profile, user?.userRole);
      return canUseMobileModule(profile, moduleId);
    },
    [profile, user?.userRole],
  );

  return { profile, loading: loading || storeLoading, canUse, reload: load };
}
