import React, { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Plus, Edit3, ShoppingCart, Minus, CheckCircle, XCircle, Download, Share2, Printer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Purchase, PurchaseItem, Supplier, RawMaterial } from '@/types/inventory';
import { logAction } from '@/lib/auditLog';
import MobileHeader from '@/components/MobileHeader';
import BackButton from '@/components/BackButton';
import { useIsMobile } from '@/hooks/use-mobile';

const AdminPurchases: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [isAddingPurchase, setIsAddingPurchase] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [receivingPurchase, setReceivingPurchase] = useState<Purchase | null>(null);
  const [newPurchase, setNewPurchase] = useState({
    supplierId: '',
    supplierName: '',
    supplierContact: '',
    supplierEmail: '',
    expectedDeliveryDate: '',
    notes: '',
    items: [] as PurchaseItem[],
  });

  const [isCreatingNewSupplier, setIsCreatingNewSupplier] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.storeId) return;
      const db = getFirestore();

      // Fetch purchases
      const purchasesRef = collection(db, 'purchases');
      const purchasesQuery = query(purchasesRef, where('storeId', '==', user.storeId));
      const purchasesSnapshot = await getDocs(purchasesQuery);
      const purchasesList: Purchase[] = purchasesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Purchase));
      setPurchases(purchasesList.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()));

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
    };
    fetchData();
  }, [user?.storeId]);

  const generatePONumber = (): string => {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const seq = (purchases.length + 1).toString().padStart(4, '0');
    return `PO-${year}${month}-${seq}`;
  };

  const calculateTotal = (items: PurchaseItem[]): number => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  };

  const handleCreateInlineSupplier = async () => {
    if (!newPurchase.supplierName || !newPurchase.supplierContact || !user?.storeId) {
      toast({ title: "Error", description: "Supplier name and contact are required", variant: "destructive" });
      return;
    }

    try {
      const db = getFirestore();
      const supplierData = {
        storeId: user.storeId,
        name: newPurchase.supplierName,
        contactPerson: newPurchase.supplierContact,
        email: newPurchase.supplierEmail || '',
        phone: '',
        address: '',
        createdAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, 'suppliers'), supplierData);
      const newSupplier = { id: docRef.id, ...supplierData };
      setSuppliers([...suppliers, newSupplier]);
      setNewPurchase({ ...newPurchase, supplierId: docRef.id });
      setIsCreatingNewSupplier(false);
      toast({ title: "Success", description: "Supplier created successfully" });
    } catch (error) {
      console.error('Error creating supplier:', error);
      toast({ title: "Error", description: "Failed to create supplier", variant: "destructive" });
    }
  };

  const generatePOHTML = (purchase: Purchase) => {
    const supplier = suppliers.find(s => s.id === purchase.supplierId);
    const itemsHtml = purchase.items?.map(item => {
      const material = rawMaterials.find(m => m.id === item.rawMaterialId);
      const lineTotal = item.quantity * item.unitPrice;
      return `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${material?.name || 'Material'}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${item.unitPrice.toFixed(2)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${lineTotal.toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Purchase Order ${purchase.poNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; }
          .header { text-align: center; margin-bottom: 30px; }
          .header h1 { margin: 0; color: #333; }
          .po-info { margin-bottom: 30px; }
          .po-info div { margin: 5px 0; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { background: #f8f9fa; padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6; }
          .totals { margin-top: 20px; text-align: right; }
          .grand-total { font-size: 18px; font-weight: bold; color: #2563eb; margin-top: 10px; padding-top: 10px; border-top: 2px solid #333; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>PURCHASE ORDER</h1>
          <p>PO #${purchase.poNumber}</p>
          <p>Date: ${new Date(purchase.orderDate || '').toLocaleDateString()}</p>
        </div>
        
        <div class="po-info">
          <strong>Supplier:</strong><br/>
          ${supplier?.name || 'N/A'}<br/>
          ${supplier?.contactPerson || ''}<br/>
          ${supplier?.email || ''}<br/>
          ${purchase.expectedDeliveryDate ? `<br/><strong>Expected Delivery:</strong> ${new Date(purchase.expectedDeliveryDate).toLocaleDateString()}` : ''}
        </div>

        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th style="text-align: center;">Quantity</th>
              <th style="text-align: right;">Unit Price</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="totals">
          <div class="grand-total">Total: $${(purchase.totalCost || 0).toFixed(2)}</div>
        </div>

        ${purchase.notes ? `<div style="margin-top: 30px;"><strong>Notes:</strong><br/>${purchase.notes}</div>` : ''}
      </body>
      </html>
    `;
  };

  const handleDownloadPO = (purchase: Purchase) => {
    const html = generatePOHTML(purchase);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PO-${purchase.poNumber}.html`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "Success", description: "Purchase order downloaded" });
  };

  const handleSharePO = async (purchase: Purchase) => {
    const supplier = suppliers.find(s => s.id === purchase.supplierId);
    const html = generatePOHTML(purchase);
    const poText = `Purchase Order ${purchase.poNumber}\nSupplier: ${supplier?.name}\nTotal: $${(purchase.totalCost || 0).toFixed(2)}`;
    
    if (navigator.share && isMobile) {
      try {
        const blob = new Blob([html], { type: 'text/html' });
        const file = new File([blob], `PO-${purchase.poNumber}.html`, { type: 'text/html' });
        
        await navigator.share({
          title: `Purchase Order ${purchase.poNumber}`,
          text: poText,
          files: [file]
        });
        toast({ title: "Success", description: "Purchase order shared" });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(poText)}`;
          window.open(whatsappUrl, '_blank');
        }
      }
    } else {
      navigator.clipboard.writeText(poText);
      toast({ title: "Copied", description: "Purchase order details copied to clipboard" });
    }
  };

  const handlePrintPO = (purchase: Purchase) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(generatePOHTML(purchase));
    printWindow.document.close();
    printWindow.print();
  };

  const addItem = () => {
    setNewPurchase({
      ...newPurchase,
      items: [
        ...newPurchase.items,
        { rawMaterialId: '', quantity: 0, unitPrice: 0, receivedQuantity: 0 }
      ]
    });
  };

  const removeItem = (index: number) => {
    setNewPurchase({
      ...newPurchase,
      items: newPurchase.items.filter((_, i) => i !== index)
    });
  };

  const updateItem = (index: number, field: keyof PurchaseItem, value: any) => {
    const updated = [...newPurchase.items];
    updated[index] = { ...updated[index], [field]: value };
    
    // Auto-fill unit price from material's cost
    if (field === 'rawMaterialId' && value) {
      const material = rawMaterials.find(m => m.id === value);
      if (material) {
        updated[index].unitPrice = material.costPerUnit;
      }
    }
    
    setNewPurchase({ ...newPurchase, items: updated });
  };

  const handleAddPurchase = async () => {
    if (!newPurchase.supplierId || newPurchase.items.length === 0 || !user?.storeId) {
      toast({ title: "Error", description: "Supplier and at least one item required", variant: "destructive" });
      return;
    }

    try {
      const db = getFirestore();
      const poNumber = generatePONumber();
      const totalAmount = calculateTotal(newPurchase.items);

      const purchaseData = {
        poNumber,
        supplierId: newPurchase.supplierId,
        orderDate: new Date().toISOString(),
        expectedDeliveryDate: newPurchase.expectedDeliveryDate,
        status: 'draft' as const,
        items: newPurchase.items,
        totalAmount,
        notes: newPurchase.notes,
        storeId: user.storeId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, 'purchases'), purchaseData);
      setPurchases([{ id: docRef.id, ...purchaseData }, ...purchases]);

      // Audit log
      await logAction(
        user.id,
        user.name,
        user.role,
        'create',
        'purchase',
        docRef.id,
        { newValue: purchaseData },
        user.storeId
      );

      setNewPurchase({
        supplierId: '',
        expectedDeliveryDate: '',
        notes: '',
        items: [],
      });
      setIsAddingPurchase(false);
      toast({ title: "Success", description: `Purchase order ${poNumber} created!` });
    } catch (error) {
      console.error('Error adding purchase:', error);
      toast({ title: "Error", description: "Failed to create purchase order", variant: "destructive" });
    }
  };

  const handleUpdateStatus = async (purchaseId: string, newStatus: Purchase['status']) => {
    try {
      const db = getFirestore();
      const purchaseRef = doc(db, 'purchases', purchaseId);
      
      await updateDoc(purchaseRef, {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });

      setPurchases(purchases.map(p => 
        p.id === purchaseId ? { ...p, status: newStatus, updatedAt: new Date().toISOString() } : p
      ));

      if (user) {
        await logAction(
          user.id,
          user.name,
          user.role,
          'update',
          'purchase',
          purchaseId,
          { oldValue: { status: purchases.find(p => p.id === purchaseId)?.status }, newValue: { status: newStatus } },
          user.storeId
        );
      }

      toast({ title: "Success", description: "Purchase order status updated!" });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  };

  const handleReceivePurchase = async () => {
    if (!receivingPurchase || !user?.storeId) return;

    try {
      const db = getFirestore();
      const purchaseRef = doc(db, 'purchases', receivingPurchase.id);

      // Update purchase status and received date
      await updateDoc(purchaseRef, {
        status: 'received',
        receivedDate: new Date().toISOString(),
        items: receivingPurchase.items,
        updatedAt: new Date().toISOString(),
      });

      // Update raw material stock levels
      for (const item of receivingPurchase.items) {
        const material = rawMaterials.find(m => m.id === item.rawMaterialId);
        if (material && item.receivedQuantity > 0) {
          const materialRef = doc(db, 'rawMaterials', item.rawMaterialId);
          const newStock = material.currentStock + item.receivedQuantity;
          
          await updateDoc(materialRef, {
            currentStock: newStock,
            updatedAt: new Date().toISOString(),
          });

          // Update local state
          setRawMaterials(rawMaterials.map(m => 
            m.id === item.rawMaterialId ? { ...m, currentStock: newStock } : m
          ));
        }
      }

      setPurchases(purchases.map(p => 
        p.id === receivingPurchase.id ? { ...receivingPurchase, status: 'received', receivedDate: new Date().toISOString() } : p
      ));

      // Audit log
      await logAction(
        user.id,
        user.name,
        user.role,
        'update',
        'purchase',
        receivingPurchase.id,
        { oldValue: purchases.find(p => p.id === receivingPurchase.id), newValue: receivingPurchase },
        user.storeId
      );

      setReceivingPurchase(null);
      toast({ title: "Success", description: "Purchase order received and stock updated!" });
    } catch (error) {
      console.error('Error receiving purchase:', error);
      toast({ title: "Error", description: "Failed to receive purchase order", variant: "destructive" });
    }
  };

  const handleDeletePurchase = async (purchaseId: string) => {
    const purchase = purchases.find(p => p.id === purchaseId);
    if (purchase?.status === 'received') {
      toast({ title: "Error", description: "Cannot delete received purchase orders", variant: "destructive" });
      return;
    }

    if (!confirm('Are you sure you want to delete this purchase order?')) return;

    try {
      const db = getFirestore();
      await deleteDoc(doc(db, 'purchases', purchaseId));
      const deletedPurchase = purchases.find(p => p.id === purchaseId);
      setPurchases(purchases.filter(p => p.id !== purchaseId));

      if (deletedPurchase && user) {
        await logAction(
          user.id,
          user.name,
          user.role,
          'delete',
          'purchase',
          purchaseId,
          { oldValue: deletedPurchase },
          user.storeId
        );
      }

      toast({ title: "Success", description: "Purchase order deleted!" });
    } catch (error) {
      console.error('Error deleting purchase:', error);
      toast({ title: "Error", description: "Failed to delete purchase order", variant: "destructive" });
    }
  };

  const getStatusBadge = (status: Purchase['status']) => {
    const variants: Record<Purchase['status'], { variant: any; label: string }> = {
      draft: { variant: 'secondary', label: 'Draft' },
      sent: { variant: 'default', label: 'Sent' },
      confirmed: { variant: 'default', label: 'Confirmed' },
      received: { variant: 'default', label: 'Received' },
      cancelled: { variant: 'destructive', label: 'Cancelled' },
    };
    return <Badge variant={variants[status].variant}>{variants[status].label}</Badge>;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {isMobile ? <MobileHeader title="Purchase Orders" /> : null}
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {!isMobile && <BackButton to="/admin/inventory" label="Back to Inventory" />}
            <h1 className="text-2xl font-bold">Purchase Orders</h1>
          </div>
          <Dialog open={isAddingPurchase} onOpenChange={setIsAddingPurchase}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Purchase Order
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Purchase Order</DialogTitle>
                <DialogDescription>Order raw materials from supplier</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="supplierId">Supplier *</Label>
                    <Select
                      value={newPurchase.supplierId}
                      onValueChange={(value) => setNewPurchase({ ...newPurchase, supplierId: value })}
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
                    <Label htmlFor="expectedDeliveryDate">Expected Delivery</Label>
                    <Input
                      id="expectedDeliveryDate"
                      type="date"
                      value={newPurchase.expectedDeliveryDate}
                      onChange={(e) => setNewPurchase({ ...newPurchase, expectedDeliveryDate: e.target.value })}
                    />
                  </div>
                </div>

                {/* Items Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Order Items *</Label>
                    <Button type="button" size="sm" onClick={addItem}>
                      <Plus className="h-4 w-4 mr-1" /> Add Item
                    </Button>
                  </div>
                  {newPurchase.items.map((item, index) => {
                    const material = rawMaterials.find(m => m.id === item.rawMaterialId);
                    const lineTotal = item.quantity * item.unitPrice;

                    return (
                      <div key={index} className="grid grid-cols-12 gap-2 mb-2 items-end">
                        <div className="col-span-5">
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
                                  {mat.name} ({mat.unit})
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
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs">Unit Price</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="col-span-2">
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
                  {newPurchase.items.length > 0 && (
                    <div className="mt-2 p-3 bg-gray-100 rounded">
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total Amount:</span>
                        <span>${calculateTotal(newPurchase.items).toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={newPurchase.notes}
                    onChange={(e) => setNewPurchase({ ...newPurchase, notes: e.target.value })}
                    placeholder="Additional notes or special instructions..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddingPurchase(false)}>Cancel</Button>
                <Button onClick={handleAddPurchase}>Create Purchase Order</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Purchase Orders List */}
        <div className="grid gap-4">
          {purchases.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ShoppingCart className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500">No purchase orders yet. Create your first PO to get started.</p>
              </CardContent>
            </Card>
          ) : (
            purchases.map((purchase) => {
              const supplier = suppliers.find(s => s.id === purchase.supplierId);

              return (
                <Card key={purchase.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {purchase.poNumber}
                          {getStatusBadge(purchase.status)}
                        </CardTitle>
                        <CardDescription>
                          Supplier: {supplier?.name || 'Unknown'} | Order Date: {new Date(purchase.orderDate).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {purchase.status === 'draft' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdateStatus(purchase.id, 'sent')}
                          >
                            Send to Supplier
                          </Button>
                        )}
                        {purchase.status === 'sent' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdateStatus(purchase.id, 'confirmed')}
                          >
                            Mark Confirmed
                          </Button>
                        )}
                        {purchase.status === 'confirmed' && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => setReceivingPurchase({ ...purchase, items: purchase.items.map(i => ({ ...i, receivedQuantity: i.quantity })) })}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Receive Items
                          </Button>
                        )}
                        {purchase.status !== 'received' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpdateStatus(purchase.id, 'cancelled')}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeletePurchase(purchase.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-500">Total Amount</p>
                        <p className="font-bold text-lg">${purchase.totalAmount.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Items</p>
                        <p className="font-medium">{purchase.items.length} item(s)</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Expected Delivery</p>
                        <p className="font-medium">
                          {purchase.expectedDeliveryDate ? new Date(purchase.expectedDeliveryDate).toLocaleDateString() : 'Not set'}
                        </p>
                      </div>
                      {purchase.receivedDate && (
                        <div>
                          <p className="text-sm text-gray-500">Received Date</p>
                          <p className="font-medium">{new Date(purchase.receivedDate).toLocaleDateString()}</p>
                        </div>
                      )}
                    </div>
                    <div className="border-t pt-3">
                      <p className="text-sm font-semibold mb-2">Items:</p>
                      <div className="space-y-1">
                        {purchase.items.map((item, idx) => {
                          const material = rawMaterials.find(m => m.id === item.rawMaterialId);
                          return (
                            <div key={idx} className="text-sm flex justify-between">
                              <span>
                                {material?.name || 'Unknown'}: {item.quantity} {material?.unit} @ ${item.unitPrice}
                                {item.receivedQuantity > 0 && ` (Received: ${item.receivedQuantity})`}
                              </span>
                              <span className="font-medium">${(item.quantity * item.unitPrice).toFixed(2)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {purchase.notes && (
                      <div className="mt-3 p-2 bg-gray-50 rounded text-sm">
                        <span className="font-semibold">Notes:</span> {purchase.notes}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Receive Purchase Dialog */}
        {receivingPurchase && (
          <Dialog open={!!receivingPurchase} onOpenChange={() => setReceivingPurchase(null)}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Receive Purchase Order: {receivingPurchase.poNumber}</DialogTitle>
                <DialogDescription>Enter received quantities to update stock levels</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                {receivingPurchase.items.map((item, index) => {
                  const material = rawMaterials.find(m => m.id === item.rawMaterialId);
                  
                  return (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center border-b pb-2">
                      <div className="col-span-5">
                        <p className="font-medium">{material?.name || 'Unknown'}</p>
                        <p className="text-xs text-gray-500">Current stock: {material?.currentStock} {material?.unit}</p>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Ordered</Label>
                        <p className="font-medium">{item.quantity}</p>
                      </div>
                      <div className="col-span-3">
                        <Label className="text-xs">Received Qty</Label>
                        <Input
                          type="number"
                          min="0"
                          max={item.quantity}
                          step="0.01"
                          value={item.receivedQuantity}
                          onChange={(e) => {
                            const updated = [...receivingPurchase.items];
                            updated[index].receivedQuantity = parseFloat(e.target.value) || 0;
                            setReceivingPurchase({ ...receivingPurchase, items: updated });
                          }}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">New Stock</Label>
                        <p className="font-bold text-green-600">
                          {((material?.currentStock || 0) + item.receivedQuantity).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setReceivingPurchase(null)}>Cancel</Button>
                <Button onClick={handleReceivePurchase}>Receive & Update Stock</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </main>
    </div>
  );
};

export default AdminPurchases;
