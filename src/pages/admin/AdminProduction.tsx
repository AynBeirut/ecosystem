import React, { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Factory, Plus, Edit2, Trash2, CheckCircle, Clock, AlertCircle, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ProductionBatch, ProductionBatchStatus, ComposedProduct, RawMaterial, Recipe } from '@/types/inventory';
import { FinishedGoodsItem } from '@/types/finishedGoods';
import { logAction } from '@/lib/auditLog';
import MobileHeader from '@/components/MobileHeader';
import BackButton from '@/components/BackButton';
import { useIsMobile } from '@/hooks/use-mobile';

const STATUS_CONFIG: Record<ProductionBatchStatus, { label: string; color: string; icon: any }> = {
  planned: { label: 'Planned', color: 'bg-blue-100 text-blue-800', icon: Clock },
  in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-800', icon: Factory },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800', icon: AlertCircle },
};

const AdminProduction: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [products, setProducts] = useState<ComposedProduct[]>([]);
  const [isAddingBatch, setIsAddingBatch] = useState(false);
  const [editingBatch, setEditingBatch] = useState<ProductionBatch | null>(null);
  const [filterStatus, setFilterStatus] = useState<ProductionBatchStatus | 'all'>('all');
  const [newBatch, setNewBatch] = useState({
    productId: '',
    quantity: 0,
    scheduledDate: new Date().toISOString().split('T')[0],
    estimatedCompletionDate: '',
    priority: 'normal' as 'low' | 'normal' | 'high' | 'urgent',
    notes: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.storeId) return;
      const db = getFirestore();

      const productsRef = collection(db, 'composedProducts');
      const productsQuery = query(productsRef, where('storeId', '==', user.storeId));
      const productsSnapshot = await getDocs(productsQuery);
      const productsList: ComposedProduct[] = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ComposedProduct));
      setProducts(productsList);

      const batchesRef = collection(db, 'productionBatches');
      const batchesQuery = query(batchesRef, where('storeId', '==', user.storeId));
      const batchesSnapshot = await getDocs(batchesQuery);
      const batchesList: ProductionBatch[] = batchesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ProductionBatch));
      setBatches(batchesList.sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime()));
    };
    fetchData();
  }, [user?.storeId]);

  const handleAddBatch = async () => {
    if (!newBatch.productId || newBatch.quantity <= 0 || !user?.storeId) {
      toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }

    const product = products.find(p => p.id === newBatch.productId);
    if (!product) {
      toast({ title: "Error", description: "Product not found", variant: "destructive" });
      return;
    }

    try {
      const db = getFirestore();
      const batchData = {
        ...newBatch,
        productName: product.name,
        status: 'planned' as ProductionBatchStatus,
        actualQuantity: 0,
        startDate: null,
        completionDate: null,
        assignedStaff: [],
        materialsCost: product.productionCost * newBatch.quantity,
        storeId: user.storeId,
        createdAt: new Date().toISOString(),
        createdBy: user.id,
      };

      const docRef = await addDoc(collection(db, 'productionBatches'), batchData);
      const newBatchObj = { id: docRef.id, ...batchData };
      setBatches([newBatchObj, ...batches]);

      await logAction(
        user.id,
        user.name,
        user.role,
        'create',
        'productionBatch',
        docRef.id,
        { newValue: batchData },
        user.storeId
      );

      setNewBatch({
        productId: '',
        quantity: 0,
        scheduledDate: new Date().toISOString().split('T')[0],
        estimatedCompletionDate: '',
        priority: 'normal',
        notes: '',
      });
      setIsAddingBatch(false);
      toast({ title: "Success", description: "Production batch created successfully!" });
    } catch (error) {
      console.error('Error creating batch:', error);
      toast({ title: "Error", description: "Failed to create batch", variant: "destructive" });
    }
  };

  const handleUpdateBatch = async () => {
    if (!editingBatch || !user?.storeId) return;

    try {
      const db = getFirestore();
      const batchRef = doc(db, 'productionBatches', editingBatch.id);
      const updateData = {
        quantity: editingBatch.quantity,
        scheduledDate: editingBatch.scheduledDate,
        estimatedCompletionDate: editingBatch.estimatedCompletionDate,
        priority: editingBatch.priority,
        status: editingBatch.status,
        actualQuantity: editingBatch.actualQuantity,
        startDate: editingBatch.startDate,
        completionDate: editingBatch.completionDate,
        notes: editingBatch.notes,
      };

      await updateDoc(batchRef, updateData);
      setBatches(batches.map(b => b.id === editingBatch.id ? editingBatch : b));

      await logAction(
        user.id,
        user.name,
        user.role,
        'update',
        'productionBatch',
        editingBatch.id,
        { 
          oldValue: batches.find(b => b.id === editingBatch.id),
          newValue: editingBatch 
        },
        user.storeId
      );

      setEditingBatch(null);
      toast({ title: "Success", description: "Production batch updated successfully!" });
    } catch (error) {
      console.error('Error updating batch:', error);
      toast({ title: "Error", description: "Failed to update batch", variant: "destructive" });
    }
  };

  const handleDeleteBatch = async (batch: ProductionBatch) => {
    if (!confirm(`Delete production batch for "${batch.productName}"?`)) return;
    if (!user?.storeId) return;

    try {
      const db = getFirestore();
      await deleteDoc(doc(db, 'productionBatches', batch.id));
      setBatches(batches.filter(b => b.id !== batch.id));

      await logAction(
        user.id,
        user.name,
        user.role,
        'delete',
        'productionBatch',
        batch.id,
        { oldValue: batch },
        user.storeId
      );

      toast({ title: "Success", description: "Production batch deleted successfully!" });
    } catch (error) {
      console.error('Error deleting batch:', error);
      toast({ title: "Error", description: "Failed to delete batch", variant: "destructive" });
    }
  };

  const handleStartProduction = async (batch: ProductionBatch) => {
    if (!user?.storeId) return;
    try {
      const db = getFirestore();
      const batchRef = doc(db, 'productionBatches', batch.id);
      const updateData = {
        status: 'in_progress' as ProductionBatchStatus,
        startDate: new Date().toISOString(),
      };
      await updateDoc(batchRef, updateData);
      setBatches(batches.map(b => b.id === batch.id ? { ...b, ...updateData } : b));
      toast({ title: "Success", description: "Production started!" });
    } catch (error) {
      console.error('Error starting production:', error);
      toast({ title: "Error", description: "Failed to start production", variant: "destructive" });
    }
  };

  const handleCompleteProduction = async (batch: ProductionBatch) => {
    if (!user?.storeId) return;
    const actualQuantity = prompt(`Enter actual quantity produced (planned: ${batch.quantity}):`, batch.quantity.toString());
    if (!actualQuantity) return;
    
    const actualQty = parseInt(actualQuantity);
    if (actualQty <= 0) {
      toast({ title: "Error", description: "Quantity must be greater than 0", variant: "destructive" });
      return;
    }

    try {
      const db = getFirestore();
      
      // 1. Get the composed product and its recipe
      const composedProductDoc = await getDoc(doc(db, 'composedProducts', batch.productId));
      if (!composedProductDoc.exists()) {
        toast({ title: "Error", description: "Composed product not found", variant: "destructive" });
        return;
      }
      const composedProduct = { id: composedProductDoc.id, ...composedProductDoc.data() } as ComposedProduct;
      
      // 2. Get recipe details
      const recipeDoc = await getDoc(doc(db, 'recipes', composedProduct.recipeId || ''));
      if (!recipeDoc.exists()) {
        toast({ title: "Error", description: "Recipe not found", variant: "destructive" });
        return;
      }
      const recipe = { id: recipeDoc.id, ...recipeDoc.data() } as Recipe;
      
      // 3. Calculate material costs and reduce raw materials stock
      let totalMaterialCost = 0;
      const materialsUsed = [];
      
      for (const ingredient of recipe.ingredients || []) {
        const rawMaterialDoc = await getDoc(doc(db, 'rawMaterials', ingredient.rawMaterialId));
        if (!rawMaterialDoc.exists()) continue;
        
        const rawMaterial = { id: rawMaterialDoc.id, ...rawMaterialDoc.data() } as RawMaterial;
        const quantityNeeded = ingredient.quantity * actualQty;
        const currentStock = rawMaterial.currentStock || 0;
        
        // Check if enough stock
        if (currentStock < quantityNeeded) {
          toast({
            title: "Insufficient Stock",
            description: `Not enough ${rawMaterial.name}. Need: ${quantityNeeded}, Available: ${currentStock}`,
            variant: "destructive"
          });
          return;
        }
        
        // Calculate cost for this material
        const materialCost = (rawMaterial.costPerUnit || 0) * quantityNeeded;
        totalMaterialCost += materialCost;
        
        // Reduce stock
        await updateDoc(doc(db, 'rawMaterials', ingredient.rawMaterialId), {
          currentStock: currentStock - quantityNeeded,
          updatedAt: new Date().toISOString(),
        });
        
        materialsUsed.push({
          materialId: ingredient.rawMaterialId,
          materialName: rawMaterial.name,
          quantityUsed: quantityNeeded,
          unitCost: rawMaterial.costPerUnit || 0,
          totalCost: materialCost,
        });
      }
      
      // 4. Calculate total cost per unit (materials + service cost)
      // Service cost is the difference between recipe totalCost and material costs
      const recipeTotalCost = recipe.totalCost || 0;
      const serviceCost = Math.max(0, recipeTotalCost - (totalMaterialCost / actualQty));
      const totalCostPerUnit = (totalMaterialCost + (serviceCost * actualQty)) / actualQty;
      
      // 5. Update or create finished goods entry
      const fgQuery = query(
        collection(db, 'finishedGoodsInventory'),
        where('storeId', '==', user.storeId),
        where('composedProductId', '==', batch.productId)
      );
      const fgSnapshot = await getDocs(fgQuery);
      
      const batchDetails = {
        batchId: batch.id,
        batchNumber: `BATCH-${batch.id.slice(-6)}`,
        quantity: actualQty,
        costPerUnit: totalCostPerUnit,
        remainingQuantity: actualQty,
        productionDate: new Date().toISOString(),
      };
      
      const transaction = {
        id: `${Date.now()}`,
        date: new Date().toISOString(),
        actionType: 'manufactured' as const,
        quantity: actualQty,
        unitCost: totalCostPerUnit,
        totalCost: totalCostPerUnit * actualQty,
        referenceId: batch.id,
        referenceNumber: `BATCH-${batch.id.slice(-6)}`,
        userId: user.id,
        userName: user.name,
        batchDetails,
      };
      
      if (!fgSnapshot.empty) {
        // Update existing finished goods
        const fgDoc = fgSnapshot.docs[0];
        const fgData = fgDoc.data() as FinishedGoodsItem;
        
        await updateDoc(doc(db, 'finishedGoodsInventory', fgDoc.id), {
          currentBalance: (fgData.currentBalance || 0) + actualQty,
          quantityManufactured: (fgData.quantityManufactured || 0) + actualQty,
          transactions: [...(fgData.transactions || []), transaction],
          batchQueue: [...(fgData.batchQueue || []), batchDetails],
          costPrice: totalCostPerUnit, // Update cost price to latest
          totalValue: ((fgData.currentBalance || 0) + actualQty) * totalCostPerUnit,
          updatedAt: new Date().toISOString(),
        });
      } else {
        // Create new finished goods entry
        const fgCode = `FG-${Date.now().toString().slice(-6)}`;
        const fgData: Omit<FinishedGoodsItem, 'id'> = {
          itemCode: fgCode,
          productId: composedProduct.productId || '',
          composedProductId: batch.productId,
          recipeId: composedProduct.recipeId || '',
          description: composedProduct.name,
          productName: composedProduct.name,
          unit: 'units',
          openingBalance: 0,
          quantityManufactured: actualQty,
          quantitySold: 0,
          quantityAdjusted: 0,
          currentBalance: actualQty,
          costPrice: totalCostPerUnit,
          sellingPrice: composedProduct.sellingPrice || (totalCostPerUnit * 2.5),
          totalValue: actualQty * totalCostPerUnit,
          valuationMethod: 'FIFO',
          transactions: [transaction],
          batchQueue: [batchDetails],
          storeId: user.storeId,
          createdBy: user.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        await addDoc(collection(db, 'finishedGoodsInventory'), fgData);
      }
      
      // 6. Update production batch
      const batchRef = doc(db, 'productionBatches', batch.id);
      const updateData = {
        status: 'completed' as ProductionBatchStatus,
        completionDate: new Date().toISOString(),
        actualQuantity: actualQty,
        materialsCost: totalMaterialCost,
        totalCost: totalMaterialCost + serviceCost,
        costPerUnit: totalCostPerUnit,
      };
      await updateDoc(batchRef, updateData);
      setBatches(batches.map(b => b.id === batch.id ? { ...b, ...updateData } : b));
      
      // Log the action
      await logAction(
        user.id,
        user.name,
        user.role,
        'update',
        'productionBatch',
        batch.id,
        {
          oldValue: { status: 'in_progress' },
          newValue: { status: 'completed', actualQuantity: actualQty, materialsUsed }
        },
        user.storeId
      );
      
      toast({ 
        title: "Production Completed!", 
        description: `${actualQty} units of ${composedProduct.name} manufactured. Cost: $${totalCostPerUnit.toFixed(2)}/unit`,
      });
    } catch (error) {
      console.error('Error completing production:', error);
      toast({ title: "Error", description: "Failed to complete production", variant: "destructive" });
    }
  };

  const getFilteredBatches = () => {
    return batches.filter(batch => filterStatus === 'all' || batch.status === filterStatus);
  };

  const filteredBatches = getFilteredBatches();
  const plannedBatches = batches.filter(b => b.status === 'planned').length;
  const inProgressBatches = batches.filter(b => b.status === 'in_progress').length;
  const completedBatches = batches.filter(b => b.status === 'completed').length;
  const totalPlannedQuantity = batches
    .filter(b => b.status === 'planned' || b.status === 'in_progress')
    .reduce((sum, b) => sum + b.quantity, 0);

  const getPriorityBadge = (priority: string) => {
    const colors = {
      low: 'bg-gray-100 text-gray-800',
      normal: 'bg-blue-100 text-blue-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800',
    };
    return <Badge className={colors[priority as keyof typeof colors]}>{priority.toUpperCase()}</Badge>;
  };

  const ProductionForm = ({ batch, onChange, isEdit = false }: { 
    batch: typeof newBatch | ProductionBatch, 
    onChange: (updates: any) => void,
    isEdit?: boolean 
  }) => (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="productId">Product *</Label>
          <Select
            value={batch.productId}
            onValueChange={(value) => onChange({ productId: value })}
            disabled={isEdit}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select product" />
            </SelectTrigger>
            <SelectContent>
              {products.map(product => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name} (Cost: ${product.productionCost.toFixed(2)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="quantity">Quantity *</Label>
          <Input
            id="quantity"
            type="number"
            min="1"
            value={batch.quantity === 0 ? '' : batch.quantity}
            onChange={(e) => onChange({ quantity: e.target.value === '' ? 0 : (parseInt(e.target.value) || 0) })}
            placeholder="1"
          />
        </div>
        <div>
          <Label htmlFor="priority">Priority</Label>
          <Select
            value={batch.priority}
            onValueChange={(value) => onChange({ priority: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="scheduledDate">Scheduled Date *</Label>
          <Input
            id="scheduledDate"
            type="date"
            value={batch.scheduledDate}
            onChange={(e) => onChange({ scheduledDate: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="estimatedCompletionDate">Est. Completion</Label>
          <Input
            id="estimatedCompletionDate"
            type="date"
            value={batch.estimatedCompletionDate}
            onChange={(e) => onChange({ estimatedCompletionDate: e.target.value })}
          />
        </div>
        {isEdit && (
          <>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={(batch as ProductionBatch).status}
                onValueChange={(value: ProductionBatchStatus) => onChange({ status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="actualQuantity">Actual Quantity</Label>
              <Input
                id="actualQuantity"
                type="number"
                min="0"
                value={(batch as ProductionBatch).actualQuantity === 0 ? '' : (batch as ProductionBatch).actualQuantity}
                onChange={(e) => onChange({ actualQuantity: e.target.value === '' ? 0 : (parseInt(e.target.value) || 0) })}
                placeholder="0"
              />
            </div>
          </>
        )}
        <div className="col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={batch.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder="Production notes..."
            rows={3}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {isMobile ? <MobileHeader title="Production Planning" /> : null}
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {!isMobile && <BackButton />}
            <h1 className="text-2xl font-bold">Production Planning</h1>
          </div>
          <Dialog open={isAddingBatch} onOpenChange={setIsAddingBatch}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Schedule Production
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Schedule Production Batch</DialogTitle>
                <DialogDescription>Create a new production batch</DialogDescription>
              </DialogHeader>
              <ProductionForm
                batch={newBatch}
                onChange={(updates) => setNewBatch({ ...newBatch, ...updates })}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddingBatch(false)}>Cancel</Button>
                <Button onClick={handleAddBatch}>Schedule Batch</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-500" />
                <div>
                  <div className="text-2xl font-bold">{plannedBatches}</div>
                  <p className="text-xs text-gray-500">Planned</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Factory className="h-5 w-5 text-yellow-500" />
                <div>
                  <div className="text-2xl font-bold">{inProgressBatches}</div>
                  <p className="text-xs text-gray-500">In Progress</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <div className="text-2xl font-bold">{completedBatches}</div>
                  <p className="text-xs text-gray-500">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-purple-500" />
                <div>
                  <div className="text-2xl font-bold">{totalPlannedQuantity}</div>
                  <p className="text-xs text-gray-500">Units Scheduled</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-4">
          <Select value={filterStatus} onValueChange={(value: ProductionBatchStatus | 'all') => setFilterStatus(value)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="planned">Planned</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4">
          {filteredBatches.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Factory className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500">No production batches scheduled.</p>
              </CardContent>
            </Card>
          ) : (
            filteredBatches.map((batch) => {
              const statusConfig = STATUS_CONFIG[batch.status];
              const Icon = statusConfig.icon;
              return (
                <Card key={batch.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                          {batch.productName}
                          <Badge className={statusConfig.color}>
                            <Icon className="h-3 w-3 mr-1" />
                            {statusConfig.label}
                          </Badge>
                          {getPriorityBadge(batch.priority)}
                        </CardTitle>
                        <CardDescription>
                          Scheduled: {new Date(batch.scheduledDate).toLocaleDateString()}
                          {batch.estimatedCompletionDate && ` | Est. Completion: ${new Date(batch.estimatedCompletionDate).toLocaleDateString()}`}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {batch.status === 'planned' && (
                          <Button size="sm" onClick={() => handleStartProduction(batch)}>
                            Start
                          </Button>
                        )}
                        {batch.status === 'in_progress' && (
                          <Button size="sm" onClick={() => handleCompleteProduction(batch)}>
                            Complete
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingBatch(batch)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteBatch(batch)}
                          disabled={batch.status === 'in_progress'}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Planned Quantity</p>
                        <p className="font-bold text-lg">{batch.quantity}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Actual Quantity</p>
                        <p className="font-medium">{batch.actualQuantity || '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Materials Cost</p>
                        <p className="font-medium">${batch.materialsCost.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Start Date</p>
                        <p className="font-medium">
                          {batch.startDate ? new Date(batch.startDate).toLocaleDateString() : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Completion Date</p>
                        <p className="font-medium">
                          {batch.completionDate ? new Date(batch.completionDate).toLocaleDateString() : '-'}
                        </p>
                      </div>
                    </div>
                    {batch.notes && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-sm text-gray-600">{batch.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {editingBatch && (
          <Dialog open={!!editingBatch} onOpenChange={() => setEditingBatch(null)}>
            <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Production Batch</DialogTitle>
                <DialogDescription>Update production batch details</DialogDescription>
              </DialogHeader>
              <ProductionForm
                batch={editingBatch}
                onChange={(updates) => setEditingBatch({ ...editingBatch, ...updates })}
                isEdit
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingBatch(null)}>Cancel</Button>
                <Button onClick={handleUpdateBatch}>Update Batch</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </main>
    </div>
  );
};

export default AdminProduction;
