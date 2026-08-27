import { useEffect, useMemo, useState } from 'react';
import { useLedger } from '@/context/LedgerContext';
import { useAppContext } from '@/context/AppContext';
import { useGrabioStore } from '@/hooks/useGrabioStore';
import { normalizeAccountingLanguage } from '@/lib/grabio/accountingMode';
import { loadPcgClientAccounts } from '@/lib/firestore/pcgClientAccountsFirestore';
import AccountRangeStatementPanel from '@/components/AccountRangeStatementPanel';
import VoucherDetailDialog from '@/components/VoucherDetailDialog';
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
  const [entryId, setEntryId] = useState('');
  const selected = useMemo(() => entries.find((e) => e.id === entryId) || null, [entries, entryId]);

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
    <>
    <AccountRangeStatementPanel
      accounts={accounts}
      entries={entries}
      lines={lines}
      isLebaneseCoa={isLebaneseCoa}
      pcgClientAccounts={pcgClientAccounts}
      accountingLanguage={accountingLanguage}
      currencyCode={currencyCode}
      usdToLbp={profile?.customExchangeRate}
      companyName={profile?.name || profile?.storeName}
      loading={loading}
      onOpenEntry={setEntryId}
    />
    <VoucherDetailDialog
      entry={selected}
      lines={lines}
      open={Boolean(selected)}
      onOpenChange={(open) => !open && setEntryId('')}
      isLebaneseCoa={isLebaneseCoa}
      pcgClientAccounts={pcgClientAccounts}
      accountingLanguage={accountingLanguage}
    />
    </>
  );
}
