import React, { useEffect, useState } from 'react';
import { getFirestore, collection, query, where, getDocs, doc, getDoc, addDoc } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Phone, Mail, Package } from 'lucide-react';
import { Order } from '@/types/order';
import { ReturnReason, ItemCondition, ExchangeItem } from '@/types/returns';
import type { ProductReview } from '@/types/product';
import { toast } from '@/components/ui/sonner';
import BackButton from '@/components/BackButton';

type StoreProfile = Record<string, unknown>;
type ProductInfo = { id: string; name: string; price: number };

type ReturnDraftItem = {
  productId: string;
  productName: string;
  maxQuantity: number;
  quantity: number;
  originalPrice: number;
};

type ExchangeDraftItem = {
  productId: string;
  quantity: number;
  unitPrice: number;
  productName: string;
};

const RETURN_REASONS: Array<{ value: ReturnReason; label: string }> = [
  { value: 'defective', label: 'Defective' },
  { value: 'wrong_item', label: 'Wrong item received' },
  { value: 'damaged_shipping', label: 'Damaged during shipping' },
  { value: 'not_as_described', label: 'Not as described' },
  { value: 'changed_mind', label: 'Changed mind' },
  { value: 'size_issue', label: 'Size issue' },
  { value: 'quality_issue', label: 'Quality issue' },
  { value: 'arrived_late', label: 'Arrived late' },
  { value: 'duplicate_order', label: 'Duplicate order' },
  { value: 'other', label: 'Other' },
];

const CONDITION_OPTIONS: Array<{ value: ItemCondition; label: string }> = [
  { value: 'unopened', label: 'Unopened' },
  { value: 'opened', label: 'Opened' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'defective', label: 'Defective' },
];

