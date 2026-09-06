import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import { fetchCrmClients, type CrmClient } from '@/lib/crmService';
import { fetchCrmTeamReps } from '@/lib/crmAssignableAgents';
import type { CrmRep } from '@/types/crm';

function canLoadTeamReps(user: { role?: string; subAccountRole?: string } | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'sub_account' && user.subAccountRole === 'manager') return true;
  return false;
}

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
        canLoadTeamReps(user) ? fetchCrmTeamReps(storeId) : Promise.resolve([] as CrmRep[]),
      ]);
      setClients(clientList);
      setReps(repList);
    } finally {
      setLoading(false);
    }
  }, [storeId, opts?.repId, opts?.crmOnly, user?.role, user?.crmRepId, user?.subAccountRole]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { storeId, clients, setClients, reps, loading, reload, user };
}
