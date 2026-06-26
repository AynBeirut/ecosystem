import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { RotateCcw, Plus, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Order, PaymentRecord } from '@/types/order';
import { SalesReturn, SalesReturnItem } from '@/types/salesReturns';
import { logAction } from '@/lib/auditLog';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';

const SalesReturns: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [returns, setReturns] = useState<SalesReturn[]>([]);
  const [allOrders, setAllOrders] = useState<(Order & { id: string })[]>([]);
  const [orders, setOrders] = useState<(Order & { id: string })[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isCreatingReturn, setIsCreatingReturn] = useState(false);
  const [isCreatingReturnSubmitting, setIsCreatingReturnSubmitting] = useState(false);
  const [processingReturn, setProcessingReturn] = useState<SalesReturn | null>(null);
  const [isProcessingReturnSubmitting, setIsProcessingReturnSubmitting] = useState(false);
  
  // Double-click prevention locks
  const isCreatingReturnRef = useRef(false);
  const isProcessingReturnRef = useRef(false);
  
  const [newReturn, setNewReturn] = useState({
    orderId: '',
    restockItems: true,
    notes: '',
    items: [] as SalesReturnItem[],
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.storeId) return;
      const db = getFirestore();

      const fetchCollection = async (collectionName: string) => {
        const ref = collection(db, collectionName);
        const q = query(ref, where('storeId', '==', user.storeId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      };

      try {
        const [returnsData, ordersData, productsData] = await Promise.all([
          fetchCollection('salesReturns'),
          fetchCollection('orders'),
          fetchCollection('products'),
        ]);

        const typedOrders = ordersData as (Order & { id: string })[];
        setReturns(returnsData as SalesReturn[]);
        setAllOrders(typedOrders);
        setOrders(typedOrders.filter(o => o.status === 'delivered' || o.status === 'returned'));
        setProducts(productsData);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
      }
    };
    fetchData();
  }, [user?.storeId, toast]);

  const generateReturnNumber = async (): Promise<string> => {
    if (!user?.storeId) return 'SRET-001';
    const db = getFirestore();
    const returnsRef = collection(db, 'salesReturns');
    const q = query(returnsRef, where('storeId', '==', user.storeId));
    const snapshot = await getDocs(q);
    return `SRET-${String(snapshot.docs.length + 1).padStart(3, '0')}`;
  };

  const handleSelectOrder = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order || !order.items) return;

    const returnItems = order.items.map(item => {
      const product = products.find(p => p.id === item.productId);
      return {
        productId: item.productId,
        productName: product?.name || 'Unknown Product',
        quantity: 0,
        originalQuantity: item.quantity,
        price: item.price || product?.price || product?.sellingPrice || 0,
        subtotal: 0,
        reason: '',
      };
    });

    setNewReturn({
      ...newReturn,
      orderId,
      items: returnItems,
    });
  };

  const handleItemQuantityChange = (index: number, quantity: number) => {
    const items = [...newReturn.items];
    items[index].quantity = quantity;
    items[index].subtotal = quantity * items[index].price;
    setNewReturn({ ...newReturn, items });
  };

  const handleItemReasonChange = (index: number, reason: string) => {
    const items = [...newReturn.items];
    items[index].reason = reason;
    setNewReturn({ ...newReturn, items });
  };

  const calculateTotal = () => {
    return newReturn.items.reduce((sum, item) => sum + item.subtotal, 0);
  };

  const handleCreateReturn = async () => {
    if (isCreatingReturnRef.current) {
      console.log('⚠️ Create return operation already in progress');
      return;
    }

    if (!newReturn.orderId || !user?.storeId) {
      toast({ title: "Error", description: "Please select an order", variant: "destructive" });
      return;
    }

    const itemsToReturn = newReturn.items
      .filter(item => item.quantity > 0)
      .map(item => {
        const returnItem: any = {
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.subtotal,
        };
        if (item.reason) {
          returnItem.reason = item.reason;
        }
        return returnItem;
      });
    
    if (itemsToReturn.length === 0) {
      toast({ title: "Error", description: "Please add at least one item to return", variant: "destructive" });
      return;
    }

    // Validate quantities
    for (const item of newReturn.items) {
      if (item.quantity > (item.originalQuantity || 0)) {
        toast({ title: "Error", description: `Cannot return more than ordered for ${item.productName}`, variant: "destructive" });
        return;
      }
    }

    isCreatingReturnRef.current = true;
    setIsCreatingReturnSubmitting(true);
    let operationSucceeded = false;

    try {
      const db = getFirestore();
      const order = orders.find(o => o.id === newReturn.orderId);
      if (!order) return;

      // Get customer name from order
      const customerName = order.customerName || 'Walk-in Customer';

      const returnNumber = await generateReturnNumber();
      const refundAmount = calculateTotal();

      // Build returnData with only defined values
      const returnData: any = {
        returnNumber,
        orderId: order.id,
        invoiceNumber: order.invoiceNumber || order.orderNumber || 'N/A',
        customerName: customerName,
        items: itemsToReturn,
        subtotal: refundAmount,
        refundAmount,
        returnDate: new Date().toISOString(),
        status: 'pending',
        restockItems: newReturn.restockItems,
        storeId: user.storeId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Only add customerId if it exists
      if (order.customerId) {
        returnData.customerId = order.customerId;
      }

      if (newReturn.notes) {
        returnData.notes = newReturn.notes;
      }

      if (user.id) {
        returnData.createdBy = user.id;
      }

      const docRef = await addDoc(collection(db, 'salesReturns'), returnData);
      setReturns([{ id: docRef.id, ...returnData }, ...returns]);

      await logAction(user.id, user.name, user.role, 'create', 'sales_return', docRef.id, { newValue: returnData }, user.storeId);

      operationSucceeded = true;
      toast({ title: "Success", description: `Return ${returnNumber} created successfully!` });
    } catch (error) {
      console.error('Error creating return:', error);
      toast({ title: "Error", description: "Failed to create return", variant: "destructive" });
    } finally {
      isCreatingReturnRef.current = false;
      setIsCreatingReturnSubmitting(false);
      
      if (operationSucceeded) {
        setNewReturn({ orderId: '', restockItems: true, notes: '', items: [] });
        setIsCreatingReturn(false);
      }
    }
  };

  const handleProcessReturn = async (returnId: string, newStatus: SalesReturn['status'], refundMethod?: string) => {
    if (isProcessingReturnRef.current) {
      console.log('⚠️ Process return operation already in progress');
      return;
    }

    if (!user?.storeId) return;

    isProcessingReturnRef.current = true;
    setIsProcessingReturnSubmitting(true);
    let operationSucceeded = false;

    try {
      const db = getFirestore();
      const returnRef = doc(db, 'salesReturns', returnId);
      const returnDoc = returns.find(r => r.id === returnId);
      if (!returnDoc) return;

      const updateData: any = {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      };

      if (newStatus === 'completed') {
        updateData.refundMethod = refundMethod;
        updateData.refundDate = new Date().toISOString();

        // Restock items if requested
        if (returnDoc.restockItems) {
          for (const item of returnDoc.items) {
            const product = products.find(p => p.id === item.productId);
            if (product) {
              const productRef = doc(db, 'products', item.productId);
              const newStock = (product.currentStock || 0) + item.quantity;
              await updateDoc(productRef, {
                currentStock: newStock,
                updatedAt: new Date().toISOString(),
              });
            }
          }
        }

        // CRITICAL FIX: Reverse quantitySold in finished goods inventory
        for (const item of returnDoc.items) {
          // Find matching finished goods entry
          const fgQuery = query(
            collection(db, 'finishedGoodsInventory'),
            where('storeId', '==', user.storeId)
          );
          const fgSnapshot = await getDocs(fgQuery);
          
          const matchingFG = fgSnapshot.docs.find(fgDoc => {
            const data = fgDoc.data();
            return data.productId === item.productId || data.composedProductId === item.productId;
          });
          
          if (matchingFG) {
            const fgData = matchingFG.data();
            
            // Reverse the sale: add back to balance, subtract from quantitySold
            const newBalance = (fgData.currentBalance || 0) + item.quantity;
            const newQuantitySold = Math.max(0, (fgData.quantitySold || 0) - item.quantity);
            const newTotalValue = newBalance * (fgData.costPrice || 0);
            
            // Create reversal transaction record
            const reversalTransaction = {
              id: `TXN-RETURN-${Date.now()}-${item.productId}`,
              date: new Date().toISOString(),
              actionType: 'adjustment' as const,
              quantity: item.quantity, // Positive = adding back
              unitCost: fgData.costPrice || 0,
              totalCost: (fgData.costPrice || 0) * item.quantity,
              reason: `Sales return: ${returnDoc.returnNumber} from order ${returnDoc.orderNumber}`,
              referenceId: returnId,
              referenceNumber: returnDoc.returnNumber,
              userId: user.id,
              userName: user.name,
            };
            
            await updateDoc(doc(db, 'finishedGoodsInventory', matchingFG.id), {
              currentBalance: newBalance,
              quantitySold: newQuantitySold,
              totalValue: newTotalValue,
              transactions: [...(fgData.transactions || []), reversalTransaction],
              updatedAt: new Date().toISOString(),
            });
          }
        }

        // Update order payment status if refund is processed
        try {
          const orderRef = doc(db, 'orders', returnDoc.orderId);
          const orderSnap = await getDoc(orderRef);
          
          if (!orderSnap.exists()) {
            console.error('Order not found:', returnDoc.orderId);
            throw new Error(`Order ${returnDoc.orderId} not found`);
          }

          const order = orderSnap.data();
          console.log('Processing return for order:', returnDoc.orderId, 'Current order data:', order);
          
          // Calculate current amountPaid from paymentHistory if available
          let currentAmountPaid = order.amountPaid || 0;
          if (order.paymentHistory && order.paymentHistory.length > 0) {
            currentAmountPaid = order.paymentHistory.reduce((sum: number, payment: any) => sum + (payment.amount || 0), 0);
          }
          
          const newAmountPaid = Math.max(0, currentAmountPaid - returnDoc.refundAmount);
          const totalAmount = order.total || 0;
          
          let paymentStatus: 'unpaid' | 'partial' | 'paid' = 'unpaid';
          if (newAmountPaid >= totalAmount) {
            paymentStatus = 'paid';
          } else if (newAmountPaid > 0) {
            paymentStatus = 'partial';
          }

          // Add return to payment history as a negative entry
          const returnPayment = {
            amount: -returnDoc.refundAmount,
            method: refundMethod || 'return',
            date: new Date().toISOString(),
            notes: `Sales Return ${returnDoc.returnNumber}`,
            recordedBy: user.name,
          };

          const updatedPaymentHistory = [...(order.paymentHistory || []), returnPayment];

          const orderUpdate = {
            amountPaid: newAmountPaid,
            paymentStatus,
            paymentHistory: updatedPaymentHistory,
            status: 'returned',
            updatedAt: new Date().toISOString(),
          };

          console.log('Updating order with:', orderUpdate);
          await updateDoc(orderRef, orderUpdate);
          console.log('✓ Order updated successfully');
        } catch (orderError) {
          console.error('Failed to update order:', orderError);
          throw orderError;
        }
      }

      await updateDoc(returnRef, updateData);
      setReturns(returns.map(r => r.id === returnId ? { ...r, ...updateData } : r));

      await logAction(user.id, user.name, user.role, 'update', 'sales_return', returnId, { 
        oldValue: { status: returnDoc.status }, 
        newValue: { status: newStatus, ...updateData } 
      }, user.storeId);

      // Refresh orders and products data to show updated values
      if (newStatus === 'completed') {
        const fetchCollection = async (collectionName: string) => {
          const ref = collection(db, collectionName);
          const q = query(ref, where('storeId', '==', user.storeId));
          const snapshot = await getDocs(q);
          return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        };
        
        const [ordersData, productsData] = await Promise.all([
          fetchCollection('orders'),
          fetchCollection('products'),
        ]);
        
        const typedOrders = ordersData as (Order & { id: string })[];
        setAllOrders(typedOrders);
        setOrders(typedOrders.filter(o => o.status === 'delivered' || o.status === 'returned'));
        setProducts(productsData);
      }

      operationSucceeded = true;
      toast({ title: "Success", description: `Return ${newStatus}!` });
    } catch (error) {
      console.error('Error processing return:', error);
      toast({ title: "Error", description: "Failed to process return", variant: "destructive" });
    } finally {
      isProcessingReturnRef.current = false;
      setIsProcessingReturnSubmitting(false);
      
      if (operationSucceeded) {
        setProcessingReturn(null);
      }
    }
  };

  const getStatusBadge = (status: SalesReturn['status']) => {
    const variants = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return <Badge className={variants[status]}>{status.toUpperCase()}</Badge>;
  };

  const selectedOrder = orders.find(o => o.id === newReturn.orderId);

  const paymentRefunds = useMemo(() => {
    const rows: OrderPaymentRefund[] = [];
    for (const order of allOrders) {
      for (const payment of order.paymentHistory || []) {
        if (payment.entryType === 'refund' || Number(payment.amount || 0) < 0) {
          rows.push({ order, payment });
        }
      }
    }
    return rows.sort((a, b) => {
      const aTime = new Date(a.payment.recordedAt || a.payment.date || 0).getTime();
      const bTime = new Date(b.payment.recordedAt || b.payment.date || 0).getTime();
      return bTime - aTime;
    });
  }, [allOrders]);

  const getPaymentRefundInventoryNote = (order: Order & { id: string }, payment: PaymentRecord) => {
    const meta = order.lastRefundInventoryRestore;
    if (!meta || meta.refundId !== payment.id) return null;
    if (meta.manualAdjustmentRequired) {
      return `Stock not auto-restored (${meta.skippedFractionalQty ?? 0} unit(s) need manual adjustment).`;
    }
    if ((meta.restoredLines ?? 0) > 0) {
      return `Stock restored for ${meta.restoredLines} line(s).`;
    }
    return null;
  };

  return (
    <AdminPageShell
      title="Sales Returns & Refunds"
      description="Process customer returns and issue refunds"
      eyebrow="Daily Operations"
      backTo="/admin/inventory"
      backLabel="Back to Inventory"
      actions={(
        <Button onClick={() => setIsCreatingReturn(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Create Return
        </Button>
      )}
    >

        {/* Create Return Dialog */}
        <Dialog
          open={isCreatingReturn}
          onOpenChange={(open) => {
            if (!open && isCreatingReturnSubmitting) return;
            setIsCreatingReturn(open);
          }}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-4 md:p-6">
            <DialogHeader>
              <DialogTitle className="text-xl md:text-2xl">Create Sales Return</DialogTitle>
              <DialogDescription className="text-sm">Select a delivered order and items to return</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label className="text-sm md:text-base">Order/Invoice *</Label>
                <Select value={newReturn.orderId} onValueChange={handleSelectOrder}>
                  <SelectTrigger className="text-sm md:text-base">
                    <SelectValue placeholder="Select order" />
                  </SelectTrigger>
                  <SelectContent>
                    {orders.map(order => (
                      <SelectItem key={order.id} value={order.id} className="text-sm">
                        {order.invoiceNumber || order.orderNumber} - {order.customerName} - ${(order.total || 0).toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedOrder && newReturn.items.length > 0 && (
                <>
                  <div>
                    <Label className="text-base md:text-lg font-semibold">Items to Return</Label>
                    <div className="space-y-3 mt-2">
                      {newReturn.items.map((item, index) => (
                        <AdminPanel key={index}>
                          <CardContent className="p-3 md:p-4">
                            <div className="space-y-3">
                              <div>
                                <Label className="font-semibold text-sm md:text-base">{item.productName}</Label>
                                <p className="text-xs md:text-sm text-gray-500">Unit Price: ${(item.price || 0).toFixed(2)}</p>
                                <p className="text-xs md:text-sm font-medium text-blue-600">Original Quantity: {item.originalQuantity || 0}</p>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <Label htmlFor={`qty-${index}`} className="text-sm">Return Quantity *</Label>
                                  <Input
                                    id={`qty-${index}`}
                                    type="number"
                                    min="0"
                                    max={item.originalQuantity || 0}
                                    value={item.quantity || ''}
                                    onChange={(e) => handleItemQuantityChange(index, parseFloat(e.target.value) || 0)}
                                    placeholder="0"
                                    className="text-sm"
                                  />
                                  <p className="text-xs text-gray-500 mt-1">Max: {item.originalQuantity || 0}</p>
                                </div>
                                <div>
                                  <Label htmlFor={`reason-${index}`} className="text-sm">Reason *</Label>
                                  <Input
                                    id={`reason-${index}`}
                                    value={item.reason}
                                    onChange={(e) => handleItemReasonChange(index, e.target.value)}
                                    placeholder="e.g., Defective, Wrong item"
                                    className="text-sm"
                                  />
                                </div>
                              </div>
                              <div className="flex justify-between items-center pt-2 border-t">
                                <Label className="text-sm">Subtotal</Label>
                                <p className="text-base md:text-lg font-semibold">${(item.subtotal || 0).toFixed(2)}</p>
                              </div>
                            </div>
                          </CardContent>
                        </AdminPanel>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 p-4 bg-blue-50 rounded">
                    <Switch
                      id="restock"
                      checked={newReturn.restockItems}
                      onCheckedChange={(checked) => setNewReturn({ ...newReturn, restockItems: checked })}
                    />
                    <Label htmlFor="restock" className="cursor-pointer">
                      Restock returned items to inventory
                    </Label>
                  </div>

                  <div className="p-4 bg-gray-100 rounded">
                    <div className="flex justify-between text-xl font-bold">
                      <span>Total Refund Amount:</span>
                      <span className="text-red-600">${calculateTotal().toFixed(2)}</span>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={newReturn.notes}
                      onChange={(e) => setNewReturn({ ...newReturn, notes: e.target.value })}
                      placeholder="Additional information about this return..."
                      rows={3}
                    />
                  </div>
                </>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreatingReturn(false)} disabled={isCreatingReturnSubmitting}>Cancel</Button>
              <Button onClick={handleCreateReturn} disabled={isCreatingReturnSubmitting || !newReturn.orderId || newReturn.items.filter(i => i.quantity > 0).length === 0}>
                {isCreatingReturnSubmitting ? 'Creating...' : 'Create Return'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Process Return Dialog */}
        {processingReturn && (
          <Dialog
            open={!!processingReturn}
            onOpenChange={(open) => {
              if (!open && isProcessingReturnSubmitting) return;
              if (!open) setProcessingReturn(null);
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Process Return - {processingReturn.returnNumber}</DialogTitle>
                <DialogDescription>Complete the return and process refund</DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="p-4 bg-gray-100 rounded">
                  <p className="font-semibold">Refund Amount: ${processingReturn.refundAmount.toFixed(2)}</p>
                  <p className="text-sm text-gray-600">Customer: {processingReturn.customerName}</p>
                  {processingReturn.restockItems && (
                    <p className="text-sm text-blue-600 mt-1">✓ Items will be restocked</p>
                  )}
                </div>

                <div>
                  <Label>Refund Method *</Label>
                  <Select defaultValue="cash">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="store_credit">Store Credit</SelectItem>
                      <SelectItem value="original_payment">Original Payment Method</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setProcessingReturn(null)} disabled={isProcessingReturnSubmitting}>Cancel</Button>
                <Button variant="destructive" onClick={() => handleProcessReturn(processingReturn.id, 'rejected')} disabled={isProcessingReturnSubmitting}>
                  <XCircle className="h-4 w-4 mr-2" />
                  {isProcessingReturnSubmitting ? 'Processing...' : 'Reject'}
                </Button>
                <Button onClick={() => handleProcessReturn(processingReturn.id, 'completed', 'cash')} disabled={isProcessingReturnSubmitting}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {isProcessingReturnSubmitting ? 'Processing...' : 'Complete & Refund'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {paymentRefunds.length > 0 && (
          <div className="grid gap-4 mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Order payment refunds</h2>
              <p className="text-sm text-gray-500 mt-1">
                Refunds recorded from Admin → Orders appear here. Use Create Return for physical item returns.
              </p>
            </div>
            {paymentRefunds.map(({ order, payment }) => {
              const inventoryNote = getPaymentRefundInventoryNote(order, payment);
              return (
                <AdminPanel key={`${order.id}-${payment.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                          {payment.id}
                          <Badge className="bg-red-100 text-red-800">REFUND</Badge>
                        </CardTitle>
                        <CardDescription>
                          Invoice: {order.invoiceNumber || order.orderNumber || order.id}
                          {' | '}
                          Customer: {order.customerName || '—'}
                          {' | '}
                          {new Date(payment.date).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => navigate('/admin/orders')}>
                        View in Orders
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">
                        {payment.method} · {payment.recordedBy || 'Admin'}
                      </span>
                      <span className="text-lg font-bold text-red-600">
                        ${Math.abs(Number(payment.amount || 0)).toFixed(2)}
                      </span>
                    </div>
                    {payment.notes ? (
                      <p className="text-sm p-2 bg-gray-50 rounded">{payment.notes}</p>
                    ) : null}
                    {inventoryNote ? (
                      <p className="text-sm p-2 bg-amber-50 rounded border border-amber-200 text-amber-900">
                        {inventoryNote}
                      </p>
                    ) : null}
                  </CardContent>
                </AdminPanel>
              );
            })}
          </div>
        )}

        {/* Returns List */}
        <div className="grid gap-4">
          <h2 className="text-lg font-semibold text-gray-900">Physical sales returns</h2>
          {returns.length === 0 ? (
            <AdminPanel>
              <CardContent className="py-12 text-center">
                <RotateCcw className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500">
                  {paymentRefunds.length > 0
                    ? 'No physical return documents yet. Payment refunds from Orders are listed above.'
                    : 'No sales returns yet. Create your first return to get started.'}
                </p>
              </CardContent>
            </AdminPanel>
          ) : (
            returns.map((returnDoc) => (
              <AdminPanel key={returnDoc.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {returnDoc.returnNumber}
                        {getStatusBadge(returnDoc.status)}
                      </CardTitle>
                      <CardDescription>
                        Invoice: {returnDoc.invoiceNumber} | Customer: {returnDoc.customerName} | {new Date(returnDoc.returnDate).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    {returnDoc.status === 'pending' && (
                      <Button onClick={() => setProcessingReturn(returnDoc)}>
                        Process Return
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-semibold mb-1">Returned Items:</p>
                      {returnDoc.items.map((item, idx) => (
                        <div key={idx} className="text-sm p-2 bg-gray-50 rounded mb-1">
                          <div className="flex justify-between">
                            <span>{item.productName}: {item.quantity} units @ ${(item.price || 0).toFixed(2)}</span>
                            <span className="font-semibold">${(item.subtotal || 0).toFixed(2)}</span>
                          </div>
                          <p className="text-xs text-gray-600">Reason: {item.reason}</p>
                        </div>
                      ))}
                    </div>
                    {returnDoc.restockItems && (
                      <div className="text-sm p-2 bg-blue-50 rounded border border-blue-200">
                        <p className="text-blue-800">✓ Items {returnDoc.status === 'completed' ? 'have been' : 'will be'} restocked</p>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="font-semibold">Total Refund Amount:</span>
                      <span className="text-lg font-bold text-red-600">${returnDoc.refundAmount.toFixed(2)}</span>
                    </div>
                    {returnDoc.status === 'completed' && returnDoc.refundDate && (
                      <div className="p-2 bg-green-50 rounded border border-green-200">
                        <p className="text-sm text-green-800">
                          <strong>Refunded:</strong> ${returnDoc.refundAmount.toFixed(2)} via {returnDoc.refundMethod} on {new Date(returnDoc.refundDate).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                    {returnDoc.notes && (
                      <div className="text-sm p-2 bg-gray-50 rounded">
                        <strong>Notes:</strong> {returnDoc.notes}
                      </div>
                    )}
                  </div>
                </CardContent>
              </AdminPanel>
            ))
          )}
        </div>
    </AdminPageShell>
  );
};

export default SalesReturns;
