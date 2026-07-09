import React, { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Plus, CheckCircle, XCircle, PackageOpen, RefreshCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ReturnRequest, ReturnItem, RefundTransaction } from '@/types/returns';
import { Order } from '@/types/order';
import { Product } from '@/types/product';
import { generateRMANumber } from '@/lib/rmaGenerator';
import { logAction } from '@/lib/auditLog';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';

const AdminReturns: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [processingReturn, setProcessingReturn] = useState<ReturnRequest | null>(null);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState(0);

  const getRequestItems = (returnRequest: ReturnRequest): ReturnItem[] => {
    return (returnRequest.items || returnRequest.returnItems || []) as ReturnItem[];
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.storeId) return;
      const db = getFirestore();

      // Fetch returns
      const returnsRef = collection(db, 'returnRequests');
      const returnsQuery = query(returnsRef, where('storeId', '==', user.storeId));
      const returnsSnapshot = await getDocs(returnsQuery);
      const returnsList: ReturnRequest[] = returnsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ReturnRequest));
      setReturns(returnsList.sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime()));

      // Fetch orders
      const ordersRef = collection(db, 'orders');
      const ordersQuery = query(ordersRef, where('storeId', '==', user.storeId));
      const ordersSnapshot = await getDocs(ordersQuery);
      const ordersList: Order[] = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Order));
      setOrders(ordersList);

      // Fetch products
      const productsRef = collection(db, 'products');
      const productsQuery = query(productsRef, where('storeId', '==', user.storeId));
      const productsSnapshot = await getDocs(productsQuery);
      const productsList: Product[] = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Product));
      setProducts(productsList);
    };
    fetchData();
  }, [user?.storeId]);

  const handleUpdateStatus = async (returnId: string, newStatus: ReturnRequest['status']) => {
    try {
      const db = getFirestore();
      const returnRef = doc(db, 'returnRequests', returnId);
      
      const updateData: any = {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      };

      if (newStatus === 'approved') {
        updateData.approvedDate = new Date().toISOString();
      } else if (newStatus === 'received') {
        updateData.receivedDate = new Date().toISOString();
      } else if (newStatus === 'completed') {
        updateData.completedDate = new Date().toISOString();
      }

      await updateDoc(returnRef, updateData);

      setReturns(returns.map(r => 
        r.id === returnId ? { ...r, ...updateData } : r
      ));

      if (user) {
        await logAction(
          user.id,
          user.name,
          user.role,
          'update',
          'returnRequest',
          returnId,
          { oldValue: { status: returns.find(r => r.id === returnId)?.status }, newValue: { status: newStatus } },
          user.storeId
        );
      }

      toast({ title: "Success", description: `Return request ${newStatus}!` });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  };

  const handleProcessRefund = async () => {
    if (!processingReturn || !user?.storeId) return;

    try {
      const db = getFirestore();
      
      // Create refund transaction
      const refundData: Omit<RefundTransaction, 'id'> = {
        returnRequestId: processingReturn.id,
        customerId: processingReturn.customerId,
        amount: refundAmount,
        method: 'store_credit',
        status: 'completed',
        processedBy: user.id,
        processedDate: new Date().toISOString(),
        storeId: user.storeId,
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, 'refundTransactions'), refundData);

      // Update return request
      const returnRef = doc(db, 'returnRequests', processingReturn.id);
      await updateDoc(returnRef, {
        status: 'completed',
        refundAmount,
        refundMethod: 'store_credit',
        completedDate: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setReturns(returns.map(r => 
        r.id === processingReturn.id 
          ? { ...r, status: 'completed', refundAmount, refundMethod: 'store_credit', completedDate: new Date().toISOString() }
          : r
      ));

      // Audit log
      await logAction(
        user.id,
        user.name,
        user.role,
        'update',
        'returnRequest',
        processingReturn.id,
        { newValue: { refundAmount, refundMethod: 'store_credit' } },
        user.storeId
      );

      setProcessingReturn(null);
      setRefundDialogOpen(false);
      toast({ title: "Success", description: `Refund of $${refundAmount.toFixed(2)} processed!` });
    } catch (error) {
      console.error('Error processing refund:', error);
      toast({ title: "Error", description: "Failed to process refund", variant: "destructive" });
    }
  };

  const getStatusBadge = (status: ReturnRequest['status']) => {
    const variants: Record<ReturnRequest['status'], { variant: any; label: string; color: string }> = {
      pending: { variant: 'secondary', label: 'Pending', color: 'text-yellow-600' },
      approved: { variant: 'default', label: 'Approved', color: 'text-blue-600' },
      rejected: { variant: 'destructive', label: 'Rejected', color: 'text-red-600' },
      received: { variant: 'default', label: 'Received', color: 'text-purple-600' },
      completed: { variant: 'default', label: 'Completed', color: 'text-green-600' },
    };
    return <Badge variant={variants[status].variant}>{variants[status].label}</Badge>;
  };

  const getReasonLabel = (reason: string) => {
    const labels: Record<string, string> = {
      defective: 'Defective/Damaged',
      wrong_item: 'Wrong Item Sent',
      not_as_described: 'Not as Described',
      changed_mind: 'Changed Mind',
      size_issue: 'Size/Fit Issue',
      late_delivery: 'Late Delivery',
      other: 'Other',
    };
    return labels[reason] || reason;
  };

  const handleFinalizeExchange = async (returnRequest: ReturnRequest) => {
    try {
      const db = getFirestore();
      const returnRef = doc(db, 'returnRequests', returnRequest.id);
      const now = new Date().toISOString();

      await updateDoc(returnRef, {
        status: 'completed',
        exchangeProcessedDate: now,
        completedDate: now,
        updatedAt: now,
      });

      setReturns((prev) => prev.map((r) => (
        r.id === returnRequest.id
          ? { ...r, status: 'completed', exchangeProcessedDate: now, completedDate: now, updatedAt: now }
          : r
      )));

      if (user) {
        await logAction(
          user.id,
          user.name,
          user.role,
          'update',
          'returnRequest',
          returnRequest.id,
          { newValue: { status: 'completed', exchangeProcessedDate: now } },
          user.storeId
        );
      }

      toast({ title: 'Success', description: 'Exchange finalized successfully!' });
    } catch (error) {
      console.error('Error finalizing exchange:', error);
      toast({ title: 'Error', description: 'Failed to finalize exchange', variant: 'destructive' });
    }
  };

  return (
    <AdminPageShell
      title="Customer Returns (RMA)"
      description="Manage customer return requests and process refunds/exchanges."
      eyebrow="Returns"
      backTo="/admin/dashboard"
      backLabel="Dashboard"
    >
        {/* Returns List */}
        <div className="grid gap-4">
          {returns.length === 0 ? (
            <AdminPanel>
              <CardContent className="py-12 text-center">
                <PackageOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500">No return requests yet.</p>
              </CardContent>
            </AdminPanel>
          ) : (
            returns.map((returnRequest) => {
              const order = orders.find(o => o.id === returnRequest.orderId);

              return (
                <AdminPanel key={returnRequest.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          RMA #{returnRequest.rmaNumber}
                          {getStatusBadge(returnRequest.status)}
                        </CardTitle>
                        <CardDescription>
                          Order: {order?.orderNumber || 'Unknown'} | Requested: {new Date(returnRequest.requestDate).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {returnRequest.status === 'pending' && (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleUpdateStatus(returnRequest.id, 'approved')}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleUpdateStatus(returnRequest.id, 'rejected')}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}
                        {returnRequest.status === 'approved' && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleUpdateStatus(returnRequest.id, 'received')}
                          >
                            Mark as Received
                          </Button>
                        )}
                        {returnRequest.status === 'received' && (
                          returnRequest.requestType === 'exchange' ? (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleFinalizeExchange(returnRequest)}
                            >
                              <RefreshCcw className="h-4 w-4 mr-1" />
                              Finalize Exchange
                            </Button>
                          ) : (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => {
                                const requestItems = getRequestItems(returnRequest);
                                const totalRefund = requestItems.reduce((sum, item) => {
                                  const fallbackPrice = Number((item as any).originalPrice || 0);
                                  const product = products.find(p => p.id === item.productId);
                                  const unitPrice = Number(product?.price || fallbackPrice || 0);
                                  return sum + unitPrice * Number(item.quantity || 0);
                                }, 0);
                                setRefundAmount(totalRefund);
                                setProcessingReturn(returnRequest);
                                setRefundDialogOpen(true);
                              }}
                            >
                              <RefreshCcw className="h-4 w-4 mr-1" />
                              Process Refund
                            </Button>
                          )
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-500">Type</p>
                        <p className="font-medium capitalize">{returnRequest.requestType || 'refund'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Reason</p>
                        <p className="font-medium">{getReasonLabel(returnRequest.reason)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Items</p>
                        <p className="font-medium">{getRequestItems(returnRequest).length} item(s)</p>
                      </div>
                      {returnRequest.approvedDate && (
                        <div>
                          <p className="text-sm text-gray-500">Approved Date</p>
                          <p className="font-medium">{new Date(returnRequest.approvedDate).toLocaleDateString()}</p>
                        </div>
                      )}
                      {returnRequest.refundAmount && (
                        <div>
                          <p className="text-sm text-gray-500">Refund Amount</p>
                          <p className="font-bold text-green-600">${returnRequest.refundAmount.toFixed(2)}</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Return Items */}
                    <div className="border-t pt-3">
                      <p className="text-sm font-semibold mb-2">Return Items:</p>
                      <div className="space-y-2">
                        {getRequestItems(returnRequest).map((item, idx) => {
                          const product = products.find(p => p.id === item.productId);
                          return (
                            <div key={idx} className="p-2 bg-gray-50 rounded">
                              <div className="flex justify-between">
                                <span className="font-medium">{product?.name || 'Unknown Product'}</span>
                                <span>Qty: {item.quantity}</span>
                              </div>
                              <p className="text-xs text-gray-600">Condition: {item.condition}</p>
                              {item.notes && <p className="text-xs text-gray-600 mt-1">Notes: {item.notes}</p>}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {returnRequest.requestType === 'exchange' && (
                      <div className="mt-3 p-3 bg-indigo-50 rounded border border-indigo-200">
                        <p className="text-sm font-semibold text-indigo-900 mb-2">Exchange Summary</p>
                        <div className="space-y-1 text-sm text-indigo-900">
                          <div className="flex justify-between">
                            <span>Returned value</span>
                            <span>${Number(returnRequest.returnTotalAmount || returnRequest.refundAmount || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Exchange value</span>
                            <span>${Number(returnRequest.exchangeTotalAmount || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between font-semibold border-t border-indigo-200 mt-2 pt-2">
                            <span>Net settlement</span>
                            <span>
                              {returnRequest.netSettlementType === 'payable' && `Customer pays $${Number(returnRequest.netAmount || 0).toFixed(2)}`}
                              {returnRequest.netSettlementType === 'refundable' && `Customer gets $${Math.abs(Number(returnRequest.netAmount || 0)).toFixed(2)}`}
                              {(!returnRequest.netSettlementType || returnRequest.netSettlementType === 'even') && 'Even ($0.00)'}
                            </span>
                          </div>
                        </div>

                        {Array.isArray(returnRequest.exchangeItems) && returnRequest.exchangeItems.length > 0 && (
                          <div className="mt-3 space-y-1">
                            <p className="text-xs font-semibold text-indigo-900">Replacement Items:</p>
                            {returnRequest.exchangeItems.map((item, idx) => (
                              <div key={idx} className="text-xs flex justify-between text-indigo-900">
                                <span>{item.productName} × {item.quantity}</span>
                                <span>${Number(item.totalPrice || (item.quantity * item.unitPrice)).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {returnRequest.customerComments && (
                      <div className="mt-3 p-3 bg-blue-50 rounded">
                        <p className="text-xs font-semibold text-gray-600">Customer Comments:</p>
                        <p className="text-sm">{returnRequest.customerComments}</p>
                      </div>
                    )}

                    {returnRequest.internalNotes && (
                      <div className="mt-2 p-3 bg-yellow-50 rounded">
                        <p className="text-xs font-semibold text-gray-600">Internal Notes:</p>
                        <p className="text-sm">{returnRequest.internalNotes}</p>
                      </div>
                    )}
                  </CardContent>
                </AdminPanel>
              );
            })
          )}
        </div>

        {/* Refund Dialog */}
        {processingReturn && (
          <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Process Refund</DialogTitle>
                <DialogDescription>RMA #{processingReturn.rmaNumber}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div>
                  <Label>Calculated Refund Amount</Label>
                  <div className="p-4 bg-gray-100 rounded">
                    {getRequestItems(processingReturn).map((item, idx) => {
                      const product = products.find(p => p.id === item.productId);
                      const fallbackPrice = Number((item as any).originalPrice || 0);
                      const itemTotal = (product?.price || fallbackPrice || 0) * Number(item.quantity || 0);
                      return (
                        <div key={idx} className="flex justify-between text-sm mb-1">
                          <span>{product?.name || (item as any).productName}: {item.quantity} × ${Number(product?.price || fallbackPrice || 0).toFixed(2)}</span>
                          <span className="font-medium">${itemTotal.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <Label htmlFor="refundAmount">Final Refund Amount</Label>
                  <Input
                    id="refundAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={refundAmount === 0 ? '' : refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0))}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label>Refund Method</Label>
                  <Select defaultValue="store_credit">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="store_credit">Store Credit</SelectItem>
                      <SelectItem value="original_payment">Original Payment Method</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRefundDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleProcessRefund}>Process Refund</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

    </AdminPageShell>
  );
};

export default AdminReturns;
