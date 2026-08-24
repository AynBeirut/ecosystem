import { useEffect, useState } from 'react';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { canUseInvoiceManagerApp, canUseMobileModule, type MobileStoreProfile } from '../lib/entitlements';

export function useEntitlements() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<MobileStoreProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.storeId) {
        setProfile(null);
        setLoading(false);
        return;
      }
      try {
        const snap = await firestore().collection('storeProfiles').doc(user.storeId).get();
        if (!cancelled) setProfile((snap.data() as MobileStoreProfile) || null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.storeId]);

  return {
    loading,
    profile,
    canInvoice: user?.userRole === 'crm_rep' ? false : canUseInvoiceManagerApp(profile),
    canCrm: user?.userRole === 'crm_rep' || canUseMobileModule(profile, 'crm'),
  };
}
