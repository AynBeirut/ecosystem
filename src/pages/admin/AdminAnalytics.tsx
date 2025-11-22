import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, LineChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Users, ShoppingCart, DollarSign, Package, Eye, Calendar } from 'lucide-react';
import MobileHeader from '@/components/MobileHeader';
import BackButton from '@/components/BackButton';
import { useIsMobile } from '@/hooks/use-mobile';

const AdminAnalytics: React.FC = () => {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = useState('7d');

  // Mock data for charts
  const salesData = [
    { name: 'Mon', sales: 4000, orders: 24 },
    { name: 'Tue', sales: 3000, orders: 18 },
    { name: 'Wed', sales: 2000, orders: 12 },
    { name: 'Thu', sales: 2780, orders: 16 },
    { name: 'Fri', sales: 1890, orders: 11 },
    { name: 'Sat', sales: 2390, orders: 14 },
    { name: 'Sun', sales: 3490, orders: 20 }
  ];

  const categoryData = [
    { name: 'Electronics', value: 45, sales: 4500 },
    { name: 'Outdoor Gear', value: 30, sales: 3000 },
    { name: 'Home & Decor', value: 25, sales: 2500 }
  ];

  const topProducts = [
    { name: 'Wireless Earbuds', sales: 156, revenue: 1248 },
    { name: 'Smart Watch', sales: 89, revenue: 1780 },
    { name: 'Portable Charger', sales: 234, revenue: 1170 },
    { name: 'Hiking Backpack', sales: 67, revenue: 536 },
    { name: 'Handmade Candle', sales: 145, revenue: 362 }
  ];

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))'];

  const stats = [
    {
      title: 'Total Revenue',
      value: '$12,543',
      change: '+12.5%',
      isPositive: true,
      icon: DollarSign
    },
    {
      title: 'Total Orders',
      value: '1,247',
      change: '+8.2%',
      isPositive: true,
      icon: ShoppingCart
    },
    {
      title: 'Store Views',
      value: '8,492',
      change: '+15.3%',
      isPositive: true,
      icon: Eye
    },
    {
      title: 'Active Products',
      value: '24',
      change: '+2',
      isPositive: true,
      icon: Package
    }
  ];

  return (
    <div className="min-h-screen bg-background">
  {isMobile && <MobileHeader title="Analytics" />}
      
      <div className="p-4 md:p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <BarChart className="h-6 w-6" />
                Analytics
              </h1>
              <p className="text-muted-foreground">Track your store performance and insights</p>
            </div>
            
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 3 months</SelectItem>
                  <SelectItem value="1y">Last year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <Card key={index}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                  <IconComponent className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className={`text-xs flex items-center ${stat.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    {stat.isPositive ? (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-1" />
                    )}
                    {stat.change} from last period
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Sales Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Sales Overview</CardTitle>
              <CardDescription>Daily sales and order trends</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={salesData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="sales" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Orders Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Order Volume</CardTitle>
              <CardDescription>Number of orders per day</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={salesData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Category Performance */}
          <Card>
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
          </Card>

          {/* Top Products */}
          <Card>
            <CardHeader>
              <CardTitle>Top Products</CardTitle>
              <CardDescription>Best performing products by sales volume</CardDescription>
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
                      <div className="text-sm text-muted-foreground">Revenue</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Conversion Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">3.2%</div>
              <p className="text-sm text-muted-foreground flex items-center mt-1">
                <TrendingUp className="h-3 w-3 mr-1 text-green-600" />
                +0.5% from last period
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Average Order Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">$84.32</div>
              <p className="text-sm text-muted-foreground flex items-center mt-1">
                <TrendingUp className="h-3 w-3 mr-1 text-green-600" />
                +$12.50 from last period
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Return Customers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">68%</div>
              <p className="text-sm text-muted-foreground flex items-center mt-1">
                <TrendingUp className="h-3 w-3 mr-1 text-green-600" />
                +5% from last period
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;