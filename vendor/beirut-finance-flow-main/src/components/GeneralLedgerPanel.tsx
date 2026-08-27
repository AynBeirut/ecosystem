import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AccountRangePicker from '@/components/AccountRangePicker';
import ReportCurrencyPicker from '@/components/ReportCurrencyPicker';
import { accountsInCodeRange } from '@/lib/ledger/accountCodeRange';
import { buildGeneralLedgerReport, generalLedgerToCsv } from '@/lib/ledger/generalLedgerReport';
import { createGlPresentationContext } from '@/lib/ledger/glEntryPresentation';
import {
  defaultOperationalAccountRange,
  formatLedgerAmountForMode,
  splitOpeningByNormalBalance,
  type ReportCurrencyMode,
} from '@/lib/ledger/formatLedgerAmount';
import { loadCostCenters } from '@/lib/firestore/costCentersFirestore';
import type { JournalEntry, JournalLine, LedgerAccount, LedgerCostCenter, PcgClientAccount } from '@/types/generalLedger';
import { cn } from '@/lib/utils';
import type { AccountingLanguage } from '@/lib/grabio/accountingMode';
import { downloadCsvText } from '@/lib/csvExport';
import { downloadXlsxFromCsv } from '@/lib/xlsxExport';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type PurchaseOrderLike = {
  id: string;
  supplierId?: string;
  supplierName?: string;
  poNumber?: string;
  purchaseOrderNumber?: string;
};

type PaymentOrderLike = {
  id: string;
  supplierId?: string;
  supplierName?: string;
  purchaseOrderId?: string;
};

type InvoiceLike = {
  id: string;
  invoiceNumber?: string;
  clientName: string;
  amount?: number;
  paymentMethod?: string;
};

type ExpenseLike = {
  id: string;
  category: string;
  name: string;
};

type Props = {
  storeId: string;
  accounts: LedgerAccount[];
  entries: JournalEntry[];
  lines: JournalLine[];
  isLebaneseCoa?: boolean;
  pcgClientAccounts?: PcgClientAccount[];
  accountingLanguage?: AccountingLanguage;
  presetAccountId?: string;
  defaultStartDate?: string;
  defaultEndDate?: string;
  storeCurrency?: string;
  usdToLbp?: number;
  purchaseOrders?: PurchaseOrderLike[];
  paymentOrders?: PaymentOrderLike[];
  invoices?: InvoiceLike[];
  expenses?: ExpenseLike[];
  onOpenEntry?: (entryId: string) => void;
};

function typeBadgeClass(type?: string): string {
  if (type === 'RV' || type === 'Sale') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (type === 'PV') return 'bg-orange-50 text-orange-700 ring-orange-200';
  if (type === 'JV') return 'bg-blue-50 text-blue-700 ring-blue-200';
  if (type === 'CV') return 'bg-violet-50 text-violet-700 ring-violet-200';
  return 'bg-slate-100 text-slate-700 ring-slate-200';
}

