import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import AccountRangePicker from '@/components/AccountRangePicker';
import ReportCurrencyPicker from '@/components/ReportCurrencyPicker';
import ReportAmountCell from '@/components/ReportAmountCell';
import { accountsInCodeRange } from '@/lib/ledger/accountCodeRange';
import { buildGeneralLedgerReport, generalLedgerToCsv } from '@/lib/ledger/generalLedgerReport';
import { createGlPresentationContext } from '@/lib/ledger/glEntryPresentation';
import {
  buildClientByGrabioMap,
  buildClientByParentPcgMap,
  buildClientByLedgerCodeMap,
  buildClientByPartyMap,
  displayPcgCodeForLedgerRow,
  mapPcgCodeToGrabioCodes,
} from '@/lib/ledger/grabioToPcgMap';
import {
  defaultReportCurrencyMode,
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
import {
  legacyReportBodyClass,
  legacyReportCardClass,
  legacyReportHeaderClass,
  legacyReportOmitTitleBand,
  legacyReportTableClass,
  legacyReportThClass,
} from '@/components/legacyErpReportFrame';

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

import type { GlVoucherSummary } from '@/components/GlVoucherSummaryStrip';

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
  onOpenEntry?: (entryId: string, glSummary?: GlVoucherSummary) => void;
};

function typeBadgeClass(type?: string): string {
  if (type === 'RV' || type === 'Sale') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (type === 'PV') return 'bg-orange-50 text-orange-700 ring-orange-200';
  if (type === 'JV') return 'bg-blue-50 text-blue-700 ring-blue-200';
  if (type === 'CV') return 'bg-violet-50 text-violet-700 ring-violet-200';
  return 'bg-slate-100 text-slate-700 ring-slate-200';
}

const GL_CELL = 'px-1.5 py-1.5 text-xs align-middle truncate';
const GL_NUM = 'px-1.5 py-1.5 text-right text-xs tabular-nums align-top';
const GL_NUM_BOTH = 'px-1 py-1 text-right text-[11px] align-top whitespace-normal';

function isOperationalPostingAccount(account: LedgerAccount): boolean {
  return account.isActive !== false && !account.isPcgChart && account.pcgKind !== 'G';
}

