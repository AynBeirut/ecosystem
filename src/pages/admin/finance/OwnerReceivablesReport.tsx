import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getFirestore } from 'firebase/firestore';
import AdminPanel from '@/components/admin/AdminPanel';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import { listOwnerReceivables, summarizeOwnerReceivables, type OwnerReceivable } from '@/lib/ownerReceivables';

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

export default function OwnerReceivablesReport() {
  const { user } = useAuth();
  const storeId = getActualStoreId(user);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<OwnerReceivable[]>([]);

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    listOwnerReceivables(getFirestore(), storeId)
      .then(setRows)
      .finally(() => setLoading(false));
  }, [storeId]);

  const summary = useMemo(() => summarizeOwnerReceivables(rows), [rows]);

  return (
    <AdminPanel>
      <div className="p-4 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Owner receivables</h2>
          <p className="text-sm text-muted-foreground max-w-3xl">
            Money owed to you — project invoices (Stayha EST22, Borj El Hajal) and personal balances. Open the
            customer statement for payment history.
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading receivables…</p>
        ) : (
          <>
            <div className="rounded-lg border bg-emerald-50/80 dark:bg-emerald-950/20 p-4 max-w-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Owed to you (total)</p>
              <p className="text-2xl font-semibold text-emerald-800 dark:text-emerald-200">{money(summary.totalUsd)}</p>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Debtor</TableHead>
                  <TableHead>Program / note</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Statement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      No owner receivables on file.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.debtorName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.program || row.amountLabel || row.invoiceNumber || '—'}
                        {row.nextPaymentDue ? ` · next ${row.nextPaymentDue}` : ''}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{money(row.amountUsd)}</TableCell>
                      <TableCell className="text-right">
                        {row.financeClientId ? (
                          <Button asChild variant="outline" size="sm">
                            <Link
                              to={`/admin/customers/${row.financeClientId}/statement?type=customer&name=${encodeURIComponent(row.debtorName)}`}
                            >
                              View
                            </Link>
                          </Button>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </>
        )}
      </div>
    </AdminPanel>
  );
}
