import React, { useEffect, useState } from 'react';
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, Mail, Package } from 'lucide-react';
import { Order } from '@/types/order';

type StoreProfile = Record<string, unknown>;
type ProductInfo = { id: string; name: string; price: number };

const OrderTracking: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [stores, setStores] = useState<Record<string, StoreProfile>>({});
  const [products, setProducts] = useState<Record<string, ProductInfo>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const db = getFirestore();
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, where('customerId', '==', user.id));
      const snapshot = await getDocs(q);
      const ordersList = snapshot.docs.map(d => {
        const data = d.data();
        // Convert Firestore Timestamp to Date
        let createdAt = data.createdAt;
        if (createdAt && typeof createdAt === 'object' && 'toDate' in createdAt) {
          createdAt = (createdAt as any).toDate();
        } else if (createdAt && typeof createdAt === 'object' && 'seconds' in createdAt) {
          createdAt = new Date((createdAt as any).seconds * 1000);
        }
        return { id: d.id, ...data, createdAt } as Order;
      });
      
      // Sort orders: newest first, cancelled at bottom
      ordersList.sort((a, b) => {
        // Cancelled orders go to bottom
        if (a.status === 'cancelled' && b.status !== 'cancelled') return 1;
        if (a.status !== 'cancelled' && b.status === 'cancelled') return -1;
        
        // Sort by date - newest first
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      
      console.log('Fetched orders for customer:', user.id, 'Count:', ordersList.length);
      setOrders(ordersList);
      
      // Fetch store contact info and product details for each order
      const storeMap: Record<string, Record<string, unknown>> = {};
      const productMap: Record<string, ProductInfo> = {};
      
      for (const order of ordersList) {
        const storeId = order.storeId;
        if (storeId && !storeMap[storeId]) {
          const storeRef = doc(db, 'storeProfiles', storeId);
          const storeSnap = await getDoc(storeRef);
          if (storeSnap.exists()) {
            storeMap[storeId] = storeSnap.data() as StoreProfile;
          }
        }
        
        // Fetch product details for items in this order
        if (order.items) {
          for (const item of order.items) {
            if (item.productId && !productMap[item.productId]) {
              try {
                const productRef = doc(db, 'products', item.productId);
                const productSnap = await getDoc(productRef);
                if (productSnap.exists()) {
                  const productData = productSnap.data();
                  productMap[item.productId] = {
                    id: item.productId,
                    name: productData.name || 'Unknown Product',
                    price: productData.price || 0
                  };
                }
              } catch (error) {
                console.error('Error fetching product:', item.productId, error);
                productMap[item.productId] = {
                  id: item.productId,
                  name: 'Unknown Product',
                  price: 0
                };
              }
            }
          }
        }
      }
      
      setStores(storeMap);
      setProducts(productMap);
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
          <p className="text-sm text-gray-500 mt-1">View all your orders and track their status</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading your orders...</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No orders found.</p>
              <p className="text-sm text-gray-400">Your orders will appear here after you make a purchase.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order, index) => {
                // Generate a cleaner order reference
                const orderRef = order.invoiceNumber || `#${order.id.substring(0, 8).toUpperCase()}`;
                const isNewOrder = index === 0 && order.status === 'pending';
                
                return (
                  <div 
                    key={order.id} 
                    className={`border rounded-lg p-4 space-y-4 transition-all ${
                      isNewOrder ? 'border-green-500 bg-green-50' : 'border-gray-200'
                    }`}
                  >
                    {isNewOrder && (
                      <div className="bg-green-600 text-white text-xs font-medium px-3 py-1 rounded-full inline-block mb-2">
                        ✓ Just Placed
                      </div>
                    )}
                    
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="text-lg font-bold text-gray-900">
                            Order {orderRef}
                          </div>
                          <Badge 
                            variant={
                              order.status === 'delivered' ? 'default' : 
                              order.status === 'cancelled' ? 'destructive' : 
                              'secondary'
                            }
                            className="text-xs"
                          >
                            {order.status?.toUpperCase() || 'PENDING'}
                          </Badge>
                        </div>
                        
                        <div className="space-y-1 text-sm text-gray-600">
                          <div>
                            📅 {order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-US', { 
                              weekday: 'short', 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric' 
                            }) : 'N/A'}
                          </div>
                          <div>
                            📦 {order.items?.length || 0} {order.items?.length === 1 ? 'item' : 'items'}
                          </div>
                          <div className="font-semibold text-gray-900">
                            💵 Total: ${order.total?.toFixed(2) || '0.00'}
                          </div>
                        </div>
                      </div>
                      
                      {order.storeId && stores[order.storeId] && (
                        <div className="flex flex-col gap-2 bg-gray-50 p-3 rounded border border-gray-200">
                          <div className="font-medium text-sm text-gray-700">Store Contact</div>
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
                    
                    {/* Order Items */}
                    {order.items && order.items.length > 0 && (
                      <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg">
                        <div className="font-medium text-sm text-gray-700 mb-2 flex items-center">
                          <Package size={16} className="mr-2" />
                          Order Items
                        </div>
                        <div className="space-y-2">
                          {order.items.map((item, idx) => {
                            const product = products[item.productId];
                            return (
                              <div key={idx} className="flex justify-between items-center text-sm bg-white p-2 rounded">
                                <div className="flex-1">
                                  <span className="font-medium">{product?.name || 'Loading...'}</span>
                                  <span className="text-gray-500 ml-2">× {item.quantity}</span>
                                </div>
                                <div className="text-gray-700 font-medium">
                                  ${((item.price || product?.price || 0) * item.quantity).toFixed(2)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    {/* Delivery Information */}
                    {(order.customerPhone || order.deliveryAddress) && (
                      <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                        <div className="font-medium text-sm text-blue-900 mb-2">📦 Your Delivery Details</div>
                        <div className="space-y-1 text-sm">
                          {order.customerPhone && (
                            <div className="text-blue-900">
                              <strong>📞 Phone:</strong> {order.customerPhone}
                            </div>
                          )}
                          {order.deliveryAddress && (
                            <div className="text-blue-900">
                              <strong>📍 Address:</strong> {order.deliveryAddress}
                              {order.deliveryCity && `, ${order.deliveryCity}`}
                            </div>
                          )}
                          {order.deliveryNotes && (
                            <div className="text-blue-900">
                              <strong>📝 Notes:</strong> {order.deliveryNotes}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OrderTracking;
