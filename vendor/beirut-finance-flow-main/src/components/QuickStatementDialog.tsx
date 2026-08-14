import { useMemo, useRef, useState } from 'react';
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
import {
  accountRangeStatementToCsv,
  buildAccountRangeStatement,
  countAccountsInStatementRange,
  validateAccountRangeStatement,
} from '@/lib/ledger/accountRangeStatement';
import type { AccountRangeStatementReport } from '@/types/generalLedger';
import { cn, formatCurrency } from '@/lib/utils';
import { downloadCsvText } from '@/lib/csvExport';
import { toast } from 'sonner';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const QUICK_DIALOG_ROW_LIMIT = 80;

export default function QuickStatementDialog({ open, onOpenChange }: Props) {
  const { accounts, entries, lines, loading } = useLedger();
  const { selectFinanceModule } = useFinanceShellState();

  const [fromCode, setFromCode] = useState('');
  const [toCode, setToCode] = useState('');
  const [startDate, setStartDate] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<AccountRangeStatementReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);
  const tokenRef = useRef(0);

  const matchedCount = useMemo(() => {
    const from = fromCode.trim();
    const to = toCode.trim();
    if (!from || !to) return 0;
    return countAccountsInStatementRange(accounts, from, to);
  }, [accounts, fromCode, toCode]);

  const resetPreview = () => {
    tokenRef.current += 1;
    setComputing(false);
    setReport(null);
    setError(null);
  };

  const handleClose = (next: boolean) => {
    if (!next) resetPreview();
    onOpenChange(next);
  };

  const promptError = (message: string) => {
    setError(message);
    setReport(null);
    toast.error(message);
  };

  const handleDisplay = () => {
    const validationError = validateAccountRangeStatement(accounts, fromCode.trim(), toCode.trim(), {
      startDate,
      endDate,
    });
    if (validationError) {
      promptError(validationError);
      return;
    }

    const token = ++tokenRef.current;
    setError(null);
    setReport(null);
    setComputing(true);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (tokenRef.current !== token) return;
        try {
          const next = buildAccountRangeStatement(accounts, entries, lines, {
            fromCode: fromCode.trim(),
            toCode: toCode.trim(),
            startDate,
            endDate,
          });
          setReport(next);
        } catch (err) {
          promptError(err instanceof Error ? err.message : 'Could not build statement.');
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

  let rowsShown = 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="legacy-erp-shell max-w-lg gap-0 overflow-hidden border-slate-400 p-0 text-slate-900">
        <DialogHeader className="legacy-erp-toolbar mb-0 rounded-none border-b px-3 py-2 text-left normal-case">
          <DialogTitle className="text-sm font-semibold uppercase tracking-wide">Quick statement</DialogTitle>
          <DialogDescription className="text-[11px] normal-case text-slate-600">
            Account range and period — classes 1–7
          </DialogDescription>
        </DialogHeader>

        <div className="legacy-erp-body space-y-3 p-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="quick-soa-from" className="mb-1 block text-[11px] font-semibold uppercase text-slate-600">
                From account
              </label>
              <Input
                id="quick-soa-from"
                className="legacy-erp-input font-mono"
                value={fromCode}
                onChange={(e) => {
                  setFromCode(e.target.value);
                  resetPreview();
                }}
                placeholder="601"
              />
            </div>
            <div>
              <label htmlFor="quick-soa-to" className="mb-1 block text-[11px] font-semibold uppercase text-slate-600">
                To account
              </label>
              <Input
                id="quick-soa-to"
                className="legacy-erp-input font-mono"
                value={toCode}
                onChange={(e) => {
                  setToCode(e.target.value);
                  resetPreview();
                }}
                placeholder="609"
              />
            </div>
            <div>
              <label htmlFor="quick-soa-start" className="mb-1 block text-[11px] font-semibold uppercase text-slate-600">
                Period from
              </label>
              <Input
                id="quick-soa-start"
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
              <label htmlFor="quick-soa-end" className="mb-1 block text-[11px] font-semibold uppercase text-slate-600">
                Period to
              </label>
              <Input
                id="quick-soa-end"
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
          {!error && matchedCount > 0 ? (
            <p className="text-[11px] text-slate-600">{matchedCount} account{matchedCount === 1 ? '' : 's'} in range</p>
          ) : null}

          {computing ? <p className="text-[11px] text-slate-600">Building…</p> : null}

          {report ? (
            <div className="space-y-2">
              <div className="legacy-erp-soa-summary">
                {report.accountCount} account{report.accountCount === 1 ? '' : 's'} · {report.startDate} → {report.endDate}
              </div>
              <div className="legacy-erp-soa-scroll max-h-52">
                <table className="legacy-erp-grid">
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th className="legacy-erp-num">Open</th>
                      <th className="legacy-erp-num">Close</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.sections.map((section) => (
                      <tr key={section.accountId}>
                        <td className="font-mono">
                          {section.accountCode} — {section.accountName}
                        </td>
                        <td className="legacy-erp-num">{formatCurrency(section.openingBalance)}</td>
                        <td className="legacy-erp-num">{formatCurrency(section.closingBalance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {report.sections.some((s) => s.rows.length > 0) ? (
                <div className="legacy-erp-soa-scroll max-h-40">
                  <table className="legacy-erp-grid">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Voucher</th>
                        <th className="legacy-erp-num">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.sections.flatMap((section) =>
                        section.rows.map((row, idx) => {
                          if (rowsShown >= QUICK_DIALOG_ROW_LIMIT) return null;
                          rowsShown += 1;
                          return (
                            <tr key={`${section.accountId}-${row.entryId}-${idx}`}>
                              <td>{row.date}</td>
                              <td className="font-mono">{row.voucherNumber || row.entryId.slice(0, 8)}</td>
                              <td className={cn('legacy-erp-num font-semibold')}>{formatCurrency(row.runningBalance)}</td>
                            </tr>
                          );
                        }),
                      )}
                    </tbody>
                  </table>
                </div>
              ) : null}
              {report.sections.reduce((n, s) => n + s.rows.length, 0) > QUICK_DIALOG_ROW_LIMIT ? (
                <p className="text-[11px] text-amber-800">Preview truncated — open full statement or export CSV.</p>
              ) : null}
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
