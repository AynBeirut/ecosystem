import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LedgerAccountCombobox } from '@/components/LedgerAccountCombobox';
import { buildGeneralLedgerReport, generalLedgerToCsv } from '@/lib/ledger/generalLedgerReport';
import { loadCostCenters } from '@/lib/firestore/costCentersFirestore';
import type { JournalEntry, JournalLine, LedgerAccount, LedgerCostCenter, PcgClientAccount } from '@/types/generalLedger';
import { formatCurrency } from '@/lib/utils';
import type { AccountingLanguage } from '@/lib/grabio/accountingMode';
import { downloadCsvText } from '@/lib/csvExport';
import { downloadXlsxFromCsv } from '@/lib/xlsxExport';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEffect } from 'react';

type Props = {
  storeId: string;
  accounts: LedgerAccount[];
  entries: JournalEntry[];
  lines: JournalLine[];
  isLebaneseCoa?: boolean;
  pcgClientAccounts?: PcgClientAccount[];
  accountingLanguage?: AccountingLanguage;
  presetAccountId?: string;
  onOpenEntry?: (entryId: string) => void;
};

export default function GeneralLedgerPanel({
  storeId,
  accounts,
  entries,
  lines,
  isLebaneseCoa,
  pcgClientAccounts = [],
  accountingLanguage,
  presetAccountId,
  onOpenEntry,
}: Props) {
  const [accountId, setAccountId] = useState('');
  const [startDate, setStartDate] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [costCenterId, setCostCenterId] = useState('');
  const [costCenters, setCostCenters] = useState<LedgerCostCenter[]>([]);

  useEffect(() => {
    if (!storeId) return;
    void loadCostCenters(storeId).then(setCostCenters);
  }, [storeId]);

  useEffect(() => {
    if (presetAccountId) setAccountId(presetAccountId);
  }, [presetAccountId]);

  const selectedAccount = accounts.find((a) => a.id === accountId);

  const report = useMemo(() => {
    if (!selectedAccount) return null;
    return buildGeneralLedgerReport(selectedAccount, entries, lines, {
      startDate,
      endDate,
      costCenterId: costCenterId || undefined,
    });
  }, [selectedAccount, entries, lines, startDate, endDate, costCenterId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>General ledger</CardTitle>
        <CardDescription>Account movement with running balance · filter by cost center.</CardDescription>
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
            <div className="flex flex-wrap gap-4 text-sm">
              <span>Opening: <strong>{formatCurrency(report.openingBalance)}</strong></span>
              <span>Closing: <strong>{formatCurrency(report.closingBalance)}</strong></span>
              <Button type="button" variant="outline" size="sm" onClick={() => downloadCsvText(`gl-${report.accountCode}.csv`, generalLedgerToCsv(report))}>
                Export CSV
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => downloadXlsxFromCsv(`gl-${report.accountCode}.xlsx`, 'GL', generalLedgerToCsv(report))}>
                Export XLSX
              </Button>
            </div>
            <div className="rounded-md border max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Voucher</TableHead>
                    <TableHead>Memo</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rows.map((row, idx) => (
                    <TableRow key={`${row.entryId}-${idx}`}>
                      <TableCell>{row.date}</TableCell>
                      <TableCell className="font-mono text-xs">{row.voucherNumber || row.entryId.slice(0, 8)}</TableCell>
                      <TableCell>{row.memo}</TableCell>
                      <TableCell className="text-right">{row.debit ? formatCurrency(row.debit) : '—'}</TableCell>
                      <TableCell className="text-right">{row.credit ? formatCurrency(row.credit) : '—'}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.runningBalance)}</TableCell>
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
