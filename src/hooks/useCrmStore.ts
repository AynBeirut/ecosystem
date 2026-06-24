import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import { fetchCrmClients, fetchCrmReps, type CrmClient } from '@/lib/crmService';
import type { CrmRep } from '@/types/crm';

export function useCrmStore(opts?: { repId?: string; crmOnly?: boolean }) {
  const { user } = useAuth();
  const storeId = getActualStoreId(user);
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [reps, setReps] = useState<CrmRep[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!storeId) {
      setClients([]);
      setReps([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const repFilter = opts?.repId ?? (user?.role === 'crm_rep' ? user.crmRepId : undefined);
      const [clientList, repList] = await Promise.all([
        fetchCrmClients(storeId, { repId: repFilter, crmOnly: opts?.crmOnly }),
        user?.role === 'admin' ? fetchCrmReps(storeId) : Promise.resolve([] as CrmRep[]),
      ]);
      setClients(clientList);
      setReps(repList);
    } finally {
      setLoading(false);
    }
  }, [storeId, opts?.repId, opts?.crmOnly, user?.role, user?.crmRepId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { storeId, clients, setClients, reps, loading, reload, user };
}
