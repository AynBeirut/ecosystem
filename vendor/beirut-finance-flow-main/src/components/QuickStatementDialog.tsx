import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useLedger } from '@/context/LedgerContext';
import { useFinanceShellState } from '@/context/FinanceShellStateContext';
import { useGrabioStore } from '@/hooks/useGrabioStore';
import AccountRangePicker from '@/components/AccountRangePicker';
import SoaAccountDocument from '@/components/SoaAccountDocument';
import {
  accountRangeStatementToCsv,
  buildAccountRangeStatement,
  countAccountsInStatementRange,
} from '@/lib/ledger/accountRangeStatement';
import { defaultOperationalAccountRange } from '@/lib/ledger/formatLedgerAmount';
import type { AccountRangeStatementReport } from '@/types/generalLedger';
import { downloadCsvText } from '@/lib/csvExport';
import { toast } from 'sonner';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function QuickStatementDialog({ open, onOpenChange }: Props) {
  const { accounts, entries, lines, loading } = useLedger();
  const { selectFinanceModule } = useFinanceShellState();
  const { profile } = useGrabioStore();
  const currency = profile?.mainCurrency || 'LBP';
  const isLebaneseCoa = profile?.accountingMode === 'lebanese';

  const active = useMemo(() => accounts.filter((a) => a.isActive), [accounts]);
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
    if (!open || fromCode || toCode) return;
    const range = defaultOperationalAccountRange(active);
    setFromCode(range.fromCode);
    setToCode(range.toCode);
  }, [open, active, fromCode, toCode]);

  const resetPreview = () => {
    tokenRef.current += 1;
    setComputing(false);
    setReport(null);
    setError(null);
    setPageIndex(0);
  };

  const handleClose = (next: boolean) => {
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
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="legacy-erp-shell max-w-4xl gap-0 overflow-hidden border-slate-400 p-0 text-slate-900">
        <DialogHeader className="legacy-erp-toolbar mb-0 rounded-none border-b px-3 py-2 text-left normal-case">
          <DialogTitle className="text-sm font-semibold uppercase tracking-wide">Quick statement</DialogTitle>
          <DialogDescription className="text-[11px] normal-case text-slate-600">
            Same layout as the printed statement · one account per page
          </DialogDescription>
        </DialogHeader>

        <div className="legacy-erp-body space-y-3 p-3">
          <div className="grid grid-cols-2 gap-2">
            <AccountRangePicker
              accounts={active}
              fromAccountId={accountIdForCode(fromCode)}
              toAccountId={accountIdForCode(toCode)}
              onFromAccountId={setFromAccountId}
              onToAccountId={setToAccountId}
              isLebaneseCoa={isLebaneseCoa}
            />
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase text-slate-600">Period from</label>
              <Input type="date" className="legacy-erp-input" value={startDate} onChange={(e) => { setStartDate(e.target.value); resetPreview(); }} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase text-slate-600">Period to</label>
              <Input type="date" className="legacy-erp-input" value={endDate} onChange={(e) => { setEndDate(e.target.value); resetPreview(); }} />
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
                  <button type="button" className="legacy-erp-btn" disabled={pageIndex <= 0} onClick={() => setPageIndex((i) => i - 1)}>Prev</button>
                  <button type="button" className="legacy-erp-btn" disabled={pageIndex >= report.sections.length - 1} onClick={() => setPageIndex((i) => i + 1)}>Next</button>
                </span>
              </div>
              <div className="legacy-erp-soa-scroll max-h-80 overflow-auto bg-white p-2">
                <SoaAccountDocument
                  report={report}
                  section={section}
                  account={active.find((a) => a.id === section.accountId)}
                  accountName={section.accountName}
                  storeCurrency={currency}
                  currencyMode={currency.toUpperCase() === 'USD' ? 'USD' : 'LBP'}
                  usdToLbp={profile?.customExchangeRate}
                  companyName={profile?.name || profile?.storeName}
                  compact
                />
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="legacy-erp-body flex-row flex-wrap gap-2 border-t border-slate-400/60 px-3 py-2 sm:justify-start">
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
              <button type="button" className="legacy-erp-btn" onClick={() => downloadCsvText(`quick-soa-${report.fromCode}-${report.toCode}.csv`, accountRangeStatementToCsv(report))}>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
