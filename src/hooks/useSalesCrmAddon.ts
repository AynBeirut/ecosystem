import { useEffect, useState } from 'react';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import { storeHasSalesCrmAddon } from '@/lib/crm';
import type { StoreProfile } from '@/types/storeProfile';

export function useSalesCrmAddon() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<StoreProfile | null>(null);

  const storeId = getActualStoreId(user);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!storeId) {
        if (!cancelled) {
          setEnabled(false);
          setProfile(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const db = getFirestore();
        const snap = await getDoc(doc(db, 'storeProfiles', storeId));
        const data = snap.exists() ? (snap.data() as StoreProfile) : null;
        if (!cancelled) {
          setProfile(data);
          setEnabled(storeHasSalesCrmAddon(data));
        }
      } catch {
        if (!cancelled) {
          setProfile(null);
          setEnabled(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  return { enabled, loading, profile, storeId };
}
