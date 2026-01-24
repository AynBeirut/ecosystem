import React, { useState, useEffect } from 'react';
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
import { Undo2, Plus, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Purchase, RawMaterial } from '@/types/inventory';
import { SupplierReturn, SupplierReturnItem, SupplierReturnStatus } from '@/types/supplierReturns';
import { logAction } from '@/lib/auditLog';
import MobileHeader from '@/components/MobileHeader';
import BackButton from '@/components/BackButton';
import { useIsMobile } from '@/hooks/use-mobile';

const SupplierReturns: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  const [returns, setReturns] = useState<SupplierReturn[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [isCreatingReturn, setIsCreatingReturn] = useState(false);
  const [processingReturn, setProcessingReturn] = useState<SupplierReturn | null>(null);
  
  const [newReturn, setNewReturn] = useState({
    purchaseId: '',
    notes: '',
    items: [] as SupplierReturnItem[],
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
    };
    fetchData();
  }, [user?.storeId, toast]);

  const generateReturnNumber = async (): Promise<string> => {
    if (!user?.storeId) return 'RET-001';
    const db = getFirestore();
    const returnsRef = collection(db, 'supplierReturns');
    const q = query(returnsRef, where('storeId', '==', user.storeId));
    const snapshot = await getDocs(q);
    return `RET-${String(snapshot.docs.length + 1).padStart(3, '0')}`;
  };

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

    try {
      const db = getFirestore();
      const purchase = purchases.find(p => p.id === newReturn.purchaseId);
      if (!purchase) return;

      // Get supplier name
      const supplier = suppliers.find(s => s.id === purchase.supplierId);
      const supplierName = supplier?.name || purchase.supplierName || 'Unknown Supplier';

      const returnNumber = await generateReturnNumber();
      const totalAmount = calculateTotal();

      // Build returnData with only defined values
      const returnData: any = {
        sraNumber: returnNumber,
        purchaseOrderId: purchase.id,
        purchaseOrderNumber: purchase.invoiceNumber || purchase.poNumber || purchase.purchaseOrderNumber || 'N/A',
        returnItems: itemsToReturn,
        totalClaimAmount: totalAmount,
        requestDate: new Date().toISOString(),
        status: 'draft',
        returnReason: 'defective_on_arrival',
        claimType: 'defective',
        storeId: user.storeId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        supplierName: supplierName,
      };

      // Only add supplierId if it exists
      if (purchase.supplierId) {
        returnData.supplierId = purchase.supplierId;
      }
      
      if (newReturn.notes) {
        returnData.notes = newReturn.notes;
      }

      // Remove any undefined values from the object recursively
      const cleanObject = (obj: any): any => {
        if (Array.isArray(obj)) {
          return obj.map(item => cleanObject(item));
        }
        if (obj !== null && typeof obj === 'object') {
          const cleaned: any = {};
          for (const key in obj) {
            if (obj[key] !== undefined) {
              cleaned[key] = cleanObject(obj[key]);
            }
          }
          return cleaned;
        }
        return obj;
      };

      const cleanedData = cleanObject(returnData);

      // Debug: Check for undefined values
      console.log('Return data before save:', JSON.stringify(cleanedData, null, 2));
      
      const docRef = await addDoc(collection(db, 'supplierReturns'), cleanedData);
      setReturns([{ id: docRef.id, ...cleanedData }, ...returns]);

      await logAction(user.id, user.name, user.role, 'create', 'supplier_return', docRef.id, { newValue: cleanedData }, user.storeId);

      setNewReturn({ purchaseId: '', notes: '', items: [] });
      setIsCreatingReturn(false);
      toast({ title: "Success", description: `Return ${returnNumber} created successfully!` });
    } catch (error) {
      console.error('Error creating return:', error);
      toast({ title: "Error", description: "Failed to create return", variant: "destructive" });
    }
  };

  const handleProcessReturn = async (returnId: string, newStatus: SupplierReturnStatus, refundMethod?: string, refundAmount?: number) => {
    if (!user?.storeId) return;

    try {
      const db = getFirestore();
      const returnRef = doc(db, 'supplierReturns', returnId);
      const returnDoc = returns.find(r => r.id === returnId);
      if (!returnDoc) return;

      const updateData: any = {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      };

      if (newStatus === 'credited') {
        updateData.creditIssued = refundAmount || returnDoc.totalClaimAmount;
        updateData.creditedDate = new Date().toISOString();

        // Reduce stock levels for returned items
        for (const item of returnDoc.returnItems) {
          const material = rawMaterials.find(m => m.id === item.rawMaterialId);
          if (material) {
            const materialRef = doc(db, 'rawMaterials', item.rawMaterialId);
            const newStock = Math.max(0, material.currentStock - item.quantity);
            await updateDoc(materialRef, {
              currentStock: newStock,
              updatedAt: new Date().toISOString(),
            });
          }
        }

        // Update purchase payment status if refund is processed
        const purchase = purchases.find(p => p.id === returnDoc.purchaseOrderId);
        if (purchase && refundAmount) {
          const purchaseRef = doc(db, 'purchases', returnDoc.purchaseOrderId);
          
          // Calculate amountPaid from paymentHistory if missing
          let currentAmountPaid = purchase.amountPaid || 0;
          if (purchase.paymentHistory && purchase.paymentHistory.length > 0) {
            currentAmountPaid = purchase.paymentHistory.reduce((sum, payment) => sum + (payment.amount || 0), 0);
          }
          
          const newAmountPaid = Math.max(0, currentAmountPaid - refundAmount);
          const totalAmount = purchase.totalAmount || purchase.total || 0;
          
          let paymentStatus: 'unpaid' | 'partial' | 'paid' = 'unpaid';
          if (newAmountPaid >= totalAmount) {
            paymentStatus = 'paid';
          } else if (newAmountPaid > 0) {
            paymentStatus = 'partial';
          }

          await updateDoc(purchaseRef, {
            amountPaid: newAmountPaid,
            paymentStatus,
            status: 'returned',
            updatedAt: new Date().toISOString(),
          });
        }
      }

      await updateDoc(returnRef, updateData);
      setReturns(returns.map(r => r.id === returnId ? { ...r, ...updateData } : r));

      await logAction(user.id, user.name, user.role, 'update', 'supplier_return', returnId, { 
        oldValue: { status: returnDoc.status }, 
        newValue: { status: newStatus, ...updateData } 
      }, user.storeId);

      // Refresh purchases and materials data to show updated values
      if (newStatus === 'credited') {
        const fetchCollection = async (collectionName: string) => {
          const ref = collection(db, collectionName);
          const q = query(ref, where('storeId', '==', user.storeId));
          const snapshot = await getDocs(q);
          return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        };
        
        const [purchasesData, materialsData] = await Promise.all([
          fetchCollection('purchases'),
          fetchCollection('rawMaterials'),
        ]);
        
        setPurchases((purchasesData as Purchase[]).filter(p => p.status === 'received'));
        setRawMaterials(materialsData as RawMaterial[]);
      }

      setProcessingReturn(null);
      toast({ title: "Success", description: `Return ${newStatus}!` });
    } catch (error) {
      console.error('Error processing return:', error);
      toast({ title: "Error", description: "Failed to process return", variant: "destructive" });
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

  const selectedPurchase = purchases.find(p => p.id === newReturn.purchaseId);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {isMobile ? <MobileHeader title="Supplier Returns" /> : null}
      
      <main className="container mx-auto p-4 md:p-6 max-w-7xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
          <BackButton to="/admin/inventory" />
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Supplier Returns (SRA)</h1>
            <p className="text-gray-500 mt-1 text-sm md:text-base">Create and manage returns to suppliers</p>
          </div>
          <Button onClick={() => setIsCreatingReturn(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Create Return
          </Button>
        </div>

        {/* Create Return Dialog */}
        <Dialog open={isCreatingReturn} onOpenChange={setIsCreatingReturn}>
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
                        <Card key={index}>
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
                        </Card>
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
              <Button variant="outline" onClick={() => setIsCreatingReturn(false)}>Cancel</Button>
              <Button onClick={handleCreateReturn} disabled={!newReturn.purchaseId || newReturn.items.filter(i => i.quantity > 0).length === 0}>
                Create Return
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Process Return Dialog */}
        {processingReturn && (
          <Dialog open={!!processingReturn} onOpenChange={() => setProcessingReturn(null)}>
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
                <Button variant="outline" onClick={() => setProcessingReturn(null)}>Cancel</Button>
                <Button variant="destructive" onClick={() => handleProcessReturn(processingReturn.id, 'rejected')}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button onClick={() => handleProcessReturn(processingReturn.id, 'credited', 'cash', processingReturn.totalClaimAmount || 0)}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Complete & Refund
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Returns List */}
        <div className="grid gap-4">
          {returns.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Undo2 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500">No supplier returns yet. Create your first return to get started.</p>
              </CardContent>
            </Card>
          ) : (
            returns.map((returnDoc) => (
              <Card key={returnDoc.id}>
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
                      {returnDoc.returnItems.map((item, idx) => (
                        <div key={idx} className="text-sm p-2 bg-gray-50 rounded mb-1">
                          <div className="flex justify-between">
                            <span>{item.materialName}: {item.quantity} units @ ${item.unitCost.toFixed(2)}</span>
                            <span className="font-semibold">${item.totalCost.toFixed(2)}</span>
                          </div>
                          <p className="text-xs text-gray-600">Reason: {item.reason}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="font-semibold">Total Return Amount:</span>
                      <span className="text-lg font-bold text-red-600">${returnDoc.totalClaimAmount.toFixed(2)}</span>
                    </div>
                    {returnDoc.status === 'credited' && returnDoc.creditedDate && (
                      <div className="p-2 bg-green-50 rounded border border-green-200">
                        <p className="text-sm text-green-800">
                          <strong>Credited:</strong> ${returnDoc.creditIssued?.toFixed(2)} on {new Date(returnDoc.creditedDate).toLocaleDateString()}
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
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default SupplierReturns;
