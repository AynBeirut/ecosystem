import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ShoppingCart, 
  Users, 
  Package, 
  Truck,
  CheckCircle,
  Clock
} from 'lucide-react';
import { getFirestore, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import MobileHeader from '@/components/MobileHeader';
import { useIsMobile } from '@/hooks/use-mobile';

const SubAccountDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [stats, setStats] = useState({
    myOrders: 0,
    pendingOrders: 0,
    deliveriesToday: 0,
    completedToday: 0,
  });

  // Redirect admins to full dashboard
  useEffect(() => {
    if (user && user.role === 'admin') {
      navigate('/admin/dashboard');
    }
    if (!user || user.role !== 'sub_account') {
      navigate('/login');
    }
  }, [user, navigate]);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user?.storeId || user.role !== 'sub_account') return;

      const db = getFirestore();
      const today = new Date().toISOString().split('T')[0];

      try {
        // Sales person stats
        if (user.subAccountRole === 'sales' && user.id) {
          const ordersRef = collection(db, 'orders');
          const myOrdersQuery = query(
            ordersRef, 
            where('storeId', '==', user.storeId),
            where('createdBy', '==', user.id)
          );
          const myOrdersSnap = await getDocs(myOrdersQuery);
          
          const pendingQuery = query(
            ordersRef,
            where('storeId', '==', user.storeId),
            where('createdBy', '==', user.id),
            where('status', '==', 'pending')
          );
          const pendingSnap = await getDocs(pendingQuery);

          setStats(prev => ({
            ...prev,
            myOrders: myOrdersSnap.size,
            pendingOrders: pendingSnap.size,
          }));
        }

        // Delivery person stats
        if (user.subAccountRole === 'delivery') {
          const ordersRef = collection(db, 'orders');
          const deliveryQuery = query(
            ordersRef,
            where('storeId', '==', user.storeId),
            where('status', 'in', ['ready', 'delivered'])
          );
          const deliverySnap = await getDocs(deliveryQuery);
          
          const todayDeliveries = deliverySnap.docs.filter(doc => {
            const data = doc.data();
            return data.deliveredDate && data.deliveredDate.startsWith(today);
          });

          setStats(prev => ({
            ...prev,
            deliveriesToday: deliverySnap.docs.filter(d => d.data().status === 'ready').length,
            completedToday: todayDeliveries.length,
          }));
        }
      } catch (error) {
        console.error('Error fetching sub-account stats:', error);
      }
    };

    fetchStats();
  }, [user]);

  const getRoleColor = () => {
    switch (user.subAccountRole) {
      case 'sales': return 'bg-blue-100 text-blue-800';
      case 'delivery': return 'bg-green-100 text-green-800';
      case 'manager': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleDisplay = () => {
    switch (user.subAccountRole) {
      case 'sales': return 'Sales Person';
      case 'delivery': return 'Delivery Person';
      case 'manager': return 'Manager';
      default: return 'Team Member';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {isMobile && <MobileHeader title="Dashboard" showBackButton={false} />}
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Welcome, {user.name}!</h1>
            <div className="flex items-center gap-2 mt-2">
              <Badge className={getRoleColor()}>
                {getRoleDisplay()}
              </Badge>
              <span className="text-sm text-gray-500">Team Member Dashboard</span>
            </div>
          </div>
          <Button variant="outline" onClick={logout}>
            Logout
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {user.subAccountRole === 'sales' && (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">My Orders</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-gray-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.myOrders}</div>
                  <p className="text-xs text-gray-500">Total orders created</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Pending</CardTitle>
                  <Clock className="h-4 w-4 text-yellow-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.pendingOrders}</div>
                  <p className="text-xs text-gray-500">Awaiting confirmation</p>
                </CardContent>
              </Card>
            </>
          )}

          {user.subAccountRole === 'delivery' && (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Ready for Delivery</CardTitle>
                  <Truck className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.deliveriesToday}</div>
                  <p className="text-xs text-gray-500">Orders to deliver</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.completedToday}</div>
                  <p className="text-xs text-gray-500">Deliveries made</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Access your main tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(user.permissions?.includes('create_orders') || user.permissions?.includes('view_orders')) && (
                <Button 
                  variant="outline" 
                  className="h-24 flex flex-col items-center justify-center gap-2"
                  onClick={() => navigate('/admin/orders')}
                >
                  <ShoppingCart className="h-6 w-6" />
                  <span>Orders</span>
                </Button>
              )}

              {(user.permissions?.includes('manage_customers') || user.permissions?.includes('view_customers')) && (
                <Button 
                  variant="outline" 
                  className="h-24 flex flex-col items-center justify-center gap-2"
                  onClick={() => navigate('/admin/customers')}
                >
                  <Users className="h-6 w-6" />
                  <span>Customers</span>
                </Button>
              )}

              {user.permissions?.includes('view_inventory') && (
                <Button 
                  variant="outline" 
                  className="h-24 flex flex-col items-center justify-center gap-2"
                  onClick={() => navigate('/admin/products')}
                >
                  <Package className="h-6 w-6" />
                  <span>Products</span>
                </Button>
              )}

              {user.permissions?.includes('manage_deliveries') && (
                <Button 
                  variant="outline" 
                  className="h-24 flex flex-col items-center justify-center gap-2"
                  onClick={() => navigate('/admin/delivery')}
                >
                  <Truck className="h-6 w-6" />
                  <span>Deliveries</span>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Permissions Info */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Your Permissions</CardTitle>
            <CardDescription>What you can do in the system</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {user.permissions?.map(permission => (
                <Badge key={permission} variant="outline">
                  {permission.replace(/_/g, ' ')}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SubAccountDashboard;
