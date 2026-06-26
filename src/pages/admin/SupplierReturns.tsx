import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { useAuth } from '@/context/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Undo2, Plus, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Purchase, RawMaterial } from '@/types/inventory';
import { SupplierReturn, SupplierReturnItem, SupplierReturnStatus } from '@/types/supplierReturns';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';

const API_URL = import.meta.env.VITE_API_URL || 'https://us-central1-market-flow-7b074.cloudfunctions.net/api';

const SupplierReturns: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [returns, setReturns] = useState<SupplierReturn[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [isCreatingReturn, setIsCreatingReturn] = useState(false);
  const [isCreatingReturnSubmitting, setIsCreatingReturnSubmitting] = useState(false);
  const [processingReturn, setProcessingReturn] = useState<SupplierReturn | null>(null);
  const [isProcessingReturnSubmitting, setIsProcessingReturnSubmitting] = useState(false);

  const isCreatingReturnRef = useRef(false);
  const isProcessingReturnRef = useRef(false);
  
  const [newReturn, setNewReturn] = useState({
    purchaseId: '',
    notes: '',
    items: [] as SupplierReturnItem[],
  });

  const fetchData = useCallback(async () => {
    if (!user?.storeId) return;
    const db = getFirestore();

    const fetchCollection = async (collectionName: string) => {
      const ref = collection(db, collectionName);
      const q = query(ref, where('storeId', '==', user.storeId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    };

    try {
      const [returnsData, purchasesData, materialsData, suppliersData] = await Promise.all([
        fetchCollection('supplierReturns'),
        fetchCollection('purchases'),
        fetchCollection('rawMaterials'),
        fetchCollection('suppliers'),
      ]);

      setReturns(returnsData as SupplierReturn[]);
      setPurchases((purchasesData as Purchase[]).filter(p => p.status === 'received'));
      setRawMaterials(materialsData as RawMaterial[]);
      setSuppliers(suppliersData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
    }
  }, [toast, user?.storeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getToken = useCallback(async (): Promise<string> => {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Not authenticated');
    return currentUser.getIdToken();
  }, []);

  const handleSelectPurchase = (purchaseId: string) => {
    const purchase = purchases.find(p => p.id === purchaseId);
    if (!purchase) return;

    const returnItems = purchase.items.map(item => ({
      rawMaterialId: item.rawMaterialId,
      materialName: item.materialName,
      sku: item.sku,
      quantity: 0,
      originalQuantity: item.quantity,
      unitCost: item.unitCost || item.unitPrice || 0,
      totalCost: 0,
      reason: '',
    }));

    setNewReturn({
      ...newReturn,
      purchaseId,
      items: returnItems,
    });
  };

  const handleItemQuantityChange = (index: number, quantity: number) => {
    const items = [...newReturn.items];
    items[index].quantity = quantity;
    items[index].totalCost = quantity * items[index].unitCost;
    setNewReturn({ ...newReturn, items });
  };

  const handleItemReasonChange = (index: number, reason: string) => {
    const items = [...newReturn.items];
    items[index].reason = reason;
    setNewReturn({ ...newReturn, items });
  };

  const calculateTotal = () => {
    return newReturn.items.reduce((sum, item) => sum + item.totalCost, 0);
  };

  const handleCreateReturn = async () => {
    if (isCreatingReturnRef.current) {
      return;
    }

    if (!newReturn.purchaseId || !user?.storeId) {
      toast({ title: "Error", description: "Please select a purchase order", variant: "destructive" });
      return;
    }

    const itemsToReturn = newReturn.items
      .filter(item => item.quantity > 0)
      .map(item => {
        const returnItem: any = {
          rawMaterialId: item.rawMaterialId,
          materialName: item.materialName,
          sku: item.sku,
          quantity: item.quantity,
          unitCost: item.unitCost,
          totalCost: item.totalCost,
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
        toast({ title: "Error", description: `Cannot return more than purchased for ${item.materialName}`, variant: "destructive" });
        return;
      }
    }

    isCreatingReturnRef.current = true;
    setIsCreatingReturnSubmitting(true);

    try {
      const purchase = purchases.find(p => p.id === newReturn.purchaseId);
      if (!purchase) return;

      // Get supplier name
      const supplier = suppliers.find(s => s.id === purchase.supplierId);
      const supplierName = supplier?.name || purchase.supplierName || 'Unknown Supplier';

      const totalAmount = calculateTotal();

      const token = await getToken();
      const response = await fetch(`${API_URL}/supplier-returns/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          storeId: user.storeId,
          supplierId: purchase.supplierId,
          supplierName,
          purchaseOrderId: purchase.id,
          purchaseOrderNumber: purchase.invoiceNumber || purchase.poNumber || purchase.purchaseOrderNumber || 'N/A',
          returnItems: itemsToReturn,
          returnReason: 'defective_on_arrival',
          claimType: 'defective',
          notes: newReturn.notes || undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to create supplier return');
      }

      await logAction(user.id, user.name, user.role, 'create', 'supplier_return', result.id, { newValue: { totalAmount } }, user.storeId);

      await fetchData();

      setNewReturn({ purchaseId: '', notes: '', items: [] });
      setIsCreatingReturn(false);
      toast({ title: "Success", description: `Return ${result.sraNumber || 'created'} created successfully!` });
    } catch (error) {
      console.error('Error creating return:', error);
      toast({ title: "Error", description: "Failed to create return", variant: "destructive" });
    } finally {
      isCreatingReturnRef.current = false;
      setIsCreatingReturnSubmitting(false);
    }
  };

  const handleProcessReturn = async (returnId: string, newStatus: SupplierReturnStatus, refundMethod?: string, refundAmount?: number) => {
    if (isProcessingReturnRef.current) {
      return;
    }

    if (!user?.storeId) return;

    isProcessingReturnRef.current = true;
    setIsProcessingReturnSubmitting(true);

    try {
      const returnDoc = returns.find(r => r.id === returnId);
      if (!returnDoc) return;

      const token = await getToken();

      if (newStatus === 'credited') {
        const creditResponse = await fetch(`${API_URL}/supplier-returns/credit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            returnId,
            creditAmount: refundAmount || returnDoc.totalClaimAmount,
            notes: refundMethod ? `Refund method: ${refundMethod}` : undefined,
            applyToPurchase: true,
          }),
        });

        const creditResult = await creditResponse.json();
        if (!creditResponse.ok || !creditResult.success) {
          throw new Error(creditResult.error || 'Failed to credit supplier return');
        }
      } else if (newStatus === 'shipped') {
        const shipResponse = await fetch(`${API_URL}/supplier-returns/ship`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ returnId }),
        });

        const shipResult = await shipResponse.json();
        if (!shipResponse.ok || !shipResult.success) {
          throw new Error(shipResult.error || 'Failed to ship supplier return');
        }
      } else {
        const statusResponse = await fetch(`${API_URL}/supplier-returns/update-status`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ returnId, status: newStatus }),
        });

        const statusResult = await statusResponse.json();
        if (!statusResponse.ok || !statusResult.success) {
          throw new Error(statusResult.error || 'Failed to update supplier return status');
        }
      }

      await fetchData();

      await logAction(user.id, user.name, user.role, 'update', 'supplier_return', returnId, { 
        oldValue: { status: returnDoc.status }, 
        newValue: { status: newStatus } 
      }, user.storeId);

      setProcessingReturn(null);
      toast({ title: "Success", description: `Return ${newStatus}!` });
    } catch (error) {
      console.error('Error processing return:', error);
      toast({ title: "Error", description: "Failed to process return", variant: "destructive" });
    } finally {
      isProcessingReturnRef.current = false;
      setIsProcessingReturnSubmitting(false);
    }
  };

  const getStatusBadge = (status: SupplierReturnStatus) => {
    const variants: Record<SupplierReturnStatus, string> = {
      draft: 'bg-gray-100 text-gray-800',
      submitted: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      shipped: 'bg-purple-100 text-purple-800',
      received_by_supplier: 'bg-indigo-100 text-indigo-800',
      credited: 'bg-green-100 text-green-800',
      replaced: 'bg-teal-100 text-teal-800',
      rejected: 'bg-red-100 text-red-800',
      disputed: 'bg-orange-100 text-orange-800',
    };
    return <Badge className={variants[status] || 'bg-gray-100 text-gray-800'}>{status.replace(/_/g, ' ').toUpperCase()}</Badge>;
  };

  const getReturnItems = (returnDoc: SupplierReturn): SupplierReturnItem[] => {
    return (returnDoc.returnItems || returnDoc.items || []) as SupplierReturnItem[];
  };

  const selectedPurchase = purchases.find(p => p.id === newReturn.purchaseId);

  return (
    <AdminPageShell
      title="Supplier Returns (SRA)"
      description="Create and manage returns to suppliers"
      eyebrow="Inventory"
      backTo="/admin/dashboard"
      backLabel="Dashboard"
      className="pb-20"
      actions={(
        <Button onClick={() => setIsCreatingReturn(true)}>
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
              <DialogTitle className="text-xl md:text-2xl">Create Supplier Return</DialogTitle>
              <DialogDescription className="text-sm">Select a received purchase order and items to return</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label className="text-sm md:text-base">Purchase Order *</Label>
                <Select value={newReturn.purchaseId} onValueChange={handleSelectPurchase}>
                  <SelectTrigger className="text-sm md:text-base">
                    <SelectValue placeholder="Select purchase order" />
                  </SelectTrigger>
                  <SelectContent>
                    {purchases.map(purchase => {
                      const supplier = suppliers.find(s => s.id === purchase.supplierId);
                      const supplierName = supplier?.name || purchase.supplierName || 'Unknown Supplier';
                      return (
                        <SelectItem key={purchase.id} value={purchase.id} className="text-sm">
                          {purchase.invoiceNumber || purchase.poNumber} - {supplierName} - ${(purchase.totalAmount || purchase.total || 0).toFixed(2)}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {selectedPurchase && newReturn.items.length > 0 && (
                <>
                  <div>
                    <Label className="text-base md:text-lg font-semibold">Items to Return</Label>
                    <div className="space-y-3 mt-2">
                      {newReturn.items.map((item, index) => (
                        <AdminPanel key={index}>
                          <CardContent className="p-3 md:p-4">
                            <div className="space-y-3">
                              <div>
                                <Label className="font-semibold text-sm md:text-base">{item.materialName}</Label>
                                <p className="text-xs md:text-sm text-gray-500">SKU: {item.sku} | Unit Cost: ${item.unitCost.toFixed(2)}</p>
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
                                    placeholder="e.g., Damaged, Wrong item"
                                    className="text-sm"
                                  />
                                </div>
                              </div>
                              <div className="flex justify-between items-center pt-2 border-t">
                                <Label className="text-sm">Subtotal</Label>
                                <p className="text-base md:text-lg font-semibold">${item.totalCost.toFixed(2)}</p>
                              </div>
                            </div>
                          </CardContent>
                        </AdminPanel>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-gray-100 rounded">
                    <div className="flex justify-between text-xl font-bold">
                      <span>Total Return Amount:</span>
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
              <Button onClick={handleCreateReturn} disabled={isCreatingReturnSubmitting || !newReturn.purchaseId || newReturn.items.filter(i => i.quantity > 0).length === 0}>
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
                <DialogTitle>Process Return - {processingReturn.sraNumber}</DialogTitle>
                <DialogDescription>Complete the return and process refund</DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="p-4 bg-gray-100 rounded">
                  <p className="font-semibold">Return Amount: ${(processingReturn.totalClaimAmount || 0).toFixed(2)}</p>
                  <p className="text-sm text-gray-600">Supplier: {processingReturn.supplierName}</p>
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
                      <SelectItem value="credit_note">Credit Note</SelectItem>
                      <SelectItem value="deduct_from_next_order">Deduct from Next Order</SelectItem>
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
                <Button onClick={() => handleProcessReturn(processingReturn.id, 'credited', 'cash', processingReturn.totalClaimAmount || 0)} disabled={isProcessingReturnSubmitting}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {isProcessingReturnSubmitting ? 'Processing...' : 'Complete & Refund'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Returns List */}
        <div className="grid gap-4">
          {returns.length === 0 ? (
            <AdminPanel>
              <CardContent className="py-12 text-center">
                <Undo2 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500">No supplier returns yet. Create your first return to get started.</p>
              </CardContent>
            </AdminPanel>
          ) : (
            returns.map((returnDoc) => (
              <AdminPanel key={returnDoc.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {returnDoc.sraNumber}
                        {getStatusBadge(returnDoc.status)}
                      </CardTitle>
                      <CardDescription>
                        PO: {returnDoc.purchaseOrderNumber} | Supplier: {returnDoc.supplierName} | {new Date(returnDoc.requestDate).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    {returnDoc.status === 'draft' && (
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
                      {getReturnItems(returnDoc).map((item, idx) => {
                        const materialLabel = item.materialName || item.sku || item.rawMaterialId || 'Unknown Material';
                        const unitCost = Number(item.unitCost ?? item.unitPrice ?? 0);
                        const quantity = Number(item.quantity || 0);
                        const lineTotal = Number(item.totalCost ?? (quantity * unitCost));
                        const reasonLabel = item.reason || returnDoc.returnReason || 'Not specified';

                        return (
                        <div key={idx} className="text-sm p-2 bg-gray-50 rounded mb-1">
                          <div className="flex justify-between">
                            <span>{materialLabel}: {quantity} units @ ${unitCost.toFixed(2)}</span>
                            <span className="font-semibold">${lineTotal.toFixed(2)}</span>
                          </div>
                          <p className="text-xs text-gray-600">Reason: {reasonLabel}</p>
                        </div>
                      )})}
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="font-semibold">Total Return Amount:</span>
                      <span className="text-lg font-bold text-red-600">${Number(returnDoc.totalClaimAmount ?? returnDoc.totalAmount ?? 0).toFixed(2)}</span>
                    </div>
                    {returnDoc.status === 'credited' && returnDoc.creditedDate && (
                      <div className="p-2 bg-green-50 rounded border border-green-200">
                        <p className="text-sm text-green-800">
                          <strong>Credited:</strong> ${Number(returnDoc.creditIssued ?? returnDoc.totalClaimAmount ?? returnDoc.totalAmount ?? 0).toFixed(2)} on {new Date(returnDoc.creditedDate).toLocaleDateString()}
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

export default SupplierReturns;
