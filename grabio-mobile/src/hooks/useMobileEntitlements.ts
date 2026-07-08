import { useEffect, useState, useCallback } from 'react';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { canUseInvoiceManagerApp, canUseMobileModule, type MobileStoreProfile } from '../lib/entitlements';

export function useMobileEntitlements() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<MobileStoreProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const storeId = user?.storeId || user?.id;

  const load = useCallback(async () => {
    if (!storeId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const snap = await getDoc(doc(getFirestore(), 'storeProfiles', storeId));
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
      return canUseMobileModule(profile, moduleId);
    },
    [profile],
  );

  return { profile, loading, canUse, reload: load };
}
