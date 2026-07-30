import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import SystemGuideInfo from '@/components/SystemGuideInfo';
import { buildCheckRegister } from '@/lib/ledger/checkRegister';
import { updateCheckStatus } from '@/lib/ledger/checkStatusUpdate';
import type { CheckStatus, JournalEntry, JournalLine } from '@/types/generalLedger';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

type Props = {
  entries: JournalEntry[];
  lines?: JournalLine[];
  storeId?: string;
  systemGuideEnabled?: boolean;
  onOpenEntry?: (entryId: string) => void;
  onStatusUpdated?: () => void;
};

const statusTone: Record<CheckStatus, string> = {
  issued: 'bg-amber-100 text-amber-900',
  cleared: 'bg-green-100 text-green-800',
  void: 'bg-slate-100 text-slate-600',
};

export default function CheckRegisterPanel({ entries, lines, storeId, systemGuideEnabled = false, onOpenEntry, onStatusUpdated }: Props) {
  const rows = useMemo(() => buildCheckRegister(entries, lines), [entries, lines]);

  const setStatus = async (entryId: string, status: CheckStatus) => {
    if (!storeId) {
      toast.error('Store not loaded.');
      return;
    }
    try {
      await updateCheckStatus(storeId, entryId, status);
      toast.success(`Check marked ${status}.`);
      onStatusUpdated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update check status');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Check register
          <SystemGuideInfo
            enabled={systemGuideEnabled}
            label="What the check register is"
            title="Check workflow"
            content={[
              'Tracks payment vouchers (PV) issued by check. Enter check number on PV posting — Libra-style check issuance workflow.',
              'Status: issued → cleared when the bank confirms payment. Open a row to view the full voucher.',
            ]}
          />
        </CardTitle>
        <CardDescription>Payment vouchers with check numbers from PV posting.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Voucher</TableHead>
              <TableHead>Payee</TableHead>
              <TableHead>Check #</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground">
                  No checks yet — add a check number when posting a Payment voucher (PV).
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.entryId}>
                  <TableCell>{row.date}</TableCell>
                  <TableCell className="font-mono text-xs">{row.voucherNumber || row.entryId.slice(0, 8)}</TableCell>
                  <TableCell>{row.payee || '—'}</TableCell>
                  <TableCell>{row.checkNumber || '—'}</TableCell>
                  <TableCell className="text-right">{row.amount ? formatCurrency(row.amount) : '—'}</TableCell>
                  <TableCell>
                    <Badge className={statusTone[row.status]}>{row.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {onOpenEntry ? (
                        <Button type="button" variant="ghost" size="sm" onClick={() => onOpenEntry(row.entryId)}>
                          View
                        </Button>
                      ) : null}
                      {row.status === 'issued' && storeId ? (
                        <>
                          <Button type="button" variant="outline" size="sm" onClick={() => void setStatus(row.entryId, 'cleared')}>
                            Clear
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => void setStatus(row.entryId, 'void')}>
                            Void
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
