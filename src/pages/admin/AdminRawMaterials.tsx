import React, { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Edit3, AlertTriangle, Package, FileDown, AlertCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useToast } from '@/hooks/use-toast';
import { RawMaterial, Supplier } from '@/types/inventory';
import { generateSKU, generateBarcode } from '@/lib/skuGenerator';
import { logAction } from '@/lib/auditLog';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { getDaysUntilExpiry, hasExpired, isExpiringSoon } from '@/lib/expiryUtils';

const AdminRawMaterials: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<RawMaterial | null>(null);
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [damagedMaterial, setDamagedMaterial] = useState<RawMaterial | null>(null);
  const [damagedQuantity, setDamagedQuantity] = useState('');
  const [damagedReason, setDamagedReason] = useState('');
  const [newMaterial, setNewMaterial] = useState({
    name: '',
    unit: 'kg' as const,
    currentStock: 0,
    minimumThreshold: 10,
    reorderPoint: 20,
    costPerUnit: 0,
    preferredSupplierId: '',
    storageLocation: '',
    expiryTracking: false,
    expiryDate: '',
    expiryAlertDays: 30,
    warrantyPeriod: 0,
  });

  // Load materials and suppliers
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.storeId) return;
      const db = getFirestore();

      // Fetch materials
      const materialsRef = collection(db, 'rawMaterials');
      const materialsQuery = query(materialsRef, where('storeId', '==', user.storeId));
      const materialsSnapshot = await getDocs(materialsQuery);
      const materialsList: RawMaterial[] = materialsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as RawMaterial));
      setMaterials(materialsList);

      // Fetch suppliers for dropdown
      const suppliersRef = collection(db, 'suppliers');
      const suppliersQuery = query(suppliersRef, where('storeId', '==', user.storeId));
      const suppliersSnapshot = await getDocs(suppliersQuery);
      const suppliersList: Supplier[] = suppliersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Supplier));
      setSuppliers(suppliersList);
    };
    fetchData();
  }, [user?.storeId]);

  const handleAddMaterial = async () => {
    if (!newMaterial.name || !user?.storeId) {
      toast({ title: "Error", description: "Material name is required", variant: "destructive" });
      return;
    }

    // Validate cost per unit
    if (!newMaterial.costPerUnit || newMaterial.costPerUnit <= 0) {
      toast({ 
        title: "Error", 
        description: "Cost per unit must be greater than zero. Please enter the material cost.", 
        variant: "destructive" 
      });
      return;
    }

    try {
      const db = getFirestore();
      const storePrefix = user.storeId.substring(0, 5).toUpperCase();
      const sku = generateSKU(storePrefix, 'MAT', materials.length + 1);
      const barcode = generateBarcode();

      const materialData = {
        ...newMaterial,
        sku,
        barcode,
        storeId: user.storeId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        warrantyStartDate: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, 'rawMaterials'), materialData);
      setMaterials([...materials, { id: docRef.id, ...materialData }]);

      // Audit log
      await logAction(
        user.id,
        user.name,
        user.role,
        'create',
        'rawMaterial',
        docRef.id,
        { newValue: materialData },
        user.storeId
      );

      // Check if low stock
      if (materialData.currentStock < materialData.minimumThreshold) {
        toast({
          title: "Warning",
          description: `${newMaterial.name} is below minimum threshold!`,
          variant: "destructive"
        });
      }

      setNewMaterial({
        name: '',
        unit: 'kg',
        currentStock: 0,
        minimumThreshold: 10,
        reorderPoint: 20,
        costPerUnit: 0,
        preferredSupplierId: '',
        storageLocation: '',
        expiryTracking: false,
        expiryDate: '',
        expiryAlertDays: 30,
        warrantyPeriod: 0,
      });
      setIsAddingMaterial(false);
      toast({ title: "Success", description: "Material added successfully!" });
    } catch (error) {
      console.error('Error adding material:', error);
      toast({ title: "Error", description: "Failed to add material", variant: "destructive" });
    }
  };

  const handleUpdateMaterial = async () => {
    if (!editingMaterial || !user?.storeId) return;

    // Validate cost per unit
    if (!editingMaterial.costPerUnit || editingMaterial.costPerUnit <= 0) {
      toast({ 
        title: "Error", 
        description: "Cost per unit must be greater than zero. Please enter the material cost.", 
        variant: "destructive" 
      });
      return;
    }

    try {
      const db = getFirestore();
      const materialRef = doc(db, 'rawMaterials', editingMaterial.id);

      const updatedData = {
        ...editingMaterial,
        updatedAt: new Date().toISOString(),
      };

      await updateDoc(materialRef, updatedData);
      setMaterials(materials.map(m => m.id === editingMaterial.id ? updatedData : m));

      // Audit log
      const oldMaterial = materials.find(m => m.id === editingMaterial.id);
      await logAction(
        user.id,
        user.name,
        user.role,
        'update',
        'rawMaterial',
        editingMaterial.id,
        { oldValue: oldMaterial, newValue: updatedData },
        user.storeId
      );

      setEditingMaterial(null);
      toast({ title: "Success", description: "Material updated successfully!" });
    } catch (error) {
      console.error('Error updating material:', error);
      toast({ title: "Error", description: "Failed to update material", variant: "destructive" });
    }
  };

  const handleDeleteMaterial = async (materialId: string) => {
    const deletedMaterial = materials.find(m => m.id === materialId);
    
    // Check if material is used in any recipes
    try {
      const db = getFirestore();
      const recipesRef = collection(db, 'recipes');
      const recipesQuery = query(recipesRef, where('storeId', '==', user?.storeId));
      const recipesSnapshot = await getDocs(recipesQuery);

      type RecipeIngredient = { rawMaterialId?: string };
      type RecipeDoc = { ingredients?: RecipeIngredient[]; name?: string };
      
      const usedInRecipes: string[] = [];
      recipesSnapshot.docs.forEach(doc => {
        const recipe = doc.data() as RecipeDoc;
        if (recipe.ingredients && Array.isArray(recipe.ingredients)) {
          const isUsed = recipe.ingredients.some((ing) => ing.rawMaterialId === materialId);
          if (isUsed) {
            usedInRecipes.push(recipe.name || 'Unknown Recipe');
          }
        }
      });
      
      if (usedInRecipes.length > 0) {
        toast({ 
          title: "Cannot Delete", 
          description: `This material is used in ${usedInRecipes.length} recipe(s): ${usedInRecipes.slice(0, 3).join(', ')}${usedInRecipes.length > 3 ? '...' : ''}`,
          variant: "destructive" 
        });
        return;
      }
    } catch (error) {
      console.error('Error checking material usage:', error);
    }
    
    if (!confirm(`Are you sure you want to delete "${deletedMaterial?.name}"?`)) return;

    try {
      const db = getFirestore();
      
      await deleteDoc(doc(db, 'rawMaterials', materialId));
      
      // Refetch from Firestore to ensure sync
      if (user?.storeId) {
        const materialsRef = collection(db, 'rawMaterials');
        const materialsQuery = query(materialsRef, where('storeId', '==', user.storeId));
        const materialsSnapshot = await getDocs(materialsQuery);
        const materialsList: RawMaterial[] = materialsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as RawMaterial));
        setMaterials(materialsList);
      }

      // Audit log
      if (deletedMaterial && user) {
        await logAction(
          user.id,
          user.name,
          user.role,
          'delete',
          'rawMaterial',
          materialId,
          { oldValue: deletedMaterial },
          user.storeId
        );
      }

      toast({ title: "Success", description: "Material deleted successfully!" });
    } catch (error) {
      console.error('Error deleting material:', error);
      toast({ title: "Error", description: "Failed to delete material", variant: "destructive" });
    }
  };

  const handleDamagedAdjustment = async () => {
    if (!damagedMaterial || !damagedQuantity || !user?.storeId) {
      toast({ 
        title: "Error", 
        description: "Please enter a quantity", 
        variant: "destructive" 
      });
      return;
    }

    const qty = parseFloat(damagedQuantity);
    if (qty <= 0) {
      toast({ 
        title: "Error", 
        description: "Quantity must be greater than 0", 
        variant: "destructive" 
      });
      return;
    }

    if (qty > damagedMaterial.currentStock) {
      toast({ 
        title: "Error", 
        description: `Cannot mark ${qty} as damaged. Current stock is only ${damagedMaterial.currentStock} ${damagedMaterial.unit}`, 
        variant: "destructive" 
      });
      return;
    }

    try {
      const db = getFirestore();
      const newStock = damagedMaterial.currentStock - qty;
      const materialRef = doc(db, 'rawMaterials', damagedMaterial.id);

      await updateDoc(materialRef, {
        currentStock: newStock,
        updatedAt: new Date().toISOString(),
      });

      // Update local state
      setMaterials(materials.map(m => 
        m.id === damagedMaterial.id 
          ? { ...m, currentStock: newStock, updatedAt: new Date().toISOString() }
          : m
      ));

      // Audit log
      await logAction(
        user.id,
        user.name,
        user.role,
        'adjust',
        'rawMaterial',
        damagedMaterial.id,
        { 
          adjustmentType: 'damaged',
          quantity: qty,
          reason: damagedReason || 'Damaged/Wastage',
          oldStock: damagedMaterial.currentStock,
          newStock: newStock
        },
        user.storeId
      );

      toast({
        title: "Success",
        description: `Marked ${qty} ${damagedMaterial.unit} of ${damagedMaterial.name} as damaged. Stock reduced to ${newStock}.`
      });

      // Reset and close
      setDamagedMaterial(null);
      setDamagedQuantity('');
      setDamagedReason('');
    } catch (error) {
      console.error('Error adjusting damaged stock:', error);
      toast({ 
        title: "Error", 
        description: "Failed to adjust stock", 
        variant: "destructive" 
      });
    }
  };

  const filteredMaterials = filterLowStock
    ? materials.filter(m => m.currentStock < m.minimumThreshold)
    : materials;

  const lowStockCount = materials.filter(m => m.currentStock < m.minimumThreshold).length;

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Raw Materials Report', 105, 15, { align: 'center' });
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString()}`, 105, 22, { align: 'center' });

    const tableData = filteredMaterials.map(m => [
      m.name,
      m.sku || '',
      `${m.currentStock} ${m.unit}`,
      `${m.minimumThreshold} ${m.unit}`,
      `$${m.costPerUnit.toFixed(2)}`,
      `$${(m.currentStock * m.costPerUnit).toFixed(2)}`,
      m.storageLocation || '-',
      m.currentStock < m.minimumThreshold ? 'LOW STOCK' : 'OK',
    ]);

    autoTable(doc, {
      startY: 28,
      head: [['Name', 'SKU', 'Stock', 'Min Threshold', 'Cost/Unit', 'Total Value', 'Location', 'Status']],
      body: tableData,
      theme: 'striped',
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [66, 66, 66], textColor: 255, fontStyle: 'bold' },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 7 && data.cell.text[0] === 'LOW STOCK') {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });

    doc.save(`raw_materials_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <AdminPageShell
      title="Raw Materials"
      description="Manage raw materials inventory, suppliers, and stock levels"
      eyebrow="Stock & Catalog"
      backTo="/admin/inventory"
      backLabel="Back to Inventory"
      actions={(
        <>
          <Button variant="outline" onClick={exportToPDF}>
            <FileDown className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
          <Button onClick={() => setIsAddingMaterial(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Material
          </Button>
        </>
      )}
    >
          <Dialog open={isAddingMaterial} onOpenChange={setIsAddingMaterial}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Raw Material</DialogTitle>
                <DialogDescription>Enter material details (SKU & barcode auto-generated)</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Material Name *</Label>
                    <Input
                      id="name"
                      value={newMaterial.name}
                      onChange={(e) => setNewMaterial({ ...newMaterial, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="unit">Unit</Label>
                    <Select
                      value={newMaterial.unit}
                      onValueChange={(value: any) => setNewMaterial({ ...newMaterial, unit: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">Kilogram (kg)</SelectItem>
                        <SelectItem value="gram">Gram (g)</SelectItem>
                        <SelectItem value="liter">Liter (L)</SelectItem>
                        <SelectItem value="ml">Milliliter (mL)</SelectItem>
                        <SelectItem value="piece">Piece</SelectItem>
                        <SelectItem value="meter">Meter (m)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="minimumThreshold">Min Threshold</Label>
                    <Input
                      id="minimumThreshold"
                      type="number"
                      min="0"
                      step="0.01"
                      value={newMaterial.minimumThreshold === 0 ? '' : newMaterial.minimumThreshold}
                      onChange={(e) => setNewMaterial({ ...newMaterial, minimumThreshold: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0) })}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="reorderPoint">Reorder Point</Label>
                    <Input
                      id="reorderPoint"
                      type="number"
                      min="0"
                      step="0.01"
                      value={newMaterial.reorderPoint === 0 ? '' : newMaterial.reorderPoint}
                      onChange={(e) => setNewMaterial({ ...newMaterial, reorderPoint: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0) })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="costPerUnit">Cost Per Unit *</Label>
                    <Input
                      id="costPerUnit"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={newMaterial.costPerUnit === 0 ? '' : newMaterial.costPerUnit}
                      onChange={(e) => setNewMaterial({ ...newMaterial, costPerUnit: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0) })}
                      placeholder="e.g., 2.50"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Required for recipe costing</p>
                  </div>
                  <div>
                    <Label htmlFor="preferredSupplier">Preferred Supplier</Label>
                    <Select
                      value={newMaterial.preferredSupplierId}
                      onValueChange={(value) => setNewMaterial({ ...newMaterial, preferredSupplierId: value })}
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
                </div>
                <div>
                  <Label htmlFor="storageLocation">Storage Location</Label>
                  <Input
                    id="storageLocation"
                    value={newMaterial.storageLocation}
                    onChange={(e) => setNewMaterial({ ...newMaterial, storageLocation: e.target.value })}
                    placeholder="e.g., Warehouse A, Shelf 3"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="expiryTracking"
                    checked={newMaterial.expiryTracking}
                    onCheckedChange={(checked) => setNewMaterial({ ...newMaterial, expiryTracking: checked })}
                  />
                  <Label htmlFor="expiryTracking">Enable Expiry Tracking</Label>
                </div>
                {newMaterial.expiryTracking && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="expiryDate">Expiry Date</Label>
                      <Input
                        id="expiryDate"
                        type="date"
                        value={newMaterial.expiryDate}
                        onChange={(e) => setNewMaterial({ ...newMaterial, expiryDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="expiryAlertDays">Alert Before Expiry (days)</Label>
                      <Input
                        id="expiryAlertDays"
                        type="number"
                        min="1"
                        value={newMaterial.expiryAlertDays === 30 && newMaterial.expiryAlertDays ? newMaterial.expiryAlertDays : (newMaterial.expiryAlertDays || '')}
                        onChange={(e) => setNewMaterial({ ...newMaterial, expiryAlertDays: e.target.value === '' ? 30 : (parseInt(e.target.value) || 30) })}
                        placeholder="30"
                      />
                    </div>
                    <div>
                      <Label htmlFor="warrantyPeriod">Warranty Period (days)</Label>
                      <Input
                        id="warrantyPeriod"
                        type="number"
                        min="0"
                        value={newMaterial.warrantyPeriod === 0 ? '' : newMaterial.warrantyPeriod}
                        onChange={(e) => setNewMaterial({ ...newMaterial, warrantyPeriod: e.target.value === '' ? 0 : (parseInt(e.target.value) || 0) })}
                        placeholder="0"
                      />
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddingMaterial(false)}>Cancel</Button>
                <Button onClick={handleAddMaterial}>Add Material</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        {/* Low Stock Alert */}
        {lowStockCount > 0 && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {lowStockCount} material{lowStockCount > 1 ? 's are' : ' is'} below minimum threshold!
              <Button
                variant="link"
                className="ml-2 p-0 h-auto"
                onClick={() => setFilterLowStock(!filterLowStock)}
              >
                {filterLowStock ? 'Show all' : 'View low stock items'}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Materials List */}
        <div className="grid gap-4">
          {filteredMaterials.length === 0 ? (
            <AdminPanel>
              <CardContent className="py-12 text-center">
                <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500">
                  {filterLowStock ? 'No materials below threshold' : 'No materials yet. Add your first material to get started.'}
                </p>
              </CardContent>
            </AdminPanel>
          ) : (
            filteredMaterials.map((material) => {
              const isLowStock = material.currentStock < material.minimumThreshold;
              const isReorderNeeded = material.currentStock <= material.reorderPoint;
              const supplier = suppliers.find(s => s.id === material.preferredSupplierId);

              return (
                <AdminPanel key={material.id} className={isLowStock ? 'border-red-300' : ''}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {material.name}
                          {isLowStock && (
                            <Badge variant="destructive">Low Stock</Badge>
                          )}
                          {isReorderNeeded && !isLowStock && (
                            <Badge variant="secondary">Reorder</Badge>
                          )}
                          {material.expiryTracking && material.expiryDate && hasExpired(material) && (
                            <Badge variant="destructive">Expired</Badge>
                          )}
                          {material.expiryTracking && material.expiryDate && isExpiringSoon(material) && (
                            <Badge className="bg-orange-500 text-white hover:bg-orange-600">
                              Expires in {getDaysUntilExpiry(material.expiryDate)}d
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription>SKU: {material.sku} | Barcode: {material.barcode}</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingMaterial(material)}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                          onClick={() => setDamagedMaterial(material)}
                        >
                          <AlertCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteMaterial(material.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Current Stock</p>
                        <p className="font-bold text-lg">{material.currentStock} {material.unit}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Min Threshold</p>
                        <p className="font-medium">{material.minimumThreshold} {material.unit}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Cost Per Unit</p>
                        <p className="font-medium">${material.costPerUnit.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Total Value</p>
                        <p className="font-medium">${(material.currentStock * material.costPerUnit).toFixed(2)}</p>
                      </div>
                      {supplier && (
                        <div className="col-span-2">
                          <p className="text-sm text-gray-500">Preferred Supplier</p>
                          <p className="font-medium">{supplier.name}</p>
                        </div>
                      )}
                      {material.storageLocation && (
                        <div className="col-span-2">
                          <p className="text-sm text-gray-500">Storage Location</p>
                          <p className="font-medium">{material.storageLocation}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </AdminPanel>
              );
            })
          )}
        </div>

        {/* Edit Material Dialog */}
        {editingMaterial && (
          <Dialog open={!!editingMaterial} onOpenChange={() => setEditingMaterial(null)}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Raw Material</DialogTitle>
                <DialogDescription>Update material details</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-name">Material Name *</Label>
                    <Input
                      id="edit-name"
                      value={editingMaterial.name}
                      onChange={(e) => setEditingMaterial({ ...editingMaterial, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-unit">Unit</Label>
                    <Select
                      value={editingMaterial.unit}
                      onValueChange={(value: any) => setEditingMaterial({ ...editingMaterial, unit: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">Kilogram (kg)</SelectItem>
                        <SelectItem value="gram">Gram (g)</SelectItem>
                        <SelectItem value="liter">Liter (L)</SelectItem>
                        <SelectItem value="ml">Milliliter (mL)</SelectItem>
                        <SelectItem value="piece">Piece</SelectItem>
                        <SelectItem value="meter">Meter (m)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-minimumThreshold">Min Threshold</Label>
                    <Input
                      id="edit-minimumThreshold"
                      type="number"
                      min="0"
                      step="0.01"
                      value={editingMaterial.minimumThreshold === 0 ? '' : editingMaterial.minimumThreshold}
                      onChange={(e) => setEditingMaterial({ ...editingMaterial, minimumThreshold: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0) })}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-reorderPoint">Reorder Point</Label>
                    <Input
                      id="edit-reorderPoint"
                      type="number"
                      min="0"
                      step="0.01"
                      value={editingMaterial.reorderPoint === 0 ? '' : editingMaterial.reorderPoint}
                      onChange={(e) => setEditingMaterial({ ...editingMaterial, reorderPoint: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0) })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-costPerUnit">Cost Per Unit *</Label>
                    <Input
                      id="edit-costPerUnit"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={editingMaterial.costPerUnit === 0 ? '' : editingMaterial.costPerUnit}
                      onChange={(e) => setEditingMaterial({ ...editingMaterial, costPerUnit: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0) })}
                      placeholder="e.g., 2.50"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Required for recipe costing</p>
                  </div>
                  <div>
                    <Label htmlFor="edit-preferredSupplier">Preferred Supplier</Label>
                    <Select
                      value={editingMaterial.preferredSupplierId || ''}
                      onValueChange={(value) => setEditingMaterial({ ...editingMaterial, preferredSupplierId: value })}
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
                </div>
                <div>
                  <Label htmlFor="edit-storageLocation">Storage Location</Label>
                  <Input
                    id="edit-storageLocation"
                    value={editingMaterial.storageLocation || ''}
                    onChange={(e) => setEditingMaterial({ ...editingMaterial, storageLocation: e.target.value })}
                  />
                </div>
                {/* Expiry Tracking */}
                <div className="flex items-center space-x-2">
                  <Switch
                    id="edit-expiryTracking"
                    checked={!!editingMaterial.expiryTracking}
                    onCheckedChange={(checked) => setEditingMaterial({ ...editingMaterial, expiryTracking: checked })}
                  />
                  <Label htmlFor="edit-expiryTracking">Enable Expiry Tracking</Label>
                </div>
                {editingMaterial.expiryTracking && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit-expiryDate">Expiry Date</Label>
                      <Input
                        id="edit-expiryDate"
                        type="date"
                        value={editingMaterial.expiryDate || ''}
                        onChange={(e) => setEditingMaterial({ ...editingMaterial, expiryDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-expiryAlertDays">Alert Before Expiry (days)</Label>
                      <Input
                        id="edit-expiryAlertDays"
                        type="number"
                        min="1"
                        value={editingMaterial.expiryAlertDays ?? 30}
                        onChange={(e) => setEditingMaterial({ ...editingMaterial, expiryAlertDays: e.target.value === '' ? '' as any : parseInt(e.target.value) })}
                        onBlur={(e) => setEditingMaterial({ ...editingMaterial, expiryAlertDays: parseInt(e.target.value) || 30 })}
                        placeholder="30"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-warrantyPeriod">Warranty Period (days)</Label>
                      <Input
                        id="edit-warrantyPeriod"
                        type="number"
                        min="0"
                        value={editingMaterial.warrantyPeriod === 0 ? '' : (editingMaterial.warrantyPeriod || '')}
                        onChange={(e) => setEditingMaterial({ ...editingMaterial, warrantyPeriod: e.target.value === '' ? 0 : (parseInt(e.target.value) || 0) })}
                        placeholder="0"
                      />
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingMaterial(null)}>Cancel</Button>
                <Button onClick={handleUpdateMaterial}>Update Material</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Damaged Stock Adjustment Dialog */}
        {damagedMaterial && (
          <Dialog open={!!damagedMaterial} onOpenChange={() => setDamagedMaterial(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-orange-600" />
                  Mark as Damaged/Wastage
                </DialogTitle>
                <DialogDescription>
                  {damagedMaterial.name} (Current stock: {damagedMaterial.currentStock} {damagedMaterial.unit})
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="damaged-qty">Quantity to Mark as Damaged *</Label>
                  <Input
                    id="damaged-qty"
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={damagedMaterial.currentStock}
                    value={damagedQuantity}
                    onChange={(e) => setDamagedQuantity(e.target.value)}
                    placeholder={`Max: ${damagedMaterial.currentStock}`}
                  />
                  <p className="text-xs text-gray-500 mt-1">{damagedMaterial.unit}</p>
                </div>
                <div>
                  <Label htmlFor="damaged-reason">Reason (Optional)</Label>
                  <Input
                    id="damaged-reason"
                    value={damagedReason}
                    onChange={(e) => setDamagedReason(e.target.value)}
                    placeholder="e.g., Spoiled, Broken, Expired, Weather damage"
                  />
                </div>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    This will reduce the stock by {damagedQuantity || '0'} {damagedMaterial.unit} and log it as damaged/wastage.
                  </AlertDescription>
                </Alert>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDamagedMaterial(null)}>Cancel</Button>
                <Button onClick={handleDamagedAdjustment} className="bg-orange-600 hover:bg-orange-700">
                  Confirm Damage
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
    </AdminPageShell>
  );
};

export default AdminRawMaterials;
