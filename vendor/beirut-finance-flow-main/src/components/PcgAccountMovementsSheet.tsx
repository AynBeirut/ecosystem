import { useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AccountingSideSheet from '@/components/AccountingSideSheet';
import { formatCurrency } from '@/lib/utils';
import { buildBookLinesForAccount } from '@/lib/ledger/accountLedgerLines';
import { buildTrialBalance } from '@/lib/ledger/trialBalance';
import { pcgClassSuffix, resolveLedgerAccountIdsForPcgNode, type PcgTreeNode } from '@/lib/ledger/lebanesePcgTree';
import { supportsArabicEntry, type AccountingLanguage } from '@/lib/grabio/accountingMode';
import type { AccountBookLine, JournalEntry, JournalLine, LedgerAccount, PcgClientAccount } from '@/types/generalLedger';
import VoucherDetailDialog from '@/components/VoucherDetailDialog';
import type { OpenVoucherEntryHandler } from '@/lib/accounting/accountingNavigation';
import { legacyReportThClass, legacyReportTableClass } from '@/components/legacyErpReportFrame';

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
  onOpenEntry?: OpenVoucherEntryHandler;
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
  onOpenEntry,
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

  const openMovementVoucher = (entryId: string) => {
    if (onOpenEntry) {
      onOpenEntry(entryId);
      return;
    }
    setSelectedEntryId(entryId);
  };

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedEntryId) || null,
    [entries, selectedEntryId],
  );

  const suffix = node ? pcgClassSuffix(node.code) : '';

  if (!node) return null;

  return (
    <>
      <AccountingSideSheet
        open={open}
        onOpenChange={onOpenChange}
        title={
          <>
            <span className="font-mono">{node.code}</span>
            {suffix ? <span className="ml-2 font-sans text-sm font-normal text-muted-foreground">{suffix}</span> : null}
          </>
        }
        description={
          <>
            <span className="block">{node.name}</span>
            {arabicEntry && node.nameAr ? (
              <span className="block text-right" dir="rtl">
                {node.nameAr}
              </span>
            ) : null}
          </>
        }
        size="detail"
        tall
      >
        <div className="flex flex-wrap gap-3 text-sm">
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
          <div className="mt-4 max-h-[min(60vh,520px)] overflow-y-auto overflow-x-hidden overscroll-contain rounded-md border">
            <table className={legacyReportTableClass(isLebaneseCoa, 'w-full table-fixed border-collapse text-sm')}>
              <colgroup>
                <col className="w-[5rem]" />
                <col className="w-[6.5rem]" />
                <col />
                <col className="w-[4.5rem]" />
                <col className="w-[4.5rem]" />
                <col className="w-[2.5rem]" />
              </colgroup>
              <thead>
                <tr className={isLebaneseCoa ? 'border-[#2a5dad]' : 'border-b'}>
                  <th className={legacyReportThClass(isLebaneseCoa, 'px-2 py-2')}>Date</th>
                  <th className={legacyReportThClass(isLebaneseCoa, 'px-2 py-2')}>Voucher</th>
                  <th className={legacyReportThClass(isLebaneseCoa, 'px-2 py-2')}>Description</th>
                  <th className={legacyReportThClass(isLebaneseCoa, 'px-2 py-2 text-right')}>Debit</th>
                  <th className={legacyReportThClass(isLebaneseCoa, 'px-2 py-2 text-right')}>Credit</th>
                  <th className={legacyReportThClass(isLebaneseCoa, 'px-2 py-2')} />
                </tr>
              </thead>
              <tbody>
                {movementRows.length ? (
                  movementRows.map((row) => (
                    <tr key={row.lineId} className="border-b hover:bg-muted/40">
                      <td className="truncate px-2 py-1.5 text-xs">{row.entryDate.slice(0, 10)}</td>
                      <td className="truncate px-2 py-1.5 font-mono text-xs">{row.voucherNumber || '—'}</td>
                      <td className="truncate px-2 py-1.5 text-xs" title={row.description || row.memo}>{row.description || row.memo || '—'}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right text-xs tabular-nums">{row.debit ? formatCurrency(row.debit) : '—'}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right text-xs tabular-nums">{row.credit ? formatCurrency(row.credit) : '—'}</td>
                      <td className="px-1 py-1.5">
                        <Button type="button" variant="ghost" size="sm" onClick={() => openMovementVoucher(row.entryId)}>
                          <FileText className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-2 py-8 text-center text-sm text-muted-foreground">
                      No posted voucher lines for this account yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </AccountingSideSheet>

      {!onOpenEntry ? (
      <VoucherDetailDialog
        entry={selectedEntry}
        lines={lines}
        open={Boolean(selectedEntry)}
        onOpenChange={(next) => !next && setSelectedEntryId('')}
        isLebaneseCoa={isLebaneseCoa}
        pcgClientAccounts={pcgClientAccounts}
        accountingLanguage={accountingLanguage}
      />
      ) : null}
    </>
  );
}
