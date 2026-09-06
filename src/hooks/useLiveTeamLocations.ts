import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, getFirestore } from 'firebase/firestore';
import type { CrmRepLiveLocation } from '@/lib/crmService';
import { filterLiveRepsForViewer } from '@/lib/crmLiveLocationUtils';

export function useLiveTeamLocations(
  storeId: string | undefined,
  viewerRole = 'owner',
  enabled = true,
): { reps: CrmRepLiveLocation[]; loading: boolean; error: string | null } {
  const [allReps, setAllReps] = useState<CrmRepLiveLocation[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !storeId) {
      setAllReps([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const db = getFirestore();
    const unsub = onSnapshot(
      query(collection(db, 'crmRepLocations'), where('storeId', '==', storeId)),
      (snap) => {
        const rows = snap.docs
          .map((d) => ({ userId: d.id, ...d.data() } as CrmRepLiveLocation))
          .filter((r) => typeof r.lat === 'number' && typeof r.lng === 'number');
        setAllReps(rows);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, [storeId, enabled]);

  const reps = filterLiveRepsForViewer(allReps, viewerRole).sort((a, b) =>
    (a.repName || '').localeCompare(b.repName || ''),
  );

  return { reps, loading, error };
}
