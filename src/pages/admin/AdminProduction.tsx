import React, { useState, useEffect, useRef } from 'react';
import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, writeBatch, increment, runTransaction } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Factory, Plus, Edit2, Trash2, CheckCircle, Clock, AlertCircle, Package, RefreshCw, Download, FileDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ProductionBatch, ProductionBatchStatus, ComposedProduct, RawMaterial, Recipe } from '@/types/inventory';
import { FinishedGoodsItem } from '@/types/finishedGoods';
import { logAction } from '@/lib/auditLog';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import { useIsMobile } from '@/hooks/use-mobile';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper to clean non-ASCII characters for PDF export
const cleanTextForPDF = (text: string): string => {
  return text.replace(/[^\u0000-\u007F]/g, '?');
};

const STATUS_CONFIG: Record<ProductionBatchStatus, { label: string; color: string; icon: LucideIcon }> = {
  planned: { label: 'Planned', color: 'bg-blue-100 text-blue-800', icon: Clock },
  in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-800', icon: Factory },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800', icon: AlertCircle },
};

const PRODUCTION_COMPLETION_LOCKDOWN = true;
const PRODUCTION_COMPLETION_LOCKDOWN_REASON =
  'Completed production batches are locked to protect raw-material and finished-goods counts.';

// Move ProductionForm outside to prevent re-creation on every render
type ProductionFormBatch = {
  productId: string;
  quantity: number;
  productionDate: string;
  notes?: string;
};

const ProductionForm: React.FC<{ 
  batch: ProductionFormBatch,
  onChange: (updates: Partial<ProductionFormBatch>) => void,
  isEdit?: boolean,
  products: ComposedProduct[]
}> = ({ batch, onChange, isEdit = false, products }) => (
  <div className="grid gap-4">
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2">
        <Label htmlFor="productId">Product *</Label>
        <Select
          value={batch.productId}
          onValueChange={(value) => onChange({ productId: value })}
          disabled={isEdit}
        >
          <SelectTrigger id="productId">
            <SelectValue placeholder="Select product" />
          </SelectTrigger>
          <SelectContent>
            {products.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">
                No composed products found. Create a composed product first.
              </div>
            ) : (
              products.map(product => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name}
                </SelectItem>
              ))
            )}
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
          <SelectTrigger id="priority">
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
        <div className="col-span-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Status and actual quantity are controlled by Start/Complete actions to protect raw-material integrity.
        </div>
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

