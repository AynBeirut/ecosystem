import React, { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, LineChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Users, ShoppingCart, DollarSign, Package, Eye, Calendar } from 'lucide-react';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminStatCard from '@/components/admin/AdminStatCard';
import AdminPanel from '@/components/admin/AdminPanel';

const AdminAnalytics: React.FC = () => {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState('7d');
  const [loading, setLoading] = useState(true);
  
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [totalProfit, setTotalProfit] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [activeProducts, setActiveProducts] = useState(0);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);

  useEffect(() => {
    if (user?.storeId) {
      fetchAnalyticsData();
    } else {
      setLoading(false);
    }
  }, [user?.storeId, timeRange]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const db = getFirestore();
      
      // Calculate date range
      const now = new Date();
      const daysBack = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
      const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
      
      // Fetch orders
      const ordersQuery = query(
        collection(db, 'orders'),
        where('storeId', '==', user?.storeId)
      );
      const ordersSnapshot = await getDocs(ordersQuery);
      
      let revenue = 0;
      let totalCostOfGoodsSold = 0;
      let orderCount = 0;
      const dailySales: Record<string, { sales: number; orders: number; cost: number; profit: number }> = {};
      const categorySales: Record<string, number> = {};
      const productSales: Record<string, { name: string; sales: number; revenue: number; cost: number; profit: number }> = {};
      
      // Fetch finished goods for cost data
      const finishedGoodsQuery = query(
        collection(db, 'finishedGoodsInventory'),
        where('storeId', '==', user?.storeId)
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
      
      ordersSnapshot.forEach(doc => {
        const order = doc.data();
        const orderDate = order.createdAt ? new Date(order.createdAt) : new Date();
        
        // Only include orders within date range
        if (orderDate >= startDate) {
          const total = order.total || 0;
          revenue += total;
          orderCount++;
          
          // Daily sales
          const dayKey = orderDate.toLocaleDateString('en-US', { weekday: 'short' });
          if (!dailySales[dayKey]) {
            dailySales[dayKey] = { sales: 0, orders: 0, cost: 0, profit: 0 };
          }
          dailySales[dayKey].sales += total;
          dailySales[dayKey].orders++;
          
          // Process items for product and category sales
          const items = order.items || [];
          const orderSubtotal = order.subtotal || order.total || 0;
          const orderDiscount = order.discountAmount || 0;
          
          items.forEach((item: any) => {
            const productId = item.productId;
            const quantity = item.quantity || 0;
            const price = item.price || 0;
            const itemSubtotal = quantity * price;
            
            // Apply proportional discount to get actual item revenue
            const itemDiscount = orderSubtotal > 0 ? (itemSubtotal / orderSubtotal) * orderDiscount : 0;
            const itemRevenue = itemSubtotal - itemDiscount;
            
            // Get cost from finished goods (for composed products) or use a default
            const unitCost = finishedGoodsCosts[productId] || 0;
            const itemCost = quantity * unitCost;
            const itemProfit = itemRevenue - itemCost;
            
            totalCostOfGoodsSold += itemCost;
            dailySales[dayKey].cost += itemCost;
            dailySales[dayKey].profit += itemProfit;
            
            if (!productSales[productId]) {
              productSales[productId] = { name: 'Product', sales: 0, revenue: 0, cost: 0, profit: 0 };
            }
            productSales[productId].sales += quantity;
            productSales[productId].revenue += itemRevenue;
            productSales[productId].cost += itemCost;
            productSales[productId].profit += itemProfit;
          });
        }
      });
      
      // Fetch products for names and categories
      const productsQuery = query(
        collection(db, 'products'),
        where('storeId', '==', user?.storeId)
      );
      const productsSnapshot = await getDocs(productsQuery);
      
      let activeCount = 0;
      productsSnapshot.forEach(doc => {
        const product = doc.data();
        if (product.inStock !== false) activeCount++;
        
        // Update product names and category sales
        if (productSales[doc.id]) {
          productSales[doc.id].name = product.name || 'Unknown Product';
          
          const category = product.category || 'Other';
          if (!categorySales[category]) {
            categorySales[category] = 0;
          }
          categorySales[category] += productSales[doc.id].revenue;
        }
      });
      
      // Format daily sales for chart (last 7 days)
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dayName = days[date.getDay()];
        last7Days.push({
          name: dayName,
          sales: dailySales[dayName]?.sales || 0,
          orders: dailySales[dayName]?.orders || 0,
          cost: dailySales[dayName]?.cost || 0,
          profit: dailySales[dayName]?.profit || 0
        });
      }
      
      // Format category data
      const totalCategoryRevenue = Object.values(categorySales).reduce((sum, val) => sum + val, 0);
      const formattedCategories = Object.entries(categorySales)
        .map(([name, sales]) => ({
          name,
          value: totalCategoryRevenue > 0 ? Math.round((sales / totalCategoryRevenue) * 100) : 0,
          sales: Math.round(sales)
        }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 5);
      
      // Format top products with profit data
      const formattedProducts = Object.values(productSales)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)
        .map(p => ({
          name: p.name,
          sales: p.sales,
          revenue: Math.round(p.revenue),
          cost: Math.round(p.cost),
          profit: Math.round(p.profit),
          margin: p.revenue > 0 ? Math.round((p.profit / p.revenue) * 100) : 0
        }));
      
      const grossProfit = revenue - totalCostOfGoodsSold;
      
      setTotalRevenue(revenue);
      setTotalCost(totalCostOfGoodsSold);
      setTotalProfit(grossProfit);
      setTotalOrders(orderCount);
      setActiveProducts(activeCount);
      setSalesData(last7Days);
      setCategoryData(formattedCategories);
      setTopProducts(formattedProducts);
      
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#f59e0b', '#8b5cf6'];

  const statGradients = [
    'from-slate-600 to-slate-800',
    'from-violet-500 to-purple-700',
    'from-emerald-500 to-teal-700',
    'from-orange-400 to-orange-600',
    'from-sky-500 to-blue-700',
    'from-teal-500 to-teal-700',
  ];

  const stats = [
    {
      title: 'Total Revenue',
      value: `$${totalRevenue.toFixed(2)}`,
      change: timeRange === '7d' ? 'Last 7 days' : timeRange === '30d' ? 'Last 30 days' : timeRange === '90d' ? 'Last 90 days' : 'Last year',
      isPositive: true,
      icon: DollarSign
    },
    {
      title: 'Total Cost',
      value: `$${totalCost.toFixed(2)}`,
      change: 'Cost of goods sold',
      isPositive: false,
      icon: Package
    },
    {
      title: 'Gross Profit',
      value: `$${totalProfit.toFixed(2)}`,
      change: totalRevenue > 0 ? `${((totalProfit / totalRevenue) * 100).toFixed(1)}% margin` : '0% margin',
      isPositive: totalProfit >= 0,
      icon: TrendingUp
    },
    {
      title: 'Total Orders',
      value: totalOrders.toString(),
      change: timeRange === '7d' ? 'Last 7 days' : timeRange === '30d' ? 'Last 30 days' : timeRange === '90d' ? 'Last 90 days' : 'Last year',
      isPositive: true,
      icon: ShoppingCart
    },
    {
      title: 'Average Order Value',
      value: totalOrders > 0 ? `$${(totalRevenue / totalOrders).toFixed(2)}` : '$0.00',
      change: 'Per order',
      isPositive: true,
      icon: DollarSign
    },
    {
      title: 'Active Products',
      value: activeProducts.toString(),
      change: 'In stock',
      isPositive: true,
      icon: Package
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="text-lg">Loading analytics...</div>
        </div>
      </div>
    );
  }

  return (
    <AdminPageShell
      title="Analytics"
      description="Track your store performance and insights"
      eyebrow="Business Tools"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        {stats.slice(0, 6).map((stat, index) => (
          <AdminStatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            gradient={statGradients[index]}
            subtitle={stat.change}
            valueClassName={stat.title === 'Gross Profit' && !stat.isPositive ? 'text-red-600' : undefined}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Category Performance */}
          <AdminPanel>
            <CardHeader>
              <CardTitle>Sales by Category</CardTitle>
              <CardDescription>Revenue distribution across product categories</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                
                <div className="space-y-3">
                  {categoryData.map((category, index) => (
                    <div key={category.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full category-color"
                          data-color={COLORS[index % COLORS.length]}
                        />
                        <span className="text-sm font-medium">{category.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">${category.sales}</div>
                        <div className="text-xs text-muted-foreground">{category.value}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </AdminPanel>

          {/* Top Products */}
          <AdminPanel>
            <CardHeader>
              <CardTitle>Top Products</CardTitle>
              <CardDescription>Best performing products with profit margins</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topProducts.map((product, index) => (
                  <div key={product.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium">{product.name}</div>
                        <div className="text-sm text-muted-foreground">{product.sales} sold</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">${product.revenue}</div>
                      <div className="text-xs text-muted-foreground">
                        Cost: ${product.cost} • Profit: ${product.profit} ({product.margin}%)
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </AdminPanel>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <AdminPanel>
            <CardHeader>
              <CardTitle className="text-lg">Total Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{categoryData.length}</div>
              <p className="text-sm text-muted-foreground mt-1">
                Product categories
              </p>
            </CardContent>
          </AdminPanel>
          
          <AdminPanel>
            <CardHeader>
              <CardTitle className="text-lg">Best Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{categoryData[0]?.name || 'N/A'}</div>
              <p className="text-sm text-muted-foreground mt-1">
                {categoryData[0] ? `$${categoryData[0].sales} revenue` : 'No sales yet'}
              </p>
            </CardContent>
          </AdminPanel>
          
          <AdminPanel>
            <CardHeader>
              <CardTitle className="text-lg">Top Product Sales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{topProducts[0]?.sales || 0}</div>
              <p className="text-sm text-muted-foreground mt-1">
                {topProducts[0]?.name || 'No products sold'}
              </p>
            </CardContent>
          </AdminPanel>
        </div>
    </AdminPageShell>
  );
};

export default AdminAnalytics;