const OrderTracking: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [stores, setStores] = useState<Record<string, StoreProfile>>({});
  const [products, setProducts] = useState<Record<string, ProductInfo>>({});
  const [reviewStatusByProduct, setReviewStatusByProduct] = useState<Record<string, string>>({});
  const [returnsByOrder, setReturnsByOrder] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [returnReason, setReturnReason] = useState<ReturnReason>('defective');
  const [requestType, setRequestType] = useState<'refund' | 'exchange'>('refund');
  const [itemCondition, setItemCondition] = useState<ItemCondition>('unopened');
  const [returnNotes, setReturnNotes] = useState('');
  const [returnItems, setReturnItems] = useState<ReturnDraftItem[]>([]);
  const [exchangeItems, setExchangeItems] = useState<ExchangeDraftItem[]>([]);
  const [availableExchangeProducts, setAvailableExchangeProducts] = useState<ProductInfo[]>([]);

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

      // Fetch existing return requests to prevent duplicate order requests.
      const returnRequestsRef = collection(db, 'returnRequests');
      const returnQuery = query(returnRequestsRef, where('customerId', '==', user.id));
      const returnSnapshot = await getDocs(returnQuery);
      const returnMap: Record<string, string> = {};
      returnSnapshot.docs.forEach((d) => {
        const data = d.data() as any;
        if (data.orderId && data.status && data.status !== 'cancelled' && data.status !== 'rejected' && !returnMap[data.orderId]) {
          returnMap[data.orderId] = data.status;
        }
      });
      setReturnsByOrder(returnMap);
      
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

      const reviewMap: Record<string, string> = {};
      try {
        const reviewsRef = collection(db, 'productReviews');
        const reviewsQuery = query(reviewsRef, where('userId', '==', user.id));
        const reviewsSnap = await getDocs(reviewsQuery);
        reviewsSnap.docs.forEach((reviewDoc) => {
          const data = reviewDoc.data() as ProductReview;
          if (data.productId && !reviewMap[data.productId]) {
            reviewMap[data.productId] = data.status;
          }
        });
      } catch (reviewErr) {
        console.warn('Failed to load product review history', reviewErr);
      }
      setReviewStatusByProduct(reviewMap);

      setLoading(false);
    };
    fetchOrders();
  }, [user?.id]);

  const openReturnDialog = async (order: Order) => {
    const draftItems: ReturnDraftItem[] = (order.items || []).map((item) => {
      const product = products[item.productId];
      const qty = Number(item.quantity || 0);
      return {
        productId: item.productId,
        productName: product?.name || 'Unknown Product',
        maxQuantity: qty,
        quantity: 0,
        originalPrice: Number(item.price || product?.price || 0),
      };
    });

    let storeProducts: ProductInfo[] = [];
    try {
      const db = getFirestore();
      const productQuery = query(collection(db, 'products'), where('storeId', '==', order.storeId));
      const productSnapshot = await getDocs(productQuery);
      storeProducts = productSnapshot.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          name: data.name || 'Unnamed Product',
          price: Number(data.price || 0),
        };
      });
    } catch (error) {
      console.error('Error loading store products for exchange:', error);
      toast.error('Could not load replacement products. You can still request a refund return.');
    }

    setSelectedOrder(order);
    setReturnItems(draftItems);
    setAvailableExchangeProducts(storeProducts);
    setRequestType('refund');
    setExchangeItems([]);
    setReturnReason('defective');
    setItemCondition('unopened');
    setReturnNotes('');
    setReturnDialogOpen(true);
  };

  const updateReturnQuantity = (index: number, quantity: number) => {
    const updated = [...returnItems];
    const safeQty = Math.max(0, Math.min(quantity, updated[index].maxQuantity));
    updated[index] = { ...updated[index], quantity: safeQty };
    setReturnItems(updated);
  };

  const addExchangeItem = () => {
    setExchangeItems((prev) => [...prev, { productId: '', quantity: 1, unitPrice: 0, productName: '' }]);
  };

  const removeExchangeItem = (index: number) => {
    setExchangeItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateExchangeItem = (index: number, field: keyof ExchangeDraftItem, value: string | number) => {
    setExchangeItems((prev) => {
      const updated = [...prev];
      const current = { ...updated[index] };

      if (field === 'productId') {
        const selected = availableExchangeProducts.find((p) => p.id === value);
        current.productId = String(value);
        current.productName = selected?.name || '';
        current.unitPrice = Number(selected?.price || 0);
      } else if (field === 'quantity') {
        current.quantity = Math.max(1, Number(value || 1));
      } else {
        (current as any)[field] = value;
      }

      updated[index] = current;
      return updated;
    });
  };

  const getReturnTotalAmount = () => {
    return returnItems
      .filter((item) => item.quantity > 0)
      .reduce((sum, item) => sum + (item.quantity * item.originalPrice), 0);
  };

  const getExchangeTotalAmount = () => {
    return exchangeItems
      .filter((item) => item.productId && item.quantity > 0)
      .reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  };

  const handleSubmitReturnRequest = async () => {
    if (!selectedOrder || !user?.id || !selectedOrder.storeId) return;

    const selectedItems = returnItems.filter((item) => item.quantity > 0);
    if (selectedItems.length === 0) {
      toast.error('Please select at least one item quantity to return.');
      return;
    }

    const validExchangeItems = exchangeItems.filter((item) => item.productId && item.quantity > 0);
    if (requestType === 'exchange' && validExchangeItems.length === 0) {
      toast.error('Please select at least one replacement item for exchange.');
      return;
    }

    setSubmittingReturn(true);
    try {
      const db = getFirestore();

      // Sequence is best-effort for UI readability.
      const existingForStore = await getDocs(query(collection(db, 'returnRequests'), where('storeId', '==', selectedOrder.storeId)));
      const nextSeq = existingForStore.size + 1;
      const rmaNumber = `RMA-${nextSeq.toString().padStart(5, '0')}`;

      const mappedItems = selectedItems.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        sku: item.productId,
        quantity: item.quantity,
        originalPrice: item.originalPrice,
        refundAmount: item.originalPrice * item.quantity,
        returnReason,
        condition: itemCondition,
        restockable: itemCondition === 'unopened' || itemCondition === 'opened',
      }));

      const returnTotalAmount = mappedItems.reduce((sum, item) => sum + item.refundAmount, 0);
      const mappedExchangeItems: ExchangeItem[] = validExchangeItems.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.quantity * item.unitPrice,
      }));
      const exchangeTotalAmount = mappedExchangeItems.reduce((sum, item) => sum + item.totalPrice, 0);
      const netAmount = exchangeTotalAmount - returnTotalAmount;
      const netSettlementType = netAmount > 0 ? 'payable' : netAmount < 0 ? 'refundable' : 'even';
      const now = new Date().toISOString();

      const payload = {
        rmaNumber,
        orderId: selectedOrder.id,
        customerId: user.id,
        customerName: selectedOrder.customerName || user.name || 'Customer',
        customerEmail: selectedOrder.customerEmail || user.email || '',
        customerPhone: selectedOrder.customerPhone || '',
        storeId: selectedOrder.storeId,
        requestDate: now,
        status: 'pending',
        requestType,
        returnItems: mappedItems,
        items: mappedItems,
        reason: returnReason,
        customerNotes: returnNotes,
        customerComments: returnNotes,
        refundMethod: 'original_payment',
        refundAmount: returnTotalAmount,
        returnTotalAmount,
        exchangeTotalAmount,
        netAmount,
        netSettlementType,
        exchangeItems: mappedExchangeItems,
        restockingFee: 0,
        shippingCost: 0,
        createdAt: now,
        updatedAt: now,
      };

      await addDoc(collection(db, 'returnRequests'), payload);

      setReturnsByOrder((prev) => ({ ...prev, [selectedOrder.id]: 'pending' }));
      setReturnDialogOpen(false);
      toast.success(`Return request submitted (${rmaNumber}).`);
    } catch (error) {
      console.error('Error submitting return request:', error);
      toast.error('Failed to submit return request. Please try again.');
    } finally {
      setSubmittingReturn(false);
    }
  };

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
      <div className="mb-4">
        <BackButton label="Back" />
      </div>
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
                            const reviewStatus = reviewStatusByProduct[item.productId];
                            return (
                              <div key={idx} className="flex justify-between items-center text-sm bg-white p-2 rounded">
                                <div className="flex-1">
                                  <span className="font-medium">{product?.name || 'Loading...'}</span>
                                  <span className="text-gray-500 ml-2">× {item.quantity}</span>
                                  {reviewStatus && (
                                    <span className="ml-2 text-xs text-gray-500">• Review: {reviewStatus}</span>
                                  )}
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

                    {/* Self-serve return request */}
                    {(order.status === 'delivered' || order.status === 'completed') && (
                      <div className="pt-2 border-t">
                        {returnsByOrder[order.id] ? (
                          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                            Return request already submitted for this order ({returnsByOrder[order.id]}).
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => openReturnDialog(order)}>
                            Request Return
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request Return</DialogTitle>
            <DialogDescription>
              {selectedOrder?.invoiceNumber ? `Order ${selectedOrder.invoiceNumber}` : 'Select items and quantity to return'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Request Type</Label>
              <Select value={requestType} onValueChange={(v) => setRequestType(v as 'refund' | 'exchange')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="refund">Refund</SelectItem>
                  <SelectItem value="exchange">Exchange</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Reason</Label>
              <Select value={returnReason} onValueChange={(v) => setReturnReason(v as ReturnReason)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RETURN_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Item Condition</Label>
              <Select value={itemCondition} onValueChange={(v) => setItemCondition(v as ItemCondition)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-2 block">Items</Label>
              <div className="space-y-2">
                {returnItems.map((item, index) => (
                  <div key={item.productId + index} className="grid grid-cols-12 gap-2 items-center border rounded p-2">
                    <div className="col-span-7">
                      <p className="text-sm font-medium">{item.productName}</p>
                      <p className="text-xs text-gray-500">Purchased qty: {item.maxQuantity} | Unit: ${item.originalPrice.toFixed(2)}</p>
                    </div>
                    <div className="col-span-5">
                      <Input
                        type="number"
                        min="0"
                        max={item.maxQuantity}
                        step="1"
                        value={item.quantity === 0 ? '' : item.quantity}
                        placeholder="Return qty"
                        onChange={(e) => updateReturnQuantity(index, parseInt(e.target.value || '0', 10) || 0)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {requestType === 'exchange' && (
              <div className="space-y-2 border rounded p-3">
                <div className="flex items-center justify-between">
                  <Label className="mb-1 block">Replacement Items</Label>
                  <Button type="button" size="sm" variant="outline" onClick={addExchangeItem}>Add Replacement</Button>
                </div>
                {exchangeItems.length === 0 ? (
                  <p className="text-sm text-gray-500">No replacement items selected yet.</p>
                ) : (
                  <div className="space-y-2">
                    {exchangeItems.map((item, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 items-center border rounded p-2">
                        <div className="col-span-6">
                          <Select value={item.productId} onValueChange={(v) => updateExchangeItem(index, 'productId', v)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select replacement product" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableExchangeProducts.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.name} - ${p.price.toFixed(2)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-3">
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            value={item.quantity}
                            onChange={(e) => updateExchangeItem(index, 'quantity', parseInt(e.target.value || '1', 10) || 1)}
                          />
                        </div>
                        <div className="col-span-2 text-sm font-medium text-right">
                          ${(item.quantity * item.unitPrice).toFixed(2)}
                        </div>
                        <div className="col-span-1">
                          <Button type="button" size="sm" variant="destructive" onClick={() => removeExchangeItem(index)}>X</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {requestType === 'exchange' && (
              <div className="bg-gray-50 border rounded p-3 text-sm">
                <div className="flex justify-between"><span>Returned value</span><span>${getReturnTotalAmount().toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Exchange value</span><span>${getExchangeTotalAmount().toFixed(2)}</span></div>
                <div className="flex justify-between font-semibold border-t pt-2 mt-2">
                  <span>Net</span>
                  <span>
                    {(() => {
                      const net = getExchangeTotalAmount() - getReturnTotalAmount();
                      if (net > 0) return `Payable: $${net.toFixed(2)}`;
                      if (net < 0) return `Refundable: $${Math.abs(net).toFixed(2)}`;
                      return 'Even: $0.00';
                    })()}
                  </span>
                </div>
              </div>
            )}

            <div>
              <Label>Notes</Label>
              <Textarea
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                placeholder="Add details (optional)"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnDialogOpen(false)} disabled={submittingReturn}>Cancel</Button>
            <Button onClick={handleSubmitReturnRequest} disabled={submittingReturn}>
              {submittingReturn ? 'Submitting...' : 'Submit Return Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrderTracking;
