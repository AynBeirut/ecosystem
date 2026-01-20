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
import MobileHeader from '@/components/MobileHeader';
import BackButton from '@/components/BackButton';
import { useIsMobile } from '@/hooks/use-mobile';
import { Expense } from '@/types/financial';
import { PurchaseOrder } from '@/types/purchase';
import { RawMaterial } from '@/types/material';
import { Customer } from '@/types/customer';
import { SalaryPayment } from '@/types/staff';
import { ProductionBatch } from '@/types/production';
import { exportToCSV, exportToPDF } from '@/lib/exportUtils';

const AdminReports: React.FC = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [reportType, setReportType] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
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

      const [expensesData, purchasesData, materialsData, customersData, salariesData, batchesData] = await Promise.all([
        fetchCollection('expenses'),
        fetchCollection('purchaseOrders'),
        fetchCollection('rawMaterials'),
        fetchCollection('customers'),
        fetchCollection('salaryPayments'),
        fetchCollection('productionBatches'),
      ]);

      setExpenses(expensesData as Expense[]);
      setPurchases(purchasesData as PurchaseOrder[]);
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

  const totalPurchases = purchases
    .filter(p => p.status === 'received' && filterByDateRange(p.orderDate))
    .reduce((sum, p) => sum + p.totalCost, 0);

  const totalSalaries = salaryPayments
    .filter(s => filterByDateRange(s.paymentDate))
    .reduce((sum, s) => sum + s.totalAmount, 0);

  const totalCosts = totalExpenses + totalPurchases + totalSalaries;

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

  const StatCard = ({ title, value, icon: Icon, trend, color = 'text-gray-600' }: {
    title: string;
    value: string | number;
    icon: any;
    trend?: { value: number; isPositive: boolean };
    color?: string;
  }) => (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">{title}</p>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            {trend && (
              <div className={`flex items-center mt-2 text-sm ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {trend.isPositive ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                {Math.abs(trend.value)}%
              </div>
            )}
          </div>
          <Icon className={`h-8 w-8 ${color} opacity-50`} />
        </div>
      </CardContent>
    </Card>
  );

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
    const filteredPurchases = purchases.filter(p => filterByDateRange(p.orderDate));
    const exportData = filteredPurchases.map(p => ({
      Date: new Date(p.orderDate).toLocaleDateString(),
      PONumber: p.poNumber || p.id,
      Supplier: p.supplierName || 'N/A',
      Status: p.status,
      TotalCost: p.totalCost.toFixed(2),
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
      { Category: 'Total Salaries', Amount: totalSalaries.toFixed(2) },
      { Category: 'Production Cost', Amount: productionCost.toFixed(2) },
      { Category: 'Total Costs', Amount: totalCosts.toFixed(2) },
      { Category: 'Inventory Value', Amount: totalInventoryValue.toFixed(2) },
    ];
    exportToCSV(exportData, 'financial_summary');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {isMobile ? <MobileHeader title="Reports & Analytics" /> : null}
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {!isMobile && <BackButton />}
            <h1 className="text-2xl font-bold">Reports & Analytics</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportFinancialSummary}>
              <Download className="mr-2 h-4 w-4" />
              Export Summary
            </Button>
          </div>
        </div>

        <Card className="mb-6">
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
        </Card>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="financial">Financial</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="production">Production</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard
                title="Total Costs"
                value={`$${totalCosts.toFixed(2)}`}
                icon={DollarSign}
                color="text-red-600"
              />
              <StatCard
                title="Inventory Value"
                value={`$${totalInventoryValue.toFixed(2)}`}
                icon={Package}
                color="text-blue-600"
              />
              <StatCard
                title="Active Customers"
                value={activeCustomers}
                icon={Users}
                color="text-green-600"
              />
              <StatCard
                title="Production Units"
                value={totalProduction}
                icon={BarChart3}
                color="text-purple-600"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Quick Insights</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Expenses</span>
                    <span className="font-bold">${totalExpenses.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Purchases</span>
                    <span className="font-bold">${totalPurchases.toFixed(2)}</span>
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
              </Card>

              <Card>
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
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
                    <span className="text-sm">Pending Orders</span>
                    <span className="font-bold text-blue-600">
                      {purchases.filter(p => p.status === 'pending').length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-purple-50 rounded">
                    <span className="text-sm">Planned Production</span>
                    <span className="font-bold text-purple-600">
                      {productionBatches.filter(b => b.status === 'planned').length}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
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
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard
                title="Total Expenses"
                value={`$${totalExpenses.toFixed(2)}`}
                icon={DollarSign}
                color="text-red-600"
              />
              <StatCard
                title="Total Purchases"
                value={`$${totalPurchases.toFixed(2)}`}
                icon={ShoppingCart}
                color="text-orange-600"
              />
              <StatCard
                title="Salary Payments"
                value={`$${totalSalaries.toFixed(2)}`}
                icon={Users}
                color="text-purple-600"
              />
            </div>

            <Card>
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
            </Card>

            <Card>
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
            </Card>
          </TabsContent>

          <TabsContent value="inventory" className="space-y-6">
            <div className="flex justify-end mb-4">
              <Button variant="outline" size="sm" onClick={handleExportInventory}>
                <Download className="mr-2 h-4 w-4" />
                Export Inventory
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard
                title="Total Items"
                value={materials.length}
                icon={Package}
                color="text-blue-600"
              />
              <StatCard
                title="Inventory Value"
                value={`$${totalInventoryValue.toFixed(2)}`}
                icon={DollarSign}
                color="text-green-600"
              />
              <StatCard
                title="Low Stock"
                value={lowStockItems.length}
                icon={AlertTriangle}
                color="text-yellow-600"
              />
              <StatCard
                title="Out of Stock"
                value={outOfStockItems.length}
                icon={AlertTriangle}
                color="text-red-600"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
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
              </Card>

              <Card>
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
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="production" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard
                title="Total Batches"
                value={productionBatches.length}
                icon={BarChart3}
                color="text-purple-600"
              />
              <StatCard
                title="Completed"
                value={completedBatches.length}
                icon={Package}
                color="text-green-600"
              />
              <StatCard
                title="Units Produced"
                value={totalProduction}
                icon={TrendingUp}
                color="text-blue-600"
              />
              <StatCard
                title="Production Cost"
                value={`$${productionCost.toFixed(2)}`}
                icon={DollarSign}
                color="text-orange-600"
              />
            </div>

            <Card>
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
            </Card>

            <Card>
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
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminReports;
