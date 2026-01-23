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
import { Plus, Send, PackageX, CheckCircle, Minus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SupplierReturn, SupplierReturnItem, SupplierCredit, Supplier, RawMaterial, Purchase } from '@/types/inventory';
import { generateSRANumber } from '@/lib/sraGenerator';
import { logAction } from '@/lib/auditLog';
import MobileHeader from '@/components/MobileHeader';
import BackButton from '@/components/BackButton';
import { useIsMobile } from '@/hooks/use-mobile';
import { SUPPLIER_RETURN_REASONS } from '@/constants/supplierReturnReasons';

const AdminSupplierReturns: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [supplierReturns, setSupplierReturns] = useState<SupplierReturn[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isCreatingSRA, setIsCreatingSRA] = useState(false);
  const [newSRA, setNewSRA] = useState({
    supplierId: '',
    purchaseId: '',
    reason: 'defective',
    items: [] as SupplierReturnItem[],
    notes: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.storeId) return;
      const db = getFirestore();

      // Fetch supplier returns
      const sraRef = collection(db, 'supplierReturns');
      const sraQuery = query(sraRef, where('storeId', '==', user.storeId));
      const sraSnapshot = await getDocs(sraQuery);
      const sraList: SupplierReturn[] = sraSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as SupplierReturn));
      setSupplierReturns(sraList.sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime()));

      // Fetch suppliers
      const suppliersRef = collection(db, 'suppliers');
      const suppliersQuery = query(suppliersRef, where('storeId', '==', user.storeId));
      const suppliersSnapshot = await getDocs(suppliersQuery);
      const suppliersList: Supplier[] = suppliersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Supplier));
      setSuppliers(suppliersList);

      // Fetch raw materials
      const materialsRef = collection(db, 'rawMaterials');
      const materialsQuery = query(materialsRef, where('storeId', '==', user.storeId));
      const materialsSnapshot = await getDocs(materialsQuery);
      const materialsList: RawMaterial[] = materialsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as RawMaterial));
      setRawMaterials(materialsList);

      // Fetch purchases
      const purchasesRef = collection(db, 'purchases');
      const purchasesQuery = query(purchasesRef, where('storeId', '==', user.storeId));
      const purchasesSnapshot = await getDocs(purchasesQuery);
      const purchasesList: Purchase[] = purchasesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Purchase));
      setPurchases(purchasesList);
    };
    fetchData();
  }, [user?.storeId]);

  const addItem = () => {
    setNewSRA({
      ...newSRA,
      items: [
        ...newSRA.items,
        { rawMaterialId: '', quantity: 0, unitPrice: 0, reason: 'defective', condition: 'unopened' }
      ]
    });
  };

  const removeItem = (index: number) => {
    setNewSRA({
      ...newSRA,
      items: newSRA.items.filter((_, i) => i !== index)
    });
  };

  const updateItem = (index: number, field: keyof SupplierReturnItem, value: any) => {
    const updated = [...newSRA.items];
    updated[index] = { ...updated[index], [field]: value };
    
    // Auto-fill unit price from material's cost
    if (field === 'rawMaterialId' && value) {
      const material = rawMaterials.find(m => m.id === value);
      if (material) {
        updated[index].unitPrice = material.costPerUnit;
      }
    }
    
    setNewSRA({ ...newSRA, items: updated });
  };

  const calculateTotal = (items: SupplierReturnItem[]): number => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  };

  const handleCreateSRA = async () => {
    if (!newSRA.supplierId || newSRA.items.length === 0 || !user?.storeId) {
      toast({ title: "Error", description: "Supplier and at least one item required", variant: "destructive" });
      return;
    }

    try {
      const db = getFirestore();
      const sraNumber = generateSRANumber(user.storeId, supplierReturns.length + 1);
      const totalAmount = calculateTotal(newSRA.items);

      const sraData = {
        sraNumber,
        supplierId: newSRA.supplierId,
        purchaseId: newSRA.purchaseId || undefined,
        requestDate: new Date().toISOString(),
        reason: newSRA.reason,
        status: 'draft' as const,
        items: newSRA.items,
        totalAmount,
        notes: newSRA.notes,
        storeId: user.storeId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, 'supplierReturns'), sraData);
      setSupplierReturns([{ id: docRef.id, ...sraData }, ...supplierReturns]);

      // Audit log
      await logAction(
        user.id,
        user.name,
        user.role,
        'create',
        'supplierReturn',
        docRef.id,
        { newValue: sraData },
        user.storeId
      );

      setNewSRA({
        supplierId: '',
        purchaseId: '',
        reason: 'defective',
        items: [],
        notes: '',
      });
      setIsCreatingSRA(false);
      toast({ title: "Success", description: `Supplier return ${sraNumber} created!` });
    } catch (error) {
      console.error('Error creating SRA:', error);
      toast({ title: "Error", description: "Failed to create supplier return", variant: "destructive" });
    }
  };

  const handleUpdateStatus = async (sraId: string, newStatus: SupplierReturn['status']) => {
    try {
      const db = getFirestore();
      const sraRef = doc(db, 'supplierReturns', sraId);
      
      const updateData: any = {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      };

      if (newStatus === 'submitted') {
        updateData.submittedDate = new Date().toISOString();
      } else if (newStatus === 'approved') {
        updateData.approvedDate = new Date().toISOString();
      } else if (newStatus === 'shipped') {
        updateData.shippedDate = new Date().toISOString();
      } else if (newStatus === 'received_by_supplier') {
        updateData.receivedBySupplierDate = new Date().toISOString();
      } else if (newStatus === 'credited') {
        updateData.creditedDate = new Date().toISOString();
      }

      await updateDoc(sraRef, updateData);

      setSupplierReturns(supplierReturns.map(sra => 
        sra.id === sraId ? { ...sra, ...updateData } : sra
      ));

      // If shipped, deduct from raw material stock
      if (newStatus === 'shipped') {
        const sra = supplierReturns.find(s => s.id === sraId);
        if (sra) {
          for (const item of sra.items) {
            const material = rawMaterials.find(m => m.id === item.rawMaterialId);
            if (material) {
              const materialRef = doc(db, 'rawMaterials', item.rawMaterialId);
              const newStock = Math.max(0, material.currentStock - item.quantity);
              
              await updateDoc(materialRef, {
                currentStock: newStock,
                updatedAt: new Date().toISOString(),
              });

              setRawMaterials(rawMaterials.map(m => 
                m.id === item.rawMaterialId ? { ...m, currentStock: newStock } : m
              ));
            }
          }
        }
      }

      if (user) {
        await logAction(
          user.id,
          user.name,
          user.role,
          'update',
          'supplierReturn',
          sraId,
          { oldValue: { status: supplierReturns.find(s => s.id === sraId)?.status }, newValue: { status: newStatus } },
          user.storeId
        );
      }

      toast({ title: "Success", description: `Supplier return ${newStatus}!` });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  };

  const getStatusBadge = (status: SupplierReturn['status']) => {
    const variants: Record<SupplierReturn['status'], { variant: any; label: string }> = {
      draft: { variant: 'secondary', label: 'Draft' },
      submitted: { variant: 'default', label: 'Submitted' },
      approved: { variant: 'default', label: 'Approved' },
      shipped: { variant: 'default', label: 'Shipped' },
      received_by_supplier: { variant: 'default', label: 'Received by Supplier' },
      credited: { variant: 'default', label: 'Credited' },
      replaced: { variant: 'default', label: 'Replaced' },
      rejected: { variant: 'destructive', label: 'Rejected' },
      disputed: { variant: 'destructive', label: 'Disputed' },
    };
    return <Badge variant={variants[status].variant}>{variants[status].label}</Badge>;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {isMobile ? <MobileHeader title="Supplier Returns" /> : null}
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {!isMobile && <BackButton />}
            <h1 className="text-2xl font-bold">Supplier Returns (SRA)</h1>
          </div>
          <Dialog open={isCreatingSRA} onOpenChange={setIsCreatingSRA}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Supplier Return
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Supplier Return Authorization</DialogTitle>
                <DialogDescription>Return defective or incorrect materials to supplier</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="supplierId">Supplier *</Label>
                    <Select
                      value={newSRA.supplierId}
                      onValueChange={(value) => setNewSRA({ ...newSRA, supplierId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select supplier" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map(supplier => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="purchaseId">Related Purchase Order</Label>
                    <Select
                      value={newSRA.purchaseId}
                      onValueChange={(value) => setNewSRA({ ...newSRA, purchaseId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select purchase (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {purchases
                          .filter(p => p.supplierId === newSRA.supplierId)
                          .map(purchase => (
                            <SelectItem key={purchase.id} value={purchase.id}>
                              {purchase.poNumber}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="reason">Return Reason</Label>
                  <Select
                    value={newSRA.reason}
                    onValueChange={(value: any) => setNewSRA({ ...newSRA, reason: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPLIER_RETURN_REASONS.map(reason => (
                        <SelectItem key={reason.value} value={reason.value}>
                          {reason.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Items Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Return Items *</Label>
                    <Button type="button" size="sm" onClick={addItem}>
                      <Plus className="h-4 w-4 mr-1" /> Add Item
                    </Button>
                  </div>
                  {newSRA.items.map((item, index) => {
                    const material = rawMaterials.find(m => m.id === item.rawMaterialId);
                    const lineTotal = item.quantity * item.unitPrice;

                    return (
                      <div key={index} className="grid grid-cols-12 gap-2 mb-2 items-end border p-2 rounded">
                        <div className="col-span-4">
                          <Label className="text-xs">Raw Material</Label>
                          <Select
                            value={item.rawMaterialId}
                            onValueChange={(value) => updateItem(index, 'rawMaterialId', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select material" />
                            </SelectTrigger>
                            <SelectContent>
                              {rawMaterials.map(mat => (
                                <SelectItem key={mat.id} value={mat.id}>
                                  {mat.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs">Quantity</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.quantity === 0 ? '' : item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0))}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs">Unit Price</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice === 0 ? '' : item.unitPrice}
                            onChange={(e) => updateItem(index, 'unitPrice', e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0))}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs">Condition</Label>
                          <Select
                            value={item.condition}
                            onValueChange={(value: any) => updateItem(index, 'condition', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unopened">Unopened</SelectItem>
                              <SelectItem value="opened">Opened</SelectItem>
                              <SelectItem value="damaged">Damaged</SelectItem>
                              <SelectItem value="expired">Expired</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-1">
                          <Label className="text-xs">Total</Label>
                          <p className="text-sm font-medium">${lineTotal.toFixed(2)}</p>
                        </div>
                        <div className="col-span-1">
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => removeItem(index)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {newSRA.items.length > 0 && (
                    <div className="mt-2 p-3 bg-gray-100 rounded">
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total Return Value:</span>
                        <span>${calculateTotal(newSRA.items).toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={newSRA.notes}
                    onChange={(e) => setNewSRA({ ...newSRA, notes: e.target.value })}
                    placeholder="Additional details about the return..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreatingSRA(false)}>Cancel</Button>
                <Button onClick={handleCreateSRA}>Create SRA</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Supplier Returns List */}
        <div className="grid gap-4">
          {supplierReturns.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <PackageX className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500">No supplier returns yet.</p>
              </CardContent>
            </Card>
          ) : (
            supplierReturns.map((sra) => {
              const supplier = suppliers.find(s => s.id === sra.supplierId);
              const purchase = purchases.find(p => p.id === sra.purchaseId);

              return (
                <Card key={sra.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          SRA #{sra.sraNumber}
                          {getStatusBadge(sra.status)}
                        </CardTitle>
                        <CardDescription>
                          Supplier: {supplier?.name || 'Unknown'} | 
                          {purchase && ` PO: ${purchase.poNumber} |`} 
                          {' '}Requested: {new Date(sra.requestDate).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {sra.status === 'draft' && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleUpdateStatus(sra.id, 'submitted')}
                          >
                            <Send className="h-4 w-4 mr-1" />
                            Submit to Supplier
                          </Button>
                        )}
                        {sra.status === 'submitted' && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleUpdateStatus(sra.id, 'approved')}
                          >
                            Mark Approved
                          </Button>
                        )}
                        {sra.status === 'approved' && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleUpdateStatus(sra.id, 'shipped')}
                          >
                            Mark Shipped
                          </Button>
                        )}
                        {sra.status === 'shipped' && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleUpdateStatus(sra.id, 'received_by_supplier')}
                          >
                            Confirm Receipt
                          </Button>
                        )}
                        {sra.status === 'received_by_supplier' && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleUpdateStatus(sra.id, 'credited')}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Mark Credited
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-500">Return Value</p>
                        <p className="font-bold text-lg">${sra.totalAmount.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Items</p>
                        <p className="font-medium">{sra.items.length} item(s)</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Reason</p>
                        <p className="font-medium">{SUPPLIER_RETURN_REASONS.find(r => r.value === sra.reason)?.label || sra.reason}</p>
                      </div>
                      {sra.creditedDate && (
                        <div>
                          <p className="text-sm text-gray-500">Credited Date</p>
                          <p className="font-medium">{new Date(sra.creditedDate).toLocaleDateString()}</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Return Items */}
                    <div className="border-t pt-3">
                      <p className="text-sm font-semibold mb-2">Return Items:</p>
                      <div className="space-y-1">
                        {sra.items.map((item, idx) => {
                          const material = rawMaterials.find(m => m.id === item.rawMaterialId);
                          return (
                            <div key={idx} className="text-sm flex justify-between">
                              <span>
                                {material?.name || 'Unknown'}: {item.quantity} {material?.unit} 
                                ({item.condition})
                              </span>
                              <span className="font-medium">${(item.quantity * item.unitPrice).toFixed(2)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {sra.notes && (
                      <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
                        <span className="font-semibold">Notes:</span> {sra.notes}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminSupplierReturns;
