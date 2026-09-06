import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AccountingSideSheet from '@/components/AccountingSideSheet';
import GlVoucherSummaryStrip, { type GlVoucherSummary } from '@/components/GlVoucherSummaryStrip';
import { formatCurrency } from '@/lib/utils';
import { accountActivityLines } from '@/lib/ledger/ledgerActivity';
import { buildClientByGrabioMap, resolvePcgDisplay } from '@/lib/ledger/grabioToPcgMap';
import { presentGlEntry, type GlPresentationContext } from '@/lib/ledger/glEntryPresentation';
import { supportsArabicEntry, type AccountingLanguage } from '@/lib/grabio/accountingMode';
import type { JournalEntry, JournalLine, LedgerAccount, PcgClientAccount } from '@/types/generalLedger';

import type { OpenVoucherEntryHandler } from '@/lib/accounting/accountingNavigation';
import {
  legacyReportTableClass,
  legacyReportTableHeadClass,
  legacyReportTableHeaderRowClass,
  legacyReportTableHeaderShellClass,
} from '@/components/legacyErpReportFrame';

type Props = {
  accountId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: LedgerAccount[];
  entries: JournalEntry[];
  lines: JournalLine[];
  asOfDate: string;
  periodEnd?: string;
  isLebaneseCoa?: boolean;
  pcgClientAccounts?: PcgClientAccount[];
  accountingLanguage?: AccountingLanguage;
  glPresentation?: GlPresentationContext;
  onOpenEntry: OpenVoucherEntryHandler;
};

export default function AccountActivitySheet({
  accountId,
  open,
  onOpenChange,
  accounts,
  entries,
  lines,
  asOfDate,
  periodEnd,
  isLebaneseCoa,
  pcgClientAccounts = [],
  accountingLanguage,
  glPresentation,
  onOpenEntry,
}: Props) {
  const clientByGrabio = useMemo(() => buildClientByGrabioMap(pcgClientAccounts), [pcgClientAccounts]);
  const arabicEntry = supportsArabicEntry(accountingLanguage);

  const account = useMemo(
    () => accounts.find((row) => row.id === accountId) || null,
    [accountId, accounts],
  );

  const movementRows = useMemo(() => {
    if (!accountId) return [];
    const bookLines = accountActivityLines(accountId, accounts, entries, lines, periodEnd || asOfDate).slice(-200).reverse();
    return bookLines.map((row) => {
      const entry = entries.find((e) => e.id === row.entryId);
      const entryLines = lines.filter((l) => l.entryId === row.entryId);
      const focusLine = entryLines.find((l) => l.id === row.lineId) || entryLines.find((l) => l.accountId === accountId);
      const presentation =
        entry && glPresentation
          ? presentGlEntry(entry, focusLine, glPresentation, entryLines)
          : null;
      return {
        ...row,
        typeLabel: presentation?.typeLabel || row.sourceType || '—',
        party: presentation?.party || '—',
        category: presentation?.category || '—',
        details: presentation?.description || row.description || row.memo || '—',
        reference: presentation?.reference || '—',
      };
    });
  }, [accountId, accounts, asOfDate, entries, glPresentation, lines, periodEnd]);

  const title = useMemo(() => {
    if (!account) return 'Account activity';
    if (!isLebaneseCoa) return `${account.code} · ${account.name}`;
    const display = resolvePcgDisplay(account.code, account.name, clientByGrabio);
    return display ? `${display.pcgCode} · ${display.name}` : `${account.code} · ${account.name}`;
  }, [account, clientByGrabio, isLebaneseCoa]);

  const openVoucher = (entryId: string, summary: GlVoucherSummary) => {
    onOpenEntry(entryId, summary);
  };

  return (
    <AccountingSideSheet
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        description={`Posted lines through ${periodEnd || asOfDate}. Double-click a row to open voucher detail.`}
        size="detail"
        tall
      >
        {account && arabicEntry && account.nameAr ? (
          <p className="mb-3 text-sm text-muted-foreground" dir="rtl">
            {account.nameAr}
          </p>
        ) : null}

        <div className="mb-3 flex flex-wrap gap-2">
          <Badge variant="outline">{movementRows.length} movements</Badge>
        </div>

        <div className="rounded-md border overflow-hidden">
            <div className="max-h-[min(48rem,calc(100dvh-14rem))] overflow-x-hidden overflow-y-auto">
            <Table className={legacyReportTableClass(isLebaneseCoa)}>
              <TableHeader className={legacyReportTableHeaderShellClass(isLebaneseCoa)}>
                <TableRow className={legacyReportTableHeaderRowClass(isLebaneseCoa)}>
                  <TableHead className={legacyReportTableHeadClass(isLebaneseCoa)}>Date</TableHead>
                  <TableHead className={legacyReportTableHeadClass(isLebaneseCoa)}>Type</TableHead>
                  <TableHead className={legacyReportTableHeadClass(isLebaneseCoa)}>Voucher</TableHead>
                  <TableHead className={legacyReportTableHeadClass(isLebaneseCoa)}>Party</TableHead>
                  <TableHead className={legacyReportTableHeadClass(isLebaneseCoa)}>Category</TableHead>
                  <TableHead className={legacyReportTableHeadClass(isLebaneseCoa)}>Details</TableHead>
                  <TableHead className={legacyReportTableHeadClass(isLebaneseCoa)}>Ref</TableHead>
                  <TableHead className={legacyReportTableHeadClass(isLebaneseCoa, 'text-right')}>Debit</TableHead>
                  <TableHead className={legacyReportTableHeadClass(isLebaneseCoa, 'text-right')}>Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movementRows.length ? (
                  movementRows.map((row) => {
                    const serial = row.voucherNumber || row.entryId;
                    const summary = {
                      typeLabel: row.typeLabel,
                      party: row.party,
                      category: row.category,
                      description: row.details,
                      reference: row.reference,
                    };
                    return (
                    <TableRow
                      key={row.lineId}
                      className="cursor-default"
                      title="Double-click to open voucher"
                      onDoubleClick={() => openVoucher(row.entryId, summary)}
                    >
                      <TableCell className="whitespace-nowrap text-xs">{row.entryDate}</TableCell>
                      <TableCell className="text-xs">{row.typeLabel}</TableCell>
                      <TableCell className="font-mono text-xs text-sky-900" title={serial}>
                        {serial}
                      </TableCell>
                      <TableCell className="max-w-[7rem] truncate text-xs" title={row.party}>
                        {row.party || '—'}
                      </TableCell>
                      <TableCell className="max-w-[7rem] truncate text-xs text-muted-foreground" title={row.category}>
                        {row.category || '—'}
                      </TableCell>
                      <TableCell className="max-w-[9rem] truncate text-xs" title={row.details}>
                        {row.details || '—'}
                      </TableCell>
                      <TableCell className="max-w-[5rem] truncate font-mono text-xs" title={row.reference}>
                        {row.reference || '—'}
                      </TableCell>
                      <TableCell className="text-right text-xs">{row.debit ? formatCurrency(row.debit) : '—'}</TableCell>
                      <TableCell className="text-right text-xs">{row.credit ? formatCurrency(row.credit) : '—'}</TableCell>
                    </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                      No posted activity for this account in the selected period.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </AccountingSideSheet>
  );
}
