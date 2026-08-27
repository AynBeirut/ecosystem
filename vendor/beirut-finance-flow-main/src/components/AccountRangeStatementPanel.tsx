import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import AccountRangePicker from '@/components/AccountRangePicker';
import ReportCurrencyPicker from '@/components/ReportCurrencyPicker';
import SoaAccountDocument from '@/components/SoaAccountDocument';
import {
  accountRangeStatementToCsv,
  buildAccountRangeStatement,
  countAccountsInStatementRange,
} from '@/lib/ledger/accountRangeStatement';
import { accountCodeNumeric } from '@/lib/ledger/accountCodeRange';
import { buildClientByGrabioMap, resolvePcgDisplay } from '@/lib/ledger/grabioToPcgMap';
import { defaultOperationalAccountRange, type ReportCurrencyMode } from '@/lib/ledger/formatLedgerAmount';
import type { AccountingLanguage } from '@/lib/grabio/accountingMode';
import type {
  AccountRangeStatementReport,
  JournalEntry,
  JournalLine,
  LedgerAccount,
  PcgClientAccount,
} from '@/types/generalLedger';
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
  usdToLbp?: number;
  companyName?: string;
  loading?: boolean;
  onOpenEntry?: (entryId: string) => void;
};

function statementAccounts(accounts: LedgerAccount[]) {
  return accounts
    .filter((a) => a.isActive)
    .sort((a, b) => accountCodeNumeric(a.code) - accountCodeNumeric(b.code));
}

