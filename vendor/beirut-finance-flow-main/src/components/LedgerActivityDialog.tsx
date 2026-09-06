import { useMemo } from 'react';
import { FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AccountingSideSheet from '@/components/AccountingSideSheet';
import { formatCurrency } from '@/lib/utils';
import {
  accountActivityLines,
  resolveActivityEntries,
  type LedgerActivityFocus,
} from '@/lib/ledger/ledgerActivity';
import { buildClientByGrabioMap, displayPcgCode, resolvePcgDisplay } from '@/lib/ledger/grabioToPcgMap';
import type { AccountingLanguage } from '@/lib/grabio/accountingMode';
import type { JournalEntry, JournalLine, LedgerAccount, PcgClientAccount } from '@/types/generalLedger';
import { journalEntryDisplayLabel } from '@/lib/ledger/ledgerHumanLabels';
import type { OpenVoucherEntryHandler } from '@/lib/accounting/accountingNavigation';

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
  onOpenEntry: OpenVoucherEntryHandler;
};

function entryTitle(entry: JournalEntry) {
  return journalEntryDisplayLabel(entry);
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
  onOpenEntry,
}: Props) {
  const clientByGrabio = useMemo(() => buildClientByGrabioMap(pcgClientAccounts), [pcgClientAccounts]);

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

  const open = Boolean(focus);

  const accountLabel = (accountId: string, code: string, name: string) => {
    const account = accounts.find((row) => row.id === accountId);
    if (!isLebaneseCoa) return `${code} · ${name}`;
    const display = account
      ? resolvePcgDisplay(account.code, account.name, clientByGrabio)
      : resolvePcgDisplay(code, name, clientByGrabio);
    return display ? `${display.pcgCode} · ${display.name}` : `${code} · ${name}`;
  };

  const description = focus
    ? focus.kind === 'account'
      ? `Posted ledger lines through ${asOfDate}`
      : focus.kind === 'client'
        ? 'Receipt vouchers and related GL entries for this client'
        : 'Payment vouchers and related GL entries for this supplier'
    : undefined;

  return (
    <>
      <AccountingSideSheet
        open={open}
        onOpenChange={(next) => !next && onClose()}
        title={focus?.label || 'Activity'}
        description={description}
        size="detail"
        tall
      >
        {focus ? (
          <>
            <div className="mb-3 flex flex-wrap gap-2">
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
              <div className="rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background">
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
                          <div>{row.voucherNumber || '—'}</div>
                          <div className="text-xs text-muted-foreground">{row.sourceType}</div>
                        </TableCell>
                        <TableCell>{row.description || '—'}</TableCell>
                        <TableCell className="text-right">{row.debit ? formatCurrency(row.debit) : '—'}</TableCell>
                        <TableCell className="text-right">{row.credit ? formatCurrency(row.credit) : '—'}</TableCell>
                        <TableCell>
                          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenEntry(row.entryId)}>
                            <FileText className="h-4 w-4" />
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
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background">
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
                            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenEntry(entry.id)}>
                              <FileText className="h-4 w-4" />
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
              </div>
            )}

            {focus.kind === 'account' && focus.accountId ? (
              <p className="mt-3 text-xs text-muted-foreground">
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
      </AccountingSideSheet>
    </>
  );
}
