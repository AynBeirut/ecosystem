import { useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
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
import {
  accountActivityLines,
  resolveActivityEntries,
  type LedgerActivityFocus,
} from '@/lib/ledger/ledgerActivity';
import { buildClientByGrabioMap, displayPcgCode, resolvePcgDisplay } from '@/lib/ledger/grabioToPcgMap';
import { supportsArabicEntry, type AccountingLanguage } from '@/lib/grabio/accountingMode';
import type { JournalEntry, JournalLine, LedgerAccount, PcgClientAccount } from '@/types/generalLedger';
import VoucherDetailDialog from '@/components/VoucherDetailDialog';

type Props = {
  focus: LedgerActivityFocus | null;
  onClose: () => void;
  accounts: LedgerAccount[];
  entries: JournalEntry[];
  lines: JournalLine[];
  asOfDate: string;
  isLebaneseCoa?: boolean;
  pcgClientAccounts?: PcgClientAccount[];
  accountingLanguage?: AccountingLanguage;
  onOpenVouchersTab?: () => void;
  onDrillToGl?: (accountId: string) => void;
};

function entryTitle(entry: JournalEntry) {
  return entry.voucherNumber || entry.memo || entry.id;
}

export default function LedgerActivityDialog({
  focus,
  onClose,
  accounts,
  entries,
  lines,
  asOfDate,
  isLebaneseCoa,
  pcgClientAccounts = [],
  accountingLanguage,
  onOpenVouchersTab,
  onDrillToGl,
}: Props) {
  const [selectedEntryId, setSelectedEntryId] = useState('');
  const clientByGrabio = useMemo(() => buildClientByGrabioMap(pcgClientAccounts), [pcgClientAccounts]);
  const arabicEntry = supportsArabicEntry(accountingLanguage);

  const accountRows = useMemo(() => {
    if (!focus || focus.kind !== 'account') return [];
    return accountActivityLines(focus.accountId, accounts, entries, lines, asOfDate).slice(-120).reverse();
  }, [focus, accounts, entries, lines, asOfDate]);

  const partyEntries = useMemo(() => {
    if (!focus || focus.kind === 'account') return [];
    return resolveActivityEntries(focus, entries)
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
      .slice(0, 120);
  }, [focus, entries]);

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedEntryId) || null,
    [entries, selectedEntryId],
  );

  const open = Boolean(focus);

  const accountLabel = (accountId: string, code: string, name: string) => {
    const account = accounts.find((row) => row.id === accountId);
    if (!isLebaneseCoa) return `${code} · ${name}`;
    const display = account
      ? resolvePcgDisplay(account.code, account.name, clientByGrabio)
      : resolvePcgDisplay(code, name, clientByGrabio);
    return display ? `${display.pcgCode} · ${display.name}` : `${code} · ${name}`;
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {focus ? (
            <>
              <DialogHeader>
                <DialogTitle>{focus.label}</DialogTitle>
                <DialogDescription>
                  {focus.kind === 'account'
                    ? `Posted ledger lines through ${asOfDate}`
                    : focus.kind === 'client'
                      ? 'Receipt vouchers and related GL entries for this client'
                      : 'Payment vouchers and related GL entries for this supplier'}
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-wrap gap-2 mb-2">
                {focus.kind === 'account' && onDrillToGl ? (
                  <Button type="button" variant="secondary" size="sm" onClick={() => onDrillToGl(focus.accountId)}>
                    Open in GL
                  </Button>
                ) : null}
                {onOpenVouchersTab ? (
                  <Button type="button" variant="outline" size="sm" onClick={onOpenVouchersTab}>
                    <FileText className="h-4 w-4 mr-1" /> Full voucher register
                  </Button>
                ) : null}
              </div>

              {focus.kind === 'account' ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Voucher / Memo</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accountRows.map((row) => (
                      <TableRow key={row.lineId}>
                        <TableCell>{row.entryDate}</TableCell>
                        <TableCell>
                          <div>{row.voucherNumber || row.memo}</div>
                          <div className="text-xs text-muted-foreground">{row.sourceType}</div>
                        </TableCell>
                        <TableCell>{row.description || '—'}</TableCell>
                        <TableCell className="text-right">{row.debit ? formatCurrency(row.debit) : '—'}</TableCell>
                        <TableCell className="text-right">{row.credit ? formatCurrency(row.credit) : '—'}</TableCell>
                        <TableCell>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedEntryId(row.entryId)}>
                            Open
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!accountRows.length ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                          No posted activity for this account yet.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Voucher / Memo</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partyEntries.map((entry) => {
                      const entryLines = lines.filter((line) => line.entryId === entry.id);
                      const debit = entryLines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
                      const credit = entryLines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);
                      const amount = Math.max(debit, credit);
                      return (
                        <TableRow key={entry.id}>
                          <TableCell>{entry.date.slice(0, 10)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{entry.voucherType || entry.sourceType}</Badge>
                          </TableCell>
                          <TableCell>{entryTitle(entry)}</TableCell>
                          <TableCell className="text-right">{amount ? formatCurrency(amount) : '—'}</TableCell>
                          <TableCell>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedEntryId(entry.id)}>
                              Open
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!partyEntries.length ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                          No vouchers linked yet. Post an RV (client) or PV (supplier) from the Vouchers tab.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              )}

              {focus.kind === 'account' && focus.accountId ? (
                <p className="text-xs text-muted-foreground mt-3">
                  Account:{' '}
                  {(() => {
                    const account = accounts.find((row) => row.id === focus.accountId);
                    if (!account) return focus.label;
                    return accountLabel(account.id, account.code, account.name);
                  })()}
                  {isLebaneseCoa && accounts.find((row) => row.id === focus.accountId) ? (
                    <span className="ml-2 font-mono">
                      ({displayPcgCode(accounts.find((row) => row.id === focus.accountId)!.code, clientByGrabio)})
                    </span>
                  ) : null}
                </p>
              ) : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>

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
