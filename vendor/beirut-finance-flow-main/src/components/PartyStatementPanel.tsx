import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LedgerAccountCombobox } from '@/components/LedgerAccountCombobox';
import { buildPartyStatement, buildPurchasePartyLookup, partyStatementToCsv } from '@/lib/ledger/partyStatement';
import { isAccountsPayableCode, isAccountsReceivableCode } from '@/lib/ledger/accountControlCodes';
import type { JournalEntry, JournalLine, LedgerAccount, PcgClientAccount, VoucherLineSettlement } from '@/types/generalLedger';
import type { PaymentOrder, PurchaseOrder } from '@/context/AppContext';
import { formatCurrency } from '@/lib/utils';
import type { AccountingLanguage } from '@/lib/grabio/accountingMode';
import { downloadCsvText } from '@/lib/csvExport';

type Props = {
  accounts: LedgerAccount[];
  entries: JournalEntry[];
  lines: JournalLine[];
  settlements: VoucherLineSettlement[];
  purchaseOrders?: PurchaseOrder[];
  paymentOrders?: PaymentOrder[];
  isLebaneseCoa?: boolean;
  pcgClientAccounts?: PcgClientAccount[];
  accountingLanguage?: AccountingLanguage;
  initialPartyName?: string;
};

export default function PartyStatementPanel({
  accounts,
  entries,
  lines,
  settlements,
  purchaseOrders = [],
  paymentOrders = [],
  isLebaneseCoa,
  pcgClientAccounts = [],
  accountingLanguage,
  initialPartyName = '',
}: Props) {
  const partyAccounts = useMemo(
    () => accounts.filter((a) => a.isActive && (isAccountsReceivableCode(a.code) || isAccountsPayableCode(a.code))),
    [accounts],
  );
  const [accountId, setAccountId] = useState('');
  const [supplierFilterId, setSupplierFilterId] = useState('');
  const [partyName, setPartyName] = useState(initialPartyName);
  const [startDate, setStartDate] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  const purchaseLookup = useMemo(
    () => buildPurchasePartyLookup(purchaseOrders, paymentOrders),
    [purchaseOrders, paymentOrders],
  );

  const supplierOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const po of purchaseOrders) {
      const key = po.supplierId || po.supplierName.trim();
      if (key && po.supplierName.trim()) map.set(key, po.supplierName.trim());
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [purchaseOrders]);

  const selectedAccount = partyAccounts.find((a) => a.id === accountId);
  const selectedSupplier = supplierOptions.find((s) => s.id === supplierFilterId);
  const supplierFilter = selectedSupplier
    ? { supplierId: selectedSupplier.id, supplierName: selectedSupplier.name }
    : partyName.trim()
      ? { supplierName: partyName.trim() }
      : undefined;

  const report = useMemo(() => {
    if (!selectedAccount) return null;
    const partyType = isAccountsReceivableCode(selectedAccount.code) ? 'client' : 'supplier';
    const displayName = selectedSupplier?.name || partyName.trim() || selectedAccount.name;
    return buildPartyStatement(selectedAccount, entries, lines, settlements, {
      startDate,
      endDate,
      partyName: displayName,
      partyType,
      supplierFilter,
      purchaseLookup,
    });
  }, [selectedAccount, entries, lines, settlements, startDate, endDate, partyName, selectedSupplier, purchaseLookup]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Party statement of account</CardTitle>
        <CardDescription>
          AP/AR control accounts (401x/201, 411x/110) combine all parties in one GL bucket. Pick a supplier below to filter their lines; otherwise every supplier appears together.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Party account</Label>
            <LedgerAccountCombobox
              accounts={partyAccounts}
              value={accountId}
              onValueChange={setAccountId}
              isLebaneseCoa={isLebaneseCoa}
              pcgClientAccounts={pcgClientAccounts}
              accountingLanguage={accountingLanguage}
            />
          </div>
          <div>
            <Label>Supplier filter</Label>
            <Select
              value={supplierFilterId || '__all__'}
              onValueChange={(value) => {
                if (value === '__all__') {
                  setSupplierFilterId('');
                  return;
                }
                setSupplierFilterId(value);
                const match = supplierOptions.find((s) => s.id === value);
                if (match) setPartyName(match.name);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All suppliers (combined)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All suppliers (combined)</SelectItem>
                {supplierOptions.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Party name search</Label>
            <Input
              value={partyName}
              onChange={(e) => {
                setPartyName(e.target.value);
                if (supplierFilterId) setSupplierFilterId('');
              }}
              placeholder="Filter by supplier name"
            />
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
            <div className="flex flex-wrap gap-4 text-sm">
              <span>Opening: <strong>{formatCurrency(report.openingBalance)}</strong></span>
              <span>Closing: <strong>{formatCurrency(report.closingBalance)}</strong></span>
              {supplierFilter ? (
                <span className="text-muted-foreground">Filtered: {report.partyName}</span>
              ) : (
                <span className="text-muted-foreground">Showing all suppliers on this account</span>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => downloadCsvText(`party-soa-${report.partyName}.csv`, partyStatementToCsv(report))}
              >
                Export CSV
              </Button>
            </div>
            <div className="rounded-md border max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Ref</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Matched</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-muted-foreground">No movements in range.</TableCell>
                    </TableRow>
                  ) : (
                    report.rows.map((row, idx) => (
                      <TableRow key={`${row.entryId}-${idx}`}>
                        <TableCell>{row.date}</TableCell>
                        <TableCell>{row.voucherType || '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{row.refNumber}</TableCell>
                        <TableCell>{row.supplierName || '—'}</TableCell>
                        <TableCell className="max-w-[220px] truncate" title={row.description}>{row.description || '—'}</TableCell>
                        <TableCell className="text-right">{row.debit ? formatCurrency(row.debit) : '—'}</TableCell>
                        <TableCell className="text-right">{row.credit ? formatCurrency(row.credit) : '—'}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.runningBalance)}</TableCell>
                        <TableCell className="font-mono text-xs">{row.matchedDocumentId || '—'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Select a party sub-account to view the statement.</p>
        )}
      </CardContent>
    </Card>
  );
}
