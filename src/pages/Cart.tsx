
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/CartContext';
import { Minus, Plus, Trash2, MapPin, Truck, UtensilsCrossed } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { buildWhatsAppOrderURL } from '@/lib/whatsapp';
import { pixelPurchase, trackMetaConversionEvent } from '@/lib/metaPixel';
import ClampedText from '@/components/ClampedText';
import ProductVisual from '@/components/ProductVisual';
import { formatDualMoneyLines } from '@/lib/money/format';
import { resolveStoreShopLabel, resolveStoreShopUrl } from '@/lib/storeNavigation';
import { buildProductRelativePath, buildStoreRelativePath, isExternalUrl } from '@/lib/storeUrls';
import { getApiBaseUrl } from '@/lib/apiBase';
import {
  CustomerFulfillmentMethod,
  getFulfillmentLabel,
  getStoreFulfillmentOptions,
  intersectFulfillmentOptions,
  fulfillmentRequiresAddress,
  isScheduledOrdersEnabled,
} from '@/lib/fulfillmentOptions';
import {
  getStoreClosedDayMessage,
  isStoreOpenOnDateForStores,
} from '@/lib/storeWorkingDays';

type StorePaymentMethods = {
  creditCard: boolean;
  debitCard: boolean;
  square: boolean;
  omt: boolean;
  bob: boolean;
  paypal: boolean;
  applePay: boolean;
  googlePay: boolean;
  bankTransfer: boolean;
  cashOnDelivery: boolean;
  storeCredits: boolean;
};

type CheckoutApiResponse = {
  error?: string;
  orderIds?: string[];
  invoiceNumbers?: string[];
};

type PaymentInitResponse = {
  error?: string;
  paymentUrl?: string;
  message?: string;
};

type DeliveryPartnerOption = {
  id: string;
  name: string;
  type: 'shipping' | 'local' | 'own';
};

