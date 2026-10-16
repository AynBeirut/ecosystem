import { useCallback, useEffect, useState } from 'react';
import { useGrabioStore } from '@/hooks/useGrabioStore';
import { loadLedgerAccounts } from '@/lib/firestore/ledgerFirestore';
import { loadPcgClientAccounts } from '@/lib/firestore/pcgClientAccountsFirestore';
import { partyAccountForCurrency } from '@/lib/ledger/partySubaccountLedger';
import type { PartyKind } from '@/lib/ledger/partySubaccount';
import type { LedgerAccount, PcgClientAccount } from '@/types/generalLedger';

/** Chart accounts already on the store. Lookup only — does not create accounts. */
export function usePartyCurrencyAccounts(kind: PartyKind, partyId?: string) {
  const { storeId } = useGrabioStore();
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [pcgRows, setPcgRows] = useState<PcgClientAccount[]>([]);

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    void Promise.all([loadLedgerAccounts(storeId), loadPcgClientAccounts(storeId)]).then(([nextAccounts, nextPcg]) => {
      if (cancelled) return;
      setAccounts(nextAccounts);
      setPcgRows(nextPcg);
    });
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const accountFor = useCallback(
    (currency: string) => {
      const id = String(partyId || '').trim();
      if (!id) return null;
      return partyAccountForCurrency(kind, id, currency, accounts, pcgRows);
    },
    [accounts, kind, partyId, pcgRows],
  );

  return { accountFor };
}
