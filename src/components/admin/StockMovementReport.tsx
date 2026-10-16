import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AdminPanel from '@/components/admin/AdminPanel';
import ReportPeriodToolbar from '@/components/admin/ReportPeriodToolbar';
import { useStockReportData } from '@/hooks/useStockReportData';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import { useStoreCurrency } from '@/hooks/useStoreCurrency';
import { exportToCSV } from '@/lib/exportUtils';
import { normalizeDateRange, quarterBounds, currentVatQuarter } from '@/lib/reportPeriodPresets';
import { buildStockMovements } from '@/lib/stockListReports';

export default function StockMovementReport() {
  const { user } = useAuth();
  const { money } = useStoreCurrency();
  const { loading, sales, purchases } = useStockReportData(getActualStoreId(user));
  const [startDate, setStartDate] = useState(() => {
    const y = new Date().getFullYear();
    return quarterBounds(y, currentVatQuarter()).startDate;
  });
  const [endDate, setEndDate] = useState(() => {
    const y = new Date().getFullYear();
    return quarterBounds(y, currentVatQuarter()).endDate;
  });
  const [search, setSearch] = useState('');

  const period = useMemo(
    () => normalizeDateRange(startDate, endDate),
    [startDate, endDate],
  );

  const movements = useMemo(
    () => buildStockMovements(sales, purchases, period.startDate, period.endDate),
    [sales, purchases, period.startDate, period.endDate],
  );

  const searchLower = search.trim().toLowerCase();
  const filtered = movements.filter((row) => {
    if (!searchLower) return true;
    return (
      row.productName.toLowerCase().includes(searchLower) ||
      row.party.toLowerCase().includes(searchLower) ||
      row.ref.toLowerCase().includes(searchLower)
    );
  });

  const totals = filtered.reduce(
    (acc, row) => {
      if (row.type === 'sale_out') acc.salesOut += Math.abs(row.quantity);
      else acc.purchaseIn += row.quantity;
      acc.netQty += row.quantity;
      acc.amount += row.amount;
      return acc;
    },
    { salesOut: 0, purchaseIn: 0, netQty: 0, amount: 0 },
  );

  const exportCsv = () => {
    exportToCSV(
      filtered.map((row) => ({
        Date: row.date,
        Type: row.type === 'sale_out' ? 'Sale out' : 'Purchase in',
        Ref: row.ref,
        Party: row.party,
        Product: row.productName,
        Quantity: row.quantity,
        Amount: row.amount,
      })),
      'stock_movement',
    );
  };

  return (
    <AdminPanel>
      <div className="space-y-3 p-3 md:p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">Stock movement</h2>
            <p className="text-xs text-muted-foreground">
              Sales &amp; purchases by period — Q1–Q4 shortcuts below.
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
          </Button>
        </div>

        <ReportPeriodToolbar
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          showVatQuarters
        />

        <Input
          placeholder="Search product, party, or ref…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 max-w-md"
        />

        <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4 md:gap-3">
          <div className="rounded-md border px-2.5 py-2">
            <p className="text-muted-foreground">Purchase in</p>
            <p className="text-lg font-semibold tabular-nums text-emerald-700">{totals.purchaseIn}</p>
          </div>
          <div className="rounded-md border px-2.5 py-2">
            <p className="text-muted-foreground">Sales out</p>
            <p className="text-lg font-semibold tabular-nums text-orange-700">{totals.salesOut}</p>
          </div>
          <div className="rounded-md border px-2.5 py-2">
            <p className="text-muted-foreground">Net qty</p>
            <p className="text-lg font-semibold tabular-nums">{totals.netQty}</p>
          </div>
          <div className="rounded-md border px-2.5 py-2">
            <p className="text-muted-foreground">Line value</p>
            <p className="text-lg font-semibold tabular-nums">{money(totals.amount)}</p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading movements…</p>
        ) : (
          <div className="rounded-md border overflow-auto max-h-[32rem]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Ref</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-muted-foreground">No stock movements in this period.</TableCell></TableRow>
                ) : (
                  filtered.map((row, idx) => (
                    <TableRow key={`${row.ref}-${row.productName}-${idx}`}>
                      <TableCell>{row.date}</TableCell>
                      <TableCell>
                        <Badge variant={row.type === 'purchase_in' ? 'default' : 'secondary'}>
                          {row.type === 'purchase_in' ? 'In' : 'Out'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.ref}</TableCell>
                      <TableCell>{row.party}</TableCell>
                      <TableCell>{row.productName}</TableCell>
                      <TableCell className={`text-right ${row.quantity < 0 ? 'text-orange-700' : 'text-emerald-700'}`}>
                        {row.quantity > 0 ? `+${row.quantity}` : row.quantity}
                      </TableCell>
                      <TableCell className="text-right">{money(row.amount)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AdminPanel>
  );
}
