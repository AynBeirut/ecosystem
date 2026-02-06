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

// Helper to clean non-ASCII characters for PDF export
const cleanTextForPDF = (text: string): string => {
  return text.replace(/[^\x00-\x7F]/g, '?');
};

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
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

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
      
      // Fetch all orders
      const ordersQuery = query(
        collection(db, 'orders'),
        where('storeId', '==', user.storeId)
      );
      const ordersSnapshot = await getDocs(ordersQuery);
      
      // Fetch finished goods for cost data
      const finishedGoodsQuery = query(
        collection(db, 'finishedGoodsInventory'),
        where('storeId', '==', user.storeId)
      );
      const finishedGoodsSnapshot = await getDocs(finishedGoodsQuery);
      const finishedGoodsCosts: Record<string, number> = {};
      
      finishedGoodsSnapshot.forEach(doc => {
        const fg = doc.data();
        if (fg.productId) {
          finishedGoodsCosts[fg.productId] = fg.costPrice || 0;
        }
        if (fg.composedProductId) {
          finishedGoodsCosts[fg.composedProductId] = fg.costPrice || 0;
        }
      });
      
      // Fetch products for names and categories
      const productsQuery = query(
        collection(db, 'products'),
        where('storeId', '==', user.storeId)
      );
      const productsSnapshot = await getDocs(productsQuery);
      const productsData: Record<string, { name: string; category: string }> = {};
      
      productsSnapshot.forEach(doc => {
        const product = doc.data();
        productsData[doc.id] = {
          name: product.name || 'Unknown Product',
          category: product.category || 'Other'
        };
      });
      
      // Calculate revenue per product
      const productStats: Record<string, {
        quantitySold: number;
        revenue: number;
        cost: number;
        name: string;
        category: string;
      }> = {};
      
      ordersSnapshot.forEach(doc => {
        const order = doc.data();
        
        // Skip cancelled orders
        if (order.status === 'cancelled') return;
        
        const orderSubtotal = order.subtotal || 0;
        const orderTotal = order.total || 0;
        // Calculate discount from the difference (discount field doesn't exist in orders)
        const orderDiscount = Math.max(0, orderSubtotal - orderTotal);
        
        // Calculate discount percentage for this order
        const discountPercentage = orderSubtotal > 0 ? orderDiscount / orderSubtotal : 0;
        
        const items = order.items || [];
        items.forEach((item: { productId: string; quantity: number; price: number }) => {
          const productId = item.productId;
          const quantity = item.quantity || 0;
          const price = item.price || 0;
          const itemSubtotal = quantity * price;
          // Apply the order's discount percentage to this item
          const itemDiscount = itemSubtotal * discountPercentage;
          const itemRevenue = itemSubtotal - itemDiscount;
          
          // Get cost from finished goods
          const unitCost = finishedGoodsCosts[productId] || 0;
          const itemCost = quantity * unitCost;
          
          if (!productStats[productId]) {
            productStats[productId] = {
              quantitySold: 0,
              revenue: 0,
              cost: 0,
              name: productsData[productId]?.name || 'Unknown Product',
              category: productsData[productId]?.category || 'Other'
            };
          }
          
          productStats[productId].quantitySold += quantity;
          productStats[productId].revenue += itemRevenue;
          productStats[productId].cost += itemCost;
        });
      });
      
      // Convert to array and calculate profit
      const revenueList: ProductRevenue[] = Object.entries(productStats).map(([productId, stats]) => {
        const profit = stats.revenue - stats.cost;
        const profitMargin = stats.revenue > 0 ? (profit / stats.revenue) * 100 : 0;
        
        return {
          productId,
          productName: stats.name,
          category: stats.category,
          quantitySold: stats.quantitySold,
          revenue: stats.revenue,
          cost: stats.cost,
          profit,
          profitMargin
        };
      });
      
      // Sort by revenue descending
      revenueList.sort((a, b) => b.revenue - a.revenue);
      
      setProductRevenues(revenueList);
    } catch (error) {
      console.error('Error fetching revenue data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredRevenues = () => {
    return productRevenues.filter(item => {
      const matchesCategory = !filterCategory || item.category === filterCategory;
      return matchesCategory;
    });
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
    
    // Add totals row
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
          </div>
        </div>

        {/* Summary Cards */}
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

        {/* Filters and Export */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 items-end">
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
              
              {filterCategory && (
                <button
                  onClick={() => setFilterCategory('')}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
                >
                  Clear Filter
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

        {/* Revenue Table */}
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
