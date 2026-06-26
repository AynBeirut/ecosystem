import React, { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, Package, AlertTriangle, Download, FileText } from 'lucide-react';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminStatCard from '@/components/admin/AdminStatCard';
import AdminPanel from '@/components/admin/AdminPanel';
import { Expense } from '@/types/financial';
import { Purchase } from '@/types/inventory';
import { RawMaterial } from '@/types/material';
import { Customer } from '@/types/customer';
import { SalaryPayment } from '@/types/staff';
import { ProductionBatch } from '@/types/production';
import { Order } from '@/types/order';
import { exportToCSV, exportToPDF } from '@/lib/exportUtils';

const AdminReports: React.FC = () => {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [reportType, setReportType] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [salaryPayments, setSalaryPayments] = useState<SalaryPayment[]>([]);
  const [productionBatches, setProductionBatches] = useState<ProductionBatch[]>([]);

  useEffect(() => {
    const fetchAllData = async () => {
      if (!user?.storeId) return;
      const db = getFirestore();

      const fetchCollection = async (collectionName: string) => {
        const ref = collection(db, collectionName);
        const q = query(ref, where('storeId', '==', user.storeId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      };

      const [expensesData, purchasesData, ordersData, materialsData, customersData, salariesData, batchesData] = await Promise.all([
        fetchCollection('expenses'),
        fetchCollection('purchases'),
        fetchCollection('orders'),
        fetchCollection('rawMaterials'),
        fetchCollection('customers'),
        fetchCollection('salaryPayments'),
        fetchCollection('productionBatches'),
      ]);

      setExpenses(expensesData as Expense[]);
      setPurchases(purchasesData as Purchase[]);
      setOrders(ordersData as Order[]);
      setMaterials(materialsData as RawMaterial[]);
      setCustomers(customersData as Customer[]);
      setSalaryPayments(salariesData as SalaryPayment[]);
      setProductionBatches(batchesData as ProductionBatch[]);
    };

    fetchAllData();
  }, [user?.storeId]);

  const filterByDateRange = (date: string) => {
    return date >= dateRange.startDate && date <= dateRange.endDate;
  };

  // Financial Metrics
  const totalExpenses = expenses
    .filter(e => filterByDateRange(e.date))
    .reduce((sum, e) => sum + e.amount, 0);

  // Purchases - Total amounts for received orders
  const receivedPurchases = purchases.filter(p => p.status === 'received' && filterByDateRange(p.orderDate || p.createdAt));
  
  const totalPurchases = receivedPurchases
    .reduce((sum, p) => sum + (p.totalAmount || p.total || 0), 0);
  
  // Paid purchases
  const totalPurchasesPaid = receivedPurchases
    .filter(p => p.paymentStatus === 'paid')
    .reduce((sum, p) => sum + (p.amountPaid || 0), 0);
  
  // Unpaid purchases (Accounts Payable)
  const unpaidPurchases = receivedPurchases.filter(p => p.paymentStatus !== 'paid');
  const accountsPayable = unpaidPurchases
    .reduce((sum, p) => sum + ((p.totalAmount || p.total || 0) - (p.amountPaid || 0)), 0);

  const totalSalaries = salaryPayments
    .filter(s => filterByDateRange(s.paymentDate))
    .reduce((sum, s) => sum + s.totalAmount, 0);

  const totalCosts = totalExpenses + totalPurchasesPaid + totalSalaries;

  // Sales & Revenue (Orders)
  const completedOrders = orders.filter(o => 
    o.status !== 'cancelled' && o.createdAt && filterByDateRange(o.createdAt.toString())
  );
  
  const totalRevenue = completedOrders
    .reduce((sum, o) => sum + (o.total || 0), 0);
  
  const totalRevenuePaid = completedOrders
    .filter(o => o.paymentStatus === 'paid')
    .reduce((sum, o) => sum + (o.amountPaid || 0), 0);
  
  // Unpaid orders (Accounts Receivable)
  const unpaidOrders = completedOrders.filter(o => o.paymentStatus !== 'paid');
  const accountsReceivable = unpaidOrders
    .reduce((sum, o) => sum + ((o.total || 0) - (o.amountPaid || 0)), 0);

  // Inventory Metrics
  const totalInventoryValue = materials.reduce((sum, m) => sum + (m.stockQuantity * m.costPerUnit), 0);
  const lowStockItems = materials.filter(m => m.stockQuantity <= m.minStockLevel);
  const outOfStockItems = materials.filter(m => m.stockQuantity === 0);

  // Production Metrics
  const completedBatches = productionBatches.filter(b => 
    b.status === 'completed' && b.completionDate && filterByDateRange(b.completionDate)
  );
  const totalProduction = completedBatches.reduce((sum, b) => sum + (b.actualQuantity || 0), 0);
  const productionCost = completedBatches.reduce((sum, b) => sum + b.materialsCost, 0);

  // Sales by Person
  const salesByPerson = completedOrders.reduce((acc, o) => {
    const name = o.assignedSalesPersonName || o.assignedSalesPerson || 'Unassigned';
    if (!acc[name]) acc[name] = { name, total: 0, count: 0 };
    acc[name].total += o.total || 0;
    acc[name].count += 1;
    return acc;
  }, {} as Record<string, { name: string; total: number; count: number }>);

  const salesByPersonList = Object.values(salesByPerson).sort((a, b) => b.total - a.total);
  const grandTotalSales = salesByPersonList.reduce((s, p) => s + p.total, 0);

  // Monthly sales breakdown
  const monthlySales = completedOrders.reduce((acc, o) => {
    const month = (o.createdAt || '').toString().slice(0, 7);
    if (!month) return acc;
    if (!acc[month]) acc[month] = { month, total: 0, count: 0 };
    acc[month].total += o.total || 0;
    acc[month].count += 1;
    return acc;
  }, {} as Record<string, { month: string; total: number; count: number }>);

  const monthlySalesList = Object.values(monthlySales).sort((a, b) => a.month.localeCompare(b.month));

  // Customer Metrics
  const activeCustomers = customers.filter(c => c.status === 'active').length;
  const totalCustomerValue = customers.reduce((sum, c) => sum + (c.lifetimeValue || 0), 0);
  const totalLoyaltyPoints = customers.reduce((sum, c) => sum + c.loyaltyPoints, 0);

  // Expense Breakdown by Category
  const expensesByCategory = expenses
    .filter(e => filterByDateRange(e.date))
    .reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {} as Record<string, number>);

  const topExpenseCategories = Object.entries(expensesByCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  // Purchase Trends
  const purchasesByMonth = purchases
    .filter(p => filterByDateRange(p.orderDate))
    .reduce((acc, p) => {
      const month = p.orderDate.slice(0, 7);
      acc[month] = (acc[month] || 0) + p.totalCost;
      return acc;
    }, {} as Record<string, number>);

  const handleExportExpenses = () => {
    const filteredExpenses = expenses.filter(e => filterByDateRange(e.date));
    const exportData = filteredExpenses.map(e => ({
      Date: new Date(e.date).toLocaleDateString(),
      Description: e.description,
      Category: e.category,
      Amount: e.amount.toFixed(2),
      Vendor: e.vendor || 'N/A',
      PaymentMethod: e.paymentMethod,
      Recurring: e.recurring ? 'Yes' : 'No',
    }));
    exportToCSV(exportData, 'expenses_report');
  };

  const handleExportPurchases = () => {
    const filteredPurchases = purchases.filter(p => filterByDateRange(p.orderDate || p.createdAt));
    const exportData = filteredPurchases.map(p => ({
      Date: new Date(p.orderDate || p.createdAt).toLocaleDateString(),
      PONumber: p.invoiceNumber || p.poNumber || p.id,
      Supplier: p.supplierName || 'N/A',
      Status: p.status,
      TotalAmount: (p.totalAmount || p.total || 0).toFixed(2),
      AmountPaid: (p.amountPaid || 0).toFixed(2),
      AmountDue: ((p.totalAmount || p.total || 0) - (p.amountPaid || 0)).toFixed(2),
      PaymentStatus: p.paymentStatus || 'unpaid',
      PaymentDate: p.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : 'Not Paid',
      ReceivedDate: p.receivedDate ? new Date(p.receivedDate).toLocaleDateString() : 'Not Received',
    }));
    exportToCSV(exportData, 'purchases_report');
  };

  const handleExportInventory = () => {
    const exportData = materials.map(m => ({
      Name: m.name,
      SKU: m.sku || 'N/A',
      Category: m.category,
      Stock: m.stockQuantity,
      Unit: m.unit,
      CostPerUnit: m.costPerUnit.toFixed(2),
      TotalValue: (m.stockQuantity * m.costPerUnit).toFixed(2),
      MinStock: m.minStockLevel,
      Supplier: m.supplierName || 'N/A',
    }));
    exportToCSV(exportData, 'inventory_report');
  };

  const handleExportFinancialSummary = () => {
    const exportData = [
      { Category: 'Total Expenses', Amount: totalExpenses.toFixed(2) },
      { Category: 'Total Purchases', Amount: totalPurchases.toFixed(2) },
      { Category: 'Purchases Paid', Amount: totalPurchasesPaid.toFixed(2) },
      { Category: 'Accounts Payable', Amount: accountsPayable.toFixed(2) },
      { Category: 'Total Salaries', Amount: totalSalaries.toFixed(2) },
      { Category: 'Production Cost', Amount: productionCost.toFixed(2) },
      { Category: 'Total Costs (Actual Paid)', Amount: totalCosts.toFixed(2) },
      { Category: 'Inventory Value', Amount: totalInventoryValue.toFixed(2) },
    ];
    exportToCSV(exportData, 'financial_summary');
  };

  return (
    <AdminPageShell
      title="Reports & Analytics"
      description="Financial, inventory, and production insights for your store"
      eyebrow="Business Tools"
      backTo="/admin/dashboard"
      actions={(
        <Button variant="outline" onClick={handleExportFinancialSummary}>
          <Download className="mr-2 h-4 w-4" />
          Export Summary
        </Button>
      )}
    >
        <AdminPanel className="mb-6">
          <CardHeader>
            <CardTitle>Report Settings</CardTitle>
            <CardDescription>Configure date range and report type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="reportType">Report Type</Label>
                <Select value={reportType} onValueChange={(value: any) => setReportType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </AdminPanel>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="salesperson">By Sales Person</TabsTrigger>
            <TabsTrigger value="financial">Financial</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="production">Production</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <AdminStatCard
                title="Total Costs"
                value={`$${totalCosts.toFixed(2)}`}
                icon={DollarSign}
                gradient="from-red-500 to-rose-700"
                valueClassName="text-red-600"
              />
              <AdminStatCard
                title="Inventory Value"
                value={`$${totalInventoryValue.toFixed(2)}`}
                icon={Package}
                gradient="from-sky-500 to-blue-700"
                valueClassName="text-blue-600"
              />
              <AdminStatCard
                title="Active Customers"
                value={activeCustomers}
                icon={Users}
                gradient="from-emerald-500 to-teal-700"
                valueClassName="text-green-600"
              />
              <AdminStatCard
                title="Production Units"
                value={totalProduction}
                icon={BarChart3}
                gradient="from-violet-500 to-purple-700"
                valueClassName="text-purple-600"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AdminPanel>
                <CardHeader>
                  <CardTitle>Quick Insights</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b">
                    <span className="text-sm font-semibold text-gray-700">Revenue</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Revenue</span>
                    <span className="font-bold">${totalRevenue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Revenue Received</span>
                    <span className="font-bold text-green-600">${totalRevenuePaid.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Accounts Receivable</span>
                    <span className="font-bold text-orange-600">${accountsReceivable.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b mt-4">
                    <span className="text-sm font-semibold text-gray-700">Costs</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Expenses</span>
                    <span className="font-bold">${totalExpenses.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Purchases</span>
                    <span className="font-bold">${totalPurchases.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Purchases Paid</span>
                    <span className="font-bold text-green-600">${totalPurchasesPaid.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Accounts Payable</span>
                    <span className="font-bold text-red-600">${accountsPayable.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Salaries</span>
                    <span className="font-bold">${totalSalaries.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Production Cost</span>
                    <span className="font-bold">${productionCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="font-semibold">Customer Lifetime Value</span>
                    <span className="font-bold text-green-600">${totalCustomerValue.toFixed(2)}</span>
                  </div>
                </CardContent>
              </AdminPanel>

              <AdminPanel>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    Alerts & Warnings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-red-50 rounded">
                    <span className="text-sm">Out of Stock Items</span>
                    <span className="font-bold text-red-600">{outOfStockItems.length}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-yellow-50 rounded">
                    <span className="text-sm">Low Stock Items</span>
                    <span className="font-bold text-yellow-600">{lowStockItems.length}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-orange-50 rounded">
                    <span className="text-sm">Unpaid Purchases</span>
                    <span className="font-bold text-orange-600">{unpaidPurchases.length}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
                    <span className="text-sm">Pending Orders</span>
                    <span className="font-bold text-blue-600">
                      {purchases.filter(p => p.status === 'draft' || p.status === 'sent' || p.status === 'confirmed').length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-purple-50 rounded">
                    <span className="text-sm">Planned Production</span>
                    <span className="font-bold text-purple-600">
                      {productionBatches.filter(b => b.status === 'planned').length}
                    </span>
                  </div>
                </CardContent>
              </AdminPanel>
            </div>
          </TabsContent>

          <TabsContent value="salesperson" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sales by Person */}
              <AdminPanel>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Sales by Person</CardTitle>
                  <CardDescription>{dateRange.startDate} → {dateRange.endDate}</CardDescription>
                </CardHeader>
                <CardContent>
                  {salesByPersonList.length === 0 ? (
                    <p className="text-sm text-gray-500">No sales assigned to any person in this period.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Person</th>
                          <th className="text-right py-2">Orders</th>
                          <th className="text-right py-2">Total</th>
                          <th className="text-right py-2">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesByPersonList.map((p) => (
                          <tr key={p.name} className="border-b last:border-0">
                            <td className="py-2 font-medium">{p.name}</td>
                            <td className="py-2 text-right">{p.count}</td>
                            <td className="py-2 text-right">${p.total.toFixed(2)}</td>
                            <td className="py-2 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-blue-500 h-2 rounded-full"
                                    style={{ width: `${grandTotalSales > 0 ? (p.total / grandTotalSales) * 100 : 0}%` }}
                                  />
                                </div>
                                <span className="w-10 text-right">
                                  {grandTotalSales > 0 ? ((p.total / grandTotalSales) * 100).toFixed(1) : '0.0'}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t-2">
                        <tr>
                          <td className="py-2 font-bold">Total</td>
                          <td className="py-2 text-right font-bold">{completedOrders.length}</td>
                          <td className="py-2 text-right font-bold">${grandTotalSales.toFixed(2)}</td>
                          <td className="py-2 text-right font-bold">100%</td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </CardContent>
              </AdminPanel>

              {/* Monthly Sales Report */}
              <AdminPanel>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />Monthly Sales Report</CardTitle>
                  <CardDescription>Revenue per month in selected range</CardDescription>
                </CardHeader>
                <CardContent>
                  {monthlySalesList.length === 0 ? (
                    <p className="text-sm text-gray-500">No sales data in this period.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Month</th>
                          <th className="text-right py-2">Orders</th>
                          <th className="text-right py-2">Revenue</th>
                          <th className="text-right py-2">vs Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlySalesList.map((m) => (
                          <tr key={m.month} className="border-b last:border-0">
                            <td className="py-2 font-medium">
                              {new Date(m.month + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                            </td>
                            <td className="py-2 text-right">{m.count}</td>
                            <td className="py-2 text-right">${m.total.toFixed(2)}</td>
                            <td className="py-2 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-green-500 h-2 rounded-full"
                                    style={{ width: `${grandTotalSales > 0 ? (m.total / grandTotalSales) * 100 : 0}%` }}
                                  />
                                </div>
                                <span className="w-10 text-right">
                                  {grandTotalSales > 0 ? ((m.total / grandTotalSales) * 100).toFixed(1) : '0.0'}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t-2">
                        <tr>
                          <td className="py-2 font-bold">Total</td>
                          <td className="py-2 text-right font-bold">{completedOrders.length}</td>
                          <td className="py-2 text-right font-bold">${grandTotalSales.toFixed(2)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </CardContent>
              </AdminPanel>
            </div>

            {/* Monthly breakdown per salesperson */}
            <AdminPanel>
              <CardHeader>
                <CardTitle>Monthly Breakdown per Sales Person</CardTitle>
                <CardDescription>Each person's sales per month</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {salesByPersonList.length === 0 ? (
                  <p className="text-sm text-gray-500">No data available.</p>
                ) : (() => {
                  const months = monthlySalesList.map(m => m.month);
                  const perPersonPerMonth: Record<string, Record<string, number>> = {};
                  completedOrders.forEach(o => {
                    const name = o.assignedSalesPersonName || o.assignedSalesPerson || 'Unassigned';
                    const month = (o.createdAt || '').toString().slice(0, 7);
                    if (!month) return;
                    if (!perPersonPerMonth[name]) perPersonPerMonth[name] = {};
                    perPersonPerMonth[name][month] = (perPersonPerMonth[name][month] || 0) + (o.total || 0);
                  });
                  return (
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 pr-4">Person</th>
                          {months.map(m => (
                            <th key={m} className="text-right py-2 px-2">
                              {new Date(m + '-01').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}
                            </th>
                          ))}
                          <th className="text-right py-2 pl-4">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesByPersonList.map(p => (
                          <tr key={p.name} className="border-b last:border-0">
                            <td className="py-2 pr-4 font-medium">{p.name}</td>
                            {months.map(m => (
                              <td key={m} className="py-2 px-2 text-right">
                                {perPersonPerMonth[p.name]?.[m] ? `$${perPersonPerMonth[p.name][m].toFixed(2)}` : '-'}
                              </td>
                            ))}
                            <td className="py-2 pl-4 text-right font-bold">${p.total.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t-2">
                        <tr>
                          <td className="py-2 font-bold">Total</td>
                          {months.map(m => (
                            <td key={m} className="py-2 px-2 text-right font-bold">
                              ${(monthlySales[m]?.total || 0).toFixed(2)}
                            </td>
                          ))}
                          <td className="py-2 pl-4 text-right font-bold">${grandTotalSales.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  );
                })()}
              </CardContent>
            </AdminPanel>
          </TabsContent>

          <TabsContent value="financial" className="space-y-6">
            <div className="flex justify-end gap-2 mb-4">
              <Button variant="outline" size="sm" onClick={handleExportExpenses}>
                <Download className="mr-2 h-4 w-4" />
                Export Expenses
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPurchases}>
                <Download className="mr-2 h-4 w-4" />
                Export Purchases
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <AdminStatCard
                title="Total Expenses"
                value={`$${totalExpenses.toFixed(2)}`}
                icon={DollarSign}
                gradient="from-red-500 to-rose-700"
                valueClassName="text-red-600"
              />
              <AdminStatCard
                title="Purchases (Paid)"
                value={`$${totalPurchasesPaid.toFixed(2)}`}
                icon={ShoppingCart}
                gradient="from-emerald-500 to-teal-700"
                valueClassName="text-green-600"
              />
              <AdminStatCard
                title="Accounts Payable"
                value={`$${accountsPayable.toFixed(2)}`}
                icon={AlertTriangle}
                gradient="from-red-500 to-rose-700"
                valueClassName="text-red-600"
              />
              <AdminStatCard
                title="Salary Payments"
                value={`$${totalSalaries.toFixed(2)}`}
                icon={Users}
                gradient="from-violet-500 to-purple-700"
                valueClassName="text-purple-600"
              />
            </div>

            {unpaidPurchases.length > 0 && (
              <AdminPanel>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    Unpaid Purchases (Accounts Payable)
                  </CardTitle>
                  <CardDescription>{unpaidPurchases.length} purchase order(s) awaiting payment</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {unpaidPurchases.map(purchase => {
                      const totalAmount = purchase.totalAmount || purchase.total || 0;
                      const amountPaid = purchase.amountPaid || 0;
                      const amountDue = totalAmount - amountPaid;
                      return (
                        <div key={purchase.id} className="flex justify-between items-center p-3 bg-red-50 rounded">
                          <div>
                            <p className="font-medium">{purchase.invoiceNumber || purchase.poNumber || `PO-${purchase.id.slice(0, 8)}`}</p>
                            <p className="text-xs text-gray-500">
                              {purchase.supplierName} • {new Date(purchase.orderDate || purchase.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-red-600">${amountDue.toFixed(2)}</p>
                            {amountPaid > 0 && (
                              <p className="text-xs text-gray-500">Paid: ${amountPaid.toFixed(2)}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </AdminPanel>
            )}

            {unpaidOrders.length > 0 && (
              <AdminPanel>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                    Unpaid Orders (Accounts Receivable)
                  </CardTitle>
                  <CardDescription>{unpaidOrders.length} order(s) awaiting payment</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {unpaidOrders.map(order => {
                      const totalAmount = order.total || 0;
                      const amountPaid = order.amountPaid || 0;
                      const amountDue = totalAmount - amountPaid;
                      return (
                        <div key={order.id} className="flex justify-between items-center p-3 bg-orange-50 rounded">
                          <div>
                            <p className="font-medium">{order.invoiceNumber || `Order #${order.id.slice(0, 8)}`}</p>
                            <p className="text-xs text-gray-500">
                              {order.customerName} • {new Date(order.createdAt || '').toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-orange-600">${amountDue.toFixed(2)}</p>
                            {amountPaid > 0 && (
                              <p className="text-xs text-gray-500">Paid: ${amountPaid.toFixed(2)}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </AdminPanel>
            )}

            <AdminPanel>
              <CardHeader>
                <CardTitle>Expense Breakdown by Category</CardTitle>
                <CardDescription>Top 5 expense categories in selected period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topExpenseCategories.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No expenses in this period</p>
                  ) : (
                    topExpenseCategories.map(([category, amount]) => {
                      const percentage = (amount / totalExpenses) * 100;
                      return (
                        <div key={category}>
                          <div className="flex justify-between mb-2">
                            <span className="text-sm font-medium capitalize">{category}</span>
                            <span className="text-sm font-bold">${amount.toFixed(2)} ({percentage.toFixed(1)}%)</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </AdminPanel>

            <AdminPanel>
              <CardHeader>
                <CardTitle>Purchase Trends</CardTitle>
                <CardDescription>Monthly purchase totals</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(purchasesByMonth).length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No purchases in this period</p>
                  ) : (
                    Object.entries(purchasesByMonth)
                      .sort(([a], [b]) => b.localeCompare(a))
                      .map(([month, total]) => (
                        <div key={month} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                          <span className="font-medium">{new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                          <span className="font-bold text-green-600">${total.toFixed(2)}</span>
                        </div>
                      ))
                  )}
                </div>
              </CardContent>
            </AdminPanel>
          </TabsContent>

          <TabsContent value="inventory" className="space-y-6">
            <div className="flex justify-end mb-4">
              <Button variant="outline" size="sm" onClick={handleExportInventory}>
                <Download className="mr-2 h-4 w-4" />
                Export Inventory
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <AdminStatCard
                title="Total Items"
                value={materials.length}
                icon={Package}
                gradient="from-sky-500 to-blue-700"
                valueClassName="text-blue-600"
              />
              <AdminStatCard
                title="Inventory Value"
                value={`$${totalInventoryValue.toFixed(2)}`}
                icon={DollarSign}
                gradient="from-emerald-500 to-teal-700"
                valueClassName="text-green-600"
              />
              <AdminStatCard
                title="Low Stock"
                value={lowStockItems.length}
                icon={AlertTriangle}
                gradient="from-amber-400 to-yellow-600"
                valueClassName="text-yellow-600"
              />
              <AdminStatCard
                title="Out of Stock"
                value={outOfStockItems.length}
                icon={AlertTriangle}
                gradient="from-red-500 to-rose-700"
                valueClassName="text-red-600"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AdminPanel>
                <CardHeader>
                  <CardTitle>Low Stock Items</CardTitle>
                  <CardDescription>Items below minimum stock level</CardDescription>
                </CardHeader>
                <CardContent>
                  {lowStockItems.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">All items are well stocked</p>
                  ) : (
                    <div className="space-y-2">
                      {lowStockItems.slice(0, 10).map(item => (
                        <div key={item.id} className="flex justify-between items-center p-2 bg-yellow-50 rounded">
                          <div>
                            <p className="font-medium text-sm">{item.name}</p>
                            <p className="text-xs text-gray-500">Min: {item.minStockLevel} {item.unit}</p>
                          </div>
                          <span className="font-bold text-yellow-600">{item.stockQuantity} {item.unit}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </AdminPanel>

              <AdminPanel>
                <CardHeader>
                  <CardTitle>Top Value Items</CardTitle>
                  <CardDescription>Highest inventory value items</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {materials
                      .sort((a, b) => (b.stockQuantity * b.costPerUnit) - (a.stockQuantity * a.costPerUnit))
                      .slice(0, 10)
                      .map(item => {
                        const value = item.stockQuantity * item.costPerUnit;
                        return (
                          <div key={item.id} className="flex justify-between items-center p-2 bg-blue-50 rounded">
                            <div>
                              <p className="font-medium text-sm">{item.name}</p>
                              <p className="text-xs text-gray-500">{item.stockQuantity} {item.unit} × ${item.costPerUnit.toFixed(2)}</p>
                            </div>
                            <span className="font-bold text-blue-600">${value.toFixed(2)}</span>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </AdminPanel>
            </div>
          </TabsContent>

          <TabsContent value="production" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <AdminStatCard
                title="Total Batches"
                value={productionBatches.length}
                icon={BarChart3}
                gradient="from-violet-500 to-purple-700"
                valueClassName="text-purple-600"
              />
              <AdminStatCard
                title="Completed"
                value={completedBatches.length}
                icon={Package}
                gradient="from-emerald-500 to-teal-700"
                valueClassName="text-green-600"
              />
              <AdminStatCard
                title="Units Produced"
                value={totalProduction}
                icon={TrendingUp}
                gradient="from-sky-500 to-blue-700"
                valueClassName="text-blue-600"
              />
              <AdminStatCard
                title="Production Cost"
                value={`$${productionCost.toFixed(2)}`}
                icon={DollarSign}
                gradient="from-orange-400 to-orange-600"
                valueClassName="text-orange-600"
              />
            </div>

            <AdminPanel>
              <CardHeader>
                <CardTitle>Production Status</CardTitle>
                <CardDescription>Overview of all production batches</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-blue-50 rounded text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {productionBatches.filter(b => b.status === 'planned').length}
                    </div>
                    <div className="text-sm text-gray-600">Planned</div>
                  </div>
                  <div className="p-4 bg-yellow-50 rounded text-center">
                    <div className="text-2xl font-bold text-yellow-600">
                      {productionBatches.filter(b => b.status === 'in_progress').length}
                    </div>
                    <div className="text-sm text-gray-600">In Progress</div>
                  </div>
                  <div className="p-4 bg-green-50 rounded text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {productionBatches.filter(b => b.status === 'completed').length}
                    </div>
                    <div className="text-sm text-gray-600">Completed</div>
                  </div>
                  <div className="p-4 bg-red-50 rounded text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {productionBatches.filter(b => b.status === 'cancelled').length}
                    </div>
                    <div className="text-sm text-gray-600">Cancelled</div>
                  </div>
                </div>
              </CardContent>
            </AdminPanel>

            <AdminPanel>
              <CardHeader>
                <CardTitle>Customer Metrics</CardTitle>
                <CardDescription>Customer relationship overview</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-gray-50 rounded">
                    <p className="text-sm text-gray-600 mb-1">Total Customers</p>
                    <p className="text-2xl font-bold">{customers.length}</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded">
                    <p className="text-sm text-gray-600 mb-1">Active</p>
                    <p className="text-2xl font-bold text-green-600">{activeCustomers}</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded">
                    <p className="text-sm text-gray-600 mb-1">Total Loyalty Points</p>
                    <p className="text-2xl font-bold text-purple-600">{totalLoyaltyPoints.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </AdminPanel>
          </TabsContent>
        </Tabs>

    </AdminPageShell>
  );
};

export default AdminReports;