const AdminProduction: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [products, setProducts] = useState<ComposedProduct[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isAddingBatch, setIsAddingBatch] = useState(false);
  const [editingBatch, setEditingBatch] = useState<ProductionBatch | null>(null);
  const [filterStatus, setFilterStatus] = useState<ProductionBatchStatus | 'all'>('all');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [completingBatch, setCompletingBatch] = useState<ProductionBatch | null>(null);
  const [completionQuantity, setCompletionQuantity] = useState<string>('');
  const [isCompleting, setIsCompleting] = useState(false);
  const isOperatingRef = useRef(false);
  const isAddingBatchRef = useRef(false);
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

      // Fetch composed products directly from products collection
      const productsRef = collection(db, 'products');
      const productsQuery = query(
        productsRef, 
        where('storeId', '==', user.storeId),
        where('productType', '==', 'composed')
      );
      const productsSnapshot = await getDocs(productsQuery);
      
      const productsList: ComposedProduct[] = productsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          productId: doc.id,
          ...data,
          name: data.name || 'Unknown Product'
        } as ComposedProduct;
      }).filter(p => p.recipeId); // Only show products with recipes
      
      console.log('Loaded composed products for production:', productsList);
      setProducts(productsList);

      // Fetch recipes
      const recipesRef = collection(db, 'recipes');
      const recipesQuery = query(recipesRef, where('storeId', '==', user.storeId));
      const recipesSnapshot = await getDocs(recipesQuery);
      const recipesList: Recipe[] = recipesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Recipe));
      setRecipes(recipesList);

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
    if (isAddingBatchRef.current) {
      console.log('⚠️ Add batch operation already in progress');
      return;
    }

    if (!newBatch.productId || newBatch.quantity <= 0 || !user?.storeId) {
      toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }

    const product = products.find(p => p.id === newBatch.productId);
    if (!product) {
      toast({ title: "Error", description: "Product not found", variant: "destructive" });
      return;
    }

    isAddingBatchRef.current = true;
    let operationSucceeded = false;

    try {
      const db = getFirestore();
      const recipe = recipes.find(r => r.id === product.recipeId);
      const costPerUnit = recipe?.costPerUnit || product.costPrice || 0;
      
      const batchData: any = {
        ...newBatch,
        productName: product.name,
        batchNumber: `BATCH-${Date.now().toString().slice(-6)}`,
        composedProductId: newBatch.productId,
        recipeId: product.recipeId || '',
        quantityProduced: 0,
        status: 'planned' as ProductionBatchStatus,
        actualQuantity: 0,
        startDate: null,
        completionDate: null,
        assignedStaff: [],
        materialsCost: costPerUnit * newBatch.quantity,
        totalCost: 0,
        costPerUnit: costPerUnit,
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

      operationSucceeded = true;
      toast({ title: "Success", description: "Production batch created successfully!" });
    } catch (error) {
      console.error('Error creating batch:', error);
      toast({ title: "Error", description: "Failed to create batch", variant: "destructive" });
    } finally {
      isAddingBatchRef.current = false;
      
      if (operationSucceeded) {
        setNewBatch({
          productId: '',
          quantity: 0,
          scheduledDate: new Date().toISOString().split('T')[0],
          estimatedCompletionDate: '',
          priority: 'normal',
          notes: '',
        });
        setIsAddingBatch(false);
      }
    }
  };

  const handleUpdateBatch = async () => {
    if (!editingBatch || !user?.storeId) return;

    if (editingBatch.status === 'completed') {
      toast({
        title: 'Completed batch locked',
        description: 'Delete and recreate, or add a new batch — completed runs cannot be edited in place.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const db = getFirestore();
      const batchRef = doc(db, 'productionBatches', editingBatch.id);
      const updateData = {
        quantity: editingBatch.quantity,
        scheduledDate: editingBatch.scheduledDate,
        estimatedCompletionDate: editingBatch.estimatedCompletionDate,
        priority: editingBatch.priority,
        notes: editingBatch.notes,
      };

      await updateDoc(batchRef, updateData);
      setBatches(batches.map(b => b.id === editingBatch.id ? { ...b, ...updateData } : b));

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

  const handleRecalculateBatchCost = async (batch: ProductionBatch) => {
    if (!user?.storeId) return;
    
    try {
      const db = getFirestore();
      
      // Get the composed product - try both productId and composedProductId
      const productIdToFind = batch.composedProductId || batch.productId;
      const product = products.find(p => p.id === productIdToFind);
      
      if (!product || !product.recipeId) {
        toast({ title: "Error", description: "Product or recipe not found", variant: "destructive" });
        return;
      }
      
      // Get the recipe
      const recipeDoc = await getDoc(doc(db, 'recipes', product.recipeId));
      if (!recipeDoc.exists()) {
        toast({ title: "Error", description: "Recipe not found", variant: "destructive" });
        return;
      }
      const recipe = { id: recipeDoc.id, ...recipeDoc.data() } as any;
      const recipeOutputQty = Number(recipe.outputQuantity || recipe.yieldQuantity || 1);
      const safeRecipeOutputQty = recipeOutputQty > 0 ? recipeOutputQty : 1;
      
      // Support both 'ingredients' and 'materials' field names
      const recipeIngredients = Array.isArray(recipe.ingredients) 
        ? recipe.ingredients 
        : (Array.isArray(recipe.materials) ? recipe.materials : []);
      
      if (recipeIngredients.length === 0) {
        toast({ 
          title: "Error", 
          description: "Recipe has no ingredients. Please edit the recipe to add ingredients.", 
          variant: "destructive" 
        });
        return;
      }
      
      // Get all purchases to find material costs
      const purchasesQuery = query(
        collection(db, 'purchases'),
        where('storeId', '==', user.storeId),
        where('status', '==', 'received')
      );
      const purchasesSnapshot = await getDocs(purchasesQuery);
      
      // Calculate material costs
      let totalMaterialCost = 0;
      const missingMaterials: string[] = [];
      
      for (const ingredient of recipeIngredients) {
        const rawMaterialDoc = await getDoc(doc(db, 'rawMaterials', ingredient.rawMaterialId));
        if (!rawMaterialDoc.exists()) {
          missingMaterials.push(`Unknown material (${ingredient.rawMaterialId})`);
          continue;
        }
        
        const rawMaterial = { id: rawMaterialDoc.id, ...rawMaterialDoc.data() } as RawMaterial;
        let materialCostPerUnit = rawMaterial.costPerUnit || 0;
        
        // If raw material has no cost, try to get it from latest purchase
        if (!materialCostPerUnit || materialCostPerUnit === 0) {
          // Find the most recent purchase with this material
          let latestCost = 0;
          let latestDate = new Date(0);
          
          purchasesSnapshot.forEach(purchaseDoc => {
            const purchase = purchaseDoc.data();
            const purchaseItems = purchase.items || [];
            
            purchaseItems.forEach((item: any) => {
              if (item.rawMaterialId === ingredient.rawMaterialId || 
                  item.materialName === rawMaterial.name) {
                const itemCost = item.unitCost || item.unitPrice || 0;
                const purchaseDate = new Date(purchase.receivedDate || purchase.orderDate);
                
                if (itemCost > 0 && purchaseDate > latestDate) {
                  latestCost = itemCost;
                  latestDate = purchaseDate;
                }
              }
            });
          });
          
          if (latestCost > 0) {
            materialCostPerUnit = latestCost;
            
            // Update the raw material with this cost
            await updateDoc(doc(db, 'rawMaterials', ingredient.rawMaterialId), {
              costPerUnit: latestCost,
              updatedAt: new Date().toISOString(),
            });
          } else {
            missingMaterials.push(rawMaterial.name);
          }
        }
        
        const quantityNeeded = (ingredient.quantity * (batch.actualQuantity || batch.quantity)) / safeRecipeOutputQty;
        const materialCost = materialCostPerUnit * quantityNeeded;
        totalMaterialCost += materialCost;
      }
      
      if (missingMaterials.length > 0) {
        toast({
          title: "Warning",
          description: `Could not find costs for: ${missingMaterials.join(', ')}. Check purchases.`,
          variant: "destructive"
        });
        return;
      }
      
      // Calculate cost per unit (ONLY MATERIAL COSTS)
      const actualQty = batch.actualQuantity || batch.quantity;
      const costPerUnit = totalMaterialCost / actualQty;
      const totalCost = totalMaterialCost; // Only materials, service cost tracked separately
      
      // Update the production batch
      await updateDoc(doc(db, 'productionBatches', batch.id), {
        materialsCost: totalMaterialCost,
        totalCost: totalCost,
        costPerUnit: costPerUnit,
        updatedAt: new Date().toISOString(),
      });
      
      // Update the finished goods if exists
      const fgQuery = query(
        collection(db, 'finishedGoodsInventory'),
        where('storeId', '==', user.storeId),
        where('composedProductId', '==', productIdToFind)
      );
      const fgSnapshot = await getDocs(fgQuery);
      
      if (!fgSnapshot.empty) {
        const fgDoc = fgSnapshot.docs[0];
        const fgData = fgDoc.data();
        await updateDoc(doc(db, 'finishedGoodsInventory', fgDoc.id), {
          costPrice: costPerUnit,
          totalValue: (fgData.currentBalance || 0) * costPerUnit,
          updatedAt: new Date().toISOString(),
        });
      }
      
      await logAction(user.id, user.name, user.role, 'update', 'productionBatch', batch.id, {
        oldValue: { materialsCost: batch.materialsCost },
        newValue: { materialsCost: totalMaterialCost, costPerUnit }
      }, user.storeId);
      
      // Refresh batches
      const batchesRef = collection(db, 'productionBatches');
      const batchesQuery = query(batchesRef, where('storeId', '==', user.storeId));
      const batchesSnapshot = await getDocs(batchesQuery);
      const batchesList: ProductionBatch[] = batchesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ProductionBatch));
      setBatches(batchesList.sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime()));
      
      toast({ 
        title: "Success", 
        description: `Cost calculated from purchases: Materials $${totalMaterialCost.toFixed(2)}, Per Unit $${costPerUnit.toFixed(2)}`
      });
    } catch (error) {
      console.error('Error recalculating cost:', error);
      toast({ title: "Error", description: "Failed to recalculate cost", variant: "destructive" });
    }
  };

  const handleDeleteBatch = async (batch: ProductionBatch) => {
    if (!user?.storeId) return;

    // Enhanced confirmation for completed batches
    const confirmMessage = batch.status === 'completed' 
      ? `Delete completed production batch for "${batch.productName}"?\n\n⚠️ WARNING: This will also reverse the finished goods inventory created by this batch.\n\nActual Quantity: ${batch.actualQuantity || batch.quantity}\nThis action cannot be undone!`
      : `Delete production batch for "${batch.productName}"?`;
    
    if (!confirm(confirmMessage)) return;

    try {
      const db = getFirestore();
      
      // If batch is completed, reverse finished goods and restore raw materials
      if (batch.status === 'completed' && batch.actualQuantity) {
        const nowIso = new Date().toISOString();
        const commitBatch = writeBatch(db);
        let restoredRawMaterialsCount = 0;

        let materialsToRestore = Array.isArray((batch as any).materialsUsed)
          ? ((batch as any).materialsUsed as Array<{ rawMaterialId?: string; quantityUsed?: number }>).map((item) => ({
              rawMaterialId: String(item.rawMaterialId || '').trim(),
              quantityUsed: Number(item.quantityUsed || 0),
            })).filter((item) => item.rawMaterialId.length > 0 && item.quantityUsed > 0)
          : [];

        if (materialsToRestore.length === 0 && batch.recipeId) {
          const recipeSnap = await getDoc(doc(db, 'recipes', batch.recipeId));
          if (recipeSnap.exists()) {
            const recipeData = recipeSnap.data() as any;
            const recipeIngredients = Array.isArray(recipeData.ingredients)
              ? recipeData.ingredients
              : (Array.isArray(recipeData.materials) ? recipeData.materials : []);
            const recipeOutputQty = Number(recipeData.outputQuantity || recipeData.yieldQuantity || 1);
            const safeRecipeOutputQty = recipeOutputQty > 0 ? recipeOutputQty : 1;
            const actualQty = Number(batch.actualQuantity || batch.quantity || 0);

            const aggregatedUsage = new Map<string, number>();
            for (const ingredient of recipeIngredients) {
              const rawMaterialId = String(ingredient?.rawMaterialId || '').trim();
              const ingredientQty = Number(ingredient?.quantity || 0);
              if (!rawMaterialId || ingredientQty <= 0 || actualQty <= 0) continue;

              const quantityUsed = (ingredientQty * actualQty) / safeRecipeOutputQty;
              aggregatedUsage.set(rawMaterialId, Number((aggregatedUsage.get(rawMaterialId) || 0) + quantityUsed));
            }

            materialsToRestore = Array.from(aggregatedUsage.entries()).map(([rawMaterialId, quantityUsed]) => ({
              rawMaterialId,
              quantityUsed,
            }));
          }
        }

        for (const material of materialsToRestore) {
          commitBatch.update(doc(db, 'rawMaterials', material.rawMaterialId), {
            currentStock: increment(material.quantityUsed),
            updatedAt: nowIso,
          });
          restoredRawMaterialsCount += 1;
        }

        const fgQuery = query(
          collection(db, 'finishedGoodsInventory'),
          where('storeId', '==', user.storeId),
          where('productId', '==', batch.productId)
        );
        const fgSnapshot = await getDocs(fgQuery);
        
        if (!fgSnapshot.empty) {
          const fgDoc = fgSnapshot.docs[0];
          const fgData = fgDoc.data();
          
          const newManufactured = Math.max(0, (fgData.quantityManufactured || 0) - batch.actualQuantity);
          const newBalance = Math.max(0, (fgData.currentBalance || 0) - batch.actualQuantity);

          commitBatch.update(fgDoc.ref, {
            quantityManufactured: newManufactured,
            currentBalance: newBalance,
            totalValue: newBalance * (fgData.costPrice || 0),
            updatedAt: nowIso
          });

          // Create reversal transaction
          const fgTxnRef = doc(collection(db, 'finishedGoodsTransactions'));
          commitBatch.set(fgTxnRef, {
            storeId: user.storeId,
            productId: batch.productId,
            productName: batch.productName,
            type: 'production_batch_deletion',
            quantity: -batch.actualQuantity,
            relatedBatchId: batch.id,
            createdAt: nowIso,
            createdBy: user.id,
            createdByName: user.name
          });
          
          console.log('✅ Reversed finished goods:', {
            product: batch.productName,
            quantityReversed: batch.actualQuantity,
            newManufactured,
            newBalance
          });
        }

        commitBatch.delete(doc(db, 'productionBatches', batch.id));
        await commitBatch.commit();

        setBatches(batches.filter(b => b.id !== batch.id));

        await logAction(
          user.id,
          user.name,
          user.role,
          'delete',
          'productionBatch',
          batch.id,
          {
            oldValue: batch,
            reversedFinishedGoods: batch.actualQuantity,
            restoredRawMaterials: restoredRawMaterialsCount,
          },
          user.storeId
        );

        toast({ title: "Success", description: "Production batch deleted, finished goods reversed, and raw materials restored!" });
        return;
      }
      
      // Delete the production batch
      await deleteDoc(doc(db, 'productionBatches', batch.id));
      setBatches(batches.filter(b => b.id !== batch.id));

      await logAction(
        user.id,
        user.name,
        user.role,
        'delete',
        'productionBatch',
        batch.id,
        { 
          oldValue: batch,
          reversedFinishedGoods: batch.status === 'completed' ? batch.actualQuantity : 0
        },
        user.storeId
      );

      const message = batch.status === 'completed'
        ? "Production batch deleted and finished goods reversed!"
        : "Production batch deleted successfully!";
      
      toast({ title: "Success", description: message });
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

    if (PRODUCTION_COMPLETION_LOCKDOWN) {
      toast({
        title: 'Production completion disabled',
        description: PRODUCTION_COMPLETION_LOCKDOWN_REASON,
        variant: 'destructive',
      });
      return;
    }
    
    // Open dialog instead of prompt
    setCompletingBatch(batch);
    setCompletionQuantity(batch.quantity.toString());
  };
  
  const executeCompleteProduction = async () => {
    if (PRODUCTION_COMPLETION_LOCKDOWN) {
      toast({
        title: 'Production completion disabled',
        description: PRODUCTION_COMPLETION_LOCKDOWN_REASON,
        variant: 'destructive',
      });
      return;
    }

    // Synchronous lock to prevent double execution
    if (isOperatingRef.current) {
      console.log('⚠️ Operation already in progress, ignoring click');
      return;
    }
    if (!completingBatch || !user?.storeId || isCompleting) {
      console.log('⚠️ Validation failed:', { completingBatch: !!completingBatch, storeId: !!user?.storeId, isCompleting });
      return;
    }
    
    const actualQty = parseInt(completionQuantity);
    if (!actualQty || actualQty <= 0) {
      toast({ title: "Error", description: "Quantity must be greater than 0", variant: "destructive" });
      return;
    }

    console.log('🔒 Locking operation');
    isOperatingRef.current = true;
    setIsCompleting(true);
    let operationSucceeded = false;
    
    try {
      const db = getFirestore();

      const latestBatchRef = doc(db, 'productionBatches', completingBatch.id);
      const latestBatchSnap = await getDoc(latestBatchRef);
      if (!latestBatchSnap.exists()) {
        toast({ title: "Error", description: "Batch no longer exists", variant: "destructive" });
        setIsCompleting(false);
        return;
      }

      const latestBatchData = latestBatchSnap.data() as ProductionBatch;
      if (latestBatchData.status === 'completed') {
        toast({ title: "Already Completed", description: "This batch was already completed and stock was already applied." });
        setCompletingBatch(null);
        setCompletionQuantity('');
        setIsCompleting(false);
        return;
      }

      const effectiveBatch = {
        ...completingBatch,
        ...latestBatchData,
        id: completingBatch.id,
      } as ProductionBatch;
      
      // 1. Resolve product ID and get product document
      const candidateProductIds = Array.from(new Set([
        effectiveBatch.composedProductId,
        effectiveBatch.productId,
      ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)));

      let productDoc = null as any;
      let resolvedProductId = candidateProductIds[0] || '';

      for (const candidateId of candidateProductIds) {
        const candidateDoc = await getDoc(doc(db, 'products', candidateId));
        if (candidateDoc.exists()) {
          productDoc = candidateDoc;
          resolvedProductId = candidateId;
          break;
        }
      }

      if (!productDoc) {
        const localProduct = products.find((p) =>
          candidateProductIds.includes(p.id) ||
          (typeof p.productId === 'string' && candidateProductIds.includes(p.productId))
        );

        if (localProduct?.id) {
          const fallbackDoc = await getDoc(doc(db, 'products', localProduct.id));
          if (fallbackDoc.exists()) {
            productDoc = fallbackDoc;
            resolvedProductId = localProduct.id;
          }
        }

        if (!resolvedProductId && localProduct?.id) {
          resolvedProductId = localProduct.id;
        }
      }

      if (!productDoc || !productDoc.exists()) {
        console.warn('⚠️ Product lookup fallback used for completion', {
          batchId: completingBatch.id,
          productId: effectiveBatch.productId,
          composedProductId: effectiveBatch.composedProductId,
          candidates: candidateProductIds,
          resolvedProductId,
        });
      }
      const productData = productDoc?.exists() ? productDoc.data() : {};
      
      const composedProduct = { 
        id: productDoc?.id || resolvedProductId,
        productId: productDoc?.id || resolvedProductId,
        ...productData,
        name: productData.name || completingBatch.productName || 'Unknown Product'
      } as ComposedProduct;
      
      // 2. Get recipe details
      const resolvedRecipeId = composedProduct.recipeId || effectiveBatch.recipeId || '';
      if (!resolvedRecipeId) {
        console.error('❌ Recipe ID missing for completion', {
          batchId: completingBatch.id,
          resolvedProductId,
          productIdFromBatch: effectiveBatch.productId,
          composedProductIdFromBatch: effectiveBatch.composedProductId,
          recipeIdFromBatch: effectiveBatch.recipeId,
        });
        toast({ title: "Error", description: "Recipe not found", variant: "destructive" });
        setIsCompleting(false);
        return;
      }
      const recipeDoc = await getDoc(doc(db, 'recipes', resolvedRecipeId));
      if (!recipeDoc.exists()) {
        console.error('❌ Recipe lookup failed for completion', {
          batchId: completingBatch.id,
          resolvedProductId,
          recipeIdFromProduct: composedProduct.recipeId,
          recipeIdFromBatch: effectiveBatch.recipeId,
          resolvedRecipeId,
        });
        toast({ title: "Error", description: "Recipe not found", variant: "destructive" });
        setIsCompleting(false);
        return;
      }
      const recipe = { id: recipeDoc.id, ...recipeDoc.data() } as Recipe;
      const recipeOutputQty = Number((recipe as any).outputQuantity || (recipe as any).yieldQuantity || 1);
      const safeRecipeOutputQty = recipeOutputQty > 0 ? recipeOutputQty : 1;
      
      // 3. Calculate material costs and reduce raw materials stock
      let totalMaterialCost = 0;
      const materialsUsed = [];
      const zeroCostMaterials: string[] = [];
      const rawMaterialUsageMap = new Map<string, number>();
      
      console.log('🔧 Production Completion Started:', {
        batchId: completingBatch.id,
        productId: resolvedProductId,
        actualQty,
        recipeIngredients: recipe.ingredients?.length || 0,
        recipeOutputQty: safeRecipeOutputQty,
      });
      
      for (const ingredient of recipe.ingredients || []) {
        console.log('📦 Processing ingredient:', {
          rawMaterialId: ingredient.rawMaterialId,
          quantityInRecipe: ingredient.quantity,
          normalizedByOutput: safeRecipeOutputQty,
        });
        
        // Skip ingredients with invalid or empty rawMaterialId
        if (!ingredient.rawMaterialId || ingredient.rawMaterialId.trim() === '') {
          console.warn('⚠️ Skipping ingredient with empty rawMaterialId');
          continue;
        }
        
        // Skip ingredients with zero or negative quantity
        if (!ingredient.quantity || ingredient.quantity <= 0) {
          console.warn('⚠️ Skipping ingredient with invalid quantity:', ingredient.quantity);
          continue;
        }
        
        const rawMaterialDoc = await getDoc(doc(db, 'rawMaterials', ingredient.rawMaterialId));
        if (!rawMaterialDoc.exists()) {
          console.error('❌ Raw material not found:', ingredient.rawMaterialId);
          continue;
        }
        
        const rawMaterial = { id: rawMaterialDoc.id, ...rawMaterialDoc.data() } as RawMaterial;
        const quantityNeeded = (ingredient.quantity * actualQty) / safeRecipeOutputQty;
        const currentStock = rawMaterial.currentStock || 0;
        const alreadyPlannedUsage = rawMaterialUsageMap.get(ingredient.rawMaterialId) || 0;
        const totalPlannedUsage = alreadyPlannedUsage + quantityNeeded;
        
        console.log('📊 Material details:', {
          name: rawMaterial.name,
          currentStock,
          quantityNeeded,
          costPerUnit: rawMaterial.costPerUnit
        });
        
        // Check if material has zero cost
        if (!rawMaterial.costPerUnit || rawMaterial.costPerUnit === 0) {
          zeroCostMaterials.push(rawMaterial.name);
        }
        
        // Check if enough stock
        if (currentStock < totalPlannedUsage) {
          toast({
            title: "Insufficient Stock",
            description: `Not enough ${rawMaterial.name}. Need: ${totalPlannedUsage}, Available: ${currentStock}`,
            variant: "destructive"
          });
          setIsCompleting(false);
          return;
        }
        
        // Calculate cost for this material
        const materialCost = (rawMaterial.costPerUnit || 0) * quantityNeeded;
        totalMaterialCost += materialCost;
        
        // Reduce stock
        console.log('✅ Reducing stock:', {
          material: rawMaterial.name,
          from: currentStock,
          reducing: quantityNeeded,
          to: currentStock - totalPlannedUsage
        });

        rawMaterialUsageMap.set(ingredient.rawMaterialId, totalPlannedUsage);

        console.log('✅ Stock reduction prepared for commit:', rawMaterial.name);
        
        materialsUsed.push({
          rawMaterialId: ingredient.rawMaterialId,
          materialName: rawMaterial.name,
          quantityUsed: quantityNeeded,
          unitCost: rawMaterial.costPerUnit || 0,
          totalCost: materialCost,
        });
      }
      
      console.log('🎉 All materials processed:', {
        totalMaterialsProcessed: materialsUsed.length,
        totalMaterialCost,
        materialsUsed: materialsUsed.map(m => ({ name: m.materialName, qty: m.quantityUsed }))
      });
      
      // Warn if materials have zero cost
      if (zeroCostMaterials.length > 0) {
        toast({
          title: "Cannot Complete Production",
          description: `The following materials have zero cost: ${zeroCostMaterials.join(', ')}. Please update material costs in Raw Materials page before completing production.`,
          variant: "destructive"
        });
        setIsCompleting(false);
        return;
      }
      
      // 4. Calculate cost per unit (ONLY MATERIAL COSTS)
      // Service cost is tracked separately via monthly allocation in Finished Goods
      const materialCostPerUnit = totalMaterialCost / actualQty;
      const totalCostPerUnit = materialCostPerUnit; // Only material costs
      
      // 5. Update or create finished goods entry
      const fgQuery = query(
        collection(db, 'finishedGoodsInventory'),
        where('storeId', '==', user.storeId),
        where('productId', '==', resolvedProductId)
      );
      const fgSnapshot = await getDocs(fgQuery);
      
      const batchDetails = {
        batchId: completingBatch.id,
        batchNumber: `BATCH-${completingBatch.id.slice(-6)}`,
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
        referenceId: completingBatch.id,
        referenceNumber: `BATCH-${completingBatch.id.slice(-6)}`,
        userId: user.id,
        userName: user.name,
        batchDetails,
      };

      const nowIso = new Date().toISOString();
      const commitBatch = writeBatch(db);

      // Queue raw material stock updates
      for (const [rawMaterialId, quantityUsed] of rawMaterialUsageMap.entries()) {
        commitBatch.update(doc(db, 'rawMaterials', rawMaterialId), {
          currentStock: increment(-quantityUsed),
          updatedAt: nowIso,
        });
      }
      
      // Capture FG doc identity before committing batch; actual write happens
      // in a runTransaction AFTER commit so concurrent order-delivery writes
      // don't cause stale-overwrite data drift.
      const isNewFGDoc = fgSnapshot.empty;
      const existingFGDocId = isNewFGDoc ? null : fgSnapshot.docs[0].id;

      // 7. Update production batch
      const batchRef = doc(db, 'productionBatches', completingBatch.id);
      const updateData = {
        status: 'completed' as ProductionBatchStatus,
        completionDate: nowIso,
        actualQuantity: actualQty,
        productId: resolvedProductId,
        composedProductId: resolvedProductId,
        recipeId: resolvedRecipeId,
        materialsCost: totalMaterialCost,
        totalCost: totalCostPerUnit * actualQty,
        costPerUnit: totalCostPerUnit,
        materialsUsed,
      };
      commitBatch.update(batchRef, updateData);

      // Commit all writes atomically (raw materials + production batch record)
      await commitBatch.commit();

      // Atomically update finished goods AFTER the raw-materials batch.
      // runTransaction provides optimistic-locking retry so concurrent
      // order-delivery ops never silently overwrite each other.
      const round3Prod = (n: number) => Math.round(n * 1000) / 1000;
      await runTransaction(db, async (tx) => {
        if (!isNewFGDoc && existingFGDocId) {
          const fgRef = doc(db, 'finishedGoodsInventory', existingFGDocId);
          const freshSnap = await tx.get(fgRef);
          if (!freshSnap.exists()) return;
          const fresh = freshSnap.data() as FinishedGoodsItem;
          const freshOldQty = fresh.currentBalance || 0;
          const freshOldCost = fresh.costPrice || 0;
          const freshTotalQty = round3Prod(freshOldQty + actualQty);
          const freshWeightedAvg = freshTotalQty > 0
            ? ((freshOldQty * freshOldCost) + (actualQty * totalCostPerUnit)) / freshTotalQty
            : totalCostPerUnit;
          tx.update(fgRef, {
            currentBalance: freshTotalQty,
            quantityManufactured: round3Prod((fresh.quantityManufactured || 0) + actualQty),
            transactions: [...(fresh.transactions || []), transaction],
            batchQueue: [...(fresh.batchQueue || []), batchDetails],
            costPrice: Math.round(freshWeightedAvg * 10000) / 10000,
            totalValue: round3Prod(freshTotalQty * freshWeightedAvg),
            updatedAt: nowIso,
          });
        } else {
          // First-ever production for this product — create the FG document
          const fgCode = `FG-${Date.now().toString().slice(-6)}`;
          const newFgRef = doc(collection(db, 'finishedGoodsInventory'));
          const newFgData: Omit<FinishedGoodsItem, 'id'> = {
            itemCode: fgCode,
            productId: resolvedProductId,
            composedProductId: resolvedProductId,
            recipeId: resolvedRecipeId,
            description: composedProduct.name,
            productName: composedProduct.name,
            unit: 'units',
            openingBalance: 0,
            quantityManufactured: actualQty,
            quantitySold: 0,
            quantityAdjusted: 0,
            currentBalance: actualQty,
            costPrice: totalCostPerUnit,
            sellingPrice: composedProduct.price || composedProduct.sellingPrice || (totalCostPerUnit * 2.5),
            totalValue: round3Prod(actualQty * totalCostPerUnit),
            valuationMethod: 'FIFO',
            transactions: [transaction],
            batchQueue: [batchDetails],
            storeId: user.storeId,
            createdBy: user.id,
            createdAt: nowIso,
            updatedAt: nowIso,
          };
          tx.set(newFgRef, newFgData);
        }
      });

      setBatches(batches.map(b => b.id === completingBatch.id ? { ...b, ...updateData } : b));
      
      // Log the action
      await logAction(
        user.id,
        user.name,
        user.role,
        'update',
        'productionBatch',
        completingBatch.id,
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
      
      console.log('✅ Production completed successfully, marking operationSucceeded = true');
      operationSucceeded = true;
    } catch (error) {
      console.error('Error completing production:', error);
      toast({ title: "Error", description: "Failed to complete production", variant: "destructive" });
    } finally {
      console.log('🔓 Unlocking operation, operationSucceeded:', operationSucceeded);
      isOperatingRef.current = false;
      setIsCompleting(false);
      
      // Close dialog only if operation succeeded
      if (operationSucceeded) {
        console.log('✅ Closing dialog and resetting state');
        setCompletingBatch(null);
        setCompletionQuantity('');
      } else {
        console.log('❌ Operation failed, keeping dialog open');
      }
    }
  };

  const getFilteredBatches = () => {
    return batches.filter(batch => {
      const statusMatch = filterStatus === 'all' || batch.status === filterStatus;
      
      // Date filtering based on completion date (for completed batches) or scheduled date
      const batchDate = batch.completionDate || batch.scheduledDate;
      const dateMatch = (!filterStartDate || batchDate >= filterStartDate) && 
                       (!filterEndDate || batchDate <= filterEndDate);
      
      return statusMatch && dateMatch;
    });
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

  const exportToExcel = () => {
    const data = filteredBatches.map(batch => ({
      'Batch Code': batch.batchNumber,
      'Product': batch.productName,
      'Quantity': batch.quantity,
      'Actual Quantity': batch.actualQuantity || '-',
      'Status': batch.status.toUpperCase(),
      'Priority': batch.priority.toUpperCase(),
      'Scheduled Date': batch.scheduledDate,
      'Completion Date': batch.completionDate || '-',
      'Cost': batch.totalCost ? `$${batch.totalCost.toFixed(2)}` : '-',
      'Notes': batch.notes || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Production Batches');
    
    const dateRange = filterStartDate && filterEndDate 
      ? `_${filterStartDate}_to_${filterEndDate}` 
      : '';
    XLSX.writeFile(wb, `production_batches${dateRange}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('PRODUCTION BATCHES REPORT', 105, 15, { align: 'center' });
    
    if (filterStartDate && filterEndDate) {
      doc.setFontSize(10);
      doc.text(`Period from ${new Date(filterStartDate).toLocaleDateString('en-GB')} to ${new Date(filterEndDate).toLocaleDateString('en-GB')}`, 105, 22, { align: 'center' });
    }
    
    doc.setFontSize(8);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString()}`, 105, filterStartDate && filterEndDate ? 28 : 22, { align: 'center' });
    
    const tableData = filteredBatches.map(batch => [
      batch.batchNumber,
      cleanTextForPDF(batch.productName),
      batch.quantity.toString(),
      batch.actualQuantity?.toString() || '-',
      batch.status.toUpperCase(),
      batch.priority.toUpperCase(),
      new Date(batch.scheduledDate).toLocaleDateString('en-GB'),
      batch.completionDate ? new Date(batch.completionDate).toLocaleDateString('en-GB') : '-',
      batch.totalCost ? `$${batch.totalCost.toFixed(2)}` : '-'
    ]);
    
    autoTable(doc, {
      startY: filterStartDate && filterEndDate ? 32 : 26,
      head: [['Batch', 'Product', 'Qty', 'Actual', 'Status', 'Priority', 'Scheduled', 'Completed', 'Cost']],
      body: tableData,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [66, 66, 66], textColor: 255, fontStyle: 'bold' }
    });
    
    const dateRange = filterStartDate && filterEndDate 
      ? `_${filterStartDate}_to_${filterEndDate}` 
      : '';
    doc.save(`production_batches${dateRange}.pdf`);
  };

  return (
    <AdminPageShell
      title="Production Planning"
      description="Schedule and track production batches"
      eyebrow="Daily Operations"
      backTo="/admin/inventory"
      backLabel="Back to Inventory"
      actions={
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
                products={products}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddingBatch(false)}>Cancel</Button>
                <Button onClick={handleAddBatch}>Schedule Batch</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
      }
    >

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <AdminPanel>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-500" />
                <div>
                  <div className="text-2xl font-bold">{plannedBatches}</div>
                  <p className="text-xs text-gray-500">Planned</p>
                </div>
              </div>
            </CardContent>
          </AdminPanel>
          <AdminPanel>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Factory className="h-5 w-5 text-yellow-500" />
                <div>
                  <div className="text-2xl font-bold">{inProgressBatches}</div>
                  <p className="text-xs text-gray-500">In Progress</p>
                </div>
              </div>
            </CardContent>
          </AdminPanel>
          <AdminPanel>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <div className="text-2xl font-bold">{completedBatches}</div>
                  <p className="text-xs text-gray-500">Completed</p>
                </div>
              </div>
            </CardContent>
          </AdminPanel>
          <AdminPanel>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-purple-500" />
                <div>
                  <div className="text-2xl font-bold">{totalPlannedQuantity}</div>
                  <p className="text-xs text-gray-500">Units Scheduled</p>
                </div>
              </div>
            </CardContent>
          </AdminPanel>
        </div>

        {PRODUCTION_COMPLETION_LOCKDOWN && (
          <AdminPanel className="mb-4 border-red-300 bg-red-50">
            <CardContent className="pt-4">
              <p className="text-sm font-medium text-red-700">⚠️ Production completion is temporarily disabled.</p>
              <p className="text-xs text-red-600 mt-1">{PRODUCTION_COMPLETION_LOCKDOWN_REASON}</p>
            </CardContent>
          </AdminPanel>
        )}

        <div className="mb-4 flex gap-4 flex-wrap">
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
          
          <div className="flex gap-2 items-center">
            <Label className="text-sm text-gray-600">From:</Label>
            <Input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="w-40"
            />
          </div>
          
          <div className="flex gap-2 items-center">
            <Label className="text-sm text-gray-600">To:</Label>
            <Input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="w-40"
            />
          </div>
          
          {(filterStartDate || filterEndDate) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFilterStartDate('');
                setFilterEndDate('');
              }}
            >
              Clear Dates
            </Button>
          )}
          
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportToExcel}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {!isMobile && 'Export Excel'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportToPDF}
              className="flex items-center gap-2"
            >
              <FileDown className="h-4 w-4" />
              {!isMobile && 'Export PDF'}
            </Button>
          </div>
        </div>

        <div className="grid gap-4">
          {filteredBatches.length === 0 ? (
            <AdminPanel>
              <CardContent className="py-12 text-center">
                <Factory className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500">No production batches scheduled.</p>
              </CardContent>
            </AdminPanel>
          ) : (
            filteredBatches.map((batch) => {
              const statusConfig = STATUS_CONFIG[batch.status];
              const Icon = statusConfig.icon;
              return (
                <AdminPanel key={batch.id}>
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
                          <Button 
                            size="sm" 
                            onClick={() => handleCompleteProduction(batch)}
                            disabled={isCompleting || PRODUCTION_COMPLETION_LOCKDOWN}
                          >
                            Complete
                          </Button>
                        )}
                        {batch.status === 'completed' && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleRecalculateBatchCost(batch)}
                            title="Recalculate materials cost from raw materials"
                            className="text-blue-600"
                          >
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Recalc Cost
                          </Button>
                        )}
                        {batch.status !== 'completed' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingBatch(batch)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        )}
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
                        <p className="font-medium">${(batch.materialsCost || 0).toFixed(2)}</p>
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
                </AdminPanel>
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
                products={products}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingBatch(null)}>Cancel</Button>
                <Button onClick={handleUpdateBatch}>Update Batch</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {completingBatch && (
          <Dialog open={!!completingBatch} onOpenChange={() => !isCompleting && setCompletingBatch(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Complete Production</DialogTitle>
                <DialogDescription>
                  Enter the actual quantity produced for {completingBatch.productName}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="actualQty">Actual Quantity Produced</Label>
                  <Input
                    id="actualQty"
                    type="number"
                    min="1"
                    value={completionQuantity}
                    onChange={(e) => setCompletionQuantity(e.target.value)}
                    placeholder={`Planned: ${completingBatch.quantity}`}
                    disabled={isCompleting}
                  />
                  <p className="text-sm text-gray-500">
                    Planned quantity: {completingBatch.quantity}
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label>Completion Date</Label>
                  <p className="text-sm font-medium">{new Date().toLocaleDateString()}</p>
                  <p className="text-xs text-gray-500">Auto-filled with current date</p>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setCompletingBatch(null)}
                  disabled={isCompleting}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={executeCompleteProduction}
                  disabled={isCompleting || PRODUCTION_COMPLETION_LOCKDOWN || !completionQuantity || parseInt(completionQuantity) <= 0}
                >
                  {isCompleting ? 'Completing...' : 'Complete Production'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
    </AdminPageShell>
  );
};

export default AdminProduction;
