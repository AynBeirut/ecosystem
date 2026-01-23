
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/CartContext';
import { Minus, Plus, Trash2, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/sonner';
import { getStoreById } from '@/data/mockData';
import { Product } from '@/types/product';
import { StoreProfile } from '@/types/storeProfile';
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { useAuth } from '@/context/useAuth';
import { Label } from '@/components/ui/label';
import { PaymentMethod } from '@/types/product';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const Cart: React.FC = () => {
  const { items, updateQuantity, removeFromCart, clearCart, subtotal } = useCart();
  const { user, setUser } = useAuth();
  // credits feature removed
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('visa');
  const [deliveryInfo, setDeliveryInfo] = useState({
    phone: '',
    address: '',
    city: '',
    notes: '',
    coordinates: { lat: 0, lng: 0 }
  });
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [hasSavedInfo, setHasSavedInfo] = useState(false);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
  const navigate = useNavigate();

  // Load saved delivery info from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('deliveryInfo');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.phone || parsed.address) {
          setDeliveryInfo(prev => ({ ...prev, ...parsed }));
          setHasSavedInfo(true);
        }
      } catch (e) {
        console.error('Failed to parse saved delivery info', e);
      }
    }
  }, []);

  // Fetch exchange rates for all stores in cart
  useEffect(() => {
    const fetchExchangeRates = async () => {
      const storeIds = [...new Set(items.map(item => item.product.storeId))];
      const db = getFirestore();
      const rates: Record<string, number> = {};
      
      for (const storeId of storeIds) {
        try {
          const storeDoc = await getDoc(doc(db, 'storeProfiles', storeId));
          if (storeDoc.exists()) {
            const storeData = storeDoc.data() as StoreProfile;
            rates[storeId] = storeData.customExchangeRate || 89000;
            console.log(`Store ${storeId}: Exchange rate = ${rates[storeId]}`);
          } else {
            rates[storeId] = 89000; // Default fallback
            console.log(`Store ${storeId}: Not found, using default 89000`);
          }
        } catch (error) {
          console.error('Error fetching exchange rate for store:', storeId, error);
          rates[storeId] = 89000; // Default fallback
        }
      }
      
      setExchangeRates(rates);
    };
    
    if (items.length > 0) {
      fetchExchangeRates();
    }
  }, [items]);

  // Save delivery info to localStorage whenever it changes
  useEffect(() => {
    if (deliveryInfo.phone || deliveryInfo.address) {
      localStorage.setItem('deliveryInfo', JSON.stringify(deliveryInfo));
    }
  }, [deliveryInfo]);

  const handleClearSavedInfo = () => {
    localStorage.removeItem('deliveryInfo');
    setDeliveryInfo({
      phone: '',
      address: '',
      city: '',
      notes: '',
      coordinates: { lat: 0, lng: 0 }
    });
    setHasSavedInfo(false);
    toast.success('Delivery information cleared');
  };

  const handleQuantityChange = (productId: string, newQuantity: number) => {
    if (newQuantity >= 1) {
      updateQuantity(productId, newQuantity);
    }
  };

  const handleRemoveItem = (productId: string) => {
    removeFromCart(productId);
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setDeliveryInfo(prev => ({
          ...prev,
          coordinates: { lat: latitude, lng: longitude }
        }));
        
        // Try to get address from coordinates using reverse geocoding
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const data = await response.json();
          if (data.display_name) {
            const addressParts = data.display_name.split(',');
            setDeliveryInfo(prev => ({
              ...prev,
              address: addressParts.slice(0, 2).join(',').trim(),
              city: data.address?.city || data.address?.town || data.address?.village || ''
            }));
            toast.success('Location detected successfully!');
          }
        } catch (error) {
          console.error('Reverse geocoding failed', error);
          toast.success(`Location captured: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        }
        setIsGettingLocation(false);
      },
      (error) => {
        console.error('Geolocation error', error);
        toast.error('Unable to get your location. Please enter it manually.');
        setIsGettingLocation(false);
      }
    );
  };

  const handleCheckout = async () => {
    if (items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }
    
    // Validate delivery info (required for all users, even guests)
    if (!deliveryInfo.phone || !deliveryInfo.address) {
      toast.error('Please fill in your phone number and delivery address');
      return;
    }
    
    // Check if user is logged in - if not, redirect to login
    if (!user) {
      toast.error('Please login or sign up to complete your order');
      // Save current path to return after login
      localStorage.setItem('redirectAfterLogin', '/cart');
      navigate('/login');
      return;
    }
    
    // Check stock for all items
    const db = getFirestore();
    for (const item of items) {
      const productRef = doc(db, 'products', item.product.id);
      const productSnap = await getDoc(productRef);
      if (!productSnap.exists() || !productSnap.data().inStock) {
        toast.error(`Sorry, ${item.product.name} is out of stock.`);
        return;
      }
    }
    // Place order via server-side checkout to ensure atomic credits handling
    try {
      if (!user) {
        toast.error('You must be logged in to place an order.');
        return;
      }
      const auth = getAuth();
      const currentUser = auth.currentUser;
      const idToken = currentUser ? await currentUser.getIdToken() : null;

      // Use an env-configurable API base so production can point to the deployed
      // Cloud Function URL (set VITE_API_BASE) while development uses '/api' and
      // the Vite proxy to the local functions emulator.
      const API_BASE = (import.meta.env as any).VITE_API_BASE ?? '/api';
      const url = `${API_BASE.replace(/\/$/, '')}/checkout`;

      // Transform cart items to the format expected by the backend
      const checkoutItems = items.map(item => ({
        productId: item.product.id,
        storeId: item.product.storeId,
        quantity: item.quantity
      }));

      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({ 
          items: checkoutItems, 
          shipping: null,
          deliveryInfo: deliveryInfo
        }),
      });

      // Be defensive: the server might return HTML (index.html) when the
      // endpoint is wrong; avoid throwing on resp.json() for non-JSON bodies.
      let body: any = null;
      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          body = await resp.json();
        } catch (e) {
          console.error('Failed to parse JSON response from checkout', e);
          body = null;
        }
      } else {
        // Not JSON: capture text for debugging and show a helpful error
        const text = await resp.text();
        console.error('Non-JSON response from checkout', { status: resp.status, text });
        if (!resp.ok) {
          toast.error('Checkout failed: ' + (text || resp.statusText));
          return;
        }
        try { body = JSON.parse(text); } catch { body = { text }; }
      }

      if (!resp.ok) {
        toast.error('Checkout failed: ' + (body?.error || resp.statusText));
        return;
      }
      // Success
      toast.success('Order placed successfully!');
      // Success
      // Optionally handle server response details if needed
      clearCart();
      navigate('/orders/confirmation');
    } catch (err: unknown) {
      console.error('Checkout error', err);
  const msg = err instanceof Error ? err.message : 'Failed to place order. Please try again.';
  toast.error(msg);
    }
  };

  const total = subtotal;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Shopping Cart</h1>

        {items.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Items ({items.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y">
                    {items.map((item) => {
                      const store = getStoreById(item.product.storeId);
                      const usdToLbp = exchangeRates[item.product.storeId] || 89000;
                      const itemSubtotalLBP = item.product.price * item.quantity * usdToLbp;
                      return (
                        <li key={item.product.id} className="py-4 flex flex-col sm:flex-row">
                          <div className="sm:w-24 sm:h-24 mb-4 sm:mb-0 flex-shrink-0">
                            <img 
                              src={item.product.image} 
                              alt={item.product.name} 
                              className="w-full h-full object-cover rounded-md"
                            />
                          </div>
                          <div className="sm:ml-4 flex-grow">
                            <div className="flex flex-col sm:flex-row sm:justify-between">
                              <div>
                                <h3 className="font-medium text-gray-900">
                                  <Link to={`/product/${item.product.id}`} className="hover:text-market-primary">
                                    {item.product.name}
                                  </Link>
                                </h3>
                                <p className="text-sm text-gray-500">
                                  {store?.name}
                                </p>
                                <p className="text-sm text-gray-500">
                                  Delivery: {item.product.deliveryTime}
                                </p>
                              </div>
                              <div className="mt-2 sm:mt-0 text-right">
                                <p className="font-medium text-market-primary">
                                  ${item.product.price.toFixed(2)}
                                </p>
                                <p className="text-sm text-gray-500">
                                  Subtotal: ${(item.product.price * item.quantity).toFixed(2)}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {itemSubtotalLBP.toLocaleString()} LBP
                                </p>
                              </div>
                            </div>
                            <div className="mt-4 flex justify-between items-center">
                              <div className="flex items-center">
                                <Button 
                                  variant="outline" 
                                  size="icon" 
                                  aria-label="Decrease quantity"
                                  title="Decrease quantity"
                                  onClick={() => handleQuantityChange(item.product.id, item.quantity - 1)}
                                  disabled={item.quantity <= 1}
                                >
                                  <Minus size={14} />
                                </Button>
                                <Input
                                  type="number"
                                  min="1"
                                  value={item.quantity === 0 ? '' : item.quantity}
                                  aria-label="Quantity"
                                  placeholder="1"
                                  onChange={(e) => handleQuantityChange(item.product.id, e.target.value === '' ? 1 : (parseInt(e.target.value) || 1))}
                                  className="text-center mx-2 w-16"
                                />
                                <Button 
                                  variant="outline" 
                                  size="icon" 
                                  aria-label="Increase quantity"
                                  title="Increase quantity"
                                  onClick={() => handleQuantityChange(item.product.id, item.quantity + 1)}
                                >
                                  <Plus size={14} />
                                </Button>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                aria-label="Remove item"
                                title="Remove item"
                                onClick={() => handleRemoveItem(item.product.id)}
                                className="text-gray-500 hover:text-red-500"
                              >
                                <Trash2 size={18} />
                              </Button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" onClick={() => navigate('/')}>
                    Continue Shopping
                  </Button>
                  <Button variant="outline" onClick={() => clearCart()}>
                    Clear Cart
                  </Button>
                </CardFooter>
              </Card>
            </div>

            {/* Order Summary */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  
                  {/* Credits feature removed */}
                  
                  <Separator />
                  
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Total</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                  
                  {/* Payment Method */}
                  <div className="pt-2">
                    <p className="text-sm font-medium mb-2">Payment Method</p>
                    <RadioGroup 
                      value={paymentMethod} 
                      onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
                      className="space-y-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="visa" id="visa" />
                        <Label htmlFor="visa" className="flex items-center">
                          <img src="https://placehold.co/40x25/2C5282/fff?text=VISA" alt="Visa" className="mr-2 h-6" />
                          Visa
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="mastercard" id="mastercard" />
                        <Label htmlFor="mastercard" className="flex items-center">
                          <img src="https://placehold.co/40x25/ED8936/fff?text=MC" alt="Mastercard" className="mr-2 h-6" />
                          Mastercard
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="paypal" id="paypal" />
                        <Label htmlFor="paypal" className="flex items-center">
                          <img src="https://placehold.co/40x25/38B2AC/fff?text=PP" alt="PayPal" className="mr-2 h-6" />
                          PayPal
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="cash" id="cash" />
                        <Label htmlFor="cash" className="flex items-center">
                          <img src="https://placehold.co/40x25/718096/fff?text=CASH" alt="Cash" className="mr-2 h-6" />
                          Cash on Delivery
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                  
                  <Separator />
                  
                  {/* Delivery Information */}
                  <div className="pt-2 space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">Delivery Information</p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleGetLocation}
                          disabled={isGettingLocation}
                          className="text-xs"
                        >
                          <MapPin size={14} className="mr-1" />
                          {isGettingLocation ? 'Getting...' : 'Use My Location'}
                        </Button>
                        {hasSavedInfo && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleClearSavedInfo}
                            className="text-xs text-red-600 hover:text-red-700"
                          >
                            Clear Saved Info
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {hasSavedInfo && (
                      <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                        <p className="text-xs text-green-800 font-medium">
                          ✓ Using your saved delivery information
                        </p>
                        <p className="text-xs text-green-700 mt-1">
                          You can update any field below or clear to start fresh
                        </p>
                      </div>
                    )}
                    
                    <div>
                      <Label htmlFor="phone">Phone Number *</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+961 XX XXX XXX"
                        value={deliveryInfo.phone}
                        onChange={(e) => setDeliveryInfo({ ...deliveryInfo, phone: e.target.value })}
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">Required to contact you for delivery</p>
                    </div>
                    <div>
                      <Label htmlFor="address">Delivery Address *</Label>
                      <Input
                        id="address"
                        placeholder="Street address, building, floor"
                        value={deliveryInfo.address}
                        onChange={(e) => setDeliveryInfo({ ...deliveryInfo, address: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        placeholder="City"
                        value={deliveryInfo.city}
                        onChange={(e) => setDeliveryInfo({ ...deliveryInfo, city: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="notes">Delivery Notes</Label>
                      <Input
                        id="notes"
                        placeholder="Any special instructions"
                        value={deliveryInfo.notes}
                        onChange={(e) => setDeliveryInfo({ ...deliveryInfo, notes: e.target.value })}
                      />
                    </div>
                    {deliveryInfo.coordinates.lat !== 0 && (
                      <p className="text-xs text-green-600">
                        ✓ Location captured: {deliveryInfo.coordinates.lat.toFixed(4)}, {deliveryInfo.coordinates.lng.toFixed(4)}
                      </p>
                    )}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    className="w-full"
                    onClick={handleCheckout}
                    disabled={items.length === 0}
                  >
                    {user ? 'Place Order' : 'Login to Place Order'}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                <ShoppingCart size={32} className="text-gray-400" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">Your cart is empty</h2>
              <p className="text-gray-600 mb-6">Looks like you haven't added any products to your cart yet.</p>
              <Button asChild>
                <Link to="/">Start Shopping</Link>
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const ShoppingCart = ({ size, className }: { size: number, className: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <circle cx="8" cy="21" r="1" />
    <circle cx="19" cy="21" r="1" />
    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
  </svg>
);

export default Cart;
