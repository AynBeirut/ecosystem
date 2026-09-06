import { toast } from 'sonner';
import { useMemo } from 'react';
import { Printer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AccountingSideSheet from '@/components/AccountingSideSheet';
import GlVoucherSummaryStrip, { type GlVoucherSummary } from '@/components/GlVoucherSummaryStrip';
import VoucherSaleTotalsBand, {
  isSalesDiscountLedgerLine,
  parseSaleTotalsFromMeta,
} from '@/components/VoucherSaleTotalsBand';
import { formatCurrency } from '@/lib/utils';
import { supportsArabicEntry, type AccountingLanguage } from '@/lib/grabio/accountingMode';
import { buildClientByGrabioMap, displayPcgCode, resolvePcgDisplay } from '@/lib/ledger/grabioToPcgMap';
import { journalEntryDisplayLabel } from '@/lib/ledger/ledgerHumanLabels';
import { usePostedVoucherEditor } from '@/hooks/usePostedVoucherEditor';
import { useVoucherParty } from '@/hooks/useVoucherParty';
import { useLedger } from '@/context/LedgerContext';
import type { JournalEntry, JournalLine, PcgClientAccount } from '@/types/generalLedger';
import {
  legacyReportTableClass,
  legacyReportTableHeadClass,
  legacyReportTableHeaderRowClass,
  legacyReportTableHeaderShellClass,
} from '@/components/legacyErpReportFrame';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function entryLabel(entry: JournalEntry) {
  return journalEntryDisplayLabel(entry);
}

function entryKind(entry: JournalEntry) {
  if (entry.sourceType === 'order' && entry.event === 'sale-recognized') return 'Sales';
  if (entry.voucherType) return entry.voucherType;
  return entry.sourceType;
}

type InvoiceLike = {
  id: string;
  invoiceNumber?: string;
  clientName: string;
  clientId?: string;
};

type Props = {
  entry: JournalEntry | null;
  lines: JournalLine[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLebaneseCoa?: boolean;
  pcgClientAccounts?: PcgClientAccount[];
  accountingLanguage?: AccountingLanguage;
  invoices?: InvoiceLike[];
  canReverse?: boolean;
  reversing?: boolean;
  onReverse?: (entryId: string) => void;
  onEdit?: () => void;
  glSummary?: GlVoucherSummary | null;
};

export default function VoucherDetailDialog({
  entry,
  lines,
  open,
  onOpenChange,
  isLebaneseCoa,
  pcgClientAccounts = [],
  accountingLanguage,
  invoices = [],
  canReverse,
  reversing,
  onReverse,
  onEdit,
  glSummary,
}: Props) {
  const clientByGrabio = useMemo(() => buildClientByGrabioMap(pcgClientAccounts), [pcgClientAccounts]);
  const arabicEntry = supportsArabicEntry(accountingLanguage);
  const { isDateLocked } = useLedger();
  const editPostedVoucher = usePostedVoucherEditor();

  const periodLocked = Boolean(entry && isDateLocked(entry.date));
  const canEdit = Boolean(entry && entry.status === 'posted');

  const handleEdit = () => {
    if (!entry || !canEdit) return;
    if (periodLocked) {
      toast.error('That period is closed — unlock it under Settings → Year-end close to edit this voucher.');
      return;
    }
    if (onEdit) {
      onEdit();
      return;
    }
    editPostedVoucher(entry, { onClose: () => onOpenChange(false) });
  };

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

  const party = useVoucherParty(entry, invoices);

  const saleTotals = useMemo(
    () => parseSaleTotalsFromMeta((entry?.voucherMeta || {}) as Record<string, unknown>),
    [entry],
  );

  const showGlSummary = Boolean(
    glSummary &&
      (glSummary.typeLabel ||
        glSummary.party ||
        glSummary.category ||
        glSummary.description ||
        glSummary.reference),
  );

  const accountName = (line: JournalLine) => {
    if (!isLebaneseCoa) return line.accountName;
    return resolvePcgDisplay(line.accountCode, line.accountName, clientByGrabio)?.name || line.accountName;
  };

  const accountCode = (line: JournalLine) => {
    if (!isLebaneseCoa) return line.accountCode;
    return displayPcgCode(line.accountCode, clientByGrabio);
  };

  if (!entry) return null;

  return (
    <AccountingSideSheet
      open={open}
      onOpenChange={onOpenChange}
      title={entryLabel(entry)}
      description={
        <>
          {entry.date.slice(0, 10)} · {entry.sourceType}
          {entry.voucherNumber ? ` · ${entry.voucherNumber}` : ''}
        </>
      }
      size="detail"
      tall
    >
      <div className="space-y-4">
        {showGlSummary ? <GlVoucherSummaryStrip summary={glSummary} /> : null}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{entryKind(entry)}</Badge>
          {party.name ? (
            <Badge variant="secondary">
              {party.kind === 'supplier' ? 'Supplier' : party.kind === 'client' ? 'Client' : 'Party'} · {party.name}
            </Badge>
          ) : null}
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
                {canEdit ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={periodLocked}
                    title={
                      periodLocked
                        ? 'Period is closed — reopen the quarter under Settings to edit'
                        : 'Reverse and repost this voucher'
                    }
                    onClick={handleEdit}
                  >
                    {periodLocked ? 'Edit (period closed)' : 'Edit'}
                  </Button>
                ) : null}
                {periodLocked ? (
                  <Badge variant="outline" className="text-amber-700 border-amber-300">
                    Period closed
                  </Badge>
                ) : null}
          <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" /> Print
          </Button>
        </div>
        {saleTotals ? (
          <VoucherSaleTotalsBand totals={saleTotals} isLebaneseCoa={isLebaneseCoa} />
        ) : null}
        <div className="rounded-md border">
          <Table className={legacyReportTableClass(isLebaneseCoa)}>
            <TableHeader className={legacyReportTableHeaderShellClass(isLebaneseCoa)}>
              <TableRow className={legacyReportTableHeaderRowClass(isLebaneseCoa)}>
                <TableHead className={legacyReportTableHeadClass(isLebaneseCoa)}>Code</TableHead>
                <TableHead className={legacyReportTableHeadClass(isLebaneseCoa)}>Account</TableHead>
                <TableHead className={legacyReportTableHeadClass(isLebaneseCoa)}>Description</TableHead>
                <TableHead className={legacyReportTableHeadClass(isLebaneseCoa, 'text-right')}>Debit</TableHead>
                <TableHead className={legacyReportTableHeadClass(isLebaneseCoa, 'text-right')}>Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedLines.map((line) => {
                const discountLine = isSalesDiscountLedgerLine(line);
                const displayName = accountName(line);
                const arabicName =
                  arabicEntry && isLebaneseCoa
                    ? resolvePcgDisplay(line.accountCode, line.accountName, clientByGrabio)?.nameAr
                    : undefined;
                const showArabic = Boolean(arabicName && arabicName.trim() !== displayName.trim());
                return (
                <TableRow
                  key={line.id}
                  className={discountLine ? 'bg-amber-50/90 font-medium' : undefined}
                >
                  <TableCell className="font-mono text-xs">{accountCode(line)}</TableCell>
                  <TableCell>
                    <div>{displayName}</div>
                    {showArabic ? (
                      <div dir="rtl" className="text-xs text-slate-700 text-right">
                        {arabicName}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>{line.description || '—'}</TableCell>
                  <TableCell className="text-right">{line.debit ? formatCurrency(line.debit) : '—'}</TableCell>
                  <TableCell className="text-right">{line.credit ? formatCurrency(line.credit) : '—'}</TableCell>
                </TableRow>
              );
              })}
              <TableRow className="font-semibold border-t">
                <TableCell colSpan={3}>Totals</TableCell>
                <TableCell className="text-right">{formatCurrency(totals.debit)}</TableCell>
                <TableCell className="text-right">{formatCurrency(totals.credit)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </AccountingSideSheet>
  );
}
