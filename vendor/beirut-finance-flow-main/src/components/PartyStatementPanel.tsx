import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LedgerAccountCombobox } from '@/components/LedgerAccountCombobox';
import { buildPartyStatement, partyStatementToCsv } from '@/lib/ledger/partyStatement';
import { isAccountsPayableCode, isAccountsReceivableCode } from '@/lib/ledger/accountControlCodes';
import type { JournalEntry, JournalLine, LedgerAccount, PcgClientAccount, VoucherLineSettlement } from '@/types/generalLedger';
import { formatCurrency } from '@/lib/utils';
import type { AccountingLanguage } from '@/lib/grabio/accountingMode';
import { downloadCsvText } from '@/lib/csvExport';

type Props = {
  accounts: LedgerAccount[];
  entries: JournalEntry[];
  lines: JournalLine[];
  settlements: VoucherLineSettlement[];
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
  const [partyName, setPartyName] = useState(initialPartyName);
  const [startDate, setStartDate] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  const selectedAccount = partyAccounts.find((a) => a.id === accountId);

  const report = useMemo(() => {
    if (!selectedAccount) return null;
    const partyType = isAccountsReceivableCode(selectedAccount.code) ? 'client' : 'supplier';
    return buildPartyStatement(selectedAccount, entries, lines, settlements, {
      startDate,
      endDate,
      partyName: partyName || selectedAccount.name,
      partyType,
    });
  }, [selectedAccount, entries, lines, settlements, startDate, endDate, partyName]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Party statement of account</CardTitle>
        <CardDescription>Unified GL SOA on AR (411x/110) or AP (401x/201) with knock-off references.</CardDescription>
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
            <Label>Party name (label)</Label>
            <Input value={partyName} onChange={(e) => setPartyName(e.target.value)} placeholder="Optional display name" />
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
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Matched</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-muted-foreground">No movements in range.</TableCell>
                    </TableRow>
                  ) : (
                    report.rows.map((row, idx) => (
                      <TableRow key={`${row.entryId}-${idx}`}>
                        <TableCell>{row.date}</TableCell>
                        <TableCell>{row.voucherType || '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{row.refNumber}</TableCell>
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
