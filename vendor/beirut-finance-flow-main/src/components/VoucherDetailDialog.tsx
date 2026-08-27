import { useMemo } from 'react';
import { Printer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import { supportsArabicEntry, type AccountingLanguage } from '@/lib/grabio/accountingMode';
import { buildClientByGrabioMap, displayPcgCode, resolvePcgDisplay } from '@/lib/ledger/grabioToPcgMap';
import type { JournalEntry, JournalLine, PcgClientAccount } from '@/types/generalLedger';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function entryLabel(entry: JournalEntry) {
  if (entry.voucherNumber) return entry.voucherNumber;
  if (entry.sourceType === 'order' && entry.event === 'sale-recognized') return `Sales voucher · ${entry.memo}`;
  return entry.memo || entry.id;
}

function entryKind(entry: JournalEntry) {
  if (entry.sourceType === 'order' && entry.event === 'sale-recognized') return 'Sales';
  if (entry.voucherType) return entry.voucherType;
  return entry.sourceType;
}

type Props = {
  entry: JournalEntry | null;
  lines: JournalLine[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLebaneseCoa?: boolean;
  pcgClientAccounts?: PcgClientAccount[];
  accountingLanguage?: AccountingLanguage;
  canReverse?: boolean;
  reversing?: boolean;
  onReverse?: (entryId: string) => void;
  onEdit?: () => void;
};

export default function VoucherDetailDialog({
  entry,
  lines,
  open,
  onOpenChange,
  isLebaneseCoa,
  pcgClientAccounts = [],
  accountingLanguage,
  canReverse,
  reversing,
  onReverse,
  onEdit,
}: Props) {
  const clientByGrabio = useMemo(() => buildClientByGrabioMap(pcgClientAccounts), [pcgClientAccounts]);
  const arabicEntry = supportsArabicEntry(accountingLanguage);

  const selectedLines = useMemo(
    () => (entry ? lines.filter((line) => line.entryId === entry.id) : []),
    [entry, lines],
  );

  const totals = useMemo(
    () => ({
      debit: round2(selectedLines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0)),
      credit: round2(selectedLines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0)),
    }),
    [selectedLines],
  );

  const accountName = (line: JournalLine) => {
    if (!isLebaneseCoa) return line.accountName;
    return resolvePcgDisplay(line.accountCode, line.accountName, clientByGrabio)?.name || line.accountName;
  };

  const accountCode = (line: JournalLine) => {
    if (!isLebaneseCoa) return line.accountCode;
    return displayPcgCode(line.accountCode, clientByGrabio);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        {entry ? (
          <>
            <DialogHeader>
              <DialogTitle>{entryLabel(entry)}</DialogTitle>
              <DialogDescription>
                {entry.date.slice(0, 10)} · {entry.sourceType}
                {entry.sourceId ? ` · ${entry.sourceId}` : ''}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{entryKind(entry)}</Badge>
                {entry.status ? <Badge variant="secondary">{entry.status}</Badge> : null}
                {entry.voucherNumber ? <Badge>{entry.voucherNumber}</Badge> : null}
                {canReverse && entry.status === 'posted' && onReverse ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={reversing}
                    onClick={() => onReverse(entry.id)}
                  >
                    {reversing ? 'Reversing…' : 'Reverse'}
                  </Button>
                ) : null}
                {onEdit && entry.status === 'posted' ? (
                  <Button type="button" variant="outline" size="sm" onClick={onEdit}>
                    Edit
                  </Button>
                ) : null}
                <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={() => window.print()}>
                  <Printer className="h-4 w-4 mr-1" /> Print
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedLines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-mono text-xs">{accountCode(line)}</TableCell>
                      <TableCell>
                        <div>{accountName(line)}</div>
                        {arabicEntry && isLebaneseCoa ? (
                          <div dir="rtl" className="text-xs text-muted-foreground text-right">
                            {resolvePcgDisplay(line.accountCode, line.accountName, clientByGrabio)?.nameAr || '—'}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>{line.description || '—'}</TableCell>
                      <TableCell className="text-right">{line.debit ? formatCurrency(line.debit) : '—'}</TableCell>
                      <TableCell className="text-right">{line.credit ? formatCurrency(line.credit) : '—'}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold border-t">
                    <TableCell colSpan={3}>Totals</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.debit)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.credit)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
