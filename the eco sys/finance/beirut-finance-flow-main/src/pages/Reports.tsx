import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useAppContext } from "@/context/AppContext";
import { useAccounting } from "@/context/AccountingContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, FileText, Download, FileSpreadsheet, File, Wallet, Users, Truck, Receipt } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { exportToCSV, exportToExcel, exportToPDF, ReportData } from "@/lib/reportExport";
import { formatCurrency } from "@/lib/utils";
import { EXPENSE_CATEGORY_LABELS } from "@/types/accounting";

const Reports = () => {
  const { user, invoices, receipts, products, purchaseOrders, logout } = useAppContext();
  const { 
    expenses, 
    staffPayments, 
    deliveryOrders, 
    deliveryPersons,
    cashBalance,
    cashCollections,
    getTotalExpensesByCategory, 
    getTotalPayroll,
    getDeliveryStats
  } = useAccounting();
  const { toast } = useToast();
  const [period, setPeriod] = useState<"month" | "quarter" | "year">("month");
  const [activeTab, setActiveTab] = useState("summary");

  const handleLogout = () => {
    logout();
    toast({ title: "Logged out", description: "You've been successfully logged out" });
  };

  // Filter data by period
  const getDateRange = () => {
    const now = new Date();
    const start = new Date();
    
    if (period === "month") {
      start.setMonth(now.getMonth() - 1);
    } else if (period === "quarter") {
      start.setMonth(now.getMonth() - 3);
    } else {
      start.setFullYear(now.getFullYear() - 1);
    }
    
    return { start, end: now };
  };

  const { start, end } = getDateRange();
  const dateRangeStr = { start: start.toLocaleDateString(), end: end.toLocaleDateString() };

  const filteredInvoices = invoices.filter(inv => {
    const date = new Date(inv.date);
    return date >= start && date <= end;
  });

  const filteredExpenses = expenses.filter(exp => {
    const date = new Date(exp.startDate);
    return date >= start && date <= end;
  });

  const filteredPayments = staffPayments.filter(pay => {
    const date = new Date(pay.periodStart);
    return date >= start && date <= end;
  });

  const filteredDeliveryOrders = deliveryOrders.filter(order => {
    const date = new Date(order.createdAt);
    return date >= start && date <= end;
  });

  // Calculate metrics
  const paidInvoices = filteredInvoices.filter(inv => inv.status === "paid");
  const totalRevenue = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0);

  // Calculate COGS
  const calculateCOGS = () => {
    let cogs = 0;
    paidInvoices.forEach(invoice => {
      invoice.items?.forEach(item => {
        const product = products.find(p => p.id === item.id);
        const rawPrice = item.rawPrice || product?.rawPrice || 0;
        cogs += rawPrice * item.quantity;
      });
    });
    return cogs;
  };

  const cogs = calculateCOGS();
  const grossProfit = totalRevenue - cogs;

  // Total expenses (from expense module + receipts)
  const expenseModuleTotal = filteredExpenses
    .filter(e => e.status === "paid")
    .reduce((sum, e) => sum + e.amount, 0);
  
  const receiptExpenses = receipts
    .filter(rec => {
      const date = new Date(rec.date);
      return date >= start && date <= end && rec.category;
    })
    .reduce((sum, rec) => sum + rec.amount, 0);

  const totalOperatingExpenses = expenseModuleTotal + receiptExpenses;

  // Payroll totals
  const payrollPaid = filteredPayments.filter(p => p.status === "paid").reduce((sum, p) => sum + p.amount, 0);
  const payrollPending = filteredPayments.filter(p => p.status !== "paid").reduce((sum, p) => sum + p.amount, 0);

  const totalExpenses = totalOperatingExpenses + payrollPaid;
  const netProfit = grossProfit - totalExpenses;

  const outstandingInvoices = filteredInvoices.filter(inv => inv.status !== "paid");
  const outstandingAmount = outstandingInvoices.reduce((sum, inv) => sum + inv.amount, 0);

  // Inventory metrics
  const productItems = products.filter(p => p.type === "product");
  const lowStockProducts = productItems.filter(p => (p.stockQuantity || 0) > 0 && (p.stockQuantity || 0) <= 10);
  const outOfStockProducts = productItems.filter(p => (p.stockQuantity || 0) === 0);
  const totalStockValue = productItems.reduce((sum, p) => sum + ((p.rawPrice || 0) * (p.stockQuantity || 0)), 0);

  // Top products by revenue
  const productRevenue = new Map<string, { name: string; revenue: number; quantity: number }>();
  paidInvoices.forEach(invoice => {
    invoice.items?.forEach(item => {
      const product = products.find(p => p.id === item.id);
      const productName = product?.name || item.description;
      const current = productRevenue.get(item.id) || { name: productName, revenue: 0, quantity: 0 };
      productRevenue.set(item.id, {
        name: productName,
        revenue: current.revenue + item.subtotal,
        quantity: current.quantity + item.quantity,
      });
    });
  });

  const topProducts = Array.from(productRevenue.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Expense breakdown by category
  const expensesByCategory = getTotalExpensesByCategory(start.toISOString(), end.toISOString());

  // Delivery stats
  const deliveryStats = getDeliveryStats();
  const deliveryByPerson = deliveryPersons.map(person => {
    const personOrders = filteredDeliveryOrders.filter(o => o.deliveryPersonId === person.id);
    const collections = cashCollections.filter(c => c.deliveryPersonId === person.id);
    return {
      name: person.name,
      ordersCount: personOrders.length,
      collected: personOrders.filter(o => o.status === "paid").reduce((sum, o) => sum + o.amount, 0),
      returned: collections.reduce((sum, c) => sum + c.totalAmount, 0),
      pending: person.walletBalance
    };
  });

  // Export handlers
  const handleExport = (type: 'pdf' | 'csv' | 'excel', reportType: string) => {
    let report: ReportData;

    switch (reportType) {
      case 'expenses':
        report = {
          title: 'Expense Report',
          dateRange: dateRangeStr,
          columns: [
            { key: 'category', label: 'Category', type: 'text' },
            { key: 'amount', label: 'Amount', type: 'currency' },
          ],
          data: Object.entries(expensesByCategory)
            .filter(([_, amount]) => amount > 0)
            .map(([category, amount]) => ({
              category: EXPENSE_CATEGORY_LABELS[category as keyof typeof EXPENSE_CATEGORY_LABELS],
              amount
            })),
          summary: { 'Total Expenses': expenseModuleTotal },
          currency: 'USD'
        };
        break;

      case 'payroll':
        report = {
          title: 'Payroll Report',
          dateRange: dateRangeStr,
          columns: [
            { key: 'staff', label: 'Staff', type: 'text' },
            { key: 'period', label: 'Period', type: 'text' },
            { key: 'amount', label: 'Amount', type: 'currency' },
            { key: 'status', label: 'Status', type: 'text' },
          ],
          data: filteredPayments.map(p => ({
            staff: p.staffName,
            period: `${new Date(p.periodStart).toLocaleDateString()} - ${new Date(p.periodEnd).toLocaleDateString()}`,
            amount: p.amount,
            status: p.status
          })),
          summary: { 'Total Paid': payrollPaid, 'Total Pending': payrollPending },
          currency: 'USD'
        };
        break;

      case 'delivery':
        report = {
          title: 'Delivery Report',
          dateRange: dateRangeStr,
          columns: [
            { key: 'person', label: 'Delivery Person', type: 'text' },
            { key: 'orders', label: 'Orders', type: 'number' },
            { key: 'collected', label: 'Cash Collected', type: 'currency' },
            { key: 'returned', label: 'Cash Returned', type: 'currency' },
            { key: 'pending', label: 'Pending', type: 'currency' },
          ],
          data: deliveryByPerson,
          summary: { 
            'Total Orders': deliveryStats.totalOrders,
            'Cash in Delivery': deliveryStats.pendingCash
          },
          currency: 'USD'
        };
        break;

      case 'inventory':
        report = {
          title: 'Inventory Report',
          subtitle: `Stock levels as of ${new Date().toLocaleDateString()}`,
          columns: [
            { key: 'name', label: 'Item Name', type: 'text' },
            { key: 'type', label: 'Type', type: 'text' },
            { key: 'stock', label: 'Stock', type: 'number' },
            { key: 'cost', label: 'Unit Cost', type: 'currency' },
            { key: 'value', label: 'Total Value', type: 'currency' },
            { key: 'status', label: 'Status', type: 'text' },
          ],
          data: products.map(p => ({
            name: p.name,
            type: p.type,
            stock: p.type === 'product' ? (p.stockQuantity || 0) : 'N/A',
            cost: p.rawPrice || 0,
            value: p.type === 'product' ? ((p.rawPrice || 0) * (p.stockQuantity || 0)) : 0,
            status: p.type === 'service' ? 'Service' : 
              (p.stockQuantity || 0) === 0 ? 'Out of Stock' : 
              (p.stockQuantity || 0) <= 10 ? 'Low Stock' : 'In Stock'
          })),
          summary: { 'Total Stock Value': totalStockValue },
          currency: 'USD'
        };
        break;

      case 'sales':
        report = {
          title: 'Sales Report',
          dateRange: dateRangeStr,
          columns: [
            { key: 'id', label: 'Invoice #', type: 'text' },
            { key: 'date', label: 'Date', type: 'date' },
            { key: 'client', label: 'Client', type: 'text' },
            { key: 'amount', label: 'Amount', type: 'currency' },
            { key: 'status', label: 'Status', type: 'text' },
          ],
          data: filteredInvoices.map(inv => ({
            id: inv.id,
            date: inv.date,
            client: inv.clientName,
            amount: inv.amount,
            status: inv.status
          })),
          summary: { 'Total Revenue': totalRevenue, 'Paid Invoices': paidInvoices.length },
          currency: 'USD'
        };
        break;

      case 'pnl':
      default:
        report = {
          title: 'Profit & Loss Report',
          dateRange: dateRangeStr,
          columns: [
            { key: 'category', label: 'Category', type: 'text' },
            { key: 'amount', label: 'Amount', type: 'currency' },
          ],
          data: [
            { category: 'Revenue', amount: totalRevenue },
            { category: 'Cost of Goods Sold', amount: -cogs },
            { category: 'Gross Profit', amount: grossProfit },
            { category: 'Operating Expenses', amount: -totalOperatingExpenses },
            { category: 'Payroll', amount: -payrollPaid },
            { category: 'Net Profit', amount: netProfit },
          ],
          summary: { 'Net Profit': netProfit },
          currency: 'USD'
        };
    }

    let success = false;
    switch (type) {
      case 'pdf': success = exportToPDF(report); break;
      case 'csv': success = exportToCSV(report); break;
      case 'excel': success = exportToExcel(report); break;
    }

    toast({
      title: success ? 'Export Successful' : 'Export Failed',
      description: success ? `${reportType} report exported as ${type.toUpperCase()}` : 'Failed to export report',
      variant: success ? 'default' : 'destructive'
    });
  };

  const StatCard = ({ title, value, icon: Icon, description, color }: any) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color || 'text-muted-foreground'}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{typeof value === 'number' ? formatCurrency(value, "USD") : value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );

  const ExportButtons = ({ reportType }: { reportType: string }) => (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={() => handleExport('pdf', reportType)}>
        <File className="h-4 w-4 mr-1" /> PDF
      </Button>
      <Button variant="outline" size="sm" onClick={() => handleExport('csv', reportType)}>
        <Download className="h-4 w-4 mr-1" /> CSV
      </Button>
      <Button variant="outline" size="sm" onClick={() => handleExport('excel', reportType)}>
        <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
      </Button>
    </div>
  );

  return (
    <AppLayout onLogout={handleLogout}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Financial Reports</h1>
            <p className="text-muted-foreground">Comprehensive business analytics</p>
          </div>
          
          <Select value={period} onValueChange={(value: any) => setPeriod(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Last Month</SelectItem>
              <SelectItem value="quarter">Last Quarter</SelectItem>
              <SelectItem value="year">Last Year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Cash Flow Overview */}
        <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" /> Cash Flow Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="p-4 bg-white dark:bg-gray-900 rounded-lg">
                <p className="text-sm text-muted-foreground">Cash on Hand</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(cashBalance.cashOnHand, "USD")}</p>
              </div>
              <div className="p-4 bg-white dark:bg-gray-900 rounded-lg">
                <p className="text-sm text-muted-foreground">Bank Balance</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(cashBalance.bankBalance, "USD")}</p>
              </div>
              <div className="p-4 bg-white dark:bg-gray-900 rounded-lg">
                <p className="text-sm text-muted-foreground">Cash in Delivery</p>
                <p className="text-2xl font-bold text-amber-600">{formatCurrency(cashBalance.deliveryHeldCash, "USD")}</p>
              </div>
              <div className="p-4 bg-white dark:bg-gray-900 rounded-lg">
                <p className="text-sm text-muted-foreground">Outstanding</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(outstandingAmount, "USD")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Revenue" value={totalRevenue} icon={DollarSign} description={`From ${paidInvoices.length} paid invoices`} color="text-green-600" />
          <StatCard title="Cost of Goods Sold" value={cogs} icon={ShoppingCart} description="Based on product costs" color="text-red-600" />
          <StatCard title="Gross Profit" value={grossProfit} icon={TrendingUp} description={`${((grossProfit / totalRevenue) * 100 || 0).toFixed(1)}% margin`} />
          <StatCard title="Net Profit" value={netProfit} icon={netProfit >= 0 ? TrendingUp : TrendingDown} description={`After all expenses`} color={netProfit >= 0 ? "text-green-600" : "text-red-600"} />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="summary">P&L Summary</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="payroll">Payroll</TabsTrigger>
            <TabsTrigger value="delivery">Delivery</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="sales">Sales</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Profit & Loss Statement</CardTitle>
                  <CardDescription>Period: {dateRangeStr.start} - {dateRangeStr.end}</CardDescription>
                </div>
                <ExportButtons reportType="pnl" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-medium">Revenue</span>
                    <span className="font-bold text-green-600">{formatCurrency(totalRevenue, "USD")}</span>
                  </div>
                  <div className="flex justify-between items-center border-b pb-2 pl-4">
                    <span className="text-muted-foreground">Less: Cost of Goods Sold</span>
                    <span className="text-red-600">-{formatCurrency(cogs, "USD")}</span>
                  </div>
                  <div className="flex justify-between items-center border-b pb-2 font-semibold">
                    <span>Gross Profit</span>
                    <span className={grossProfit >= 0 ? "text-green-600" : "text-red-600"}>{formatCurrency(grossProfit, "USD")}</span>
                  </div>
                  <div className="flex justify-between items-center border-b pb-2 pl-4">
                    <span className="text-muted-foreground">Less: Operating Expenses</span>
                    <span className="text-red-600">-{formatCurrency(totalOperatingExpenses, "USD")}</span>
                  </div>
                  <div className="flex justify-between items-center border-b pb-2 pl-4">
                    <span className="text-muted-foreground">Less: Payroll</span>
                    <span className="text-red-600">-{formatCurrency(payrollPaid, "USD")}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 text-lg font-bold">
                    <span>Net Profit</span>
                    <span className={netProfit >= 0 ? "text-green-600" : "text-red-600"}>{formatCurrency(netProfit, "USD")}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="expenses" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Expense Report</CardTitle>
                  <CardDescription>Breakdown by category</CardDescription>
                </div>
                <ExportButtons reportType="expenses" />
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3 mb-6">
                  <div className="p-4 border rounded-lg text-center">
                    <p className="text-2xl font-bold">{filteredExpenses.length}</p>
                    <p className="text-sm text-muted-foreground">Total Expenses</p>
                  </div>
                  <div className="p-4 border rounded-lg text-center">
                    <p className="text-2xl font-bold text-red-600">{formatCurrency(expenseModuleTotal, "USD")}</p>
                    <p className="text-sm text-muted-foreground">Total Paid</p>
                  </div>
                  <div className="p-4 border rounded-lg text-center">
                    <p className="text-2xl font-bold">{filteredExpenses.filter(e => e.type === "recurring").length}</p>
                    <p className="text-sm text-muted-foreground">Recurring</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {Object.entries(expensesByCategory)
                    .filter(([_, amount]) => amount > 0)
                    .sort((a, b) => b[1] - a[1])
                    .map(([category, amount]) => (
                      <div key={category} className="flex justify-between items-center p-3 border rounded-lg">
                        <span className="font-medium">{EXPENSE_CATEGORY_LABELS[category as keyof typeof EXPENSE_CATEGORY_LABELS]}</span>
                        <span className="font-bold">{formatCurrency(amount, "USD")}</span>
                      </div>
                    ))}
                  {Object.values(expensesByCategory).every(v => v === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No expenses in this period</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payroll" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Payroll Report</CardTitle>
                  <CardDescription>Staff payments summary</CardDescription>
                </div>
                <ExportButtons reportType="payroll" />
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3 mb-6">
                  <div className="p-4 border rounded-lg text-center">
                    <p className="text-2xl font-bold">{filteredPayments.length}</p>
                    <p className="text-sm text-muted-foreground">Total Payments</p>
                  </div>
                  <div className="p-4 border rounded-lg text-center">
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(payrollPaid, "USD")}</p>
                    <p className="text-sm text-muted-foreground">Paid</p>
                  </div>
                  <div className="p-4 border rounded-lg text-center">
                    <p className="text-2xl font-bold text-amber-600">{formatCurrency(payrollPending, "USD")}</p>
                    <p className="text-sm text-muted-foreground">Pending</p>
                  </div>
                </div>
                
                {filteredPayments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No payroll records in this period</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Staff</th>
                          <th className="text-left py-2">Period</th>
                          <th className="text-right py-2">Amount</th>
                          <th className="text-right py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPayments.map((payment, i) => (
                          <tr key={i} className="border-b">
                            <td className="py-2">{payment.staffName}</td>
                            <td className="py-2 text-muted-foreground">
                              {new Date(payment.periodStart).toLocaleDateString()} - {new Date(payment.periodEnd).toLocaleDateString()}
                            </td>
                            <td className="py-2 text-right font-medium">{formatCurrency(payment.amount, "USD")}</td>
                            <td className="py-2 text-right">
                              <span className={`px-2 py-1 rounded-full text-xs ${payment.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                                {payment.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="delivery" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Delivery Report</CardTitle>
                  <CardDescription>Cash collection and delivery tracking</CardDescription>
                </div>
                <ExportButtons reportType="delivery" />
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4 mb-6">
                  <div className="p-4 border rounded-lg text-center">
                    <p className="text-2xl font-bold">{filteredDeliveryOrders.length}</p>
                    <p className="text-sm text-muted-foreground">Total Orders</p>
                  </div>
                  <div className="p-4 border rounded-lg text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {filteredDeliveryOrders.filter(o => o.status === "paid" || o.returnedAt).length}
                    </p>
                    <p className="text-sm text-muted-foreground">Completed</p>
                  </div>
                  <div className="p-4 border rounded-lg text-center">
                    <p className="text-2xl font-bold text-amber-600">{formatCurrency(deliveryStats.pendingCash, "USD")}</p>
                    <p className="text-sm text-muted-foreground">Cash in Delivery</p>
                  </div>
                  <div className="p-4 border rounded-lg text-center">
                    <p className="text-2xl font-bold text-blue-600">{formatCurrency(deliveryStats.collectedCash, "USD")}</p>
                    <p className="text-sm text-muted-foreground">Total Collected</p>
                  </div>
                </div>
                
                {deliveryByPerson.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No delivery data</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Delivery Person</th>
                          <th className="text-right py-2">Orders</th>
                          <th className="text-right py-2">Collected</th>
                          <th className="text-right py-2">Returned</th>
                          <th className="text-right py-2">Pending</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deliveryByPerson.map((person, i) => (
                          <tr key={i} className="border-b">
                            <td className="py-2 font-medium">{person.name}</td>
                            <td className="py-2 text-right">{person.ordersCount}</td>
                            <td className="py-2 text-right">{formatCurrency(person.collected, "USD")}</td>
                            <td className="py-2 text-right text-green-600">{formatCurrency(person.returned, "USD")}</td>
                            <td className="py-2 text-right">
                              <span className={person.pending > 0 ? "text-amber-600 font-medium" : ""}>
                                {formatCurrency(person.pending, "USD")}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inventory" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Inventory Report</CardTitle>
                  <CardDescription>Current stock levels and values</CardDescription>
                </div>
                <ExportButtons reportType="inventory" />
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3 mb-6">
                  <div className="p-4 border rounded-lg text-center">
                    <p className="text-2xl font-bold">{productItems.length}</p>
                    <p className="text-sm text-muted-foreground">Total Products</p>
                  </div>
                  <div className="p-4 border rounded-lg text-center">
                    <p className="text-2xl font-bold text-amber-600">{lowStockProducts.length}</p>
                    <p className="text-sm text-muted-foreground">Low Stock</p>
                  </div>
                  <div className="p-4 border rounded-lg text-center">
                    <p className="text-2xl font-bold text-red-600">{outOfStockProducts.length}</p>
                    <p className="text-sm text-muted-foreground">Out of Stock</p>
                  </div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Stock Value</p>
                  <p className="text-3xl font-bold">{formatCurrency(totalStockValue, "USD")}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sales" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Sales Report</CardTitle>
                  <CardDescription>Invoice history for the period</CardDescription>
                </div>
                <ExportButtons reportType="sales" />
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Product</th>
                        <th className="text-right py-2">Qty Sold</th>
                        <th className="text-right py-2">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topProducts.length === 0 ? (
                        <tr><td colSpan={3} className="text-center py-8 text-muted-foreground">No sales data</td></tr>
                      ) : topProducts.map((p, i) => (
                        <tr key={i} className="border-b">
                          <td className="py-2">{p.name}</td>
                          <td className="py-2 text-right">{p.quantity}</td>
                          <td className="py-2 text-right">{formatCurrency(p.revenue, "USD")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Reports;
