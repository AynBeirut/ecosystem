import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  accountRangeStatementToCsv,
  ACCOUNT_RANGE_STATEMENT_MAX_DISPLAY_ROWS,
  buildAccountRangeStatement,
  countAccountsInStatementRange,
  validateAccountRangeStatement,
} from '@/lib/ledger/accountRangeStatement';
import { accountCodeNumeric } from '@/lib/ledger/accountCodeRange';
import {
  buildClientByGrabioMap,
  resolvePcgDisplay,
} from '@/lib/ledger/grabioToPcgMap';
import type { AccountingLanguage } from '@/lib/grabio/accountingMode';
import type {
  AccountRangeStatementReport,
  JournalEntry,
  JournalLine,
  LedgerAccount,
  PcgClientAccount,
} from '@/types/generalLedger';
import { cn, formatCurrency } from '@/lib/utils';
import { downloadCsvText } from '@/lib/csvExport';
import { downloadXlsxFromCsv } from '@/lib/xlsxExport';
import { toast } from 'sonner';

type Props = {
  accounts: LedgerAccount[];
  entries: JournalEntry[];
  lines: JournalLine[];
  isLebaneseCoa?: boolean;
  pcgClientAccounts?: PcgClientAccount[];
  accountingLanguage?: AccountingLanguage;
  currencyCode?: string;
  loading?: boolean;
};

const SOA_HEAD = 'px-1 py-1.5 text-[10px] font-semibold leading-tight text-white';
const SOA_NUM_HEAD = `${SOA_HEAD} text-right`;
const SOA_CELL = 'px-1 py-1 align-top text-[11px]';
const SOA_NUM_CELL = `${SOA_CELL} text-right tabular-nums whitespace-nowrap`;

function statementAccounts(accounts: LedgerAccount[], isLebaneseCoa?: boolean) {
  const active = accounts.filter((a) => a.isActive);
  if (!isLebaneseCoa) return active.sort((a, b) => accountCodeNumeric(a.code) - accountCodeNumeric(b.code));
  return active
    .filter((account) => account.pcgKind !== 'G' && !account.isPcgChart)
    .sort((a, b) => accountCodeNumeric(a.code) - accountCodeNumeric(b.code));
}