export default function GeneralLedgerPanel({
  storeId,
  accounts,
  entries,
  lines,
  isLebaneseCoa,
  pcgClientAccounts = [],
  accountingLanguage,
  presetAccountId,
  defaultStartDate,
  defaultEndDate,
  storeCurrency = 'USD',
  usdToLbp,
  purchaseOrders = [],
  paymentOrders = [],
  invoices = [],
  expenses = [],
  onOpenEntry,
}: Props) {
  const active = useMemo(
    () => accounts.filter((a) => a.isActive).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })),
    [accounts],
  );
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [startDate, setStartDate] = useState(() => defaultStartDate || `${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(() => defaultEndDate || new Date().toISOString().slice(0, 10));
  const [costCenterId, setCostCenterId] = useState('');
  const [costCenters, setCostCenters] = useState<LedgerCostCenter[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [currencyMode, setCurrencyMode] = useState<ReportCurrencyMode>(
    storeCurrency.toUpperCase() === 'USD' ? 'USD' : 'LBP',
  );

  useEffect(() => {
    if (!storeId) return;
    void loadCostCenters(storeId).then(setCostCenters);
  }, [storeId]);

  useEffect(() => {
    if (presetAccountId) {
      setFromAccountId(presetAccountId);
      setToAccountId(presetAccountId);
      setPageIndex(0);
      return;
    }
    if (fromAccountId || toAccountId) return;
    const range = defaultOperationalAccountRange(active);
    const from = active.find((a) => a.code === range.fromCode);
    const to = active.find((a) => a.code === range.toCode);
    if (from) setFromAccountId(from.id);
    if (to) setToAccountId(to.id);
  }, [presetAccountId, active, fromAccountId, toAccountId]);

  useEffect(() => {
    if (defaultStartDate) setStartDate(defaultStartDate);
  }, [defaultStartDate]);

  useEffect(() => {
    if (defaultEndDate) setEndDate(defaultEndDate);
  }, [defaultEndDate]);

  const fromAccount = active.find((a) => a.id === fromAccountId);
  const toAccount = active.find((a) => a.id === toAccountId);
  const ranged = useMemo(() => {
    if (!fromAccount || !toAccount) return [];
    return accountsInCodeRange(active, fromAccount.code, toAccount.code);
  }, [active, fromAccount, toAccount]);

  useEffect(() => {
    setPageIndex(0);
  }, [fromAccountId, toAccountId, startDate, endDate, costCenterId]);

  const selectedAccount = ranged[pageIndex] || null;

  const presentation = useMemo(
    () => createGlPresentationContext(purchaseOrders, paymentOrders, invoices, expenses, accounts),
    [purchaseOrders, paymentOrders, invoices, expenses, accounts],
  );

  const reportCurrency = selectedAccount?.currency === 'LL' ? 'LBP' : selectedAccount?.currency || storeCurrency;

  const report = useMemo(() => {
    if (!selectedAccount) return null;
    return buildGeneralLedgerReport(selectedAccount, entries, lines, {
      startDate,
      endDate,
      costCenterId: costCenterId || undefined,
      defaultCurrency: reportCurrency,
      presentation,
    });
  }, [selectedAccount, entries, lines, startDate, endDate, costCenterId, reportCurrency, presentation]);

  const openingSplit = report
    ? splitOpeningByNormalBalance(report.openingBalance, selectedAccount?.normalBalance)
    : { debit: 0, credit: 0 };

  const fmt = (amount: number) => formatLedgerAmountForMode(amount, storeCurrency, currencyMode, usdToLbp);
  const currencyLabel = currencyMode === 'both' ? 'LBP + USD' : currencyMode;

  const exportCsv = () => {
    if (!fromAccount || !toAccount) return;
    const chunks = ranged.map((account) =>
      generalLedgerToCsv(
        buildGeneralLedgerReport(account, entries, lines, {
          startDate,
          endDate,
          costCenterId: costCenterId || undefined,
          defaultCurrency: account.currency === 'LL' ? 'LBP' : account.currency || storeCurrency,
          presentation,
        }),
      ),
    );
    downloadCsvText(`gl-${fromAccount.code}-${toAccount.code}.csv`, chunks.join('\n\n'));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>General ledger</CardTitle>
        <CardDescription>
          From → To accounts · one account per page · full voucher serial · {currencyLabel}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
          <AccountRangePicker
            accounts={active}
            fromAccountId={fromAccountId}
            toAccountId={toAccountId}
            onFromAccountId={setFromAccountId}
            onToAccountId={setToAccountId}
            isLebaneseCoa={isLebaneseCoa}
            pcgClientAccounts={pcgClientAccounts}
            accountingLanguage={accountingLanguage}
          />
          <div>
            <Label>Cost center</Label>
            <Select value={costCenterId || '__all'} onValueChange={(v) => setCostCenterId(v === '__all' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All</SelectItem>
                {costCenters.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Period from</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label>Period to</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <ReportCurrencyPicker value={currencyMode} onChange={setCurrencyMode} id="gl-currency" />
        </div>

        {report && selectedAccount ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-slate-50 px-3 py-2 text-sm">
              <span>
                Account {pageIndex + 1} of {ranged.length} · {selectedAccount.code} — {selectedAccount.name}
              </span>
              <span className="flex gap-2 print:hidden">
                <Button type="button" variant="outline" size="sm" disabled={pageIndex <= 0} onClick={() => setPageIndex((i) => i - 1)}>Prev</Button>
                <Button type="button" variant="outline" size="sm" disabled={pageIndex >= ranged.length - 1} onClick={() => setPageIndex((i) => i + 1)}>Next</Button>
              </span>
            </div>
            <div className="flex flex-wrap gap-4 text-sm items-center print:break-after-page">
              <span>Opening Dr: <strong>{fmt(openingSplit.debit)}</strong></span>
              <span>Opening Cr: <strong>{fmt(openingSplit.credit)}</strong></span>
              <span>Opening: <strong>{fmt(report.openingBalance)}</strong></span>
              <span>Closing: <strong>{fmt(report.closingBalance)}</strong></span>
              <span className="text-muted-foreground">{report.rows.length} lines</span>
              <Button type="button" variant="outline" size="sm" onClick={exportCsv}>Export CSV</Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => downloadXlsxFromCsv(`gl-${selectedAccount.code}.xlsx`, 'GL', generalLedgerToCsv(report))}
              >
                Export XLSX
              </Button>
            </div>
            <div className="rounded-md border max-h-[32rem] overflow-auto print:max-h-none">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Voucher</TableHead>
                    <TableHead>Party</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Ref</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rows.map((row, idx) => {
                    const serial = row.voucherNumber || row.entryId;
                    return (
                      <TableRow key={`${row.entryId}-${idx}`}>
                        <TableCell className="whitespace-nowrap text-xs">{row.date}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('text-[10px] font-semibold ring-1 ring-inset', typeBadgeClass(row.typeLabel))}>
                            {row.typeLabel || row.voucherType || '—'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs whitespace-nowrap">
                          {onOpenEntry ? (
                            <button
                              type="button"
                              className="text-left text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-900"
                              onClick={() => onOpenEntry(row.entryId)}
                            >
                              {serial}
                            </button>
                          ) : (
                            serial
                          )}
                        </TableCell>
                        <TableCell className="max-w-[140px] truncate text-xs" title={row.party}>
                          {row.party || '—'}
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate text-xs text-muted-foreground" title={row.category}>
                          {row.category || '—'}
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate text-xs" title={row.displayDescription || row.memo}>
                          {row.displayDescription || row.memo || '—'}
                        </TableCell>
                        <TableCell className="font-mono text-xs whitespace-nowrap">{row.reference || '—'}</TableCell>
                        <TableCell className="text-right text-xs whitespace-nowrap">
                          {row.debit ? fmt(row.debit) : '—'}
                        </TableCell>
                        <TableCell className="text-right text-xs whitespace-nowrap">
                          {row.credit ? fmt(row.credit) : '—'}
                        </TableCell>
                        <TableCell className="text-right text-xs whitespace-nowrap font-medium">
                          {fmt(row.runningBalance)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Select From and To accounts to view movements.</p>
        )}
      </CardContent>
    </Card>
  );
}
