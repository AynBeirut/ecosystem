import { useEffect, useMemo, useState } from 'react';
import { getFirestore } from 'firebase/firestore';
import AdminPanel from '@/components/admin/AdminPanel';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import { listOwnerPayables, summarizeOwnerPayables, type OwnerPayable } from '@/lib/ownerStayhaLoans';

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

export default function OwnerStayhaLoansReport() {
  const { user } = useAuth();
  const storeId = getActualStoreId(user);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<OwnerPayable[]>([]);

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    listOwnerPayables(getFirestore(), storeId)
      .then(setRows)
      .finally(() => setLoading(false));
  }, [storeId]);

  const summary = useMemo(() => summarizeOwnerPayables(rows), [rows]);

  return (
    <AdminPanel>
      <div className="p-4 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Owner payables</h2>
          <p className="text-sm text-muted-foreground max-w-3xl">
            Money you owe creditors personally — Stayha loans (Alaa, Talia) and supplier balances, separate from Jobran EST22.
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading payables…</p>
        ) : (
          <>
            <div className="rounded-lg border bg-amber-50/80 dark:bg-amber-950/20 p-4 max-w-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">You owe (total)</p>
              <p className="text-2xl font-semibold text-amber-800 dark:text-amber-200">{money(summary.totalUsd)}</p>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Creditor</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">
                      No owner payables on file.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.creditorName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.math || row.reason || row.program || '—'}
                      </TableCell>
                      <TableCell className="text-right font-semibold">{money(row.amountUsd)}</TableCell>
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
