import { useEffect, useMemo, useState } from 'react';
import { getFirestore } from 'firebase/firestore';
import { Download } from 'lucide-react';
import AdminPanel from '@/components/admin/AdminPanel';
import ReportPeriodToolbar from '@/components/admin/ReportPeriodToolbar';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import { exportToCSV } from '@/lib/exportUtils';
import { normalizeDateRange } from '@/lib/reportPeriodPresets';
import {
  aggregateOwnerServiceIncomeByMonth,
  discoverOwnerServiceIncomeClients,
  listOwnerServiceIncomeReceipts,
  type OwnerServiceIncomeClient,
  type OwnerServiceIncomeReceipt,
} from '@/lib/ownerServiceIncome';

export default function OwnerServiceIncomeReport() {
  const { user } = useAuth();
  const storeId = getActualStoreId(user);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<OwnerServiceIncomeClient[]>([]);
  const [receipts, setReceipts] = useState<OwnerServiceIncomeReceipt[]>([]);
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState('2026-12-31');

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    void discoverOwnerServiceIncomeClients(getFirestore(), storeId)
      .then(async (nextClients) => {
        setClients(nextClients);
        const rows = await listOwnerServiceIncomeReceipts(getFirestore(), storeId, nextClients);
        setReceipts(rows);
      })
      .finally(() => setLoading(false));
  }, [storeId]);

  const period = useMemo(() => normalizeDateRange(startDate, endDate), [startDate, endDate]);
  const activeClients = useMemo(
    () => clients.filter((c) => receipts.some((r) => r.clientId === c.id)),
    [clients, receipts],
  );
  const summary = useMemo(
    () => aggregateOwnerServiceIncomeByMonth(receipts, activeClients, period.startDate, period.endDate),
    [receipts, activeClients, period.startDate, period.endDate],
  );

  const detailRows = useMemo(
    () =>
      receipts.filter(
        (row) => row.paymentDate >= period.startDate && row.paymentDate <= period.endDate,
      ),
    [receipts, period.startDate, period.endDate],
  );

  const exportCsv = () => {
    exportToCSV(
      summary.rows.map((row) => {
        const out: Record<string, string | number> = { Month: row.label, Total: row.total };
        activeClients.forEach((client) => {
          out[client.label] = row.byClient[client.id] || 0;
        });
        return out;
      }),
      'owner_service_income_by_month',
    );
  };

  const money = (value: number) => `$${value.toFixed(2)}`;

  return (
    <AdminPanel>
      <div className="p-4 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Service income (Whish)</h2>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Cash received from service clients (electrical, dev, yoga) — all Whish receipt vouchers. Excludes
              Stayha/Borj project receivables.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={exportCsv} disabled={!summary.rows.length}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        <ReportPeriodToolbar
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
        />

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading Whish receipts…</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {activeClients.map((client) => (
                <div key={client.id} className="rounded-lg border bg-card p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{client.label}</p>
                  <p className="text-2xl font-semibold tabular-nums">{money(summary.grandByClient[client.id] || 0)}</p>
                </div>
              ))}
            </div>

            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    {activeClients.map((client) => (
                      <TableHead key={client.id} className="text-right whitespace-nowrap">
                        {client.label.split(' ')[0]}
                      </TableHead>
                    ))}
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={activeClients.length + 2} className="text-center text-muted-foreground">
                        No Whish receipts in this period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    summary.rows.map((row) => (
                      <TableRow key={row.month}>
                        <TableCell>{row.label}</TableCell>
                        {activeClients.map((client) => (
                          <TableCell key={client.id} className="text-right tabular-nums">
                            {(row.byClient[client.id] || 0) > 0 ? money(row.byClient[client.id]) : '—'}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-medium tabular-nums">{money(row.total)}</TableCell>
                      </TableRow>
                    ))
                  )}
                  {summary.rows.length > 0 ? (
                    <TableRow className="bg-muted/40">
                      <TableCell className="font-semibold">Total</TableCell>
                      {activeClients.map((client) => (
                        <TableCell key={client.id} className="text-right font-semibold tabular-nums">
                          {money(summary.grandByClient[client.id] || 0)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-semibold tabular-nums">{money(summary.grandTotal)}</TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Receipt detail ({detailRows.length})</h3>
              <div className="rounded-lg border overflow-x-auto max-h-[420px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Voucher</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.paymentDate}</TableCell>
                        <TableCell>{row.clientName}</TableCell>
                        <TableCell>{row.voucherNumber}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(row.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminPanel>
  );
}