const Cart: React.FC = () => {
  const { items, updateQuantity, removeFromCart, clearCart, subtotal } = useCart();
  const { user, setUser } = useAuth();
  // credits feature removed
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState({
    creditCard: false,
    debitCard: false,
    square: false,
    omt: false,
    bob: false,
    paypal: false,
    applePay: false,
    googlePay: false,
    bankTransfer: false,
    cashOnDelivery: true,
    storeCredits: false
  });
  const [deliveryInfo, setDeliveryInfo] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    deliveryPartner: '',
    notes: '',
    coordinates: { lat: 0, lng: 0 }
  });
  const [availableDeliveryPartners, setAvailableDeliveryPartners] = useState<DeliveryPartnerOption[]>([]);
  const [availableFulfillmentOptions, setAvailableFulfillmentOptions] = useState<CustomerFulfillmentMethod[]>(['delivery']);
  const [fulfillmentMethod, setFulfillmentMethod] = useState<CustomerFulfillmentMethod>('delivery');
  const [scheduledOrdersEnabled, setScheduledOrdersEnabled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [storeWorkingDaysList, setStoreWorkingDaysList] = useState<string[]>([]);
  const [storeWorkingHours, setStoreWorkingHours] = useState('');
  const [scheduledDateError, setScheduledDateError] = useState('');
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isWhatsAppOrdering, setIsWhatsAppOrdering] = useState(false);
  const [hasSavedInfo, setHasSavedInfo] = useState(false);
  const [storeCurrencyInfo, setStoreCurrencyInfo] = useState<Record<string, { currency: string; secondaryCurrency?: string; rate?: number }>>({});
  const [whatsappStoreInfo, setWhatsappStoreInfo] = useState<{ number: string; name: string; currency?: string; slug?: string } | null>(null);
  
  // Double-click prevention lock
  const isCheckingOutRef = useRef(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const stripeHandledRef = useRef<string | null>(null);
  const squareHandledRef = useRef<string | null>(null);

  // Load saved delivery info from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('deliveryInfo');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.phone || parsed.address || parsed.email || parsed.name) {
          setDeliveryInfo(prev => ({ ...prev, ...parsed }));
          setHasSavedInfo(true);
        }
      } catch (e) {
        console.error('Failed to parse saved delivery info', e);
      }
    }
  }, []);

  const validateScheduledDate = (date: string): boolean => {
    if (!date.trim()) {
      setScheduledDateError('');
      return true;
    }
    if (storeWorkingDaysList.length > 0 && !isStoreOpenOnDateForStores(date, storeWorkingDaysList)) {
      setScheduledDateError(getStoreClosedDayMessage(storeWorkingDaysList[0], storeWorkingHours));
      return false;
    }
    setScheduledDateError('');
    return true;
  };

  // Fetch exchange rates for all stores in cart
  useEffect(() => {
    const fetchExchangeRates = async () => {
      const storeIds = [...new Set(items.map(item => item.product.storeId))];
      const db = getFirestore();
      const info: Record<string, { currency: string; secondaryCurrency?: string; rate?: number }> = {};

      for (const storeId of storeIds) {
        try {
          const storeDoc = await getDoc(doc(db, 'storeProfiles', storeId));
          if (storeDoc.exists()) {
            const storeData = storeDoc.data() as StoreProfile;
            const rate = Number(storeData.customExchangeRate);
            const validRate = Number.isFinite(rate) && rate > 0 ? rate : undefined;
            const base = storeData.mainCurrency || 'USD';
            const secondary = storeData.secondaryCurrency && storeData.secondaryCurrency !== base
              ? storeData.secondaryCurrency
              : undefined;
            info[storeId] = { currency: base, secondaryCurrency: secondary, rate: validRate };
          } else {
            info[storeId] = { currency: 'USD' };
          }
        } catch (error) {
          console.error('Error fetching store currency for store:', storeId, error);
          info[storeId] = { currency: 'USD' };
        }
      }

      setStoreCurrencyInfo(info);
    };
    
    if (items.length > 0) {
      fetchExchangeRates();
    }
  }, [items]);

  // Fetch WhatsApp store info — only when cart has items from a single store
  useEffect(() => {
    const storeIds = [...new Set(items.map(item => item.product.storeId))];
    if (storeIds.length !== 1) {
      setWhatsappStoreInfo(null);
      return;
    }
    const fetchWhatsApp = async () => {
      try {
        const db = getFirestore();
        const storeDoc = await getDoc(doc(db, 'storeProfiles', storeIds[0]));
        if (storeDoc.exists()) {
          const data = storeDoc.data() as StoreProfile;
          if (data.whatsappBusiness && data.subscriptionTier !== 'trial') {
            setWhatsappStoreInfo({ number: data.whatsappBusiness, name: data.name, currency: data.mainCurrency, slug: data.slug });
          } else {
            setWhatsappStoreInfo(null);
          }
        } else {
          setWhatsappStoreInfo(null);
        }
      } catch {
        setWhatsappStoreInfo(null);
      }
    };
    fetchWhatsApp();
  }, [items]);

  // Fetch available delivery partners from admin settings (intersection across all stores in cart)
  useEffect(() => {
    const fetchDeliveryPartners = async () => {
      const storeIds = [...new Set(items.map(item => item.product.storeId))];
      if (storeIds.length === 0) {
        setAvailableDeliveryPartners([]);
        return;
      }

      const db = getFirestore();
      const storePartnerOptions: DeliveryPartnerOption[][] = [];
      const storeFulfillmentOptions: CustomerFulfillmentMethod[][] = [];
      const scheduledFlags: boolean[] = [];
      const workingDaysCollected: string[] = [];
      let primaryWorkingHours = '';

      const buildStorePartnerOptions = (storeData: StoreProfile): DeliveryPartnerOption[] => {
        const settings = storeData.deliverySettings || {};
        const configured = Array.isArray(settings.deliveryPartners)
          ? settings.deliveryPartners
              .filter((partner) => partner.active && String(partner.name || '').trim() !== '')
              .map((partner) => ({ id: partner.id, name: partner.name, type: partner.type }))
          : [];

        if (settings.ownDeliveryEnabled !== false) {
          return [{ id: 'in_house', name: 'In-house Delivery', type: 'own' }, ...configured];
        }

        return configured;
      };

      for (const storeId of storeIds) {
        try {
          const storeDoc = await getDoc(doc(db, 'storeProfiles', storeId));
          if (storeDoc.exists()) {
            const storeData = storeDoc.data() as StoreProfile;
            storePartnerOptions.push(buildStorePartnerOptions(storeData));
            storeFulfillmentOptions.push(getStoreFulfillmentOptions(storeData.deliverySettings));
            scheduledFlags.push(isScheduledOrdersEnabled(storeData.deliverySettings));
            workingDaysCollected.push(storeData.deliverySettings?.workingDays || 'Every day');
            if (!primaryWorkingHours) {
              primaryWorkingHours = storeData.deliverySettings?.workingHours || '';
            }
          } else {
            storePartnerOptions.push([{ id: 'in_house', name: 'In-house Delivery', type: 'own' }]);
            storeFulfillmentOptions.push(['delivery']);
            scheduledFlags.push(false);
            workingDaysCollected.push('Every day');
          }
        } catch (error) {
          console.error('Error fetching delivery partners for store:', storeId, error);
          storePartnerOptions.push([{ id: 'in_house', name: 'In-house Delivery', type: 'own' }]);
          storeFulfillmentOptions.push(['delivery']);
          scheduledFlags.push(false);
          workingDaysCollected.push('Every day');
        }
      }

      setStoreWorkingDaysList(workingDaysCollected);
      setStoreWorkingHours(primaryWorkingHours);
      const commonFulfillmentOptions = intersectFulfillmentOptions(storeFulfillmentOptions);
      setAvailableFulfillmentOptions(commonFulfillmentOptions);
      setScheduledOrdersEnabled(
        scheduledFlags.length > 0 && scheduledFlags.every(Boolean),
      );
      setFulfillmentMethod((prev) => (
        commonFulfillmentOptions.includes(prev) ? prev : commonFulfillmentOptions[0]
      ));

      const firstStorePartners = storePartnerOptions[0] || [];
      const commonPartnerIds = firstStorePartners
        .map((partner) => partner.id)
        .filter((id) => storePartnerOptions.every((partners) => partners.some((partner) => partner.id === id)));

      const commonPartners = firstStorePartners.filter((partner) => commonPartnerIds.includes(partner.id));
      setAvailableDeliveryPartners(commonPartners);

      setDeliveryInfo((prev) => {
        if (commonPartners.length === 0) {
          return { ...prev, deliveryPartner: '' };
        }

        if (commonPartners.some((partner) => partner.id === prev.deliveryPartner)) {
          return prev;
        }

        return { ...prev, deliveryPartner: commonPartners[0].id };
      });
    };

    fetchDeliveryPartners();
  }, [items]);

  // Fetch available payment methods from all stores in cart
  useEffect(() => {
    const fetchPaymentMethods = async () => {
      const storeIds = [...new Set(items.map(item => item.product.storeId))];
      if (storeIds.length === 0) return;
      
      const db = getFirestore();
      const storePaymentSettings: StorePaymentMethods[] = [];
      
      // Fetch payment settings for each store
      for (const storeId of storeIds) {
        try {
          const storeDoc = await getDoc(doc(db, 'storeProfiles', storeId));
          if (storeDoc.exists()) {
            const storeData = storeDoc.data();
            const gatewaySettings = (storeData.paymentGatewaySettings || {}) as { squareEnabled?: boolean; omtEnabled?: boolean; bobEnabled?: boolean; stripeEnabled?: boolean; paypalEnabled?: boolean };
            // If store has payment methods configured, use them; otherwise allow all
            if (storeData.paymentMethods) {
              storePaymentSettings.push({
                ...storeData.paymentMethods,
                square: Boolean(gatewaySettings.squareEnabled),
                omt: Boolean(gatewaySettings.omtEnabled),
                bob: Boolean(gatewaySettings.bobEnabled),
                creditCard: storeData.paymentMethods.creditCard && (gatewaySettings.stripeEnabled ?? true),
                paypal: storeData.paymentMethods.paypal && (gatewaySettings.paypalEnabled ?? true),
              });
            } else {
              // Default baseline when payment methods are not configured
              storePaymentSettings.push({
                creditCard: gatewaySettings.stripeEnabled ?? true,
                debitCard: gatewaySettings.stripeEnabled ?? true,
                square: Boolean(gatewaySettings.squareEnabled),
                omt: Boolean(gatewaySettings.omtEnabled),
                bob: Boolean(gatewaySettings.bobEnabled),
                paypal: gatewaySettings.paypalEnabled ?? true,
                applePay: true,
                googlePay: true,
                bankTransfer: true,
                cashOnDelivery: true,
                storeCredits: true
              });
            }
          } else {
            // Default: all methods enabled if store not found
            storePaymentSettings.push({
              creditCard: true,
              debitCard: true,
              square: false,
              omt: false,
              bob: false,
              paypal: true,
              applePay: true,
              googlePay: true,
              bankTransfer: true,
              cashOnDelivery: true,
              storeCredits: true
            });
          }
        } catch (error) {
          console.error('Error fetching payment methods for store:', storeId, error);
          // Default on error
          storePaymentSettings.push({
            creditCard: true,
            debitCard: true,
            square: false,
            omt: false,
            bob: false,
            paypal: true,
            applePay: true,
            googlePay: true,
            bankTransfer: true,
            cashOnDelivery: true,
            storeCredits: true
          });
        }
      }
      
      // Only show payment methods that ALL stores support (intersection)
      const commonMethods = {
        creditCard: storePaymentSettings.every(s => s.creditCard),
        debitCard: storePaymentSettings.every(s => s.debitCard),
        square: storePaymentSettings.every(s => s.square),
        omt: storePaymentSettings.every(s => s.omt),
        bob: storePaymentSettings.every(s => s.bob),
        paypal: storePaymentSettings.every(s => s.paypal),
        applePay: storePaymentSettings.every(s => s.applePay),
        googlePay: storePaymentSettings.every(s => s.googlePay),
        bankTransfer: storePaymentSettings.every(s => s.bankTransfer),
        cashOnDelivery: storePaymentSettings.every(s => s.cashOnDelivery),
        storeCredits: storePaymentSettings.every(s => s.storeCredits)
      };
      
      setAvailablePaymentMethods(commonMethods);
      
      // Set default payment method to first available
      if (commonMethods.cashOnDelivery) {
        setPaymentMethod('cash');
      } else if (commonMethods.creditCard) {
        setPaymentMethod('visa');
      } else if (commonMethods.debitCard) {
        setPaymentMethod('visa');
      } else if (commonMethods.square) {
        setPaymentMethod('square');
      } else if (commonMethods.omt) {
        setPaymentMethod('omt');
      } else if (commonMethods.bob) {
        setPaymentMethod('bob');
      } else if (commonMethods.paypal) {
        setPaymentMethod('paypal');
      } else if (commonMethods.applePay) {
        setPaymentMethod('apple_pay');
      } else if (commonMethods.googlePay) {
        setPaymentMethod('google_pay');
      } else if (commonMethods.bankTransfer) {
        setPaymentMethod('bank_transfer');
      }
    };
    
    if (items.length > 0) {
      fetchPaymentMethods();
    }
  }, [items]);

  // Save delivery info to localStorage whenever it changes
  useEffect(() => {
    if (deliveryInfo.phone || deliveryInfo.address) {
      localStorage.setItem('deliveryInfo', JSON.stringify(deliveryInfo));
    }
  }, [deliveryInfo]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const stripeState = params.get('stripe');
    const orderId = params.get('orderId');
    const sessionId = params.get('session_id');

    if (!stripeState || !orderId) {
      return;
    }

    const token = `${stripeState}:${orderId}:${sessionId || ''}`;
    if (stripeHandledRef.current === token) {
      return;
    }
    stripeHandledRef.current = token;

    const clearStripeQuery = () => {
      navigate('/cart', { replace: true });
    };

    if (stripeState === 'cancel') {
      toast.error('Stripe payment was canceled. You can try again.');
      clearStripeQuery();
      return;
    }

    if (stripeState !== 'success' || !sessionId) {
      toast.error('Invalid Stripe return parameters.');
      clearStripeQuery();
      return;
    }

    const confirmStripe = async () => {
      try {
        const API_BASE = getApiBaseUrl();
        const auth = getAuth();
        const currentUser = auth.currentUser;
        const idToken = currentUser ? await currentUser.getIdToken() : null;

        const response = await fetch(`${API_BASE.replace(/\/$/, '')}/payment/stripe/confirm`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          },
          body: JSON.stringify({ sessionId, orderId }),
        });

        let payload: { error?: string; success?: boolean } | null = null;
        try {
          payload = await response.json();
        } catch (error) {
          console.error('Failed to parse Stripe confirm response', error);
        }

        if (!response.ok || !payload?.success) {
          toast.error(payload?.error || 'Stripe payment confirmation failed.');
          clearStripeQuery();
          return;
        }

        toast.success('Payment completed successfully.');
        clearCart();

        if (user) {
          navigate('/orders');
        } else {
          navigate(`/track-order?orderId=${orderId}`);
        }
      } catch (error) {
        console.error('Stripe confirmation error', error);
        toast.error('Failed to verify Stripe payment. Please contact support if charged.');
        clearStripeQuery();
      }
    };

    void confirmStripe();
  }, [location.search, navigate, clearCart, user]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const squareState = params.get('square');
    const orderId = params.get('orderId');

    if (!squareState || !orderId) {
      return;
    }

    const token = `${squareState}:${orderId}`;
    if (squareHandledRef.current === token) {
      return;
    }
    squareHandledRef.current = token;

    const clearSquareQuery = () => {
      navigate('/cart', { replace: true });
    };

    if (squareState === 'cancel') {
      toast.error('Square payment was canceled. You can try again.');
      clearSquareQuery();
      return;
    }

    if (squareState !== 'success') {
      toast.error('Invalid Square return parameters.');
      clearSquareQuery();
      return;
    }

    const confirmSquare = async () => {
      try {
        const API_BASE = getApiBaseUrl();
        const auth = getAuth();
        const currentUser = auth.currentUser;
        const idToken = currentUser ? await currentUser.getIdToken() : null;

        const response = await fetch(`${API_BASE.replace(/\/$/, '')}/payment/square/confirm`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          },
          body: JSON.stringify({ orderId }),
        });

        let payload: { error?: string; success?: boolean; status?: string } | null = null;
        try {
          payload = await response.json();
        } catch (error) {
          console.error('Failed to parse Square confirm response', error);
        }

        if (response.status === 202 || payload?.status === 'pending') {
          toast.message('Square payment is still processing. Check your orders in a moment.');
          clearSquareQuery();
          return;
        }

        if (!response.ok || !payload?.success) {
          toast.error(payload?.error || 'Square payment confirmation failed.');
          clearSquareQuery();
          return;
        }

        toast.success('Payment completed successfully.');
        clearCart();

        if (user) {
          navigate('/orders');
        } else {
          navigate(`/track-order?orderId=${orderId}`);
        }
      } catch (error) {
        console.error('Square confirmation error', error);
        toast.error('Failed to verify Square payment. Please contact support if charged.');
        clearSquareQuery();
      }
    };

    void confirmSquare();
  }, [location.search, navigate, clearCart, user]);

  const handleClearSavedInfo = () => {
    localStorage.removeItem('deliveryInfo');
    setDeliveryInfo({
      phone: '',
      address: '',
      city: '',
      deliveryPartner: '',
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

  const handleWhatsAppOrder = async () => {
    if (isCheckingOutRef.current) {
      toast.error('Checkout already in progress. Please wait...');
      return;
    }

    if (items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    if (!whatsappStoreInfo) {
      toast.error('WhatsApp ordering is not available for this store');
      return;
    }

    if (!deliveryInfo.phone) {
      toast.error('Please add your phone number before ordering on WhatsApp');
      return;
    }

    if (fulfillmentRequiresAddress(fulfillmentMethod) && !deliveryInfo.address) {
      toast.error('Please fill in your delivery address');
      return;
    }

    if (scheduledDate && !validateScheduledDate(scheduledDate)) {
      toast.error(scheduledDateError || "We're closed on that day — please choose another date.");
      return;
    }

    localStorage.setItem('deliveryInfo', JSON.stringify(deliveryInfo));
    isCheckingOutRef.current = true;
    setIsWhatsAppOrdering(true);

    const db = getFirestore();
    try {
      for (const item of items) {
        const productRef = doc(db, 'products', item.product.id);
        const productSnap = await getDoc(productRef);
        if (!productSnap.exists() || !productSnap.data().inStock) {
          toast.error(`Sorry, ${item.product.name} is out of stock.`);
          isCheckingOutRef.current = false;
          setIsWhatsAppOrdering(false);
          return;
        }
      }

      const auth = getAuth();
      const currentUser = auth.currentUser;
      const idToken = currentUser ? await currentUser.getIdToken() : null;
      const API_BASE = getApiBaseUrl();
      const url = `${API_BASE.replace(/\/$/, '')}/checkout`;
      const checkoutItems = items.map((item) => ({
        productId: item.product.id,
        storeId: item.product.storeId,
        quantity: item.quantity,
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
          checkoutChannel: 'whatsapp',
          deliveryInfo: {
            ...deliveryInfo,
            name: deliveryInfo.name || user?.name || 'WhatsApp Customer',
            fulfillmentMethod,
            scheduledDate: scheduledDate || undefined,
            scheduledTime: scheduledTime || undefined,
            guestCount: guestCount ? Number(guestCount) : undefined,
            deliveryPartnerName: availableDeliveryPartners.find((partner) => partner.id === deliveryInfo.deliveryPartner)?.name || '',
          },
        }),
      });

      let body: CheckoutApiResponse | null = null;
      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        body = await resp.json();
      } else {
        const text = await resp.text();
        if (!resp.ok) {
          toast.error('Could not register order: ' + (text || resp.statusText));
          return;
        }
        try { body = JSON.parse(text); } catch { body = null; }
      }

      if (!resp.ok || !body?.orderIds?.length) {
        toast.error('Could not register order: ' + (body?.error || resp.statusText));
        return;
      }

      const orderId = body.orderIds[0];
      const orderReference = body.invoiceNumbers?.[0] || orderId.slice(-8).toUpperCase();
      const waUrl = buildWhatsAppOrderURL(
        items.map((item) => ({ name: item.product.name, qty: item.quantity, price: item.product.price })),
        {
          storeName: whatsappStoreInfo.name,
          whatsappNumber: whatsappStoreInfo.number,
          currency: whatsappStoreInfo.currency,
          orderReference,
          orderId,
          storeSlug: whatsappStoreInfo.slug,
        },
        {
          customerName: deliveryInfo.name || user?.name,
          customerPhone: deliveryInfo.phone,
          fulfillmentMethod: getFulfillmentLabel(fulfillmentMethod),
          scheduledDate: scheduledDate || undefined,
          scheduledTime: scheduledTime || undefined,
          guestCount: guestCount ? Number(guestCount) : undefined,
          notes: deliveryInfo.notes || undefined,
          address: deliveryInfo.address || undefined,
        },
      );

      if (!waUrl) {
        toast.error('Could not open WhatsApp');
        return;
      }

      window.open(waUrl, '_blank', 'noopener,noreferrer');
      clearCart();
      toast.success(`Order ${orderReference} registered. Finish the chat on WhatsApp — the store will mark it paid.`);
    } catch (error) {
      console.error('WhatsApp order failed:', error);
      toast.error('Failed to register WhatsApp order');
    } finally {
      isCheckingOutRef.current = false;
      setIsWhatsAppOrdering(false);
    }
  };

  const handleCheckout = async () => {
    if (isCheckingOutRef.current) {
      toast.error('Checkout already in progress. Please wait...');
      return;
    }

    if (items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }
    
    // Validate contact info for all fulfillment types
    if (!deliveryInfo.phone) {
      toast.error('Please fill in your phone number');
      return;
    }

    if (fulfillmentRequiresAddress(fulfillmentMethod) && !deliveryInfo.address) {
      toast.error('Please fill in your delivery address');
      return;
    }

    if (scheduledDate && !validateScheduledDate(scheduledDate)) {
      toast.error(scheduledDateError || "We're closed on that day — please choose another date.");
      return;
    }

    if (
      fulfillmentRequiresAddress(fulfillmentMethod)
      && availableDeliveryPartners.length > 0
      && !deliveryInfo.deliveryPartner
    ) {
      toast.error('Please choose a delivery partner');
      return;
    }
    
    // For guest checkout, email and name are also required
    if (!user && (!deliveryInfo.email || !deliveryInfo.name)) {
      toast.error('Please provide your name and email to continue');
      return;
    }
    
    // Save delivery info to localStorage for next time
    localStorage.setItem('deliveryInfo', JSON.stringify(deliveryInfo));
    
    isCheckingOutRef.current = true;
    setIsCheckingOut(true);
    
    // Check stock for all items
    const db = getFirestore();
    try {
      for (const item of items) {
        const productRef = doc(db, 'products', item.product.id);
        const productSnap = await getDoc(productRef);
        if (!productSnap.exists() || !productSnap.data().inStock) {
          toast.error(`Sorry, ${item.product.name} is out of stock.`);
          isCheckingOutRef.current = false;
          setIsCheckingOut(false);
          return;
        }
      }
    } catch (stockError) {
      console.error('Error checking stock:', stockError);
      toast.error('Failed to verify stock availability');
      isCheckingOutRef.current = false;
      setIsCheckingOut(false);
      return;
    }
    
    const itemsByStore = items.reduce((acc, item) => {
      const key = item.product.storeId;
      acc[key] = acc[key] || [];
      acc[key].push(item);
      return acc;
    }, {} as Record<string, typeof items>);

    // Place order via server-side checkout (supports both guest and registered users)
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      const idToken = currentUser ? await currentUser.getIdToken() : null;

      for (const [storeId, storeItems] of Object.entries(itemsByStore)) {
        const storeValue = storeItems.reduce((sum, item) => sum + Number(item.product.price || 0) * Number(item.quantity || 1), 0);
        const contentIds = storeItems.map((item) => item.product.id);
        void trackMetaConversionEvent({
          storeId,
          eventName: 'InitiateCheckout',
          value: storeValue,
          currency: 'USD',
          contentIds,
          userData: {
            externalId: String(user?.id || ''),
            email: String(user?.email || deliveryInfo.email || ''),
            phone: String(deliveryInfo.phone || ''),
          },
        });
      }

      const API_BASE = getApiBaseUrl();
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
          // Only include auth header if user is logged in (guest checkout doesn't need it)
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({ 
          items: checkoutItems, 
          shipping: null,
          deliveryInfo: {
            ...deliveryInfo,
            fulfillmentMethod,
            scheduledDate: scheduledDate || undefined,
            scheduledTime: scheduledTime || undefined,
            guestCount: guestCount ? Number(guestCount) : undefined,
            deliveryPartnerName: availableDeliveryPartners.find((partner) => partner.id === deliveryInfo.deliveryPartner)?.name || '',
          }
        }),
      });

      // Be defensive: the server might return HTML (index.html) when the
      // endpoint is wrong; avoid throwing on resp.json() for non-JSON bodies.
      let body: CheckoutApiResponse | null = null;
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

      // Order created successfully - now create payment
      const orderIds = body?.orderIds || [];
      if (!orderIds || orderIds.length === 0) {
        toast.error('Order created but no order ID returned');
        return;
      }

      // Use the first order ID (assuming single-store cart for now)
      const orderId = orderIds[0];
      
      // For cash on delivery, skip payment and show success
      if (paymentMethod === 'cash') {
        toast.success('Order placed successfully! The store will contact you soon.');
        pixelPurchase({ value: subtotal, contentIds: items.map(i => i.product.id) });

        for (const [storeId, storeItems] of Object.entries(itemsByStore)) {
          const storeValue = storeItems.reduce((sum, item) => sum + Number(item.product.price || 0) * Number(item.quantity || 1), 0);
          const contentIds = storeItems.map((item) => item.product.id);
          void trackMetaConversionEvent({
            storeId,
            eventName: 'Purchase',
            value: storeValue,
            currency: 'USD',
            contentIds,
            userData: {
              externalId: String(user?.id || ''),
              email: String(user?.email || deliveryInfo.email || ''),
              phone: String(deliveryInfo.phone || ''),
            },
          });
        }

        clearCart();
        
        // For guest users, redirect to tracking page with order ID; for logged-in users, go to orders
        if (user) {
          navigate('/orders');
        } else {
          // Redirect to guest order tracking with order ID pre-filled
          navigate(`/track-order?orderId=${orderId}`);
          toast.info('Save your Order ID to track your order: ' + orderId);
        }
        return;
      }
      
      // Create payment for the order (only for online payment methods)
      const useStripeForCards = paymentMethod === 'visa' || paymentMethod === 'mastercard';
      const useSquareCheckout = paymentMethod === 'square';
      const useOmtCheckout = paymentMethod === 'omt';
      const useBobCheckout = paymentMethod === 'bob';
      const paymentUrl = useStripeForCards
        ? `${API_BASE.replace(/\/$/, '')}/payment/stripe/checkout`
        : useSquareCheckout
          ? `${API_BASE.replace(/\/$/, '')}/payment/square/checkout`
        : useOmtCheckout
          ? `${API_BASE.replace(/\/$/, '')}/payment/omt/checkout`
        : useBobCheckout
          ? `${API_BASE.replace(/\/$/, '')}/payment/bob/checkout`
        : `${API_BASE.replace(/\/$/, '')}/payment/checkout`;
      const paymentResp = await fetch(paymentUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({ orderId, paymentMethod }),
      });

      let paymentBody: PaymentInitResponse | null = null;
      const paymentContentType = paymentResp.headers.get('content-type') || '';
      if (paymentContentType.includes('application/json')) {
        try {
          paymentBody = await paymentResp.json();
        } catch (e) {
          console.error('Failed to parse payment response', e);
        }
      }

      if (!paymentResp.ok) {
        toast.error('Payment initialization failed: ' + (paymentBody?.error || paymentResp.statusText));
        return;
      }

      // Redirect to payment page (Stripe for cards, Whish for other online methods)
      const paymentPageUrl = paymentBody?.paymentUrl;
      if (paymentPageUrl) {
        toast.success(useStripeForCards ? 'Redirecting to Stripe...' : useSquareCheckout ? 'Redirecting to Square...' : useOmtCheckout ? 'Opening OMT transfer instructions...' : useBobCheckout ? 'Opening BOB transfer instructions...' : 'Redirecting to payment...');
        if (paymentBody?.message && (useOmtCheckout || useBobCheckout)) {
          toast.info(paymentBody.message);
        }
        // Clear cart before redirecting (order is already created)
        clearCart();
        // Redirect to payment
        if (useOmtCheckout || useBobCheckout) {
          navigate(paymentPageUrl.replace(/^https?:\/\/[^/]+/, ''));
        } else {
          window.location.href = paymentPageUrl;
        }
      } else {
        toast.error('Payment URL not received');
      }
    } catch (err: unknown) {
      console.error('Checkout error', err);
      const msg = err instanceof Error ? err.message : 'Failed to place order. Please try again.';
      toast.error(msg);
    } finally {
      isCheckingOutRef.current = false;
      setIsCheckingOut(false);
    }
  };

  const total = subtotal;
  // Cart totals display in the store's currency when all items share one store; else fall back to USD.
  const cartStoreIds = [...new Set(items.map((item) => item.product.storeId))];
  const cartCurInfo = cartStoreIds.length === 1
    ? (storeCurrencyInfo[cartStoreIds[0]] || { currency: 'USD' })
    : { currency: 'USD' as string, secondaryCurrency: undefined as string | undefined, rate: undefined as number | undefined };

  const continueShoppingUrl = resolveStoreShopUrl({ pathname: location.pathname, items });
  const continueShoppingLabel = resolveStoreShopLabel(continueShoppingUrl);

  type CurrencyInfo = { currency: string; secondaryCurrency?: string; rate?: number };

  const getSecondaryOpt = (curInfo: CurrencyInfo) =>
    curInfo.secondaryCurrency && curInfo.rate && curInfo.rate > 0
      ? { currency: curInfo.secondaryCurrency, rate: curInfo.rate }
      : undefined;

  const renderDualMoney = (
    amount: number,
    curInfo: CurrencyInfo,
    options?: { primaryClass?: string; secondaryClass?: string; align?: 'left' | 'right' },
  ) => {
    const lines = formatDualMoneyLines(amount, {
      currency: curInfo.currency,
      style: 'full',
      numbersOnly: Boolean(getSecondaryOpt(curInfo)),
      secondary: getSecondaryOpt(curInfo),
    });
    const alignClass = options?.align === 'left' ? 'items-start text-left' : 'items-end text-right';

    if (lines.secondary) {
      return (
        <div className={`flex flex-col leading-tight min-w-0 ${alignClass}`}>
          <span className={options?.primaryClass ?? 'font-medium text-market-primary'}>{lines.primary}</span>
          <span className={options?.secondaryClass ?? 'text-xs text-gray-600'}>{lines.secondary}</span>
        </div>
      );
    }

    return (
      <span className={options?.primaryClass ?? 'font-medium text-market-primary'}>
        {lines.primary}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <Header />
      <main className="container mx-auto px-3 py-4 sm:px-4 sm:py-8 max-w-full">
        <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Shopping Cart</h1>

        {items.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
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
                      const curInfo = storeCurrencyInfo[item.product.storeId] || { currency: 'USD' };
                      return (
                        <li key={item.product.id} className="py-4 flex flex-col sm:flex-row gap-3 sm:gap-0">
                          <div className="w-full h-40 sm:w-24 sm:h-24 flex-shrink-0 overflow-hidden rounded-md">
                            <ProductVisual
                              product={item.product}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="sm:ml-4 flex-grow min-w-0">
                            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:gap-4">
                              <div className="min-w-0 flex-1">
                                <h3 className="font-medium text-gray-900 min-w-0">
                                  {(() => {
                                    const productHref = buildProductRelativePath(
                                      item.product,
                                      item.product.store?.slug,
                                    );
                                    const label = <ClampedText text={item.product.name} maxLines={2} className="font-medium text-gray-900" as="span" />;
                                    return isExternalUrl(productHref) ? (
                                      <a href={productHref} className="hover:text-market-primary block min-w-0">{label}</a>
                                    ) : (
                                      <Link to={productHref} className="hover:text-market-primary block min-w-0">{label}</Link>
                                    );
                                  })()}
                                </h3>
                                <p className="text-sm text-gray-500">
                                  {store?.name}
                                </p>
                                <p className="text-sm text-gray-500">
                                  Delivery: {item.product.deliveryTime}
                                </p>
                              </div>
                              <div className="shrink-0 sm:text-right">
                                {renderDualMoney(Number(item.product.price || 0), curInfo)}
                                <div className="mt-1">
                                  <p className="text-xs text-gray-500">Subtotal</p>
                                  {renderDualMoney(
                                    Number(item.product.price || 0) * item.quantity,
                                    curInfo,
                                    {
                                      primaryClass: 'text-sm font-medium text-gray-700',
                                      secondaryClass: 'text-xs text-gray-500',
                                    },
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="mt-4 flex flex-wrap justify-between items-center gap-3">
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
                <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                  <Button variant="outline" className="w-full sm:w-auto" onClick={() => navigate(continueShoppingUrl)}>
                    {continueShoppingLabel}
                  </Button>
                  <Button variant="outline" className="w-full sm:w-auto" onClick={() => clearCart()}>
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
                  <div className="flex items-start justify-between gap-3">
                    <span className="shrink-0">Subtotal</span>
                    <div className="min-w-0">
                      {renderDualMoney(subtotal, cartCurInfo, { primaryClass: 'font-medium' })}
                    </div>
                  </div>
                  
                  {/* Credits feature removed */}
                  
                  <Separator />
                  
                  <div className="flex items-start justify-between gap-3 font-semibold text-lg">
                    <span className="shrink-0">Total</span>
                    <div className="min-w-0">
                      {renderDualMoney(total, cartCurInfo, { primaryClass: 'font-semibold text-lg text-market-primary' })}
                    </div>
                  </div>
                  
                  {/* Payment Method */}
                  <div className="pt-2">
                    <p className="text-sm font-medium mb-2">Payment Method</p>
                    <RadioGroup 
                      value={paymentMethod} 
                      onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
                      className="space-y-2"
                    >
                      {(availablePaymentMethods.creditCard || availablePaymentMethods.debitCard) && (
                        <div className="flex items-start space-x-2">
                          <RadioGroupItem value="visa" id="visa" className="mt-1 shrink-0" />
                          <Label htmlFor="visa" className="flex items-center min-w-0 leading-snug">
                            <img src="https://placehold.co/40x25/2C5282/fff?text=VISA" alt="Visa" className="mr-2 h-6 shrink-0" />
                            Visa
                          </Label>
                        </div>
                      )}
                      {(availablePaymentMethods.creditCard || availablePaymentMethods.debitCard) && (
                        <div className="flex items-start space-x-2">
                          <RadioGroupItem value="mastercard" id="mastercard" className="mt-1 shrink-0" />
                          <Label htmlFor="mastercard" className="flex items-center min-w-0 leading-snug">
                            <img src="https://placehold.co/40x25/ED8936/fff?text=MC" alt="Mastercard" className="mr-2 h-6 shrink-0" />
                            Mastercard
                          </Label>
                        </div>
                      )}
                      {availablePaymentMethods.paypal && (
                        <div className="flex items-start space-x-2">
                          <RadioGroupItem value="paypal" id="paypal" className="mt-1 shrink-0" />
                          <Label htmlFor="paypal" className="flex items-center min-w-0 leading-snug">
                            <img src="https://placehold.co/40x25/38B2AC/fff?text=PP" alt="PayPal" className="mr-2 h-6 shrink-0" />
                            PayPal
                          </Label>
                        </div>
                      )}
                      {availablePaymentMethods.square && (
                        <div className="flex items-start space-x-2">
                          <RadioGroupItem value="square" id="square" className="mt-1 shrink-0" />
                          <Label htmlFor="square" className="flex items-center min-w-0 leading-snug">
                            <img src="https://placehold.co/40x25/0F172A/fff?text=SQ" alt="Square" className="mr-2 h-6 shrink-0" />
                            Square
                          </Label>
                        </div>
                      )}
                      {availablePaymentMethods.omt && (
                        <div className="flex items-start space-x-2">
                          <RadioGroupItem value="omt" id="omt" className="mt-1 shrink-0" />
                          <Label htmlFor="omt" className="flex items-center min-w-0 leading-snug">
                            <img src="https://placehold.co/40x25/1A365D/fff?text=OMT" alt="OMT" className="mr-2 h-6 shrink-0" />
                            OMT Transfer
                          </Label>
                        </div>
                      )}
                      {availablePaymentMethods.bob && (
                        <div className="flex items-start space-x-2">
                          <RadioGroupItem value="bob" id="bob" className="mt-1 shrink-0" />
                          <Label htmlFor="bob" className="flex items-center min-w-0 leading-snug">
                            <img src="https://placehold.co/40x25/0C4A6E/fff?text=BOB" alt="BOB Finance" className="mr-2 h-6 shrink-0" />
                            BOB Finance
                          </Label>
                        </div>
                      )}
                      {availablePaymentMethods.cashOnDelivery && (
                        <div className="flex items-start space-x-2">
                          <RadioGroupItem value="cash" id="cash" className="mt-1 shrink-0" />
                          <Label htmlFor="cash" className="flex items-center min-w-0 leading-snug">
                            <img src="https://placehold.co/40x25/718096/fff?text=CASH" alt="Cash" className="mr-2 h-6 shrink-0" />
                            Cash on Delivery
                          </Label>
                        </div>
                      )}
                    </RadioGroup>
                  </div>
                  
                  <Separator />

                  {/* Fulfillment Method */}
                  <div className="pt-2 space-y-3">
                    <p className="text-sm font-medium">How would you like to receive your order?</p>
                    <RadioGroup
                      value={fulfillmentMethod}
                      onValueChange={(value) => setFulfillmentMethod(value as CustomerFulfillmentMethod)}
                      className="grid gap-2"
                    >
                      {availableFulfillmentOptions.map((option) => (
                        <div key={option} className="flex items-center space-x-2 rounded-lg border p-3">
                          <RadioGroupItem value={option} id={`fulfillment-${option}`} />
                          <Label htmlFor={`fulfillment-${option}`} className="flex items-center gap-2 cursor-pointer font-normal">
                            {option === 'delivery' && <Truck size={16} />}
                            {option === 'pickup' && <MapPin size={16} />}
                            {option === 'dine_in' && <UtensilsCrossed size={16} />}
                            {getFulfillmentLabel(option)}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  {scheduledOrdersEnabled && (
                    <>
                      <Separator />
                      <div className="pt-2 space-y-3">
                        <p className="text-sm font-medium">Schedule your order (optional)</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label htmlFor="scheduled-date" className="text-xs">Date</Label>
                            <Input
                              id="scheduled-date"
                              type="date"
                              value={scheduledDate}
                              onChange={(e) => {
                                const next = e.target.value;
                                setScheduledDate(next);
                                validateScheduledDate(next);
                              }}
                              className={scheduledDateError ? 'border-red-500' : undefined}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="scheduled-time" className="text-xs">Time</Label>
                            <Input
                              id="scheduled-time"
                              type="time"
                              value={scheduledTime}
                              onChange={(e) => setScheduledTime(e.target.value)}
                            />
                          </div>
                        </div>
                        {scheduledDateError ? (
                          <p className="text-xs text-red-600">{scheduledDateError}</p>
                        ) : storeWorkingDaysList[0] ? (
                          <p className="text-xs text-gray-500">
                            Open: {storeWorkingDaysList[0]}
                            {storeWorkingHours ? ` · ${storeWorkingHours}` : ''}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-500">Leave blank for ASAP. Pick one or both fields.</p>
                        )}
                      </div>
                    </>
                  )}

                  {(fulfillmentMethod === 'dine_in' || scheduledDate || scheduledTime) && (
                    <>
                      <Separator />
                      <div className="space-y-1">
                        <Label htmlFor="guest-count" className="text-xs">How many people?</Label>
                        <Input
                          id="guest-count"
                          type="number"
                          min={1}
                          max={50}
                          placeholder="Party size"
                          value={guestCount}
                          onChange={(e) => setGuestCount(e.target.value)}
                        />
                      </div>
                    </>
                  )}

                  <Separator />
                  
                  {/* Delivery Information */}
                  <div className="pt-2 space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2">
                      <p className="text-sm font-medium">
                        {fulfillmentRequiresAddress(fulfillmentMethod) ? 'Delivery Information' : 'Contact Information'}
                      </p>
                      {fulfillmentRequiresAddress(fulfillmentMethod) && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleGetLocation}
                          disabled={isGettingLocation}
                          className="text-xs w-full sm:w-auto shrink-0"
                        >
                          <MapPin size={14} className="mr-1" />
                          {isGettingLocation ? 'Getting...' : 'Use My Location'}
                        </Button>
                      )}
                    </div>
                    
                    {hasSavedInfo && (
                      <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-xs text-green-800 font-medium">
                              ✓ Using your saved delivery information
                            </p>
                            <p className="text-xs text-green-700 mt-1">
                              You can update any field below or clear to start fresh
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleClearSavedInfo}
                            className="text-xs text-red-600 hover:text-red-700 shrink-0 self-start px-2 h-8"
                          >
                            Clear saved info
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {/* Guest checkout fields - only show if not logged in */}
                    {!user && (
                      <>
                        <div>
                          <Label htmlFor="name">Full Name *</Label>
                          <Input
                            id="name"
                            type="text"
                            placeholder="Your full name"
                            value={deliveryInfo.name}
                            onChange={(e) => setDeliveryInfo({ ...deliveryInfo, name: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="email">Email Address *</Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="your@email.com"
                            value={deliveryInfo.email}
                            onChange={(e) => setDeliveryInfo({ ...deliveryInfo, email: e.target.value })}
                            required
                          />
                          <p className="text-xs text-gray-500 mt-1">We'll send your order confirmation here</p>
                        </div>
                      </>
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
                      <p className="text-xs text-gray-500 mt-1">
                        {fulfillmentRequiresAddress(fulfillmentMethod)
                          ? 'Required to contact you for delivery'
                          : 'Required so we can reach you about your order'}
                      </p>
                    </div>

                    {!fulfillmentRequiresAddress(fulfillmentMethod) && (
                      <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
                        <p className="text-xs text-amber-900">
                          {fulfillmentMethod === 'pickup'
                            ? 'You chose pick up — no delivery address needed. We will contact you when your order is ready.'
                            : 'You chose dine in — no delivery address needed. Add table or timing notes below if helpful.'}
                        </p>
                      </div>
                    )}

                    {fulfillmentRequiresAddress(fulfillmentMethod) && (
                      <>
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
                    {availableDeliveryPartners.length > 0 && (
                      <div>
                        <Label>Delivery Partner *</Label>
                        <Select
                          value={deliveryInfo.deliveryPartner}
                          onValueChange={(value) => setDeliveryInfo({ ...deliveryInfo, deliveryPartner: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose delivery partner" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableDeliveryPartners.map((partner) => (
                              <SelectItem key={partner.id} value={partner.id}>
                                {partner.name} {partner.type === 'local' ? '(Local)' : partner.type === 'shipping' ? '(Shipping)' : '(Own)'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-gray-500 mt-1">Only partners enabled by the store admin are shown.</p>
                      </div>
                    )}
                      </>
                    )}
                    <div>
                      <Label htmlFor="notes">
                        {fulfillmentRequiresAddress(fulfillmentMethod) ? 'Delivery Notes' : 'Order Notes'}
                      </Label>
                      <Input
                        id="notes"
                        placeholder="Any special instructions"
                        value={deliveryInfo.notes}
                        onChange={(e) => setDeliveryInfo({ ...deliveryInfo, notes: e.target.value })}
                      />
                    </div>
                    {fulfillmentRequiresAddress(fulfillmentMethod) && deliveryInfo.coordinates.lat !== 0 && (
                      <p className="text-xs text-green-600">
                        ✓ Location captured: {deliveryInfo.coordinates.lat.toFixed(4)}, {deliveryInfo.coordinates.lng.toFixed(4)}
                      </p>
                    )}
                  </div>
                </CardContent>
                <CardFooter>
                  <div className="flex flex-col w-full gap-3">
                    <Button 
                      className="w-full"
                      onClick={handleCheckout}
                      disabled={items.length === 0 || isCheckingOut}
                    >
                      {isCheckingOut ? 'Placing Order...' : (user ? 'Place Order' : 'Place Order as Guest')}
                    </Button>
                    {whatsappStoreInfo && (
                      <Button
                        type="button"
                        onClick={handleWhatsAppOrder}
                        disabled={items.length === 0 || isCheckingOut || isWhatsAppOrdering}
                        className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white"
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.113.549 4.098 1.51 5.823L0 24l6.335-1.49A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.802 9.802 0 01-5.002-1.373l-.358-.213-3.758.884.944-3.653-.234-.374A9.788 9.788 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
                        </svg>
                        {isWhatsAppOrdering ? 'Registering order...' : 'Order via WhatsApp'}
                      </Button>
                    )}
                    {!user && (
                      <p className="text-xs text-gray-500 text-center w-full">
                        Have an account? <a href="/login" className="text-blue-600 hover:underline">Sign in</a> to save your info
                      </p>
                    )}
                  </div>
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
                <Link to={continueShoppingUrl}>{continueShoppingLabel}</Link>
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
