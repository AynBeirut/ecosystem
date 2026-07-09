import React, { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Edit3, Phone, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Supplier } from '@/types/inventory';
import { logAction } from '@/lib/auditLog';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';

const AdminSuppliers: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    paymentTerms: 'net_30' as const,
    taxId: '',
    bankDetails: '',
    notes: '',
    status: 'active' as const,
  });

  // Load suppliers from Firestore
  useEffect(() => {
    const fetchSuppliers = async () => {
      if (!user?.storeId) return;
      const db = getFirestore();
      const suppliersRef = collection(db, 'suppliers');
      const q = query(suppliersRef, where('storeId', '==', user.storeId));
      const snapshot = await getDocs(q);
      const suppliersList: Supplier[] = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as Supplier));
      setSuppliers(suppliersList);
    };
    fetchSuppliers();
  }, [user?.storeId]);

  const generateSupplierCode = (name: string, sequence: number): string => {
    const prefix = name.substring(0, 3).toUpperCase();
    return `SUP-${prefix}-${sequence.toString().padStart(4, '0')}`;
  };

  const handleAddSupplier = async () => {
    if (!newSupplier.name || !user?.storeId) {
      toast({ title: "Error", description: "Supplier name is required", variant: "destructive" });
      return;
    }

    try {
      const db = getFirestore();
      const supplierCode = generateSupplierCode(newSupplier.name, suppliers.length + 1);
      
      const supplierData = {
        ...newSupplier,
        supplierCode,
        storeId: user.storeId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, 'suppliers'), supplierData);
      setSuppliers([...suppliers, { id: docRef.id, ...supplierData }]);
      
      // Audit log
      await logAction(
        user.id,
        user.name,
        user.role,
        'create',
        'supplier',
        docRef.id,
        { newValue: supplierData },
        user.storeId
      );

      setNewSupplier({
        name: '',
        contactPerson: '',
        phone: '',
        email: '',
        address: '',
        paymentTerms: 'net_30',
        taxId: '',
        bankDetails: '',
        notes: '',
        status: 'active',
      });
      setIsAddingSupplier(false);
      toast({ title: "Success", description: "Supplier added successfully!" });
    } catch (error) {
      console.error('Error adding supplier:', error);
      toast({ title: "Error", description: "Failed to add supplier", variant: "destructive" });
    }
  };

  const handleUpdateSupplier = async () => {
    if (!editingSupplier || !user?.storeId) return;

    try {
      const db = getFirestore();
      const supplierRef = doc(db, 'suppliers', editingSupplier.id);
      
      const updatedData = {
        ...editingSupplier,
        updatedAt: new Date().toISOString(),
      };

      await updateDoc(supplierRef, updatedData);
      setSuppliers(suppliers.map(s => s.id === editingSupplier.id ? updatedData : s));
      
      // Audit log
      const oldSupplier = suppliers.find(s => s.id === editingSupplier.id);
      await logAction(
        user.id,
        user.name,
        user.role,
        'update',
        'supplier',
        editingSupplier.id,
        { oldValue: oldSupplier, newValue: updatedData },
        user.storeId
      );

      setEditingSupplier(null);
      toast({ title: "Success", description: "Supplier updated successfully!" });
    } catch (error) {
      console.error('Error updating supplier:', error);
      toast({ title: "Error", description: "Failed to update supplier", variant: "destructive" });
    }
  };

  const handleDeleteSupplier = async (supplierId: string) => {
    if (!confirm('Are you sure you want to delete this supplier?')) return;

    try {
      const db = getFirestore();
      await deleteDoc(doc(db, 'suppliers', supplierId));
      const deletedSupplier = suppliers.find(s => s.id === supplierId);
      setSuppliers(suppliers.filter(s => s.id !== supplierId));
      
      // Audit log
      if (deletedSupplier && user) {
        await logAction(
          user.id,
          user.name,
          user.role,
          'delete',
          'supplier',
          supplierId,
          { oldValue: deletedSupplier },
          user.storeId
        );
      }

      toast({ title: "Success", description: "Supplier deleted successfully!" });
    } catch (error) {
      console.error('Error deleting supplier:', error);
      toast({ title: "Error", description: "Failed to delete supplier", variant: "destructive" });
    }
  };

  return (
    <AdminPageShell
      title="Supplier Management"
      description="Manage your suppliers and their details."
      backTo="/admin/inventory"
      backLabel="Inventory"
      actions={
        <Button onClick={() => setIsAddingSupplier(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Supplier
        </Button>
      }
    >
      <Dialog open={isAddingSupplier} onOpenChange={setIsAddingSupplier}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Supplier</DialogTitle>
            <DialogDescription>Enter supplier details below</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Supplier Name *</Label>
                <Input
                  id="name"
                  value={newSupplier.name}
                  onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="contactPerson">Contact Person</Label>
                <Input
                  id="contactPerson"
                  value={newSupplier.contactPerson}
                  onChange={(e) => setNewSupplier({ ...newSupplier, contactPerson: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={newSupplier.phone}
                  onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newSupplier.email}
                  onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={newSupplier.address}
                onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="paymentTerms">Payment Terms</Label>
                <Select
                  value={newSupplier.paymentTerms}
                  onValueChange={(value: any) => setNewSupplier({ ...newSupplier, paymentTerms: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="net_30">Net 30 Days</SelectItem>
                    <SelectItem value="net_60">Net 60 Days</SelectItem>
                    <SelectItem value="net_90">Net 90 Days</SelectItem>
                    <SelectItem value="cod">Cash on Delivery</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="taxId">Tax ID</Label>
                <Input
                  id="taxId"
                  value={newSupplier.taxId}
                  onChange={(e) => setNewSupplier({ ...newSupplier, taxId: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="bankDetails">Bank Details</Label>
              <Textarea
                id="bankDetails"
                value={newSupplier.bankDetails}
                onChange={(e) => setNewSupplier({ ...newSupplier, bankDetails: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={newSupplier.notes}
                onChange={(e) => setNewSupplier({ ...newSupplier, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingSupplier(false)}>Cancel</Button>
            <Button onClick={handleAddSupplier}>Add Supplier</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suppliers List */}
      <div className="grid gap-4">
        {suppliers.length === 0 ? (
          <AdminPanel>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">No suppliers yet. Add your first supplier to get started.</p>
            </CardContent>
          </AdminPanel>
        ) : (
          suppliers.map((supplier) => (
            <AdminPanel key={supplier.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {supplier.name}
                      <Badge variant={supplier.status === 'active' ? 'default' : 'secondary'}>
                        {supplier.status}
                      </Badge>
                    </CardTitle>
                    <CardDescription>{supplier.supplierCode}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingSupplier(supplier)}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteSupplier(supplier.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {supplier.contactPerson && (
                    <div>
                      <p className="text-sm text-gray-500">Contact Person</p>
                      <p className="font-medium">{supplier.contactPerson}</p>
                    </div>
                  )}
                  {supplier.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span>{supplier.phone}</span>
                    </div>
                  )}
                  {supplier.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span>{supplier.email}</span>
                    </div>
                  )}
                  {supplier.paymentTerms && (
                    <div>
                      <p className="text-sm text-gray-500">Payment Terms</p>
                      <p className="font-medium capitalize">{supplier.paymentTerms.replace('_', ' ')}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </AdminPanel>
          ))
        )}
      </div>

      {/* Edit Supplier Dialog */}
      {editingSupplier && (
        <Dialog open={!!editingSupplier} onOpenChange={() => setEditingSupplier(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Supplier</DialogTitle>
              <DialogDescription>Update supplier details</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-name">Supplier Name *</Label>
                  <Input
                    id="edit-name"
                    value={editingSupplier.name}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-contactPerson">Contact Person</Label>
                  <Input
                    id="edit-contactPerson"
                    value={editingSupplier.contactPerson || ''}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, contactPerson: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input
                    id="edit-phone"
                    type="tel"
                    value={editingSupplier.phone || ''}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, phone: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editingSupplier.email || ''}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, email: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-address">Address</Label>
              <Textarea
                id="edit-address"
                value={editingSupplier.address || ''}
                onChange={(e) => setEditingSupplier({ ...editingSupplier, address: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-paymentTerms">Payment Terms</Label>
                <Select
                  value={editingSupplier.paymentTerms}
                  onValueChange={(value: any) => setEditingSupplier({ ...editingSupplier, paymentTerms: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="net_30">Net 30 Days</SelectItem>
                    <SelectItem value="net_60">Net 60 Days</SelectItem>
                    <SelectItem value="net_90">Net 90 Days</SelectItem>
                    <SelectItem value="cod">Cash on Delivery</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-status">Status</Label>
                <Select
                  value={editingSupplier.status}
                  onValueChange={(value: any) => setEditingSupplier({ ...editingSupplier, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSupplier(null)}>Cancel</Button>
            <Button onClick={handleUpdateSupplier}>Update Supplier</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}
    </AdminPageShell>
  );
};

export default AdminSuppliers;
