import React, { useState, useEffect, useRef } from 'react';
import { getFirestore, collection, query, where, getDocs, doc, updateDoc, addDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Package, AlertTriangle, History, Download, Plus, Edit, TrendingUp, TrendingDown, Trash2, RefreshCw, Calculator, DollarSign } from 'lucide-react';
import MobileHeader from '@/components/MobileHeader';
import BackButton from '@/components/BackButton';
import { useIsMobile } from '@/hooks/use-mobile';
import { FinishedGoodsItem, StockTransaction, FinishedGoodsAdjustment, MonthlyServiceCost } from '@/types/finishedGoods';
import { logAction } from '@/lib/auditLog';
import { Recipe, RawMaterial } from '@/types/inventory';
import { Expense } from '@/types/financial';

const AdminFinishedGoods: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  const [finishedGoods, setFinishedGoods] = useState<(FinishedGoodsItem & { id: string })[]>([]);
  const [filteredGoods, setFilteredGoods] = useState<(FinishedGoodsItem & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);
  
  const [adjustingItem, setAdjustingItem] = useState<FinishedGoodsItem | null>(null);
  const [adjustment, setAdjustment] = useState<FinishedGoodsAdjustment>({
    finishedGoodsId: '',
    adjustmentType: 'increase',
    quantity: 0,
    reason: 'count_correction',
    reasonNotes: '',
    newBalance: 0,
  });
  
  const [viewingHistory, setViewingHistory] = useState<FinishedGoodsItem | null>(null);
  
  // Service cost calculation state
  const [showServiceCostDialog, setShowServiceCostDialog] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [serviceCostCalculation, setServiceCostCalculation] = useState<{
    totalExpenses: number;
    totalProduction: number;
    serviceRate: number;
    productionUnit: string;
    expensesByCategory: Record<string, number>;
    productCount: number;
  } | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [monthlyServiceCosts, setMonthlyServiceCosts] = useState<MonthlyServiceCost[]>([]);

  // Double-click prevention lock
  const isAdjustingStockRef = useRef(false);

  useEffect(() => {
    fetchFinishedGoods();
    fetchMonthlyServiceCosts();
  }, [user?.storeId]);

  useEffect(() => {
    let filtered = finishedGoods;
    
    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.itemCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (filterLowStock) {
      filtered = filtered.filter(item => 
        item.reorderPoint && item.currentBalance < item.reorderPoint
      );
    }
    
    setFilteredGoods(filtered);
  }, [searchTerm, filterLowStock, finishedGoods]);

  const fetchFinishedGoods = async () => {
    if (!user?.storeId) return;
    
    setLoading(true);
    try {
      const db = getFirestore();
      const fgRef = collection(db, 'finishedGoodsInventory');
      const q = query(fgRef, where('storeId', '==', user.storeId));
      const snapshot = await getDocs(q);
      
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as FinishedGoodsItem & { id: string }));
      
      setFinishedGoods(items);
      setFilteredGoods(items);
    } catch (error) {
      console.error('Error fetching finished goods:', error);
      toast({ title: "Error", description: "Failed to load finished goods inventory", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlyServiceCosts = async () => {
    if (!user?.storeId) return;
    
    try {
      const db = getFirestore();
      const mscRef = collection(db, 'monthlyServiceCosts');
      const q = query(mscRef, where('storeId', '==', user.storeId));
      const snapshot = await getDocs(q);
      
      const costs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as MonthlyServiceCost));
      
      setMonthlyServiceCosts(costs.sort((a, b) => b.month.localeCompare(a.month)));
    } catch (error) {
      console.error('Error fetching monthly service costs:', error);
    }
  };

  const getMonthOptions = () => {
    const months = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      // Format as YYYY-MM without timezone conversion
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const monthStr = `${year}-${month}`;
      const label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      months.push({ value: monthStr, label });
    }
    return months;
  };

  const calculateMonthlyServiceCost = async () => {
    if (!user?.storeId || !selectedMonth) return;
    
    setIsCalculating(true);
    try {
      const db = getFirestore();
      const [year, month] = selectedMonth.split('-');
      const monthStart = `${selectedMonth}-01`;
      
      // Calculate end date: If current month, use today; otherwise use end of selected month
      const today = new Date();
      const isCurrentMonth = selectedMonth === today.toISOString().slice(0, 7);
      const nextMonth = new Date(parseInt(year), parseInt(month), 1);
      const monthEnd = isCurrentMonth 
        ? today.toISOString().slice(0, 10)
        : nextMonth.toISOString().slice(0, 10);
      
      console.log('📊 Service Cost Calculation Debug:', {
        selectedMonth,
        isCurrentMonth,
        monthStart,
        monthEnd,
        today: today.toISOString().slice(0, 10),
        todayFull: today.toISOString()
      });
      
      // Fetch expenses from start of month until end date (today if current month)
      const expensesRef = collection(db, 'expenses');
      const expensesQuery = query(
        expensesRef,
        where('storeId', '==', user.storeId),
        where('date', '>=', monthStart),
        where('date', '<=', monthEnd)
      );
      const expensesSnapshot = await getDocs(expensesQuery);
      const expenses = expensesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
      
      console.log('💰 Expenses Found:', expenses.length, expenses.map(e => ({ date: e.date, amount: e.amount, category: e.category })));
      
      const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
      const expensesByCategory = expenses.reduce((acc, exp) => {
        acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
        return acc;
      }, {} as Record<string, number>);
      
      // Fetch finished goods produced from start of month until end date
      const fgRef = collection(db, 'finishedGoodsInventory');
      const fgQuery = query(
        fgRef,
        where('storeId', '==', user.storeId),
        where('createdAt', '>=', `${monthStart}T00:00:00.000Z`),
        where('createdAt', '<=', `${monthEnd}T23:59:59.999Z`)
      );
      const fgSnapshot = await getDocs(fgQuery);
      const producedItems = fgSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FinishedGoodsItem & { id: string }));
      
      console.log('🏭 Production Found:', producedItems.length, producedItems.map(p => ({ name: p.productName, qty: p.quantityManufactured, created: p.createdAt })));
      
      const totalProduction = producedItems.reduce((sum, item) => sum + (item.quantityManufactured || 0), 0);
      
      if (totalProduction === 0) {
        // Still show results even with no production - rate will be $0 or Infinity
        setServiceCostCalculation({
          totalExpenses,
          totalProduction: 0,
          serviceRate: 0,
          productionUnit: 'units',
          expensesByCategory,
          productCount: 0
        });
        
        toast({
          title: "No Production Found",
          description: `No finished goods were produced in ${getMonthOptions().find(m => m.value === selectedMonth)?.label || selectedMonth}. Service cost rate cannot be calculated.`,
          variant: "destructive"
        });
        setIsCalculating(false);
        return;
      }
      
      // Calculate service cost rate
      const serviceRate = totalProduction > 0 ? totalExpenses / totalProduction : 0;
      
      // Get most common unit from produced items
      const unitCounts = producedItems.reduce((acc, item) => {
        acc[item.unit] = (acc[item.unit] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const productionUnit = Object.keys(unitCounts).sort((a, b) => unitCounts[b] - unitCounts[a])[0] || 'units';
      
      setServiceCostCalculation({
        totalExpenses,
        totalProduction,
        serviceRate,
        productionUnit,
        expensesByCategory,
        productCount: producedItems.length
      });
      
      toast({
        title: "Calculation Complete",
        description: `Service cost rate: $${serviceRate.toFixed(4)} per ${productionUnit}`
      });
      
    } catch (error) {
      console.error('Error calculating service cost:', error);
      toast({
        title: "Error",
        description: "Failed to calculate service cost",
        variant: "destructive"
      });
    } finally {
      setIsCalculating(false);
    }
  };

  const applyServiceCostToProducts = async () => {
    if (!user?.storeId || !selectedMonth || !serviceCostCalculation) return;
    
    setIsCalculating(true);
    try {
      const db = getFirestore();
      const [year, month] = selectedMonth.split('-');
      const monthStart = `${selectedMonth}-01`;
      const nextMonth = new Date(parseInt(year), parseInt(month), 1);
      const monthEnd = nextMonth.toISOString().slice(0, 10);
      
      // Fetch finished goods produced in that month
      const fgRef = collection(db, 'finishedGoodsInventory');
      const fgQuery = query(
        fgRef,
        where('storeId', '==', user.storeId),
        where('createdAt', '>=', `${monthStart}T00:00:00.000Z`),
        where('createdAt', '<', `${monthEnd}T00:00:00.000Z`)
      );
      const fgSnapshot = await getDocs(fgQuery);
      
      let updateCount = 0;
      const updatePromises = fgSnapshot.docs.map(async (docSnapshot) => {
        const item = { id: docSnapshot.id, ...docSnapshot.data() } as FinishedGoodsItem & { id: string };
        const quantity = item.quantityManufactured || 0;
        const serviceCostTotal = quantity * serviceCostCalculation.serviceRate;
        
        // Service cost is VIEW ONLY - does not affect actual costPrice or calculations
        await updateDoc(doc(db, 'finishedGoodsInventory', docSnapshot.id), {
          serviceCostCalculated: true,
          serviceCostMonth: selectedMonth,
          serviceCostRate: serviceCostCalculation.serviceRate,
          serviceCostTotal: serviceCostTotal,
          updatedAt: new Date().toISOString()
        });
        
        updateCount++;
      });
      
      await Promise.all(updatePromises);
      
      // Save to monthlyServiceCosts collection
      const mscData: Omit<MonthlyServiceCost, 'id'> = {
        month: selectedMonth,
        totalExpenses: serviceCostCalculation.totalExpenses,
        totalProductionQty: serviceCostCalculation.totalProduction,
        totalProductionUnit: serviceCostCalculation.productionUnit,
        ratePerUnit: serviceCostCalculation.serviceRate,
        appliedToProducts: updateCount,
        calculatedAt: new Date().toISOString(),
        calculatedBy: user.id,
        calculatedByName: user.name,
        storeId: user.storeId,
        breakdown: {
          expensesByCategory: serviceCostCalculation.expensesByCategory,
          productionByProduct: {}
        }
      };
      
      // Check if record already exists for this month
      const existingQuery = query(
        collection(db, 'monthlyServiceCosts'),
        where('storeId', '==', user.storeId),
        where('month', '==', selectedMonth)
      );
      const existingSnapshot = await getDocs(existingQuery);
      
      if (existingSnapshot.empty) {
        await addDoc(collection(db, 'monthlyServiceCosts'), mscData);
      } else {
        // Update existing record
        await updateDoc(doc(db, 'monthlyServiceCosts', existingSnapshot.docs[0].id), mscData);
      }
      
      await logAction(
        user.id,
        user.name,
        user.role,
        'create',
        'monthlyServiceCost',
        selectedMonth,
        { newValue: mscData },
        user.storeId
      );
      
      toast({
        title: "Success",
        description: `Service cost applied to ${updateCount} finished goods items`
      });
      
      setShowServiceCostDialog(false);
      setServiceCostCalculation(null);
      fetchFinishedGoods();
      fetchMonthlyServiceCosts();
      
    } catch (error) {
      console.error('Error applying service cost:', error);
      toast({
        title: "Error",
        description: "Failed to apply service cost",
        variant: "destructive"
      });
    } finally {
      setIsCalculating(false);
    }
  };

  const recalculateAllTotalValues = async () => {
    if (!user?.storeId) return;
    
    const confirmed = window.confirm('Recalculate total values for all finished goods? This will fix any inconsistencies.');
    if (!confirmed) return;
    
    setIsCalculating(true);
    try {
      const db = getFirestore();
      let updateCount = 0;
      
      const updatePromises = finishedGoods.map(async (item) => {
        const correctTotalValue = item.currentBalance * item.costPrice;
        
        // Only update if there's a discrepancy
        if (Math.abs((item.totalValue || 0) - correctTotalValue) > 0.01) {
          await updateDoc(doc(db, 'finishedGoodsInventory', item.id), {
            totalValue: correctTotalValue,
            updatedAt: new Date().toISOString()
          });
          updateCount++;
        }
      });
      
      await Promise.all(updatePromises);
      
      toast({
        title: "Success",
        description: `Recalculated ${updateCount} items`
      });
      
      fetchFinishedGoods();
      
    } catch (error) {
      console.error('Error recalculating:', error);
      toast({
        title: "Error",
        description: "Failed to recalculate values",
        variant: "destructive"
      });
    } finally {
      setIsCalculating(false);
    }
  };

  const handleDeleteItem = async (item: FinishedGoodsItem & { id: string }) => {
    if (!user?.storeId) return;
    
    if ((item.currentBalance || 0) > 0) {
      toast({ 
        title: "Cannot Delete", 
        description: "Only items with 0 current stock can be deleted", 
        variant: "destructive" 
      });
      return;
    }

    try {
      const db = getFirestore();
      await deleteDoc(doc(db, 'finishedGoodsInventory', item.id));
      setFinishedGoods(finishedGoods.filter(g => g.id !== item.id));
      setFilteredGoods(filteredGoods.filter(g => g.id !== item.id));

      await logAction(
        user.id,
        user.name,
        user.role,
        'delete',
        'finishedGoodsInventory',
        item.id,
        { oldValue: item },
        user.storeId
      );

      toast({ title: "Success", description: "Finished goods item deleted successfully!" });
    } catch (error) {
      console.error('Error deleting item:', error);
      toast({ title: "Error", description: "Failed to delete item", variant: "destructive" });
    }
  };

  const handleAdjustStock = async () => {
    if (isAdjustingStockRef.current) {
      console.log('⚠️ Stock adjustment operation already in progress');
      return;
    }

    if (!adjustingItem || !user?.storeId) return;
    
    if (adjustment.quantity <= 0) {
      toast({ title: "Error", description: "Please enter a valid quantity", variant: "destructive" });
      return;
    }

    isAdjustingStockRef.current = true;
    let operationSucceeded = false;

    try {
      const db = getFirestore();
      const fgRef = doc(db, 'finishedGoodsInventory', adjustingItem.id);
      
      const quantityChange = adjustment.adjustmentType === 'increase' 
        ? adjustment.quantity 
        : -adjustment.quantity;
      
      const newBalance = adjustingItem.currentBalance + quantityChange;
      
      if (newBalance < 0) {
        toast({ title: "Error", description: "Adjustment would result in negative stock", variant: "destructive" });
        return;
      }
      
      const transaction: StockTransaction = {
        id: `TXN-${Date.now()}`,
        date: new Date().toISOString(),
        actionType: 'adjustment',
        quantity: quantityChange,
        reason: `${adjustment.reason}: ${adjustment.reasonNotes || 'Stock adjustment'}`,
        userId: user.id,
        userName: user.name,
      };
      
      await updateDoc(fgRef, {
        currentBalance: newBalance,
        quantityAdjusted: (adjustingItem.quantityAdjusted || 0) + quantityChange,
        totalValue: newBalance * adjustingItem.costPrice,
        transactions: [...adjustingItem.transactions, transaction],
        updatedAt: new Date().toISOString(),
        lastStocktakeDate: new Date().toISOString(),
      });
      
      await logAction(user.id, user.name, user.role, 'update', 'finished_goods', adjustingItem.id, {
        oldValue: { currentBalance: adjustingItem.currentBalance },
        newValue: { currentBalance: newBalance, adjustment: quantityChange }
      }, user.storeId);
      
      operationSucceeded = true;
      toast({ title: "Success", description: "Stock adjusted successfully" });
    } catch (error) {
      console.error('Error adjusting stock:', error);
      toast({ title: "Error", description: "Failed to adjust stock", variant: "destructive" });
    } finally {
      isAdjustingStockRef.current = false;
      
      if (operationSucceeded) {
        setAdjustingItem(null);
        fetchFinishedGoods();
      }
    }
  };

  const handleRecalculateCost = async (item: FinishedGoodsItem & { id: string }) => {
    if (!user?.storeId) return;
    
    try {
      const db = getFirestore();
      
      // Get the recipe for this product
      if (!item.recipeId) {
        toast({ title: "Error", description: "No recipe found for this product", variant: "destructive" });
        return;
      }
      
      const recipeDoc = await getDoc(doc(db, 'recipes', item.recipeId));
      if (!recipeDoc.exists()) {
        toast({ title: "Error", description: "Recipe not found", variant: "destructive" });
        return;
      }
      
      const recipe = { id: recipeDoc.id, ...recipeDoc.data() } as Recipe;
      
      // Calculate cost based on current raw material prices
      let totalMaterialCost = 0;
      const zeroCostMaterials: string[] = [];
      
      for (const ingredient of recipe.ingredients || []) {
        const rawMaterialDoc = await getDoc(doc(db, 'rawMaterials', ingredient.rawMaterialId));
        if (!rawMaterialDoc.exists()) continue;
        
        const rawMaterial = { id: rawMaterialDoc.id, ...rawMaterialDoc.data() } as RawMaterial;
        
        if (!rawMaterial.costPerUnit || rawMaterial.costPerUnit === 0) {
          zeroCostMaterials.push(rawMaterial.name);
        }
        
        const materialCost = (rawMaterial.costPerUnit || 0) * ingredient.quantity;
        totalMaterialCost += materialCost;
      }
      
      if (zeroCostMaterials.length > 0) {
        toast({
          title: "Warning",
          description: `Some materials have zero cost: ${zeroCostMaterials.join(', ')}. Update Raw Materials costs first.`,
          variant: "destructive"
        });
        return;
      }
      
      // Calculate total cost per unit including service cost
      // recipe.costPerUnit is the cost per single unit from the recipe
      // totalMaterialCost is based on current raw material prices for the recipe quantity
      const materialCostPerUnit = totalMaterialCost / (recipe.outputQuantity || 1);
      const recipeCostPerUnit = recipe.costPerUnit || 0;
      const serviceCostPerUnit = Math.max(0, recipeCostPerUnit - materialCostPerUnit);
      const newCostPerUnit = materialCostPerUnit + serviceCostPerUnit;
      const newTotalValue = item.currentBalance * newCostPerUnit;
      
      // Update the finished goods item
      await updateDoc(doc(db, 'finishedGoodsInventory', item.id), {
        costPrice: newCostPerUnit,
        totalValue: newTotalValue,
        updatedAt: new Date().toISOString(),
      });
      
      await logAction(user.id, user.name, user.role, 'update', 'finished_goods', item.id, {
        oldValue: { costPrice: item.costPrice },
        newValue: { costPrice: newCostPerUnit }
      }, user.storeId);
      
      toast({ 
        title: "Success", 
        description: `Cost updated from $${item.costPrice.toFixed(2)} to $${newCostPerUnit.toFixed(2)} per unit`
      });
      fetchFinishedGoods();
    } catch (error) {
      console.error('Error recalculating cost:', error);
      toast({ title: "Error", description: "Failed to recalculate cost", variant: "destructive" });
    }
  };

  const exportToCSV = () => {
    const headers = ['Item Code', 'Product Name', 'Opening Balance', 'Manufactured', 'Sold', 'Adjusted', 'Current Balance', 'Unit', 'Cost Price', 'Selling Price', 'Total Value'];
    const rows = filteredGoods.map(item => [
      item.itemCode,
      item.productName,
      item.openingBalance || 0,
      item.quantityManufactured || 0,
      item.quantitySold || 0,
      item.quantityAdjusted || 0,
      item.currentBalance || 0,
      item.unit || '',
      (item.costPrice || 0).toFixed(2),
      (item.sellingPrice || 0).toFixed(2),
      (item.totalValue || 0).toFixed(2),
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finished-goods-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getTotalValue = () => {
    return filteredGoods.reduce((sum, item) => sum + item.totalValue, 0);
  };

  const getLowStockCount = () => {
    return finishedGoods.filter(item => item.reorderPoint && item.currentBalance < item.reorderPoint).length;
  };

  const createSampleData = async () => {
    if (!user?.storeId) return;
    
    try {
      const db = getFirestore();
      const fgRef = collection(db, 'finishedGoodsInventory');
      
      const sampleItem: Omit<FinishedGoodsItem, 'id'> = {
        itemCode: 'FG-001',
        productId: 'sample-product',
        productName: 'Sample Finished Product',
        description: 'This is a test finished goods item',
        unit: 'pcs',
        openingBalance: 0,
        quantityManufactured: 100,
        quantitySold: 0,
        quantityAdjusted: 0,
        currentBalance: 100,
        reorderPoint: 20,
        costPrice: 25.50,
        sellingPrice: 45.00,
        totalValue: 2550.00,
        valuationMethod: 'FIFO',
        batchQueue: [{
          batchId: 'BATCH-001',
          batchNumber: 'B-2026-001',
          quantity: 100,
          remainingQuantity: 100,
          costPerUnit: 25.50,
          productionDate: new Date().toISOString()
        }],
        transactions: [{
          id: 'TXN-001',
          date: new Date().toISOString(),
          actionType: 'manufactured',
          quantity: 100,
          unitCost: 25.50,
          totalCost: 2550.00,
          reason: 'Initial production batch',
          referenceId: 'BATCH-001',
          referenceNumber: 'B-2026-001',
          userId: user.id,
          userName: user.name,
          batchDetails: {
            batchId: 'BATCH-001',
            batchNumber: 'B-2026-001',
            costPerUnit: 25.50,
            remainingQuantity: 100
          }
        }],
        storeId: user.storeId,
        createdBy: user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await addDoc(fgRef, sampleItem);
      
      toast({ title: "Success", description: "Sample finished goods item created!" });
      fetchFinishedGoods();
    } catch (error) {
      console.error('Error creating sample data:', error);
      toast({ title: "Error", description: "Failed to create sample data", variant: "destructive" });
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {isMobile && <MobileHeader title="Finished Goods" showBackButton={true} />}
      <div className="container mx-auto p-4 md:p-6">
        <div className="mb-4 md:mb-6">
          {!isMobile && <BackButton to="/admin/inventory" label="Back to Inventory" />}
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Finished Goods Inventory</h1>
            <p className="text-gray-600 text-sm md:text-base mt-1">Track manufactured items ready for sale</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Total Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{finishedGoods.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Total Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${getTotalValue().toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Current Stock</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{finishedGoods.reduce((sum, item) => sum + item.currentBalance, 0)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Low Stock Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{getLowStockCount()}</div>
            </CardContent>
          </Card>
        </div>

        {/* Service Cost Calculation Section */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Monthly Service Cost Allocation
                </CardTitle>
                <CardDescription>
                  Automatically allocate monthly expenses (labor, overhead) to finished goods
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button onClick={recalculateAllTotalValues} variant="outline" size="sm" disabled={isCalculating}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Fix Values
                </Button>
                <Button onClick={() => setShowServiceCostDialog(true)} size="sm">
                  <Calculator className="h-4 w-4 mr-2" />
                  Calculate Service Cost
                </Button>
              </div>
            </div>
          </CardHeader>
          
          {monthlyServiceCosts.length > 0 && (
            <CardContent>
              <div className="text-sm">
                <div className="font-medium mb-2">Recent Calculations:</div>
                <div className="space-y-2">
                  {monthlyServiceCosts.slice(0, 3).map((msc) => (
                    <div key={msc.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <div>
                        <span className="font-medium">{new Date(msc.month + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</span>
                        <span className="text-gray-600 ml-2">• Rate: ${msc.ratePerUnit.toFixed(4)}/{msc.totalProductionUnit}</span>
                      </div>
                      <Badge variant="outline">{msc.appliedToProducts} items</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <CardTitle>Search & Filters</CardTitle>
              <div className="flex gap-2">
                {finishedGoods.length === 0 && (
                  <Button onClick={createSampleData} variant="default" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Sample Data
                  </Button>
                )}
                <Button onClick={exportToCSV} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="search">Search</Label>
                <Input
                  id="search"
                  placeholder="Item code, product name, or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterLowStock}
                    onChange={(e) => setFilterLowStock(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Show low stock only</span>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {isMobile ? (
          <div className="space-y-4">
            {filteredGoods.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-base">{item.itemCode}</CardTitle>
                      <CardDescription className="text-sm mt-1">{item.productName}</CardDescription>
                    </div>
                    {item.reorderPoint && item.currentBalance < item.reorderPoint && (
                      <Badge variant="destructive" className="ml-2">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Low Stock
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Current Balance:</span>
                      <span className="font-semibold">{item.currentBalance} {item.unit}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Manufactured:</span>
                      <span className="text-green-600">{item.quantityManufactured}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Sold:</span>
                      <span className="text-red-600">{item.quantitySold}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Cost Price:</span>
                      <span>${(item.costPrice || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Service Cost:</span>
                      {item.serviceCostCalculated ? (
                        <div className="text-right">
                          <div>${(item.serviceCostRate || 0).toFixed(4)}</div>
                          {item.serviceCostMonth && (
                            <Badge variant="secondary" className="text-xs mt-1">
                              {item.serviceCostMonth}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <Badge variant="outline">Not Calculated</Badge>
                      )}
                    </div>
                    <div className="flex justify-between text-sm font-semibold">
                      <span className="text-gray-600">Total Value:</span>
                      <span className="font-semibold">${(item.totalValue || 0).toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setViewingHistory(item)}
                      className="flex-1"
                    >
                      <History className="h-4 w-4 mr-1" />
                      History
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAdjustingItem(item)}
                      className="flex-1"
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Adjust
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRecalculateCost(item)}
                      className="flex-1 text-blue-600"
                      title="Recalculate Cost from Recipe"
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Recalc
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left p-4 font-medium text-gray-600">Item Code</th>
                      <th className="text-left p-4 font-medium text-gray-600">Product Name</th>
                      <th className="text-right p-4 font-medium text-gray-600">Opening</th>
                      <th className="text-right p-4 font-medium text-gray-600">Manufactured</th>
                      <th className="text-right p-4 font-medium text-gray-600">Sold</th>
                      <th className="text-right p-4 font-medium text-gray-600">Current</th>
                      <th className="text-right p-4 font-medium text-gray-600">Cost Price</th>
                      <th className="text-right p-4 font-medium text-gray-600">Service Cost</th>
                      <th className="text-right p-4 font-medium text-gray-600">Total Value</th>
                      <th className="text-right p-4 font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredGoods.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="p-4">
                          <div className="font-medium">{item.itemCode}</div>
                          {item.reorderPoint && item.currentBalance < item.reorderPoint && (
                            <Badge variant="destructive" className="mt-1">Low Stock</Badge>
                          )}
                        </td>
                        <td className="p-4">
                          <div>{item.productName}</div>
                          <div className="text-sm text-gray-500">{item.unit}</div>
                        </td>
                        <td className="p-4 text-right">{item.openingBalance}</td>
                        <td className="p-4 text-right text-green-600">{item.quantityManufactured}</td>
                        <td className="p-4 text-right text-red-600">{item.quantitySold}</td>
                        <td className="p-4 text-right font-semibold">{item.currentBalance}</td>
                        <td className="p-4 text-right">${(item.costPrice || 0).toFixed(2)}</td>
                        <td className="p-4 text-right">
                          {item.serviceCostCalculated ? (
                            <div>
                              <div className="font-medium">${(item.serviceCostRate || 0).toFixed(4)}</div>
                              {item.serviceCostMonth && (
                                <Badge variant="secondary" className="text-xs mt-1">
                                  {item.serviceCostMonth}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <Badge variant="outline">Not Calculated</Badge>
                          )}
                        </td>
                        <td className="p-4 text-right font-semibold">${(item.totalValue || 0).toFixed(2)}</td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setViewingHistory(item)}
                              title="View History"
                            >
                              <History className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setAdjustingItem(item)}
                              title="Adjust Stock"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRecalculateCost(item)}
                              title="Recalculate Cost from Recipe"
                              className="text-blue-600"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            {(item.currentBalance || 0) === 0 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteItem(item)}
                                title="Delete zero stock item"
                              >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredGoods.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  No finished goods found. Items will appear here when production batches are completed.
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!adjustingItem} onOpenChange={(open) => !open && setAdjustingItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
            <DialogDescription>
              Adjust stock for {adjustingItem?.itemCode} - {adjustingItem?.productName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Current Balance</Label>
              <div className="text-2xl font-bold">{adjustingItem?.currentBalance} {adjustingItem?.unit}</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Adjustment Type</Label>
                <Select
                  value={adjustment.adjustmentType}
                  onValueChange={(value: 'increase' | 'decrease') => 
                    setAdjustment({ ...adjustment, adjustmentType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="increase">
                      <div className="flex items-center">
                        <TrendingUp className="h-4 w-4 mr-2 text-green-600" />
                        Increase
                      </div>
                    </SelectItem>
                    <SelectItem value="decrease">
                      <div className="flex items-center">
                        <TrendingDown className="h-4 w-4 mr-2 text-red-600" />
                        Decrease
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min="0"
                  value={adjustment.quantity}
                  onChange={(e) => setAdjustment({ ...adjustment, quantity: Number(e.target.value) })}
                />
              </div>
            </div>

            <div>
              <Label>Reason</Label>
              <Select
                value={adjustment.reason}
                onValueChange={(value: any) => setAdjustment({ ...adjustment, reason: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="damage">Damage</SelectItem>
                  <SelectItem value="theft">Theft</SelectItem>
                  <SelectItem value="count_correction">Count Correction</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                placeholder="Additional details about this adjustment..."
                value={adjustment.reasonNotes}
                onChange={(e) => setAdjustment({ ...adjustment, reasonNotes: e.target.value })}
                rows={3}
              />
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">New Balance</div>
              <div className="text-2xl font-bold">
                {adjustingItem && (
                  adjustment.adjustmentType === 'increase'
                    ? adjustingItem.currentBalance + adjustment.quantity
                    : adjustingItem.currentBalance - adjustment.quantity
                )} {adjustingItem?.unit}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustingItem(null)}>Cancel</Button>
            <Button onClick={handleAdjustStock}>Confirm Adjustment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingHistory} onOpenChange={(open) => !open && setViewingHistory(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Transaction History</DialogTitle>
            <DialogDescription>
              {viewingHistory?.itemCode} - {viewingHistory?.productName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-600">Opening Balance</div>
                <div className="text-lg font-semibold">{viewingHistory?.openingBalance}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Manufactured</div>
                <div className="text-lg font-semibold text-green-600">+{viewingHistory?.quantityManufactured}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Sold</div>
                <div className="text-lg font-semibold text-red-600">-{viewingHistory?.quantitySold}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Current Balance</div>
                <div className="text-lg font-semibold">{viewingHistory?.currentBalance}</div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">All Transactions</h3>
              {viewingHistory && viewingHistory.transactions.length > 0 ? (
                <div className="space-y-2">
                  {[...viewingHistory.transactions].reverse().map((txn) => (
                    <div key={txn.id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <Badge variant={
                            txn.actionType === 'manufactured' ? 'default' :
                            txn.actionType === 'sold' ? 'destructive' :
                            txn.actionType === 'adjustment' ? 'secondary' :
                            'outline'
                          }>
                            {txn.actionType}
                          </Badge>
                          <div className="text-sm text-gray-600 mt-1">
                            {new Date(txn.date).toLocaleString()}
                          </div>
                        </div>
                        <div className={`text-lg font-semibold ${
                          txn.quantity > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {txn.quantity > 0 ? '+' : ''}{txn.quantity}
                        </div>
                      </div>
                      {txn.reason && (
                        <div className="text-sm text-gray-600 mb-1">{txn.reason}</div>
                      )}
                      {txn.referenceNumber && (
                        <div className="text-sm text-gray-500">Ref: {txn.referenceNumber}</div>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        By: {txn.userName}
                      </div>
                      {txn.batchDetails && (
                        <div className="text-xs text-gray-500 mt-1">
                          Batch: {txn.batchDetails.batchNumber} | Cost: ${txn.batchDetails.costPerUnit?.toFixed(2)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No transactions yet
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setViewingHistory(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Service Cost Calculation Dialog */}
      <Dialog open={showServiceCostDialog} onOpenChange={setShowServiceCostDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Calculate Monthly Service Cost</DialogTitle>
            <DialogDescription>
              Allocate monthly expenses (salaries, utilities, overhead) to finished goods produced that month
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Select Month</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  {getMonthOptions().map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Button 
              onClick={calculateMonthlyServiceCost} 
              disabled={isCalculating}
              className="w-full"
            >
              {isCalculating ? 'Calculating...' : 'Calculate'}
            </Button>
            
            {serviceCostCalculation && (
              <div className="border rounded-lg p-4 space-y-3 bg-blue-50">
                <div className="font-semibold text-lg">Calculation Results</div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Total Expenses</div>
                    <div className="text-xl font-bold">${serviceCostCalculation.totalExpenses.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Total Production</div>
                    <div className="text-xl font-bold">
                      {serviceCostCalculation.totalProduction.toFixed(2)} {serviceCostCalculation.productionUnit}
                    </div>
                  </div>
                </div>
                
                <div className="pt-3 border-t">
                  <div className="text-sm text-gray-600">Service Cost Rate</div>
                  <div className="text-2xl font-bold text-green-600">
                    ${serviceCostCalculation.serviceRate.toFixed(4)} per {serviceCostCalculation.productionUnit}
                  </div>
                </div>
                
                <div className="text-sm text-gray-600">
                  Will be applied to {serviceCostCalculation.productCount} finished goods items
                </div>
                
                {Object.keys(serviceCostCalculation.expensesByCategory).length > 0 && (
                  <div className="pt-3 border-t">
                    <div className="text-sm font-medium mb-2">Expense Breakdown:</div>
                    <div className="space-y-1 text-sm">
                      {Object.entries(serviceCostCalculation.expensesByCategory).map(([category, amount]) => (
                        <div key={category} className="flex justify-between">
                          <span className="capitalize">{category.replace('_', ' ')}</span>
                          <span className="font-medium">${amount.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <Button 
                  onClick={applyServiceCostToProducts}
                  disabled={isCalculating}
                  className="w-full mt-4"
                  variant="default"
                >
                  {isCalculating ? 'Applying...' : 'Apply to Products'}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminFinishedGoods;