export default function AccountRangeStatementPanel({
  accounts,
  entries,
  lines,
  isLebaneseCoa,
  pcgClientAccounts = [],
  accountingLanguage,
  currencyCode = 'LBP',
  usdToLbp,
  companyName,
  loading,
  onOpenEntry,
}: Props) {
  const selectable = useMemo(() => statementAccounts(accounts), [accounts]);
  const clientByGrabio = useMemo(() => buildClientByGrabioMap(pcgClientAccounts), [pcgClientAccounts]);
  const [currencyMode, setCurrencyMode] = useState<ReportCurrencyMode>(
    currencyCode.toUpperCase() === 'USD' ? 'USD' : 'LBP',
  );

  const [fromCode, setFromCode] = useState('');
  const [toCode, setToCode] = useState('');
  const [startDate, setStartDate] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<AccountRangeStatementReport | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
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

  const accountIdForCode = (code: string) =>
    selectable.find((account) => account.code === code.trim())?.id ?? '';

  const setFromAccountId = (accountId: string) => {
    const account = selectable.find((a) => a.id === accountId);
    setFromCode(account?.code || '');
    setReport(null);
    setPageIndex(0);
  };
  const setToAccountId = (accountId: string) => {
    const account = selectable.find((a) => a.id === accountId);
    setToCode(account?.code || '');
    setReport(null);
    setPageIndex(0);
  };

  const promptError = (message: string) => {
    setRangeError(message);
    setReport(null);
    toast.error(message);
  };

  const handleDisplayWithValues = (from: string, to: string, start: string, end: string) => {
    const token = ++computeTokenRef.current;
    setRangeError(null);
    setReport(null);
    setPageIndex(0);
    setComputing(true);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (computeTokenRef.current !== token) return;
        try {
          const next = buildAccountRangeStatement(selectable, entries, lines, {
            fromCode: from,
            toCode: to,
            startDate: start,
            endDate: end,
          });
          if (next.sections.length === 0) {
            promptError('No accounts in this range for the selected period.');
            return;
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

  useEffect(() => {
    if (fromCode.trim() || toCode.trim()) return;
    const range = defaultOperationalAccountRange(selectable);
    if (!range.fromCode) return;
    setFromCode(range.fromCode);
    setToCode(range.toCode);
  }, [selectable, fromCode, toCode]);

  useEffect(() => {
    if (prefillDoneRef.current || loading || accounts.length === 0) return;
    prefillDoneRef.current = true;
    const params = new URLSearchParams(window.location.search);
    let prefill: { fromCode?: string; toCode?: string; startDate?: string; endDate?: string; autoDisplay?: boolean } | null =
      null;
    try {
      const raw = sessionStorage.getItem('grabio-finance-soa-prefill');
      if (raw) {
        prefill = JSON.parse(raw) as typeof prefill;
        sessionStorage.removeItem('grabio-finance-soa-prefill');
      }
    } catch {
      prefill = null;
    }
    const fromCodeValue = prefill?.fromCode || params.get('from')?.trim() || '';
    const toCodeValue = prefill?.toCode || params.get('to')?.trim() || '';
    const startDateValue = prefill?.startDate || params.get('start')?.trim() || '';
    const endDateValue = prefill?.endDate || params.get('end')?.trim() || '';
    if (fromCodeValue) setFromCode(fromCodeValue);
    if (toCodeValue) setToCode(toCodeValue);
    if (startDateValue) setStartDate(startDateValue);
    if (endDateValue) setEndDate(endDateValue);
    if ((prefill?.autoDisplay || (params.get('from') && params.get('to'))) && fromCodeValue && toCodeValue) {
      window.setTimeout(() => {
        handleDisplayWithValues(fromCodeValue, toCodeValue, startDateValue || startDate, endDateValue || endDate);
      }, 0);
    }
  }, [accounts, entries, lines, endDate, loading, startDate]);

  const accountName = (account: LedgerAccount) => {
    if (isLebaneseCoa) return resolvePcgDisplay(account.code, account.name, clientByGrabio)?.name || account.name;
    return account.name;
  };

  const canSearch = Boolean(fromCode.trim() && toCode.trim() && !loading && !computing);
  const section = report?.sections[pageIndex] || null;
  const pageCount = report?.sections.length || 0;
  const sectionAccount = section ? accounts.find((a) => a.id === section.accountId) : undefined;

  return (
    <Card className="overflow-hidden border-slate-200 bg-white shadow-sm print:border-0 print:shadow-none">
      <CardHeader className="border-b bg-slate-50/80 pb-4 print:hidden">
        <CardTitle className="text-lg">Statement of account</CardTitle>
        <CardDescription>One account per page · B/F opening · running Db/Cr balance.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <form
          className="space-y-3 print:hidden"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSearch) handleDisplayWithValues(fromCode.trim(), toCode.trim(), startDate, endDate);
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <AccountRangePicker
              accounts={selectable}
              fromAccountId={accountIdForCode(fromCode)}
              toAccountId={accountIdForCode(toCode)}
              onFromAccountId={setFromAccountId}
              onToAccountId={setToAccountId}
              isLebaneseCoa={isLebaneseCoa}
              pcgClientAccounts={pcgClientAccounts}
              accountingLanguage={accountingLanguage}
            />
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Period from</label>
              <Input type="date" className="bg-white" value={startDate} onChange={(e) => { setStartDate(e.target.value); setReport(null); }} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Period to</label>
              <Input type="date" className="bg-white" value={endDate} onChange={(e) => { setEndDate(e.target.value); setReport(null); }} />
            </div>
            <ReportCurrencyPicker value={currencyMode} onChange={setCurrencyMode} id="soa-currency" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={!canSearch} className="h-9 min-w-[7.5rem] bg-[#316ac5] font-semibold uppercase text-white hover:bg-[#2a5dad]">
              {computing ? 'Building…' : 'Search'}
            </Button>
            {report ? (
              <>
                <Button type="button" variant="outline" className="h-9" onClick={() => window.print()}>Print</Button>
                <Button type="button" variant="outline" className="h-9" onClick={() => downloadCsvText(`soa-${report.fromCode}-${report.toCode}.csv`, accountRangeStatementToCsv(report))}>
                  Export CSV
                </Button>
                <Button type="button" variant="outline" className="h-9" onClick={() => downloadXlsxFromCsv(`soa-${report.fromCode}-${report.toCode}.xlsx`, 'Statement', accountRangeStatementToCsv(report))}>
                  Export XLSX
                </Button>
              </>
            ) : null}
            {matchedCount > 0 ? <span className="text-xs text-muted-foreground">{matchedCount} accounts in range</span> : null}
          </div>
        </form>

        {rangeError ? <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 print:hidden">{rangeError}</div> : null}

        {report && section ? (
          <div className="space-y-3 print:break-after-page">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-xs text-slate-700 print:hidden">
              <span>
                Account {pageIndex + 1} of {pageCount}
              </span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" disabled={pageIndex <= 0} onClick={() => setPageIndex((i) => Math.max(0, i - 1))}>
                  Prev
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={pageIndex >= pageCount - 1} onClick={() => setPageIndex((i) => Math.min(pageCount - 1, i + 1))}>
                  Next
                </Button>
              </div>
            </div>
            <SoaAccountDocument
              report={report}
              section={section}
              account={sectionAccount}
              accountName={sectionAccount ? accountName(sectionAccount) : section.accountName}
              storeCurrency={currencyCode}
              currencyMode={currencyMode}
              usdToLbp={usdToLbp}
              companyName={companyName}
              onOpenEntry={onOpenEntry}
            />
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-center text-sm text-muted-foreground print:hidden">
            Choose From/To accounts and period, then click Search.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
