import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/sonner';
import { Package, Mail, Phone, MapPin } from 'lucide-react';
import BackButton from '@/components/BackButton';

type Order = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryCity: string;
  status: string;
  total: number;
  items: Array<{ productId: string; quantity: number; price: number }>;
  createdAt: any;
  storeId: string;
};

type ProductInfo = {
  name: string;
  image?: string;
};

const GuestOrderTracking: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [orderId, setOrderId] = useState(searchParams.get('orderId') || '');
  const [email, setEmail] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [storeName, setStoreName] = useState('');
  const [products, setProducts] = useState<Record<string, ProductInfo>>({});
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleTrackOrder = async () => {
    if (!orderId || !email) {
      toast.error('Please enter both Order ID and Email');
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const db = getFirestore();
      
      // Query for order by ID and email
      const orderRef = doc(db, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);

      if (!orderSnap.exists()) {
        toast.error('Order not found');
        setOrder(null);
        return;
      }

      const orderData = orderSnap.data() as Order;
      
      // Verify email matches (case-insensitive)
      if (orderData.customerEmail?.toLowerCase() !== email.toLowerCase()) {
        toast.error('Email does not match this order');
        setOrder(null);
        return;
      }

      // Convert Firestore timestamp
      let createdAt = orderData.createdAt;
      if (createdAt && typeof createdAt === 'object' && 'toDate' in createdAt) {
        createdAt = (createdAt as any).toDate();
      } else if (createdAt && typeof createdAt === 'object' && 'seconds' in createdAt) {
        createdAt = new Date((createdAt as any).seconds * 1000);
      }

      setOrder({ ...orderData, id: orderSnap.id, createdAt });

      // Fetch store name
      if (orderData.storeId) {
        const storeRef = doc(db, 'storeProfiles', orderData.storeId);
        const storeSnap = await getDoc(storeRef);
        if (storeSnap.exists()) {
          setStoreName(storeSnap.data().storeName || 'Store');
        }
      }

      // Fetch product details
      const productMap: Record<string, ProductInfo> = {};
      for (const item of orderData.items || []) {
        if (item.productId && !productMap[item.productId]) {
          const productRef = doc(db, 'products', item.productId);
          const productSnap = await getDoc(productRef);
          if (productSnap.exists()) {
            const productData = productSnap.data();
            productMap[item.productId] = {
              name: productData.name || 'Product',
              image: productData.image,
            };
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-4">
            <BackButton to="/" label="Back" />
          </div>
          <h1 className="text-2xl font-bold mb-6">Track Your Order</h1>
          
          {/* Search Form */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Enter Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="orderId">Order ID *</Label>
                <Input
                  id="orderId"
                  placeholder="e.g., abc123XYZ456..."
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  You received this in your order confirmation
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

          {/* Order Details */}
          {searched && !loading && (
            order ? (
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>Order {order.invoiceNumber}</CardTitle>
                      <p className="text-sm text-gray-500 mt-1">
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                    <Badge className={getStatusColor(order.status)}>
                      {getStatusText(order.status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Store Info */}
                  {storeName && (
                    <div>
                      <h3 className="font-semibold mb-2">Store</h3>
                      <p className="text-gray-700">{storeName}</p>
                    </div>
                  )}

                  {/* Items */}
                  <div>
                    <h3 className="font-semibold mb-3">Items</h3>
                    <div className="space-y-3">
                      {order.items?.map((item, idx) => {
                        const product = products[item.productId];
                        return (
                          <div key={idx} className="flex justify-between items-center border-b pb-2">
                            <div className="flex items-center gap-3">
                              {product?.image && (
                                <img 
                                  src={product.image} 
                                  alt={product.name} 
                                  className="w-12 h-12 object-cover rounded"
                                />
                              )}
                              <div>
                                <p className="font-medium">
                                  {product?.name || item.productId}
                                </p>
                                <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                              </div>
                            </div>
                            <p className="font-medium">${(item.price * item.quantity).toFixed(2)}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Delivery Information */}
                  <div>
                    <h3 className="font-semibold mb-3">Delivery Information</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-gray-500" />
                        <span>{order.customerName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-500" />
                        <span>{order.customerPhone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-500" />
                        <span>{order.customerEmail}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-500" />
                        <span>{order.deliveryAddress}, {order.deliveryCity}</span>
                      </div>
                    </div>
                  </div>

                  {/* Total */}
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span>Total</span>
                      <span>${order.total.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Order Status Timeline */}
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
