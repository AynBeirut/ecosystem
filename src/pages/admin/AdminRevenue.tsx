import React, { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import MobileHeader from '@/components/MobileHeader';
import BackButton from '@/components/BackButton';
import { useIsMobile } from '@/hooks/use-mobile';
import { isCountedSaleStatus, isDateInRange, resolveOrderItemProductKey } from '@/lib/salesRules';

const cleanTextForPDF = (text: string): string => text.replace(/[^\u0020-\u007E]/g, '?');

interface ProductRevenue {
  productId: string;
  productName: string;
  category: string;
  quantitySold: number;
  revenue: number;
  cost: number;
  profit: number;
  profitMargin: number;
}

const AdminRevenue: React.FC = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [productRevenues, setProductRevenues] = useState<ProductRevenue[]>([]);
  const [quarantinedOrdersCount, setQuarantinedOrdersCount] = useState(0);
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  const toFiniteNumber = (value: unknown, fallback = 0): number => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  useEffect(() => {
    if (user?.storeId) {
      fetchRevenueData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.storeId]);

  const fetchRevenueData = async () => {
    if (!user?.storeId) return;

    setLoading(true);
    try {
      const db = getFirestore();

      const finishedGoodsQuery = query(
        collection(db, 'finishedGoodsInventory'),
        where('storeId', '==', user.storeId)
      );
      const finishedGoodsSnapshot = await getDocs(finishedGoodsQuery);
      const finishedGoodsData: Record<string, {
        quantitySold: number;
        costPrice: number;
        productName: string;
      }> = {};

      finishedGoodsSnapshot.forEach(doc => {
        const fg = doc.data();
        const productId = fg.productId || fg.composedProductId;
        if (productId) {
          finishedGoodsData[productId] = {
            quantitySold: fg.quantitySold || 0,
            costPrice: fg.costPrice || 0,
            productName: fg.productName || 'Unknown'
          };
        }
      });

      const ordersQuery = query(
        collection(db, 'orders'),
        where('storeId', '==', user.storeId)
      );
      const ordersSnapshot = await getDocs(ordersQuery);

      const productsQuery = query(
        collection(db, 'products'),
        where('storeId', '==', user.storeId)
      );
      const productsSnapshot = await getDocs(productsQuery);
      const productsData: Record<string, { name: string; category: string; costPrice: number; serviceCost: number }> = {};
      productsSnapshot.forEach(doc => {
        const product = doc.data();
        productsData[doc.id] = {
          name: product.name || 'Unknown Product',
          category: product.category || 'Other',
          costPrice: toFiniteNumber(product.costPrice, 0),
          serviceCost: toFiniteNumber(product.serviceCost, 0)
        };
      });

      const productRevenueMap: Record<string, number> = {};
      const orderQuantityMap: Record<string, number> = {};
      let quarantinedOrders = 0;

      ordersSnapshot.forEach(doc => {
        const order = doc.data();
        if (!isCountedSaleStatus(order.status)) return;
        if (!isDateInRange(order.createdAt || order.timestamp, filterStartDate, filterEndDate)) return;

        const orderTotal = toFiniteNumber(order.total, Number.NaN);
        if (!Number.isFinite(orderTotal) || orderTotal < 0) {
          quarantinedOrders += 1;
          return;
        }

        const items = Array.isArray(order.items) ? order.items : [];
        const itemBaseSubtotals = items.map((item: { quantity: number; price: number }) => {
          const quantity = Math.max(0, toFiniteNumber(item.quantity, 0));
          const price = Math.max(0, toFiniteNumber(item.price, 0));
          return quantity * price;
        });
        const computedSubtotal = itemBaseSubtotals.reduce((sum: number, value: number) => sum + value, 0);
        const fallbackSubtotal = Math.max(0, toFiniteNumber(order.subtotal ?? order.total, 0));
        const baseSubtotal = computedSubtotal > 0 ? computedSubtotal : fallbackSubtotal;

        if (!Number.isFinite(baseSubtotal) || baseSubtotal < 0) {
          quarantinedOrders += 1;
          return;
        }

        let allocatedSoFar = 0;
        items.forEach((item: { productId: string; composedProductId?: string; id?: string; quantity: number; price: number }, index: number) => {
          const productId = resolveOrderItemProductKey(item);
          if (!productId) return;

          const quantity = Math.max(0, toFiniteNumber(item.quantity, 0));
          const itemSubtotal = Math.max(0, toFiniteNumber(itemBaseSubtotals[index], 0));
          let itemRevenue = 0;

          if (baseSubtotal > 0) {
            itemRevenue = (itemSubtotal / baseSubtotal) * orderTotal;
          } else if (items.length > 0) {
            itemRevenue = orderTotal / items.length;
          }

          if (index === items.length - 1) {
            itemRevenue = orderTotal - allocatedSoFar;
          } else {
            allocatedSoFar += itemRevenue;
          }

          if (!Number.isFinite(itemRevenue)) {
            quarantinedOrders += 1;
            return;
          }

          productRevenueMap[productId] = (productRevenueMap[productId] || 0) + itemRevenue;
          orderQuantityMap[productId] = (orderQuantityMap[productId] || 0) + quantity;
        });
      });

      const allProductIds = new Set<string>([
        ...Object.keys(productRevenueMap),
        ...Object.keys(orderQuantityMap)
      ]);

      const revenueList: ProductRevenue[] = Array.from(allProductIds).map((productId) => {
        const fgData = finishedGoodsData[productId];
        const revenue = toFiniteNumber(productRevenueMap[productId], 0);
        const quantitySold = Math.max(0, toFiniteNumber(orderQuantityMap[productId], 0));
        const productCost = toFiniteNumber(productsData[productId]?.costPrice ?? 0, 0);
        const serviceCost = toFiniteNumber(productsData[productId]?.serviceCost ?? 0, 0);
        const inventoryCost = toFiniteNumber(fgData?.costPrice ?? 0, 0);
        const unitCost = Math.max(0, inventoryCost || productCost || serviceCost);
        const totalCost = quantitySold * unitCost;
        const profit = revenue - totalCost;
        const rawMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
        const profitMargin = Number.isFinite(rawMargin) ? rawMargin : 0;

        return {
          productId,
          productName: productsData[productId]?.name || fgData?.productName || 'Unknown Product',
          category: productsData[productId]?.category || 'Other',
          quantitySold,
          revenue,
          cost: totalCost,
          profit,
          profitMargin
        };
      });

      revenueList.sort((a, b) => b.revenue - a.revenue);
      setProductRevenues(revenueList);
      setQuarantinedOrdersCount(quarantinedOrders);
    } catch (error) {
      console.error('Error fetching revenue data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredRevenues = () => {
    return productRevenues.filter(item => !filterCategory || item.category === filterCategory);
  };

  const exportToExcel = () => {
    const filtered = getFilteredRevenues();
    const data = filtered.map(item => ({
      'Product Name': item.productName,
      'Category': item.category,
      'Quantity Sold': item.quantitySold,
      'Revenue': item.revenue.toFixed(2),
      'Cost': item.cost.toFixed(2),
      'Profit': item.profit.toFixed(2),
      'Profit Margin %': item.profitMargin.toFixed(2)
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Revenue Report');
    XLSX.writeFile(wb, `revenue_report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToPDF = () => {
    const filtered = getFilteredRevenues();
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('REVENUE & PROFIT REPORT', 105, 15, { align: 'center' });

    doc.setFontSize(8);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString()}`, 105, 22, { align: 'center' });

    const tableData = filtered.map(item => [
      cleanTextForPDF(item.productName),
      cleanTextForPDF(item.category),
      item.quantitySold.toString(),
      `$${item.revenue.toFixed(2)}`,
      `$${item.cost.toFixed(2)}`,
      `$${item.profit.toFixed(2)}`,
      `${item.profitMargin.toFixed(1)}%`
    ]);

    const totalRevenue = filtered.reduce((sum, item) => sum + item.revenue, 0);
    const totalCost = filtered.reduce((sum, item) => sum + item.cost, 0);
    const totalProfit = filtered.reduce((sum, item) => sum + item.profit, 0);
    const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    tableData.push([
      'TOTAL',
      '',
      '',
      `$${totalRevenue.toFixed(2)}`,
      `$${totalCost.toFixed(2)}`,
      `$${totalProfit.toFixed(2)}`,
      `${avgMargin.toFixed(1)}%`
    ]);

    autoTable(doc, {
      startY: 28,
      head: [['Product', 'Category', 'Qty Sold', 'Revenue', 'Cost', 'Profit', 'Margin %']],
      body: tableData,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [66, 66, 66], textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [240, 240, 240], fontStyle: 'bold' }
    });

    doc.save(`revenue_report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const filtered = getFilteredRevenues();
  const totalRevenue = filtered.reduce((sum, item) => sum + item.revenue, 0);
  const totalCost = filtered.reduce((sum, item) => sum + item.cost, 0);
  const totalProfit = filtered.reduce((sum, item) => sum + item.profit, 0);
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const categories = Array.from(new Set(productRevenues.map(p => p.category))).sort();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg">Loading revenue data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {isMobile && <MobileHeader title="Revenue & Profit" showBackButton={true} />}
      <div className="container mx-auto p-4 md:p-6">
        <div className="mb-4 md:mb-6">
          {!isMobile && <BackButton to="/admin/dashboard" label="Back to Dashboard" />}
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Revenue & Profit Report</h1>
            <p className="text-gray-600 text-sm md:text-base mt-1">Product-level profitability analysis</p>
            {quarantinedOrdersCount > 0 && (
              <p className="text-orange-600 text-sm mt-1">
                Quarantined invalid orders: {quarantinedOrdersCount}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Revenue</CardDescription>
              <CardTitle className="text-2xl">${totalRevenue.toFixed(2)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Cost</CardDescription>
              <CardTitle className="text-2xl">${totalCost.toFixed(2)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Profit</CardDescription>
              <CardTitle className={`text-2xl ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${totalProfit.toFixed(2)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Avg Profit Margin</CardDescription>
              <CardTitle className={`text-2xl ${avgMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {avgMargin.toFixed(1)}%
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[150px]">
                <label className="block text-sm font-medium mb-2">From Date</label>
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div className="flex-1 min-w-[150px]">
                <label className="block text-sm font-medium mb-2">To Date</label>
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium mb-2">Category</label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={fetchRevenueData}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
              >
                Apply Filters
              </button>

              {(filterCategory || filterStartDate || filterEndDate) && (
                <button
                  onClick={() => {
                    setFilterCategory('');
                    setFilterStartDate('');
                    setFilterEndDate('');
                    setTimeout(() => fetchRevenueData(), 100);
                  }}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
                >
                  Clear All
                </button>
              )}

              <div className="flex gap-2 ml-auto">
                <button
                  onClick={exportToExcel}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  <Download size={16} />
                  {!isMobile && 'Excel'}
                </button>
                <button
                  onClick={exportToPDF}
                  className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                >
                  <FileDown size={16} />
                  {!isMobile && 'PDF'}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Product Revenue & Profit</CardTitle>
            <CardDescription>Detailed profit analysis for each product</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-4 font-medium text-gray-600">Product Name</th>
                    <th className="text-left p-4 font-medium text-gray-600">Category</th>
                    <th className="text-right p-4 font-medium text-gray-600">Qty Sold</th>
                    <th className="text-right p-4 font-medium text-gray-600">Revenue</th>
                    <th className="text-right p-4 font-medium text-gray-600">Cost</th>
                    <th className="text-right p-4 font-medium text-gray-600">Profit</th>
                    <th className="text-right p-4 font-medium text-gray-600">Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.productId} className="border-b hover:bg-gray-50">
                      <td className="p-4 font-medium">{item.productName}</td>
                      <td className="p-4 text-gray-600">{item.category}</td>
                      <td className="p-4 text-right">{item.quantitySold}</td>
                      <td className="p-4 text-right font-medium">${item.revenue.toFixed(2)}</td>
                      <td className="p-4 text-right text-gray-600">${item.cost.toFixed(2)}</td>
                      <td className={`p-4 text-right font-semibold ${item.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${item.profit.toFixed(2)}
                      </td>
                      <td className={`p-4 text-right font-semibold ${item.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {item.profitMargin.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-100 font-bold">
                  <tr>
                    <td className="p-4" colSpan={3}>TOTAL</td>
                    <td className="p-4 text-right text-blue-600">${totalRevenue.toFixed(2)}</td>
                    <td className="p-4 text-right">${totalCost.toFixed(2)}</td>
                    <td className={`p-4 text-right ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${totalProfit.toFixed(2)}
                    </td>
                    <td className={`p-4 text-right ${avgMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {avgMargin.toFixed(1)}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminRevenue;
