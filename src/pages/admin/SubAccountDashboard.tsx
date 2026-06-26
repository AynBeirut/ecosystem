import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/useAuth';
import { Button } from '@/components/ui/button';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminStatCard from '@/components/admin/AdminStatCard';
import AdminPanel from '@/components/admin/AdminPanel';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

const SubAccountDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
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
    <AdminPageShell
      title={`Welcome, ${user.name}!`}
      description="Team member dashboard"
      eyebrow={getRoleDisplay()}
      actions={(
        <Button variant="outline" onClick={logout}>Logout</Button>
      )}
    >
        <div className="flex items-center gap-2 mb-2">
          <Badge className={getRoleColor()}>{getRoleDisplay()}</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
          {user.subAccountRole === 'sales' && (
            <>
              <AdminStatCard title="My Orders" value={stats.myOrders} icon={ShoppingCart} gradient="from-orange-400 to-orange-600" subtitle="Total orders created" />
              <AdminStatCard title="Pending" value={stats.pendingOrders} icon={Clock} gradient="from-amber-400 to-yellow-600" subtitle="Awaiting confirmation" />
            </>
          )}

          {user.subAccountRole === 'delivery' && (
            <>
              <AdminStatCard title="Ready for Delivery" value={stats.deliveriesToday} icon={Truck} gradient="from-sky-500 to-blue-700" subtitle="Orders to deliver" />
              <AdminStatCard title="Completed Today" value={stats.completedToday} icon={CheckCircle} gradient="from-emerald-500 to-teal-700" subtitle="Deliveries made" />
            </>
          )}
        </div>

        {/* Quick Actions */}
        <AdminPanel>
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
        </AdminPanel>

        {/* Permissions Info */}
        <AdminPanel className="mt-6">
          <CardHeader>
            <CardTitle>Your Permissions</CardTitle>
            <CardDescription>What you can do in the system</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {user.permissions?.map(permission => {
                const permissionLabels: Record<string, string> = {
                  'view_orders': 'View Orders',
                  'create_orders': 'Create Orders',
                  'manage_orders': 'Manage Orders',
                  'view_inventory': 'View Inventory',
                  'manage_inventory': 'Manage Inventory',
                  'view_customers': 'View Customers',
                  'manage_customers': 'Manage Customers',
                  'view_reports': 'View Reports',
                  'manage_deliveries': 'Manage Deliveries',
                  'process_payments': 'Process Payments',
                  'view_payments': 'View Payments',
                  'manage_payments': 'Manage Payments',
                };
                return (
                  <Badge key={permission} variant="outline">
                    {permissionLabels[permission] || permission.replace(/_/g, ' ')}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </AdminPanel>
    </AdminPageShell>
  );
};

export default SubAccountDashboard;