function resolveOperationalAccount(
  account: LedgerAccount | undefined,
  operationalAccounts: LedgerAccount[],
  clientByParentPcg: Map<string, PcgClientAccount[]>,
): LedgerAccount | undefined {
  if (!account) return undefined;
  if (isOperationalPostingAccount(account)) return account;

  const clientGrabio = clientByParentPcg.get(account.code)?.map((row) => row.grabioOperationalCode).filter(Boolean);
  for (const grabio of clientGrabio || []) {
    const hit = operationalAccounts.find((row) => row.code === grabio);
    if (hit) return hit;
  }
  for (const grabio of mapPcgCodeToGrabioCodes(account.code)) {
    const hit = operationalAccounts.find((row) => row.code === grabio);
    if (hit) return hit;
  }
  return undefined;
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
  const operationalAccounts = useMemo(
    () => active.filter(isOperationalPostingAccount),
    [active],
  );
  const clientByGrabio = useMemo(() => buildClientByGrabioMap(pcgClientAccounts), [pcgClientAccounts]);
  const clientByParentPcg = useMemo(() => buildClientByParentPcgMap(pcgClientAccounts), [pcgClientAccounts]);
  const clientByLedgerCode = useMemo(() => buildClientByLedgerCodeMap(pcgClientAccounts), [pcgClientAccounts]);
  const clientByParty = useMemo(() => buildClientByPartyMap(pcgClientAccounts), [pcgClientAccounts]);
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [startDate, setStartDate] = useState(() => defaultStartDate || `${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(() => defaultEndDate || new Date().toISOString().slice(0, 10));
  const [costCenterId, setCostCenterId] = useState('');
  const [costCenters, setCostCenters] = useState<LedgerCostCenter[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [currencyMode, setCurrencyMode] = useState<ReportCurrencyMode>(() =>
    defaultReportCurrencyMode(storeCurrency || 'USD'),
  );

  useEffect(() => {
    if (!storeId) return;
    void loadCostCenters(storeId).then(setCostCenters);
  }, [storeId]);

  useEffect(() => {
    if (!presetAccountId) return;
    setFromAccountId(presetAccountId);
    setToAccountId(presetAccountId);
    setPageIndex(0);
  }, [presetAccountId]);

  useEffect(() => {
    if (defaultStartDate) setStartDate(defaultStartDate);
  }, [defaultStartDate]);

  useEffect(() => {
    if (defaultEndDate) setEndDate(defaultEndDate);
  }, [defaultEndDate]);

  const fromAccount = resolveOperationalAccount(
    active.find((a) => a.id === fromAccountId),
    operationalAccounts,
    clientByParentPcg,
  );
  const toAccount = resolveOperationalAccount(
    active.find((a) => a.id === toAccountId),
    operationalAccounts,
    clientByParentPcg,
  );
  const ranged = useMemo(() => {
    if (!fromAccount || !toAccount) return [];
    return accountsInCodeRange(operationalAccounts, fromAccount.code, toAccount.code);
  }, [operationalAccounts, fromAccount, toAccount]);

  useEffect(() => {
    setPageIndex(0);
  }, [fromAccountId, toAccountId, startDate, endDate, costCenterId]);

  useEffect(() => {
    if (pageIndex < ranged.length) return;
    setPageIndex(Math.max(0, ranged.length - 1));
  }, [pageIndex, ranged.length]);

  useEffect(() => {
    const rawFrom = active.find((a) => a.id === fromAccountId);
    const rawTo = active.find((a) => a.id === toAccountId);
    const resolvedFrom = resolveOperationalAccount(rawFrom, operationalAccounts, clientByParentPcg);
    const resolvedTo = resolveOperationalAccount(rawTo, operationalAccounts, clientByParentPcg);
    if (rawFrom && resolvedFrom && rawFrom.id !== resolvedFrom.id) setFromAccountId(resolvedFrom.id);
    if (rawTo && resolvedTo && rawTo.id !== resolvedTo.id) setToAccountId(resolvedTo.id);
  }, [fromAccountId, toAccountId, active, operationalAccounts, clientByParentPcg]);

  const selectedAccount = ranged[pageIndex] || null;
  const selectedDisplayCode =
    selectedAccount && isLebaneseCoa
      ? displayPcgCodeForLedgerRow(
          selectedAccount,
          clientByGrabio,
          clientByParentPcg,
          clientByLedgerCode,
          clientByParty,
        )
      : selectedAccount?.code;

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
  const isBothCurrency = currencyMode === 'both';
  const amountCellClass = isBothCurrency ? GL_NUM_BOTH : cn(GL_NUM, 'whitespace-nowrap align-middle');
  const tableColSpan = isBothCurrency ? 9 : 10;

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
    <Card className={legacyReportCardClass(isLebaneseCoa)}>
      {!legacyReportOmitTitleBand(isLebaneseCoa) ? (
        <CardHeader className={legacyReportHeaderClass(isLebaneseCoa)}>
          <CardTitle>General ledger</CardTitle>
          <CardDescription>
            From → To accounts · one account per page · full voucher serial · {currencyLabel}
          </CardDescription>
        </CardHeader>
      ) : null}
      <CardContent className={legacyReportBodyClass(isLebaneseCoa, 'min-w-0')}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
          <AccountRangePicker
            accounts={operationalAccounts}
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
                Account {pageIndex + 1} of {ranged.length} · {selectedDisplayCode} — {selectedAccount.name}
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
            <div className="rounded-md border bg-background print:max-h-none">
              <table className={legacyReportTableClass(isLebaneseCoa, 'w-full table-fixed border-collapse')}>
                <colgroup>
                  <col style={{ width: isBothCurrency ? '7%' : '8%' }} />
                  <col style={{ width: isBothCurrency ? '5%' : '6%' }} />
                  <col style={{ width: isBothCurrency ? '9%' : '10%' }} />
                  <col style={{ width: isBothCurrency ? '12%' : '11%' }} />
                  {!isBothCurrency ? <col style={{ width: '11%' }} /> : null}
                  <col style={{ width: isBothCurrency ? '20%' : '16%' }} />
                  <col style={{ width: isBothCurrency ? '7%' : '8%' }} />
                  <col style={{ width: isBothCurrency ? '13%' : '10%' }} />
                  <col style={{ width: isBothCurrency ? '13%' : '10%' }} />
                  <col style={{ width: isBothCurrency ? '14%' : '10%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className={legacyReportThClass(isLebaneseCoa)}>Date</th>
                    <th className={legacyReportThClass(isLebaneseCoa)}>Type</th>
                    <th className={legacyReportThClass(isLebaneseCoa)}>Voucher</th>
                    <th className={legacyReportThClass(isLebaneseCoa)}>Party</th>
                    {!isBothCurrency ? <th className={legacyReportThClass(isLebaneseCoa)}>Category</th> : null}
                    <th className={legacyReportThClass(isLebaneseCoa)}>Details</th>
                    <th className={legacyReportThClass(isLebaneseCoa)}>Ref</th>
                    <th className={legacyReportThClass(isLebaneseCoa, 'text-right')}>Debit</th>
                    <th className={legacyReportThClass(isLebaneseCoa, 'text-right')}>Credit</th>
                    <th className={legacyReportThClass(isLebaneseCoa, 'text-right')}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.length === 0 ? (
                    <tr>
                      <td colSpan={tableColSpan} className="px-3 py-10 text-center text-sm text-muted-foreground">
                        No movements in {startDate} → {endDate} for this account. Widen the period or pick another
                        operational account (posting accounts only — not PCG group rows).
                      </td>
                    </tr>
                  ) : (
                    report.rows.map((row, idx) => {
                    const serial = row.voucherNumber || row.entryId;
                    const dateLabel = String(row.date || '').slice(0, 10);
                    const glSummary = {
                      typeLabel: row.typeLabel,
                      party: row.party,
                      category: row.category,
                      description: row.displayDescription || row.memo,
                      reference: row.reference,
                    };
                    return (
                      <tr
                        key={`${row.entryId}-${idx}`}
                        className={cn('border-b hover:bg-muted/40', onOpenEntry && 'cursor-default')}
                        title={onOpenEntry ? 'Double-click to open voucher' : undefined}
                        onDoubleClick={() => onOpenEntry?.(row.entryId, glSummary)}
                      >
                        <td className={cn(GL_CELL, 'whitespace-nowrap')}>{dateLabel}</td>
                        <td className={GL_CELL}>
                          <Badge
                            variant="outline"
                            className={cn('max-w-full truncate text-[10px] font-semibold ring-1 ring-inset', typeBadgeClass(row.typeLabel))}
                          >
                            {row.typeLabel || row.voucherType || '—'}
                          </Badge>
                        </td>
                        <td className={cn(GL_CELL, 'font-mono text-sky-900')} title={serial}>
                          <span className="block truncate">{serial}</span>
                        </td>
                        <td className={GL_CELL} title={row.party}>
                          {row.party || '—'}
                        </td>
                        {!isBothCurrency ? (
                          <td className={cn(GL_CELL, 'text-muted-foreground')} title={row.category}>
                            {row.category || '—'}
                          </td>
                        ) : null}
                        <td className={GL_CELL} title={[row.category, row.displayDescription || row.memo].filter(Boolean).join(' · ') || undefined}>
                          {row.displayDescription || row.memo || '—'}
                        </td>
                        <td className={cn(GL_CELL, 'font-mono')} title={row.reference}>
                          {row.reference || '—'}
                        </td>
                        <td className={amountCellClass}>
                          <ReportAmountCell
                            amount={row.debit}
                            storeCurrency={storeCurrency}
                            mode={currencyMode}
                            usdToLbp={usdToLbp}
                          />
                        </td>
                        <td className={amountCellClass}>
                          <ReportAmountCell
                            amount={row.credit}
                            storeCurrency={storeCurrency}
                            mode={currencyMode}
                            usdToLbp={usdToLbp}
                          />
                        </td>
                        <td className={cn(amountCellClass, 'font-medium')}>
                          <ReportAmountCell
                            amount={row.runningBalance}
                            storeCurrency={storeCurrency}
                            mode={currencyMode}
                            usdToLbp={usdToLbp}
                          />
                        </td>
                      </tr>
                    );
                  })
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Select From and To accounts to view movements.</p>
        )}
      </CardContent>
    </Card>
  );
}
