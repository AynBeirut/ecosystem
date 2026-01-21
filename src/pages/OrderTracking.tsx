import React, { useEffect, useState } from 'react';
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, Mail } from 'lucide-react';
import { Order } from '@/types/order';

type StoreProfile = Record<string, unknown>;

const OrderTracking: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [stores, setStores] = useState<Record<string, StoreProfile>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user?.id) return;
      setLoading(true);
      const db = getFirestore();
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, where('customerId', '==', user.id));
      const snapshot = await getDocs(q);
      const ordersList = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as Partial<Order>) })) as Order[];
      console.log('Fetched orders for customer:', user.id, 'Count:', ordersList.length);
      setOrders(ordersList);
      // Fetch store contact info for each order
      const storeMap: Record<string, Record<string, unknown>> = {};
      for (const order of ordersList) {
        const storeId = order.storeId;
        if (storeId && !storeMap[storeId]) {
          const storeRef = doc(db, 'storeProfiles', storeId);
          const storeSnap = await getDoc(storeRef);
          if (storeSnap.exists()) {
            storeMap[storeId] = storeSnap.data() as StoreProfile;
          }
        }
      }
      setStores(storeMap);
      setLoading(false);
    };
    fetchOrders();
  }, [user?.id]);

  const getStoreField = (storeId: string, field: string) => {
    const s = stores[storeId] as Record<string, unknown> | undefined;
    if (!s) return null;
    // prefer top-level field, fallback to contactInfo[field]
    const top = s[field];
    if (top && typeof top === 'string') return top;
    const contact = s.contactInfo;
    if (contact && typeof contact === 'object') {
      const c = contact as Record<string, unknown>;
      const v = c[field];
      if (v && typeof v === 'string') return v;
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <Card>
        <CardHeader>
          <CardTitle>Track Your Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div>Loading your orders...</div>
          ) : orders.length === 0 ? (
            <div>No orders found.</div>
          ) : (
            <div className="space-y-6">
              {orders.map(order => (
                <div key={order.id} className="border rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="font-semibold">
                      {order.invoiceNumber ? `Invoice: ${order.invoiceNumber}` : `Order #${order.id.substring(0, 8)}`}
                    </div>
                    <div className="text-sm text-gray-500">
                      Date: {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}
                    </div>
                    <div className="text-sm text-gray-500">
                      Items: {order.items?.length || 0} | Total: ${order.total?.toFixed(2) || '0.00'}
                    </div>
                    <div className="mt-2">
                      <Badge variant={order.status === 'delivered' ? 'default' : order.status === 'cancelled' ? 'destructive' : 'secondary'}>
                        {order.status || 'pending'}
                      </Badge>
                    </div>
                  </div>
                  {order.storeId && stores[order.storeId] && (
                    <div className="flex flex-col gap-2 bg-gray-50 p-3 rounded">
                      <div className="font-medium text-sm">Store Contact</div>
                      <div className="flex items-center text-gray-600 text-sm">
                        <Phone size={16} className="mr-2" />
                        {getStoreField(order.storeId, 'phone') || 'N/A'}
                      </div>
                      <div className="flex items-center text-gray-600 text-sm">
                        <Mail size={16} className="mr-2" />
                        {getStoreField(order.storeId, 'email') || 'N/A'}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OrderTracking;
