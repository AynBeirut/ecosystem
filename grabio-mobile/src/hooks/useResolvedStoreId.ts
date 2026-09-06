import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { resolveStoreIdForMobile } from '../lib/storeProfileSync';

/** Canonical storeProfiles id — same as grabio.space web. */
export function useResolvedStoreId(): { storeId: string | null; loading: boolean } {
  const { user } = useAuth();
  const hinted = user?.storeId?.trim() || null;
  const [storeId, setStoreId] = useState<string | null>(hinted);
  const [loading, setLoading] = useState(Boolean(user?.uid) && !hinted);

  useEffect(() => {
    if (!user?.uid) {
      setStoreId(null);
      setLoading(false);
      return;
    }
    if (hinted) {
      setStoreId(hinted);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void resolveStoreIdForMobile(user.uid, user.storeId).then((id) => {
      if (!cancelled) {
        setStoreId(id);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user?.uid, user?.storeId, hinted]);

  return { storeId, loading };
}
