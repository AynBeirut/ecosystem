import React, { useEffect, useState } from 'react';
import { getFirestore, collection, query, where, getDocs, updateDoc, doc, getDoc } from 'firebase/firestore';
import { Product } from '@/types/product';
import { useAuth } from '@/context/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { Order } from '@/types/order';

const ORDER_STATUSES = ['pending', 'accepted', 'processing', 'shipped', 'delivered', 'cancelled'];

const AdminOrders: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [productMap, setProductMap] = useState<Record<string, Product>>({});


  useEffect(() => {
    const fetchOrdersAndProducts = async () => {
      if (!user?.storeId) return;
      setLoading(true);
      const db = getFirestore();
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, where('storeId', '==', user.storeId));
      const snapshot = await getDocs(q);
      const fetchedOrders = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as Partial<Order>) })) as Order[];

      // Collect all unique productIds from all orders
      const allProductIds = Array.from(new Set(fetchedOrders.flatMap(order => order.items?.map(i => i.productId) || [])));
      // Fetch all products in one go
      const products: Record<string, Product> = {};
      for (const productId of allProductIds) {
        const productRef = doc(db, 'products', productId);
        const productSnap = await getDoc(productRef);
        if (productSnap.exists()) {
          products[productId] = { id: productId, ...productSnap.data() } as Product;
        }
      }
      setProductMap(products);
      setOrders(fetchedOrders);
      setLoading(false);
    };
    fetchOrdersAndProducts();
  }, [user?.storeId]);


  const handleStatusChange = async (orderId: string, newStatus: string) => {
    const db = getFirestore();
    const orderRef = doc(db, 'orders', orderId);
    await updateDoc(orderRef, { status: newStatus });
    setOrders(orders.map(order => order.id === orderId ? { ...order, status: newStatus } : order));
    toast.success('Order status updated!');
  };

  const handleAcceptOrder = async (orderId: string) => {
    // Accept order and reduce stock for each product
    await handleStatusChange(orderId, 'accepted');
    const order = orders.find(o => o.id === orderId);
    if (order && order.items) {
      const db = getFirestore();
      for (const item of order.items) {
        const productRef = doc(db, 'products', item.productId);
        const productSnap = await getDoc(productRef);
        if (productSnap.exists()) {
          const productData = productSnap.data();
          let newStock = (typeof productData.stock === 'number' ? productData.stock : 0) - item.quantity;
          if (newStock < 0) newStock = 0;
          await updateDoc(productRef, {
            stock: newStock,
            inStock: newStock > 0
          });
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <Card>
        <CardHeader>
          <CardTitle>Manage Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div>Loading orders...</div>
          ) : orders.length === 0 ? (
            <div>No orders found for your store.</div>
          ) : (
            <div className="space-y-6">
              {orders.map(order => (
                <div key={order.id} className="border rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <div className="font-semibold">Order #{order.id}</div>
                    <div className="text-sm text-gray-500">Total: ${order.total}</div>
                    <div className="text-sm text-gray-500">Customer: {order.customerName || order.customerId}</div>
                    {order.customerPhone && (
                      <div className="text-sm text-gray-500">Phone: {order.customerPhone}</div>
                    )}
                    {order.items && order.items.length > 0 && (
                      <div className="mt-2">
                        <div className="font-medium">Items:</div>
                        <ul className="ml-4 list-disc">
                          {order.items.map(item => (
                            <li key={item.productId} className="text-sm">
                              {productMap[item.productId]?.name || 'Product'} x{item.quantity}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={order.status || 'pending'} onValueChange={status => handleStatusChange(order.id, status)}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        {ORDER_STATUSES.map(status => (
                          <SelectItem key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={() => handleStatusChange(order.id, order.status || 'pending')}>Save</Button>
                    {order.status === 'pending' && (
                      <Button variant="default" onClick={() => handleAcceptOrder(order.id)}>
                        Accept Order
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminOrders;
