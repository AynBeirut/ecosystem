import { useEffect, useMemo, useState } from 'react';
import { useLedger } from '@/context/LedgerContext';
import { useAppContext } from '@/context/AppContext';
import { useGrabioStore } from '@/hooks/useGrabioStore';
import { normalizeAccountingLanguage } from '@/lib/grabio/accountingMode';
import { loadPcgClientAccounts } from '@/lib/firestore/pcgClientAccountsFirestore';
import { mergeLedgerPartyRowsIntoPcgClients } from '@/lib/ledger/partySubaccountLedger';
import { useReportExchangeRate } from '@/hooks/useReportExchangeRate';
import AccountRangeStatementPanel from '@/components/AccountRangeStatementPanel';
import VoucherDetailDialog from '@/components/VoucherDetailDialog';
import type { PcgClientAccount } from '@/types/generalLedger';

type Props = {
  embedded?: boolean;
};

export default function AccountStatementPage({ embedded: _embedded }: Props) {
  const { activeOrganizationId, invoices } = useAppContext();
  const { profile, storeId: grabioStoreId } = useGrabioStore();
  const { usdToLbp, storeLedgerCurrency } = useReportExchangeRate();
  const financeStoreId = grabioStoreId || activeOrganizationId || '';
  const profileReady = profile !== null;
  const isLebaneseCoa = profileReady && profile?.accountingMode === 'lebanese';
  const accountingLanguage = normalizeAccountingLanguage(
    profile?.accountingLanguage,
    profile?.accountingMode,
  );
  const currencyCode = storeLedgerCurrency;
  const { loading, accounts, entries, lines } = useLedger();
  const [pcgClientAccounts, setPcgClientAccounts] = useState<PcgClientAccount[]>([]);
  const [pcgLoaded, setPcgLoaded] = useState(false);
  const [entryId, setEntryId] = useState('');
  const selected = useMemo(() => entries.find((e) => e.id === entryId) || null, [entries, entryId]);

  const activeLedgerAccounts = useMemo(
    () => accounts.filter((account) => account.isActive),
    [accounts],
  );

  const displayPcgClientAccounts = useMemo(
    () => mergeLedgerPartyRowsIntoPcgClients(activeLedgerAccounts, pcgClientAccounts),
    [activeLedgerAccounts, pcgClientAccounts],
  );

  useEffect(() => {
    if (!profileReady) {
      setPcgLoaded(false);
      return;
    }
    if (!isLebaneseCoa || !financeStoreId) {
      setPcgClientAccounts([]);
      setPcgLoaded(true);
      return;
    }
    let cancelled = false;
    setPcgLoaded(false);
    void loadPcgClientAccounts(financeStoreId).then((rows) => {
      if (!cancelled) {
        setPcgClientAccounts(rows);
        setPcgLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [financeStoreId, isLebaneseCoa, profileReady]);

  const coaDisplayReady = profileReady && (!isLebaneseCoa || pcgLoaded);

  return (
    <>
      <AccountRangeStatementPanel
        accounts={accounts}
        entries={entries}
        lines={lines}
        isLebaneseCoa={isLebaneseCoa}
        pcgClientAccounts={displayPcgClientAccounts}
        accountingLanguage={accountingLanguage}
        currencyCode={currencyCode}
        usdToLbp={usdToLbp}
        companyName={profile?.name || profile?.storeName}
        loading={loading || !coaDisplayReady}
        onOpenEntry={setEntryId}
      />
      <VoucherDetailDialog
        entry={selected}
        lines={lines}
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setEntryId('')}
        isLebaneseCoa={isLebaneseCoa}
        pcgClientAccounts={displayPcgClientAccounts}
        accountingLanguage={accountingLanguage}
        invoices={invoices}
      />
    </>
  );
}