function shortenMemo(memo: string, max = 56): string {
  const text = memo.trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function formatSoaAmount(value: number, currency: string, emptyZero = false): string {
  if (emptyZero && !value) return '—';
  if (!value) return formatCurrency(0, currency);
  if (value < 0) return `(${formatCurrency(Math.abs(value), currency)})`;
  return formatCurrency(value, currency);
}

export default function AccountRangeStatementPanel({
  accounts,
  entries,
  lines,
  isLebaneseCoa,
  pcgClientAccounts = [],
  accountingLanguage,
  currencyCode = 'LBP',
  loading,
}: Props) {
  const currencyLabel = currencyCode.toUpperCase();
  const selectable = useMemo(() => statementAccounts(accounts, isLebaneseCoa), [accounts, isLebaneseCoa]);
  const clientByGrabio = useMemo(() => buildClientByGrabioMap(pcgClientAccounts), [pcgClientAccounts]);

  const [fromCode, setFromCode] = useState('');
  const [toCode, setToCode] = useState('');
  const [startDate, setStartDate] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<AccountRangeStatementReport | null>(null);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);
  const computeTokenRef = useRef(0);
  const prefillDoneRef = useRef(false);

  const matchedCount = useMemo(() => {
    const from = fromCode.trim();
    const to = toCode.trim();
    if (!from || !to) return 0;
    return countAccountsInStatementRange(selectable, from, to);
  }, [fromCode, toCode, selectable]);

  const promptError = (message: string) => {
    setRangeError(message);
    setReport(null);
    toast.error(message);
  };

  const resetResults = () => {
    computeTokenRef.current += 1;
    setComputing(false);
    setReport(null);
    setRangeError(null);
  };

  const handleDisplayWithValues = (
    from: string,
    to: string,
    start: string,
    end: string,
  ) => {
    const validationError = validateAccountRangeStatement(accounts, from, to, {
      startDate: start,
      endDate: end,
    });
    if (validationError) {
      promptError(validationError);
      return;
    }

    const token = ++computeTokenRef.current;
    setRangeError(null);
    setReport(null);
    setComputing(true);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (computeTokenRef.current !== token) return;
        try {
          const next = buildAccountRangeStatement(accounts, entries, lines, {
            fromCode: from,
            toCode: to,
            startDate: start,
            endDate: end,
          });
          if (next.sections.length === 0) {
            promptError('No movements found for this range and period.');
            return;
          }
          const totalRows = next.sections.reduce((sum, section) => sum + section.rows.length, 0);
          if (totalRows > ACCOUNT_RANGE_STATEMENT_MAX_DISPLAY_ROWS) {
            toast.message(
              `Showing first ${ACCOUNT_RANGE_STATEMENT_MAX_DISPLAY_ROWS} lines on screen — export CSV for the full ${totalRows} lines.`,
            );
          }
          setReport(next);
        } catch (error) {
          promptError(error instanceof Error ? error.message : 'Could not build statement.');
        } finally {
          if (computeTokenRef.current === token) setComputing(false);
        }
      });
    });
  };

  const handleDisplay = () => {
    handleDisplayWithValues(fromCode.trim(), toCode.trim(), startDate, endDate);
  };

  useEffect(() => {
    if (prefillDoneRef.current || loading || accounts.length === 0) return;
    prefillDoneRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const fromParam = params.get('from')?.trim();
    const toParam = params.get('to')?.trim();
    const startParam = params.get('start')?.trim();
    const endParam = params.get('end')?.trim();

    let prefill: {
      fromCode?: string;
      toCode?: string;
      startDate?: string;
      endDate?: string;
      autoDisplay?: boolean;
    } | null = null;

    try {
      const raw = sessionStorage.getItem('grabio-finance-soa-prefill');
      if (raw) {
        prefill = JSON.parse(raw) as typeof prefill;
        sessionStorage.removeItem('grabio-finance-soa-prefill');
      }
    } catch {
      prefill = null;
    }

    const fromCodeValue = prefill?.fromCode || fromParam || '';
    const toCodeValue = prefill?.toCode || toParam || '';
    const startDateValue = prefill?.startDate || startParam || '';
    const endDateValue = prefill?.endDate || endParam || '';

    if (fromCodeValue) setFromCode(fromCodeValue);
    if (toCodeValue) setToCode(toCodeValue);
    if (startDateValue) setStartDate(startDateValue);
    if (endDateValue) setEndDate(endDateValue);

    if ((prefill?.autoDisplay || (fromParam && toParam)) && fromCodeValue && toCodeValue) {
      window.setTimeout(() => {
        handleDisplayWithValues(
          fromCodeValue,
          toCodeValue,
          startDateValue || startDate,
          endDateValue || endDate,
        );
      }, 0);
    }
  }, [accounts, entries, lines, endDate, loading, startDate]);

  const accountName = (account: LedgerAccount) => {
    if (isLebaneseCoa) {
      return resolvePcgDisplay(account.code, account.name, clientByGrabio)?.name || account.name;
    }
    return account.name;
  };

  const canSearch = Boolean(fromCode.trim() && toCode.trim() && !loading && !computing);

  return (
    <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b bg-slate-50/80 pb-4">
        <CardTitle className="text-lg">Statement of account</CardTitle>
        <CardDescription>
          Per-account ledger with opening balance, voucher lines, and running balance · {currencyLabel}.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSearch) handleDisplay();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <label htmlFor="soa-from" className="text-xs font-medium text-slate-700">
                From account
              </label>
              <Input
                id="soa-from"
                className="font-mono bg-white"
                value={fromCode}
                onChange={(e) => {
                  setFromCode(e.target.value);
                  resetResults();
                }}
                placeholder="601"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="soa-to" className="text-xs font-medium text-slate-700">
                To account
              </label>
              <Input
                id="soa-to"
                className="font-mono bg-white"
                value={toCode}
                onChange={(e) => {
                  setToCode(e.target.value);
                  resetResults();
                }}
                placeholder="609"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="soa-start" className="text-xs font-medium text-slate-700">
                Period from
              </label>
              <Input
                id="soa-start"
                type="date"
                className="bg-white"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  resetResults();
                }}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="soa-end" className="text-xs font-medium text-slate-700">
                Period to
              </label>
              <Input
                id="soa-end"
                type="date"
                className="bg-white"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  resetResults();
                }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="submit"
              disabled={!canSearch}
              data-allow-multi-click="true"
              className="h-9 min-w-[7.5rem] bg-[#316ac5] font-semibold uppercase tracking-wide text-white hover:bg-[#2a5dad]"
            >
              {computing ? 'Building…' : 'Search'}
            </Button>
            {report ? (
              <>
                <Button type="button" variant="outline" className="h-9" onClick={() => window.print()}>
                  Print
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9"
                  onClick={() =>
                    downloadCsvText(
                      `soa-${report.fromCode}-${report.toCode}.csv`,
                      accountRangeStatementToCsv(report),
                    )
                  }
                >
                  Export CSV
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9"
                  onClick={() =>
                    downloadXlsxFromCsv(
                      `soa-${report.fromCode}-${report.toCode}.xlsx`,
                      'Statement',
                      accountRangeStatementToCsv(report),
                    )
                  }
                >
                  Export XLSX
                </Button>
              </>
            ) : null}
            {!rangeError && matchedCount > 0 ? (
              <span className="text-xs text-muted-foreground">
                {matchedCount} account{matchedCount === 1 ? '' : 's'} in range
              </span>
            ) : null}
            {loading ? <span className="text-xs text-muted-foreground">Loading ledger…</span> : null}
          </div>
        </form>

        {rangeError ? (
          <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{rangeError}</div>
        ) : null}
        {computing ? <p className="text-sm text-muted-foreground">Building statement…</p> : null}

        {report ? (
          <div className="space-y-4">
            <div className="rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-xs leading-relaxed text-slate-700">
              <strong>{report.accountCount}</strong> account{report.accountCount === 1 ? '' : 's'} · {report.startDate}{' '}
              → {report.endDate} · range {report.fromCode} → {report.toCode}
            </div>
            {report.sections.map((section) => {
              const account = accounts.find((a) => a.id === section.accountId);
              const code = section.accountCode;
              const name = account ? accountName(account) : section.accountName;
              const displayRows = section.rows.slice(0, ACCOUNT_RANGE_STATEMENT_MAX_DISPLAY_ROWS);
              const hiddenRows = section.rows.length - displayRows.length;
              const openingRow = {
                key: `${section.accountId}-opening`,
                date: report.startDate,
                voucher: '—',
                memo: 'Opening balance',
                debit: 0,
                credit: 0,
                balance: section.openingBalance,
                isOpening: true,
              };
              const movementRows = displayRows.map((row, idx) => ({
                key: `${row.entryId}-${idx}`,
                date: row.date,
                voucher: row.voucherNumber || row.entryId.slice(0, 8),
                memo: row.memo || '',
                debit: row.debit,
                credit: row.credit,
                balance: row.runningBalance,
                isOpening: false,
              }));
              const tableRows = [openingRow, ...movementRows];
              return (
                <div key={section.accountId} className="overflow-hidden rounded-md border border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-slate-200 bg-slate-50 px-2 py-1.5">
                    <div className="flex min-w-0 flex-1 items-baseline gap-2">
                      <span className="shrink-0 font-mono text-[11px] font-bold text-slate-800" title={code}>
                        {code}
                      </span>
                      <span className="min-w-0 truncate text-[11px] text-slate-700" title={name}>
                        {name}
                      </span>
                    </div>
                    <span className="shrink-0 text-[10px] tabular-nums text-slate-600">
                      Closing {formatSoaAmount(section.closingBalance, currencyCode)}
                    </span>
                  </div>
                  <div className="max-h-[min(28rem,55vh)] overflow-y-auto overflow-x-hidden">
                    <table className="w-full table-fixed border-collapse">
                      <colgroup>
                        <col className="w-[5.5rem]" />
                        <col className="w-[5rem]" />
                        <col />
                        <col className="w-[5.25rem]" />
                        <col className="w-[5.25rem]" />
                        <col className="w-[5.5rem]" />
                      </colgroup>
                      <thead className="sticky top-0 z-10 bg-[#316ac5]">
                        <tr>
                          <th className={SOA_HEAD}>Date</th>
                          <th className={SOA_HEAD}>Voucher</th>
                          <th className={SOA_HEAD}>Description</th>
                          <th className={SOA_NUM_HEAD}>Debit</th>
                          <th className={SOA_NUM_HEAD}>Credit</th>
                          <th className={SOA_NUM_HEAD}>Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableRows.map((row) => (
                          <tr
                            key={row.key}
                            className={cn(
                              'border-b border-slate-100',
                              row.isOpening && 'bg-slate-50/90 italic text-slate-700',
                            )}
                          >
                            <td className={`${SOA_CELL} whitespace-nowrap text-[10px]`}>{row.date}</td>
                            <td
                              className={`${SOA_CELL} truncate font-mono text-[10px]`}
                              title={row.isOpening ? undefined : row.voucher}
                            >
                              {row.voucher}
                            </td>
                            <td className={`${SOA_CELL} truncate`} title={row.memo || undefined}>
                              {row.memo ? shortenMemo(row.memo) : row.isOpening ? 'Opening balance' : '—'}
                            </td>
                            <td className={cn(SOA_NUM_CELL, !row.debit && 'text-slate-400')}>
                              {formatSoaAmount(row.debit, currencyCode, true)}
                            </td>
                            <td className={cn(SOA_NUM_CELL, !row.credit && 'text-slate-400')}>
                              {formatSoaAmount(row.credit, currencyCode, true)}
                            </td>
                            <td
                              className={cn(
                                SOA_NUM_CELL,
                                'font-semibold',
                                row.balance < 0 && 'text-red-700',
                              )}
                            >
                              {formatSoaAmount(row.balance, currencyCode)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {hiddenRows > 0 ? (
                    <p className="border-t border-slate-100 bg-amber-50/80 px-2 py-1 text-[10px] text-amber-900">
                      {hiddenRows} more line{hiddenRows === 1 ? '' : 's'} not shown — use Export CSV for the full list.
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-center text-sm text-muted-foreground">
            Enter From/To accounts and period, then click Search.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
