import { useEffect, useState } from 'react';
import { useLedger } from '@/context/LedgerContext';
import { useAppContext } from '@/context/AppContext';
import { useGrabioStore } from '@/hooks/useGrabioStore';
import { normalizeAccountingLanguage } from '@/lib/grabio/accountingMode';
import { loadPcgClientAccounts } from '@/lib/firestore/pcgClientAccountsFirestore';
import AccountRangeStatementPanel from '@/components/AccountRangeStatementPanel';
import type { PcgClientAccount } from '@/types/generalLedger';

type Props = {
  embedded?: boolean;
};

export default function AccountStatementPage({ embedded: _embedded }: Props) {
  const { activeOrganizationId } = useAppContext();
  const { profile, storeId: grabioStoreId } = useGrabioStore();
  const financeStoreId = grabioStoreId || activeOrganizationId || '';
  const accountingLanguage = normalizeAccountingLanguage(
    profile?.accountingLanguage,
    profile?.accountingMode,
  );
  const isLebaneseCoa = profile?.accountingMode === 'lebanese';
  const currencyCode = profile?.mainCurrency || (isLebaneseCoa ? 'LBP' : 'USD');
  const { loading, accounts, entries, lines } = useLedger();
  const [pcgClientAccounts, setPcgClientAccounts] = useState<PcgClientAccount[]>([]);

  useEffect(() => {
    if (!isLebaneseCoa || !financeStoreId) {
      setPcgClientAccounts([]);
      return;
    }
    let cancelled = false;
    void loadPcgClientAccounts(financeStoreId).then((rows) => {
      if (!cancelled) setPcgClientAccounts(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [isLebaneseCoa, financeStoreId]);

  return (
    <AccountRangeStatementPanel
      accounts={accounts}
      entries={entries}
      lines={lines}
      isLebaneseCoa={isLebaneseCoa}
      pcgClientAccounts={pcgClientAccounts}
      accountingLanguage={accountingLanguage}
      currencyCode={currencyCode}
      loading={loading}
    />
  );
}
