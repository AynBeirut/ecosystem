import { useEffect, useState } from 'react';
import firestore from '@react-native-firebase/firestore';
import type { CrmRepLiveLocation } from '../lib/crmMobileService';
import { filterLiveRepsForViewer } from '../lib/crmLiveLocationUtils';

export function subscribeCrmRepLocations(
  storeId: string,
  onUpdate: (rows: CrmRepLiveLocation[]) => void,
  onError?: (err: Error) => void,
): () => void {
  return firestore()
    .collection('crmRepLocations')
    .where('storeId', '==', storeId)
    .onSnapshot(
      (snap) => {
        const rows = snap.docs
          .map((d) => ({ userId: d.id, ...d.data() } as CrmRepLiveLocation))
          .filter((r) => typeof r.lat === 'number' && typeof r.lng === 'number');
        onUpdate(rows);
      },
      (err) => onError?.(err instanceof Error ? err : new Error(String(err))),
    );
}

export function useLiveTeamLocations(
  storeId: string | undefined,
  viewerRole?: string,
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
    const unsub = subscribeCrmRepLocations(
      storeId,
      (rows) => {
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

  const reps = filterLiveRepsForViewer(allReps, viewerRole).sort((a: CrmRepLiveLocation, b: CrmRepLiveLocation) =>
    (a.repName || '').localeCompare(b.repName || ''),
  );

  return { reps, loading, error };
}
