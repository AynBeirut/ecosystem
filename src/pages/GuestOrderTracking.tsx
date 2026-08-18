import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/sonner';
import { Package, Mail, Phone, MapPin, Clock, Users } from 'lucide-react';
import BackButton from '@/components/BackButton';
import ProductVisual from '@/components/ProductVisual';
import { resolveStoreShopLabel, resolveStoreShopUrl } from '@/lib/storeNavigation';
import { getFulfillmentLabel } from '@/lib/fulfillmentOptions';
import { formatScheduledForDisplay } from '@/lib/scheduledOrders';
import { formatMoney } from '@/lib/money/format';

type OrderItem = {
  productId: string;
  quantity: number;
  price: number;
  name?: string;
  productName?: string;
};

type Order = {
  id: string;
  invoiceNumber?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryNotes?: string;
  deliveryMethod?: string;
  scheduledFor?: string;
  guestCount?: number;
  status: string;
  total: number;
  currency?: string;
  items: OrderItem[];
  createdAt: unknown;
  storeId: string;
};

type ProductInfo = {
  name: string;
  image?: string;
  icon?: string;
};

function normalizeCreatedAt(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Date(Number((value as { seconds: number }).seconds) * 1000);
  }
  return null;
}

const GuestOrderTracking: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialOrderId = searchParams.get('orderId') || '';
  const [orderId, setOrderId] = useState(initialOrderId);
  const [email, setEmail] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [storeName, setStoreName] = useState('');
  const [storeSlug, setStoreSlug] = useState('');
  const [products, setProducts] = useState<Record<string, ProductInfo>>({});
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const loadOrder = useCallback(async (id: string, verifyEmail?: string) => {
    const trimmedId = id.trim();
    if (!trimmedId) {
      toast.error('Please enter an Order ID');
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const db = getFirestore();
      const orderSnap = await getDoc(doc(db, 'orders', trimmedId));

      if (!orderSnap.exists()) {
        toast.error('Order not found');
        setOrder(null);
        return;
      }

      const orderData = orderSnap.data() as Order;

      if (verifyEmail && orderData.customerEmail?.toLowerCase() !== verifyEmail.toLowerCase()) {
        toast.error('Email does not match this order');
        setOrder(null);
        return;
      }

      const createdAt = normalizeCreatedAt(orderData.createdAt);
      setOrder({ ...orderData, id: orderSnap.id, createdAt });

      if (orderData.storeId) {
        const storeSnap = await getDoc(doc(db, 'storeProfiles', orderData.storeId));
        if (storeSnap.exists()) {
          const storeData = storeSnap.data();
          setStoreName(String(storeData.name || storeData.storeName || 'Store'));
          setStoreSlug(String(storeData.slug || orderData.storeId));
        }
      }

      const productMap: Record<string, ProductInfo> = {};
      for (const item of orderData.items || []) {
        if (item.productId && !productMap[item.productId]) {
          const productSnap = await getDoc(doc(db, 'products', item.productId));
          if (productSnap.exists()) {
            const productData = productSnap.data();
            productMap[item.productId] = {
              name: productData.name || item.name || 'Product',
              image: productData.image,
              icon: productData.icon,
            };
          } else if (item.name) {
            productMap[item.productId] = { name: item.name };
          }
        }
      }
      setProducts(productMap);
      toast.success('Order found!');
    } catch (error) {
      console.error('Error fetching order:', error);
      toast.error('Failed to fetch order');
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialOrderId.trim()) {
      void loadOrder(initialOrderId.trim());
    }
  }, [initialOrderId, loadOrder]);

  const handleTrackOrder = async () => {
    if (!orderId || !email) {
      toast.error('Please enter both Order ID and Email');
      return;
    }
    await loadOrder(orderId, email);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'confirmed': return 'bg-blue-500';
      case 'processing': return 'bg-purple-500';
      case 'ready': return 'bg-cyan-500';
      case 'delivered': return 'bg-green-500';
      case 'returned': return 'bg-orange-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Pending',
      confirmed: 'Confirmed',
      processing: 'Processing',
      ready: 'Ready for Pickup',
      delivered: 'Delivered',
      returned: 'Returned',
      cancelled: 'Cancelled',
    };
    return labels[status] ?? (status.charAt(0).toUpperCase() + status.slice(1));
  };

  const backUrl = resolveStoreShopUrl({ storeSlug, storeId: order?.storeId });
  const backLabel = resolveStoreShopLabel(backUrl);
  const orderRef = order?.invoiceNumber || order?.id?.slice(-8).toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <Header />
      <main className="container mx-auto px-3 py-4 sm:px-4 sm:py-8 max-w-full">
        <div className="max-w-2xl mx-auto">
          <div className="mb-4">
            <BackButton to={backUrl} label={backLabel} />
          </div>
          <h1 className="text-2xl font-bold mb-6">Track Your Order</h1>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Enter Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="orderId">Order ID *</Label>
                <Input
                  id="orderId"
                  placeholder="e.g., OD5uU5B34vN872c64ALi"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  From your WhatsApp confirmation or order reference link
                </p>
              </div>
              <div>
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Required when searching manually. Links with an order ID load automatically.
                </p>
              </div>
              <Button
                onClick={handleTrackOrder}
                className="w-full"
                disabled={loading}
              >
                {loading ? 'Searching...' : 'Track Order'}
              </Button>

              <div className="text-center pt-4 border-t">
                <p className="text-sm text-gray-600 mb-2">Have an account?</p>
                <Button
                  variant="outline"
                  onClick={() => navigate('/login')}
                  className="w-full"
                >
                  Sign In to View All Orders
                </Button>
              </div>
            </CardContent>
          </Card>

          {loading && (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground animate-pulse">
                Loading order…
              </CardContent>
            </Card>
          )}

          {searched && !loading && (
            order ? (
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
                    <div className="min-w-0">
                      <CardTitle className="break-words">Order {orderRef}</CardTitle>
                      <p className="text-sm text-gray-500 mt-1">
                        {order.createdAt ? new Date(order.createdAt as string | number | Date).toLocaleString() : 'N/A'}
                      </p>
                    </div>
                    <Badge className={`${getStatusColor(order.status)} shrink-0 self-start`}>
                      {getStatusText(order.status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {storeName && (
                    <div>
                      <h3 className="font-semibold mb-2">Store</h3>
                      <p className="text-gray-700">{storeName}</p>
                    </div>
                  )}

                  <div>
                    <h3 className="font-semibold mb-3">Items</h3>
                    <div className="space-y-3">
                      {order.items?.map((item, idx) => {
                        const product = products[item.productId];
                        const lineName = item.name || item.productName || product?.name || item.productId;
                        return (
                          <div key={idx} className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center border-b pb-3">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {product?.image || product?.icon ? (
                                <ProductVisual
                                  product={{ name: lineName, image: product.image, icon: product.icon }}
                                  className="w-12 h-12 object-cover rounded shrink-0"
                                />
                              ) : null}
                              <div className="min-w-0">
                                <p className="font-medium break-words">{lineName}</p>
                                <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                              </div>
                            </div>
                            <p className="font-medium shrink-0 sm:text-right">
                              {formatMoney(item.price * item.quantity, { currency: order.currency || 'USD' })}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">
                      {order.deliveryMethod === 'pickup' || order.deliveryMethod === 'dine_in'
                        ? 'Order Details'
                        : 'Delivery Information'}
                    </h3>
                    <div className="space-y-2 text-sm">
                      {order.deliveryMethod && (
                        <div className="flex items-start gap-2">
                          <Package className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                          <span className="break-words">{getFulfillmentLabel(order.deliveryMethod)}</span>
                        </div>
                      )}
                      {order.scheduledFor && (
                        <div className="flex items-start gap-2">
                          <Clock className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                          <span className="break-words">{formatScheduledForDisplay(order.scheduledFor)}</span>
                        </div>
                      )}
                      {order.guestCount ? (
                        <div className="flex items-start gap-2">
                          <Users className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                          <span>{order.guestCount} guests</span>
                        </div>
                      ) : null}
                      <div className="flex items-start gap-2">
                        <Package className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                        <span className="break-words">{order.customerName}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Phone className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                        <span className="break-all">{order.customerPhone}</span>
                      </div>
                      {order.customerEmail && (
                        <div className="flex items-start gap-2">
                          <Mail className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                          <span className="break-all">{order.customerEmail}</span>
                        </div>
                      )}
                      {order.deliveryAddress && (
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                          <span className="break-words">
                            {order.deliveryAddress}
                            {order.deliveryCity ? `, ${order.deliveryCity}` : ''}
                          </span>
                        </div>
                      )}
                      {order.deliveryNotes && (
                        <p className="text-gray-600 pt-1">{order.deliveryNotes}</p>
                      )}
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex items-start justify-between gap-3 text-lg font-bold">
                      <span className="shrink-0">Total</span>
                      <span className="text-right break-words">{formatMoney(order.total || 0, { currency: order.currency || 'USD' })}</span>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="font-semibold mb-3">Order Progress</h3>
                    {order.status === 'cancelled' ? (
                      <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <span className="text-lg">❌</span>
                        <span className="font-semibold text-red-700">Order Cancelled</span>
                      </div>
                    ) : order.status === 'returned' ? (
                      <div className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                        <span className="text-lg">↩️</span>
                        <span className="font-semibold text-orange-700">Order Returned</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {['pending', 'confirmed', 'processing', 'ready', 'delivered'].map((status, idx) => {
                          const isActive = order.status === status;
                          const isPast = ['pending', 'confirmed', 'processing', 'ready', 'delivered'].indexOf(order.status) > idx;
                          return (
                            <div key={status} className="flex items-center gap-3">
                              <div className={`w-4 h-4 rounded-full ${isActive ? 'bg-blue-500' : isPast ? 'bg-green-500' : 'bg-gray-300'}`} />
                              <span className={`text-sm ${isActive ? 'font-semibold text-blue-600' : isPast ? 'text-gray-600' : 'text-gray-400'}`}>
                                {getStatusText(status)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600">No order found with these details</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Please check your Order ID and Email
                  </p>
                </CardContent>
              </Card>
            )
          )}
        </div>
      </main>
    </div>
  );
};

export default GuestOrderTracking;
