import { useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import { buildBookLinesForAccount } from '@/lib/ledger/accountLedgerLines';
import { buildTrialBalance } from '@/lib/ledger/trialBalance';
import { pcgClassSuffix, resolveLedgerAccountIdsForPcgNode, type PcgTreeNode } from '@/lib/ledger/lebanesePcgTree';
import { supportsArabicEntry, type AccountingLanguage } from '@/lib/grabio/accountingMode';
import type { AccountBookLine, JournalEntry, JournalLine, LedgerAccount, PcgClientAccount } from '@/types/generalLedger';
import VoucherDetailDialog from '@/components/VoucherDetailDialog';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

type Props = {
  node: PcgTreeNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: LedgerAccount[];
  entries: JournalEntry[];
  lines: JournalLine[];
  asOfDate: string;
  pcgClientAccounts?: PcgClientAccount[];
  accountingLanguage?: AccountingLanguage;
  isLebaneseCoa?: boolean;
};

export default function PcgAccountMovementsSheet({
  node,
  open,
  onOpenChange,
  accounts,
  entries,
  lines,
  asOfDate,
  pcgClientAccounts = [],
  accountingLanguage,
  isLebaneseCoa = true,
}: Props) {
  const [selectedEntryId, setSelectedEntryId] = useState('');
  const arabicEntry = supportsArabicEntry(accountingLanguage);

  const ledgerAccountIds = useMemo(
    () => (node ? resolveLedgerAccountIdsForPcgNode(node, accounts) : []),
    [node, accounts],
  );

  const movementRows = useMemo(() => {
    if (!node || !ledgerAccountIds.length) return [] as Array<AccountBookLine & { accountId: string }>;
    const merged: Array<AccountBookLine & { accountId: string }> = [];
    for (const accountId of ledgerAccountIds) {
      const rows = buildBookLinesForAccount(accountId, accounts, entries, lines, {
        startDate: '1970-01-01',
        endDate: asOfDate,
      });
      for (const row of rows) merged.push({ ...row, accountId });
    }
    merged.sort((a, b) => {
      const byDate = a.entryDate.localeCompare(b.entryDate);
      if (byDate !== 0) return byDate;
      return a.entryId.localeCompare(b.entryId);
    });
    return merged.slice(-200).reverse();
  }, [node, ledgerAccountIds, accounts, entries, lines, asOfDate]);

  const balanceSummary = useMemo(() => {
    if (!ledgerAccountIds.length) {
      return { debit: 0, credit: 0, movementCount: 0 };
    }
    let debit = 0;
    let credit = 0;
    for (const accountId of ledgerAccountIds) {
      const account = accounts.find((row) => row.id === accountId);
      if (!account) continue;
      const tb = buildTrialBalance([account], entries, lines, { endDate: asOfDate });
      const row = tb.rows.find((item) => item.accountId === accountId);
      if (!row) continue;
      debit = round2(debit + row.debit);
      credit = round2(credit + row.credit);
    }
    return {
      debit,
      credit,
      movementCount: movementRows.length,
    };
  }, [ledgerAccountIds, accounts, entries, lines, asOfDate, movementRows.length]);

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedEntryId) || null,
    [entries, selectedEntryId],
  );

  const suffix = node ? pcgClassSuffix(node.code) : '';

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          {node ? (
            <>
              <SheetHeader>
                <SheetTitle className="font-mono text-base">
                  {node.code}
                  {suffix ? <span className="ml-2 font-sans text-sm font-normal text-muted-foreground">{suffix}</span> : null}
                </SheetTitle>
                <SheetDescription className="space-y-1">
                  <span className="block">{node.name}</span>
                  {arabicEntry && node.nameAr ? (
                    <span className="block text-right" dir="rtl">
                      {node.nameAr}
                    </span>
                  ) : null}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <span>
                  Debit balance: <strong>{formatCurrency(balanceSummary.debit)}</strong>
                </span>
                <span>
                  Credit balance: <strong>{formatCurrency(balanceSummary.credit)}</strong>
                </span>
                <Badge variant="outline">As of {asOfDate}</Badge>
                <Badge variant="outline">{balanceSummary.movementCount} movements</Badge>
              </div>

              {!ledgerAccountIds.length ? (
                <p className="mt-6 text-sm text-muted-foreground">
                  No posting account linked yet for this chart row. Map or seed a ledger account to see voucher activity.
                </p>
              ) : (
                <div className="mt-4 rounded-md border max-h-[min(60vh,520px)] overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Voucher</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movementRows.length ? (
                        movementRows.map((row) => (
                          <TableRow key={row.lineId}>
                            <TableCell>{row.entryDate}</TableCell>
                            <TableCell className="font-mono text-xs">{row.voucherNumber || row.memo || '—'}</TableCell>
                            <TableCell>{row.description || row.memo || '—'}</TableCell>
                            <TableCell className="text-right">{row.debit ? formatCurrency(row.debit) : '—'}</TableCell>
                            <TableCell className="text-right">{row.credit ? formatCurrency(row.credit) : '—'}</TableCell>
                            <TableCell>
                              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedEntryId(row.entryId)}>
                                <FileText className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                            No posted voucher lines for this account yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <VoucherDetailDialog
        entry={selectedEntry}
        lines={lines}
        open={Boolean(selectedEntry)}
        onOpenChange={(next) => !next && setSelectedEntryId('')}
        isLebaneseCoa={isLebaneseCoa}
        pcgClientAccounts={pcgClientAccounts}
        accountingLanguage={accountingLanguage}
      />
    </>
  );
}
