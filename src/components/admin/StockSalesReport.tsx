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
  aggregateSalesByCustomer,
  aggregateSalesByProduct,
  filterSalesByPeriod,
} from '@/lib/stockListReports';

type SalesView = 'customer' | 'product';

export default function StockSalesReport() {
  const { user } = useAuth();
  const { money } = useStoreCurrency();
  const { loading, sales, catalog } = useStockReportData(user?.storeId);
  const [view, setView] = useState<SalesView>('customer');
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

  const filteredSales = useMemo(
    () => filterSalesByPeriod(sales, period.startDate, period.endDate),
    [sales, period.startDate, period.endDate],
  );

  const byCustomer = useMemo(() => aggregateSalesByCustomer(filteredSales), [filteredSales]);
  const byProduct = useMemo(() => aggregateSalesByProduct(filteredSales, catalog), [filteredSales, catalog]);

  const searchLower = search.trim().toLowerCase();

  const exportCsv = () => {
    if (view === 'customer') {
      exportToCSV(
        byCustomer.map((row) => ({
          Customer: row.customer,
          Invoices: row.invoiceCount,
          Invoiced: row.totalInvoiced,
          Paid: row.totalPaid,
          Balance: row.balance,
        })),
        'sales_by_customer',
      );
      return;
    }
    exportToCSV(
      byProduct.map((row) => ({
        Product: row.productName,
        Category: row.category,
        Quantity: row.quantitySold,
        Discount: row.discount,
        Revenue: row.revenue,
      })),
      'sales_by_product',
    );
  };

  return (
    <AdminPanel>
      <div className="p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">List of sales</h2>
            <p className="text-sm text-muted-foreground">Sales by customer or by product for the selected period.</p>
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
            <Button type="button" size="sm" variant={view === 'customer' ? 'default' : 'outline'} onClick={() => setView('customer')}>
              By customer
            </Button>
            <Button type="button" size="sm" variant={view === 'product' ? 'default' : 'outline'} onClick={() => setView('product')}>
              By product
            </Button>
          </div>
          <Input
            placeholder={view === 'customer' ? 'Search customer…' : 'Search product…'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-56"
          />
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading sales…</p>
        ) : view === 'customer' ? (
          <div className="rounded-md border overflow-auto max-h-[28rem]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Invoices</TableHead>
                  <TableHead className="text-right">Invoiced</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byCustomer.filter((r) => !searchLower || r.customer.toLowerCase().includes(searchLower)).length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-muted-foreground">No sales in this period.</TableCell></TableRow>
                ) : (
                  byCustomer
                    .filter((r) => !searchLower || r.customer.toLowerCase().includes(searchLower))
                    .map((row) => (
                      <TableRow key={row.customer}>
                        <TableCell>{row.customer}</TableCell>
                        <TableCell className="text-right">{row.invoiceCount}</TableCell>
                        <TableCell className="text-right">{money(row.totalInvoiced)}</TableCell>
                        <TableCell className="text-right">{money(row.totalPaid)}</TableCell>
                        <TableCell className="text-right">{money(row.balance)}</TableCell>
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
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Qty sold</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byProduct.filter((r) => !searchLower || r.productName.toLowerCase().includes(searchLower)).length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-muted-foreground">No product sales in this period.</TableCell></TableRow>
                ) : (
                  byProduct
                    .filter((r) => !searchLower || r.productName.toLowerCase().includes(searchLower))
                    .map((row) => (
                      <TableRow key={row.productId}>
                        <TableCell>{row.productName}</TableCell>
                        <TableCell>{row.category}</TableCell>
                        <TableCell className="text-right">{row.quantitySold}</TableCell>
                        <TableCell className="text-right">{money(row.discount)}</TableCell>
                        <TableCell className="text-right">{money(row.revenue)}</TableCell>
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
