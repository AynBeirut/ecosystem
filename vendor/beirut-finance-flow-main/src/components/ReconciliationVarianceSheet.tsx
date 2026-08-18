import { useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import type { VarianceDetail } from '@/lib/ledger/reconciliationVarianceDetail';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: VarianceDetail | null;
  onRefresh: () => void | Promise<void>;
  refreshing?: boolean;
};

export default function ReconciliationVarianceSheet({
  open,
  onOpenChange,
  detail,
  onRefresh,
  refreshing,
}: Props) {
  const glTotal = useMemo(
    () => (detail ? detail.glLines.reduce((s, l) => s + l.net, 0) : 0),
    [detail],
  );
  const subTotal = useMemo(
    () => (detail ? detail.subledgerLines.reduce((s, l) => s + l.amount, 0) : 0),
    [detail],
  );

  if (!detail) return null;

  const { row, glLines, subledgerLines, externalImport, hints } = detail;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Reconciliation detail</SheetTitle>
          <SheetDescription>{row.label}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-md border p-2">
              <p className="text-muted-foreground text-xs">GL</p>
              <p className="font-semibold">{formatCurrency(row.glAmount)}</p>
            </div>
            <div className="rounded-md border p-2">
              <p className="text-muted-foreground text-xs">Subledger / external</p>
              <p className="font-semibold">{formatCurrency(row.subledgerAmount)}</p>
            </div>
            <div className="rounded-md border p-2">
              <p className="text-muted-foreground text-xs">Variance</p>
              <p className={`font-semibold ${row.matched ? 'text-green-700' : 'text-red-600'}`}>
                {formatCurrency(row.variance)}
              </p>
            </div>
          </div>

          {row.matched ? (
            <Badge variant="outline" className="text-green-700">Matched</Badge>
          ) : (
            <Badge variant="destructive">Variance — review lines below</Badge>
          )}

          {externalImport && (
            <p className="text-xs text-muted-foreground">
              External CSV: {externalImport.fileName} · imported {externalImport.importedAt.slice(0, 10)}
            </p>
          )}

          {hints.length > 0 && (
            <ul className="text-sm list-disc pl-5 space-y-1 text-muted-foreground">
              {hints.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
          )}

          <div>
            <h4 className="text-sm font-semibold mb-2">GL book lines ({formatCurrency(glTotal)} net)</h4>
            <div className="rounded-md border max-h-48 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Ref</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {glLines.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-muted-foreground text-sm">No GL lines in range.</TableCell></TableRow>
                  ) : (
                    glLines.map((line, idx) => (
                      <TableRow key={`${line.ref}-${idx}`}>
                        <TableCell className="text-xs">{line.date}</TableCell>
                        <TableCell className="text-xs max-w-[140px] truncate" title={line.memo}>{line.ref} — {line.memo}</TableCell>
                        <TableCell className="text-right text-xs">{formatCurrency(line.net)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2">
              Subledger / external lines ({formatCurrency(subTotal)} total)
            </h4>
            <div className="rounded-md border max-h-48 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Ref / party</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subledgerLines.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-muted-foreground text-sm">No subledger lines — import external CSV if this account is outside Grabio.</TableCell></TableRow>
                  ) : (
                    subledgerLines.map((line, idx) => (
                      <TableRow key={`${line.ref}-${idx}`}>
                        <TableCell className="text-xs">{line.date}</TableCell>
                        <TableCell className="text-xs max-w-[140px] truncate" title={line.label}>{line.label}</TableCell>
                        <TableCell className="text-right text-xs">{formatCurrency(line.amount)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={refreshing}
              onClick={async () => {
                await onRefresh();
                onOpenChange(false);
              }}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh &amp; recalculate
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
