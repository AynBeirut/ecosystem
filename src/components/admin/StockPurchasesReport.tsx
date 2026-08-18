import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AdminPanel from '@/components/admin/AdminPanel';
import ReportPeriodToolbar from '@/components/admin/ReportPeriodToolbar';
import { useStockReportData } from '@/hooks/useStockReportData';
import { useAuth } from '@/context/useAuth';
import { useStoreCurrency } from '@/hooks/useStoreCurrency';
import { exportToCSV } from '@/lib/exportUtils';
import { normalizeDateRange, quarterBounds, currentVatQuarter } from '@/lib/reportPeriodPresets';
import {
  aggregatePurchasesByProduct,
  aggregatePurchasesBySupplier,
  filterPurchasesByPeriod,
} from '@/lib/stockListReports';

type PurchaseView = 'supplier' | 'product';

export default function StockPurchasesReport() {
  const { user } = useAuth();
  const { money } = useStoreCurrency();
  const { loading, purchases } = useStockReportData(user?.storeId);
  const [view, setView] = useState<PurchaseView>('supplier');
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

  const filteredPurchases = useMemo(
    () => filterPurchasesByPeriod(purchases, period.startDate, period.endDate),
    [purchases, period.startDate, period.endDate],
  );

  const bySupplier = useMemo(() => aggregatePurchasesBySupplier(filteredPurchases), [filteredPurchases]);
  const byProduct = useMemo(() => aggregatePurchasesByProduct(filteredPurchases), [filteredPurchases]);

  const searchLower = search.trim().toLowerCase();

  const exportCsv = () => {
    if (view === 'supplier') {
      exportToCSV(
        bySupplier.map((row) => ({
          Supplier: row.supplier,
          Documents: row.documentCount,
          Total: row.totalAmount,
        })),
        'purchases_by_supplier',
      );
      return;
    }
    exportToCSV(
      byProduct.map((row) => ({
        Product: row.productName,
        Quantity: row.quantity,
        Purchases: row.purchaseCount,
        TotalCost: row.totalCost,
      })),
      'purchases_by_product',
    );
  };

  return (
    <AdminPanel>
      <div className="p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">List of purchases</h2>
            <p className="text-sm text-muted-foreground">Purchase movement by supplier or by product for the selected period.</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        </div>

        <ReportPeriodToolbar
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          showVatQuarters
        />

        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex gap-1">
            <Button type="button" size="sm" variant={view === 'supplier' ? 'default' : 'outline'} onClick={() => setView('supplier')}>
              By supplier
            </Button>
            <Button type="button" size="sm" variant={view === 'product' ? 'default' : 'outline'} onClick={() => setView('product')}>
              By product
            </Button>
          </div>
          <Input
            placeholder={view === 'supplier' ? 'Search supplier…' : 'Search product…'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-56"
          />
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading purchases…</p>
        ) : view === 'supplier' ? (
          <div className="rounded-md border overflow-auto max-h-[28rem]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Documents</TableHead>
                  <TableHead className="text-right">Total amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bySupplier.filter((r) => !searchLower || r.supplier.toLowerCase().includes(searchLower)).length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-muted-foreground">No purchases in this period.</TableCell></TableRow>
                ) : (
                  bySupplier
                    .filter((r) => !searchLower || r.supplier.toLowerCase().includes(searchLower))
                    .map((row) => (
                      <TableRow key={row.supplier}>
                        <TableCell>{row.supplier}</TableCell>
                        <TableCell className="text-right">{row.documentCount}</TableCell>
                        <TableCell className="text-right">{money(row.totalAmount)}</TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="rounded-md border overflow-auto max-h-[28rem]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product / material</TableHead>
                  <TableHead className="text-right">Qty received</TableHead>
                  <TableHead className="text-right">PO lines</TableHead>
                  <TableHead className="text-right">Total cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byProduct.filter((r) => !searchLower || r.productName.toLowerCase().includes(searchLower)).length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-muted-foreground">No purchase lines in this period.</TableCell></TableRow>
                ) : (
                  byProduct
                    .filter((r) => !searchLower || r.productName.toLowerCase().includes(searchLower))
                    .map((row) => (
                      <TableRow key={row.productKey}>
                        <TableCell>{row.productName}</TableCell>
                        <TableCell className="text-right">{row.quantity}</TableCell>
                        <TableCell className="text-right">{row.purchaseCount}</TableCell>
                        <TableCell className="text-right">{money(row.totalCost)}</TableCell>
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
