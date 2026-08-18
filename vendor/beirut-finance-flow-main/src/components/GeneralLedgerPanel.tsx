import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LedgerAccountCombobox } from '@/components/LedgerAccountCombobox';
import { buildGeneralLedgerReport, generalLedgerToCsv } from '@/lib/ledger/generalLedgerReport';
import { createGlPresentationContext } from '@/lib/ledger/glEntryPresentation';
import { loadCostCenters } from '@/lib/firestore/costCentersFirestore';
import type { JournalEntry, JournalLine, LedgerAccount, LedgerCostCenter, PcgClientAccount } from '@/types/generalLedger';
import { cn, formatCurrency } from '@/lib/utils';
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
  purchaseOrders = [],
  paymentOrders = [],
  invoices = [],
  expenses = [],
  onOpenEntry,
}: Props) {
  const [accountId, setAccountId] = useState('');
  const [startDate, setStartDate] = useState(() => defaultStartDate || `${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(() => defaultEndDate || new Date().toISOString().slice(0, 10));
  const [costCenterId, setCostCenterId] = useState('');
  const [costCenters, setCostCenters] = useState<LedgerCostCenter[]>([]);

  useEffect(() => {
    if (!storeId) return;
    void loadCostCenters(storeId).then(setCostCenters);
  }, [storeId]);

  useEffect(() => {
    if (presetAccountId) setAccountId(presetAccountId);
  }, [presetAccountId]);

  useEffect(() => {
    if (defaultStartDate) setStartDate(defaultStartDate);
  }, [defaultStartDate]);

  useEffect(() => {
    if (defaultEndDate) setEndDate(defaultEndDate);
  }, [defaultEndDate]);

  const selectedAccount = accounts.find((a) => a.id === accountId);

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

  const fmt = (amount: number, currency?: string) => formatCurrency(amount, currency || reportCurrency);

  return (
    <Card>
      <CardHeader>
        <CardTitle>General ledger</CardTitle>
        <CardDescription>
          Client/supplier, category (expense · purchase · sales), and running balance · {reportCurrency}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Account</Label>
            <LedgerAccountCombobox
              accounts={accounts.filter((a) => a.isActive)}
              value={accountId}
              onValueChange={setAccountId}
              isLebaneseCoa={isLebaneseCoa}
              pcgClientAccounts={pcgClientAccounts}
              accountingLanguage={accountingLanguage}
            />
          </div>
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
            <Label>From</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label>To</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        {report ? (
          <>
            <div className="flex flex-wrap gap-4 text-sm items-center">
              <span>Opening: <strong>{fmt(report.openingBalance)}</strong></span>
              <span>Closing: <strong>{fmt(report.closingBalance)}</strong></span>
              <span className="text-muted-foreground">{report.rows.length} lines</span>
              <Button type="button" variant="outline" size="sm" onClick={() => downloadCsvText(`gl-${report.accountCode}.csv`, generalLedgerToCsv(report))}>
                Export CSV
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => downloadXlsxFromCsv(`gl-${report.accountCode}.xlsx`, 'GL', generalLedgerToCsv(report))}>
                Export XLSX
              </Button>
            </div>
            <div className="rounded-md border max-h-[32rem] overflow-auto">
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
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rows.map((row, idx) => (
                    <TableRow key={`${row.entryId}-${idx}`}>
                      <TableCell className="whitespace-nowrap text-xs">{row.date}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('text-[10px] font-semibold ring-1 ring-inset', typeBadgeClass(row.typeLabel))}>
                          {row.typeLabel || row.voucherType || '—'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        {row.voucherNumber || row.entryId.slice(0, 10)}
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
                        {row.debit ? fmt(row.debit, row.currency) : '—'}
                      </TableCell>
                      <TableCell className="text-right text-xs whitespace-nowrap">
                        {row.credit ? fmt(row.credit, row.currency) : '—'}
                      </TableCell>
                      <TableCell className="text-right text-xs whitespace-nowrap font-medium">
                        {fmt(row.runningBalance, row.currency)}
                      </TableCell>
                      <TableCell>
                        {onOpenEntry ? (
                          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenEntry(row.entryId)}>View</Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Select an account to view movements.</p>
        )}
      </CardContent>
    </Card>
  );
}
