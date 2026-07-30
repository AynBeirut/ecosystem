import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import type { SettlementAllocationInput } from '@/types/generalLedger';
import type { OpenItemRow } from '@/lib/ledger/openItems';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentAmount: number;
  openItems: OpenItemRow[];
  partyLabel: string;
  onConfirm: (allocations: SettlementAllocationInput[]) => void;
};

export default function InvoiceAllocationDialog({
  open,
  onOpenChange,
  paymentAmount,
  openItems,
  partyLabel,
  onConfirm,
}: Props) {
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const allocations = useMemo(() => {
    return openItems
      .map((item) => {
        const val = Number(amounts[item.documentId]) || 0;
        if (val <= 0) return null;
        return {
          documentId: item.documentId,
          documentType: item.documentType,
          allocatedAmountBase: val,
        } satisfies SettlementAllocationInput;
      })
      .filter(Boolean) as SettlementAllocationInput[];
  }, [amounts, openItems]);

  const allocatedTotal = allocations.reduce((s, a) => s + a.allocatedAmountBase, 0);

  const applyRemaining = (item: OpenItemRow) => {
    const others = allocations.filter((a) => a.documentId !== item.documentId).reduce((s, a) => s + a.allocatedAmountBase, 0);
    const room = Math.max(0, paymentAmount - others);
    const apply = Math.min(item.remaining, room);
    setAmounts((prev) => ({ ...prev, [item.documentId]: String(apply) }));
  };

  const handleConfirm = () => {
    onConfirm(allocations);
    onOpenChange(false);
    setAmounts({});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Apply payment to open items</DialogTitle>
          <DialogDescription>
            {partyLabel} · Payment {formatCurrency(paymentAmount)} · Allocate to invoices or purchase orders.
          </DialogDescription>
        </DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Document</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
              <TableHead className="text-right">Apply</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {openItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  No open items for this party.
                </TableCell>
              </TableRow>
            ) : (
              openItems.map((item) => (
                <TableRow key={item.documentId}>
                  <TableCell>{item.date}</TableCell>
                  <TableCell>{item.documentNumber}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.remaining)}</TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-28 ml-auto"
                      value={amounts[item.documentId] || ''}
                      onChange={(e) => setAmounts((prev) => ({ ...prev, [item.documentId]: e.target.value }))}
                    />
                  </TableCell>
                  <TableCell>
                    <Button type="button" variant="ghost" size="sm" onClick={() => applyRemaining(item)}>
                      Max
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <p className="text-sm text-muted-foreground">
          Allocated: {formatCurrency(allocatedTotal)} / {formatCurrency(paymentAmount)}
        </p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Skip
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={allocatedTotal > paymentAmount}>
            Apply & post
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
