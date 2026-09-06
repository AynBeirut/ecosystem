import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import AccountingSideSheet from '@/components/AccountingSideSheet';
import { useLedger } from '@/context/LedgerContext';
import { useAppContext } from '@/context/AppContext';
import { useFinanceShellState } from '@/context/FinanceShellStateContext';
import { useGrabioStore } from '@/hooks/useGrabioStore';
import { useReportExchangeRate } from '@/hooks/useReportExchangeRate';
import AccountRangePicker from '@/components/AccountRangePicker';
import SoaAccountDocument from '@/components/SoaAccountDocument';
import VoucherDetailDialog from '@/components/VoucherDetailDialog';
import {
  accountRangeStatementToCsv,
  buildAccountRangeStatement,
  countAccountsInStatementRange,
} from '@/lib/ledger/accountRangeStatement';
import { normalizeAccountingLanguage } from '@/lib/grabio/accountingMode';
import { loadPcgClientAccounts } from '@/lib/firestore/pcgClientAccountsFirestore';
import type { AccountRangeStatementReport, JournalEntry, PcgClientAccount } from '@/types/generalLedger';
import { downloadCsvText } from '@/lib/csvExport';
import { toast } from 'sonner';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function QuickStatementDialog({ open, onOpenChange }: Props) {
  const { activeOrganizationId } = useAppContext();
  const { accounts, entries, lines, loading } = useLedger();
  const { selectFinanceModule } = useFinanceShellState();
  const { profile, storeId: grabioStoreId } = useGrabioStore();
  const { usdToLbp, storeLedgerCurrency } = useReportExchangeRate();
  const financeStoreId = grabioStoreId || activeOrganizationId || '';
  const currency = storeLedgerCurrency;
  const isLebaneseCoa = profile?.accountingMode === 'lebanese';
  const accountingLanguage = normalizeAccountingLanguage(profile?.accountingLanguage, profile?.accountingMode);

  const active = useMemo(() => accounts.filter((a) => a.isActive), [accounts]);
  const [pcgClientAccounts, setPcgClientAccounts] = useState<PcgClientAccount[]>([]);
  const entryIdRef = useRef('');
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [fromCode, setFromCode] = useState('');
  const [toCode, setToCode] = useState('');
  const [startDate, setStartDate] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<AccountRangeStatementReport | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);
  const tokenRef = useRef(0);

  const accountIdForCode = (code: string) => active.find((a) => a.code === code.trim())?.id ?? '';
  const setFromAccountId = (id: string) => {
    setFromCode(active.find((a) => a.id === id)?.code || '');
    setReport(null);
  };
  const setToAccountId = (id: string) => {
    setToCode(active.find((a) => a.id === id)?.code || '');
    setReport(null);
  };

  const matchedCount = useMemo(() => {
    if (!fromCode.trim() || !toCode.trim()) return 0;
    return countAccountsInStatementRange(active, fromCode, toCode);
  }, [active, fromCode, toCode]);

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
  }, [financeStoreId, isLebaneseCoa]);

  const resetPreview = () => {
    tokenRef.current += 1;
    setComputing(false);
    setReport(null);
    setError(null);
    setPageIndex(0);
    entryIdRef.current = '';
    setSelectedEntry(null);
  };

  const openEntry = (id: string) => {
    const entry = entries.find((row) => row.id === id);
    if (!entry) return;
    entryIdRef.current = id;
    setSelectedEntry(entry);
  };

  const closeEntry = () => {
    entryIdRef.current = '';
    setSelectedEntry(null);
  };

  const handleClose = (next: boolean) => {
    // Radix closes the parent sheet when a child sheet opens — keep statement open.
    if (!next && entryIdRef.current) return;
    if (!next) resetPreview();
    onOpenChange(next);
  };

  const handleDisplay = () => {
    const token = ++tokenRef.current;
    setError(null);
    setReport(null);
    setPageIndex(0);
    setComputing(true);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (tokenRef.current !== token) return;
        try {
          const next = buildAccountRangeStatement(active, entries, lines, {
            fromCode: fromCode.trim(),
            toCode: toCode.trim(),
            startDate,
            endDate,
          });
          setReport(next);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Could not build statement.';
          setError(message);
          toast.error(message);
        } finally {
          if (tokenRef.current === token) setComputing(false);
        }
      });
    });
  };

  const openFullStatement = () => {
    const params = new URLSearchParams({
      from: fromCode.trim(),
      to: toCode.trim(),
      start: startDate.slice(0, 10),
      end: endDate.slice(0, 10),
    });
    sessionStorage.setItem(
      'grabio-finance-soa-prefill',
      JSON.stringify({
        fromCode: fromCode.trim(),
        toCode: toCode.trim(),
        startDate: startDate.slice(0, 10),
        endDate: endDate.slice(0, 10),
        autoDisplay: true,
      }),
    );
    handleClose(false);
    selectFinanceModule(`account-statement?${params.toString()}`);
  };

  const section = report?.sections[pageIndex] || null;

  return (
    <>
      <AccountingSideSheet
        open={open}
        onOpenChange={handleClose}
        title="Quick statement"
        description="Same layout as the printed statement · one account per page"
        className="sm:max-w-4xl"
        bodyClassName="legacy-erp-body space-y-3 p-0 px-6"
        footer={
          <div className="legacy-erp-body flex flex-row flex-wrap gap-2 sm:justify-start">
            <button
              type="button"
              className="legacy-erp-btn legacy-erp-btn--primary"
              disabled={loading || computing || !fromCode.trim() || !toCode.trim()}
              onClick={handleDisplay}
            >
              {computing ? 'Building…' : 'Display'}
            </button>
            {report ? (
              <>
                <button
                  type="button"
                  className="legacy-erp-btn"
                  onClick={() =>
                    downloadCsvText(
                      `quick-soa-${report.fromCode}-${report.toCode}.csv`,
                      accountRangeStatementToCsv(report),
                    )
                  }
                >
                  CSV
                </button>
                <button type="button" className="legacy-erp-btn" onClick={openFullStatement}>
                  Full statement
                </button>
              </>
            ) : null}
            <button type="button" className="legacy-erp-btn ml-auto" onClick={() => handleClose(false)}>
              Close
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-2">
          <AccountRangePicker
            accounts={active}
            fromAccountId={accountIdForCode(fromCode)}
            toAccountId={accountIdForCode(toCode)}
            onFromAccountId={setFromAccountId}
            onToAccountId={setToAccountId}
            isLebaneseCoa={isLebaneseCoa}
            pcgClientAccounts={pcgClientAccounts}
            accountingLanguage={accountingLanguage}
          />
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase text-slate-600">Period from</label>
            <Input
              type="date"
              className="legacy-erp-input"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                resetPreview();
              }}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase text-slate-600">Period to</label>
            <Input
              type="date"
              className="legacy-erp-input"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                resetPreview();
              }}
            />
          </div>
        </div>

        {error ? <div className="legacy-erp-alert legacy-erp-alert--error">{error}</div> : null}
        {matchedCount > 0 ? <p className="text-[11px] text-slate-600">{matchedCount} accounts in range</p> : null}

        {report && section ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span>
                {section.accountCode} — {section.accountName} ({pageIndex + 1}/{report.sections.length})
              </span>
              <span className="flex gap-1">
                <button
                  type="button"
                  className="legacy-erp-btn"
                  disabled={pageIndex <= 0}
                  onClick={() => setPageIndex((i) => i - 1)}
                >
                  Prev
                </button>
                <button
                  type="button"
                  className="legacy-erp-btn"
                  disabled={pageIndex >= report.sections.length - 1}
                  onClick={() => setPageIndex((i) => i + 1)}
                >
                  Next
                </button>
              </span>
            </div>
            <div className="legacy-erp-soa-scroll bg-white p-2">
              <SoaAccountDocument
                report={report}
                section={section}
                account={active.find((a) => a.id === section.accountId)}
                accountName={section.accountName}
                storeCurrency={currency}
                currencyMode={currency.toUpperCase() === 'USD' ? 'USD' : 'LBP'}
                usdToLbp={usdToLbp}
                companyName={profile?.name || profile?.storeName}
                onOpenEntry={openEntry}
                compact
              />
            </div>
          </div>
        ) : null}
      </AccountingSideSheet>

      <VoucherDetailDialog
        entry={selectedEntry}
        lines={lines}
        open={Boolean(selectedEntry)}
        onOpenChange={(next) => !next && closeEntry()}
        isLebaneseCoa={isLebaneseCoa}
        pcgClientAccounts={pcgClientAccounts}
        accountingLanguage={accountingLanguage}
      />
    </>
  );
}
