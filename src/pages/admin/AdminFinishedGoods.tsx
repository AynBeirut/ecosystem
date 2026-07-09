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
import { Package, AlertTriangle, History, Download, Edit, TrendingDown, Trash2, RefreshCw, Calculator, DollarSign, AlertCircle, FileText } from 'lucide-react';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminStatCard from '@/components/admin/AdminStatCard';
import AdminPanel from '@/components/admin/AdminPanel';
import { useIsMobile } from '@/hooks/use-mobile';
import { FinishedGoodsItem, StockTransaction, FinishedGoodsAdjustment, MonthlyServiceCost } from '@/types/finishedGoods';
import { logAction } from '@/lib/auditLog';
import { Recipe, RawMaterial } from '@/types/inventory';
import { Expense } from '@/types/financial';
import { syncFinishedGoodsSoldQuantities } from '@/lib/syncFinishedGoods';
import { isCountedSaleStatus, resolveFinishedGoodsProductKey, resolveOrderItemProductKey } from '@/lib/salesRules';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cleanTextForPDF } from '@/lib/arabicPDF';
import { Switch } from '@/components/ui/switch';
import { getDaysUntilExpiry, hasExpired, isExpiringSoon } from '@/lib/expiryUtils';

type SyncChange = {
  productName: string;
  oldQuantitySold: number;
  newQuantitySold: number;
  difference: number;
};

type SyncResult = {
  success: boolean;
  productsUpdated: number;
  changes: SyncChange[];
  errors: string[];
};

type IntegrityMismatch = {
  productId: string;
  productName: string;
  recordedQuantity: number;
  actualQuantity: number;
  difference: number;
};

const AdminFinishedGoods: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  const [finishedGoods, setFinishedGoods] = useState<(FinishedGoodsItem & { id: string })[]>([]);
  const [filteredGoods, setFilteredGoods] = useState<(FinishedGoodsItem & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  
  const [adjustingItem, setAdjustingItem] = useState<FinishedGoodsItem | null>(null);
  const [adjustment, setAdjustment] = useState<FinishedGoodsAdjustment>({
    finishedGoodsId: '',
    adjustmentType: 'decrease',
    quantity: 0,
    reason: 'damage',
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

  // Sync and Integrity Check state
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCheckingIntegrity, setIsCheckingIntegrity] = useState(false);
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [syncResults, setSyncResults] = useState<SyncResult | null>(null);
  const [integrityResults, setIntegrityResults] = useState<IntegrityMismatch[] | null>(null);


  // Edit state for manual data correction
  const [editingItem, setEditingItem] = useState<(FinishedGoodsItem & { id: string }) | null>(null);

  // Double-click prevention lock
  const isAdjustingStockRef = useRef(false);

  useEffect(() => {
    fetchFinishedGoods();
    fetchMonthlyServiceCosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.storeId]);

  useEffect(() => {
    let filtered = finishedGoods;
    
    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.itemCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    // Filter by low stock
    if (filterLowStock) {
      filtered = filtered.filter(item => item.reorderPoint && item.currentBalance < item.reorderPoint);
    }
    
    // Filter by date range (using createdAt field)
    if (filterStartDate) {
      filtered = filtered.filter(item => {
        if (!item.createdAt) return true;
        const itemDate = new Date(item.createdAt).toISOString().split('T')[0];
        return itemDate >= filterStartDate;
      });
    }
    if (filterEndDate) {
      filtered = filtered.filter(item => {
        if (!item.createdAt) return true;
        const itemDate = new Date(item.createdAt).toISOString().split('T')[0];
        return itemDate <= filterEndDate;
      });
    }
    
    setFilteredGoods(filtered);
  }, [finishedGoods, searchTerm, filterLowStock, filterStartDate, filterEndDate]);

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

    const allowedReasons = new Set(['damage', 'production_damage']);
    if (!allowedReasons.has(adjustment.reason)) {
      toast({
        title: "Error",
        description: "Stock adjustment is allowed only for material damage or production damage.",
        variant: "destructive"
      });
      return;
    }

    if (!adjustment.reasonNotes?.trim()) {
      toast({
        title: "Error",
        description: "Please add notes to document the damage reason.",
        variant: "destructive"
      });
      return;
    }

    isAdjustingStockRef.current = true;
    let operationSucceeded = false;

    try {
      const db = getFirestore();
      const fgRef = doc(db, 'finishedGoodsInventory', adjustingItem.id);
      
      const quantityChange = -Math.abs(adjustment.quantity);
      
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
        setAdjustment({
          finishedGoodsId: '',
          adjustmentType: 'decrease',
          quantity: 0,
          reason: 'damage',
          reasonNotes: '',
          newBalance: 0,
        });
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

  const exportToPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape orientation
    
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('FINISHED GOODS INVENTORY REPORT', doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    const dateStr = new Date().toLocaleDateString();
    doc.text(`Report Date: ${dateStr}`, doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' });
    
    if (filterStartDate || filterEndDate) {
      const rangeText = `Filtered Period: ${filterStartDate || 'Start'} to ${filterEndDate || 'End'}`;
      doc.text(rangeText, doc.internal.pageSize.getWidth() / 2, 28, { align: 'center' });
    }
    
    const tableData = filteredGoods.map(item => [
      cleanTextForPDF(item.itemCode),
      cleanTextForPDF(item.productName),
      (item.openingBalance || 0).toString(),
      (item.quantityManufactured || 0).toString(),
      (item.quantitySold || 0).toString(),
      (item.quantityAdjusted || 0).toString(),
      (item.currentBalance || 0).toString(),
      cleanTextForPDF(item.unit || ''),
      `$${(item.costPrice || 0).toFixed(2)}`,
      `$${(item.sellingPrice || 0).toFixed(2)}`,
      `$${(item.totalValue || 0).toFixed(2)}`,
    ]);
    
    autoTable(doc, {
      startY: filterStartDate || filterEndDate ? 32 : 28,
      head: [['Item Code', 'Product', 'Opening', 'Manufactured', 'Sold', 'Adjusted', 'Current', 'Unit', 'Cost', 'Selling', 'Total Value']],
      body: tableData,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], fontStyle: 'bold' },
      columnStyles: {
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        8: { halign: 'right' },
        9: { halign: 'right' },
        10: { halign: 'right' },
      },
      foot: [[
        '', 'TOTAL',
        filteredGoods.reduce((sum, i) => sum + (i.openingBalance || 0), 0).toString(),
        filteredGoods.reduce((sum, i) => sum + (i.quantityManufactured || 0), 0).toString(),
        filteredGoods.reduce((sum, i) => sum + (i.quantitySold || 0), 0).toString(),
        filteredGoods.reduce((sum, i) => sum + (i.quantityAdjusted || 0), 0).toString(),
        filteredGoods.reduce((sum, i) => sum + (i.currentBalance || 0), 0).toString(),
        '',
        '',
        '',
        `$${getTotalValue().toFixed(2)}`
      ]],
      footStyles: { fillColor: [229, 231, 235], textColor: [0, 0, 0], fontStyle: 'bold' },
    });
    
    doc.save(`finished-goods-inventory-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const getTotalValue = () => {
    return filteredGoods.reduce((sum, item) => sum + item.totalValue, 0);
  };

  const getLowStockCount = () => {
    return finishedGoods.filter(item => item.reorderPoint && item.currentBalance < item.reorderPoint).length;
  };

  const handleEditItem = async () => {
    if (!editingItem || !user?.storeId) {
      toast.error("Item information not available");
      return;
    }

    try {
      const db = getFirestore();
      const fgRef = doc(db, 'finishedGoodsInventory', editingItem.id);
      
      // Build update object, filtering out undefined values
      const updateData: Record<string, unknown> = {
        costPrice: editingItem.costPrice || 0,
        currentBalance: editingItem.currentBalance || 0,
        quantitySold: editingItem.quantitySold || 0,
        quantityManufactured: editingItem.quantityManufactured || 0,
        totalValue: (editingItem.currentBalance || 0) * (editingItem.costPrice || 0),
        lastUpdated: new Date().toISOString(),
        expiryTracking: editingItem.expiryTracking || false,
        expiryDate: editingItem.expiryDate || null,
        expiryAlertDays: editingItem.expiryAlertDays ?? 30,
      };
      
      // Only add reorderPoint if it has a value
      if (editingItem.reorderPoint !== undefined && editingItem.reorderPoint !== null) {
        updateData.reorderPoint = editingItem.reorderPoint;
      }
      
      await updateDoc(fgRef, updateData);

      await logAction(
        user.id,
        user.name,
        user.role,
        'update',
        'finished_goods',
        editingItem.id,
        {
          action: 'manual_edit',
          updates: {
            costPrice: editingItem.costPrice,
            currentBalance: editingItem.currentBalance,
            quantitySold: editingItem.quantitySold,
            quantityManufactured: editingItem.quantityManufactured,
            reorderPoint: editingItem.reorderPoint
          }
        }
      );

      toast.success("Item updated successfully");
      setEditingItem(null);
      fetchFinishedGoods();
    } catch (error: unknown) {
      console.error("Error updating item:", error);
      toast.error(`Failed to update item: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleSyncQuantities = async () => {
    if (!user?.storeId || !user?.id || !user?.name) {
      toast.error("User information not available");
      return;
    }

    setShowSyncDialog(true);
  };

  const confirmSync = async () => {
    if (!user?.storeId || !user?.id || !user?.name) return;
    
    setIsSyncing(true);
    setShowSyncDialog(false);
    
    try {
      // Step 1: Dry run only
      const dryRunResult = await syncFinishedGoodsSoldQuantities(user.storeId, user.id, user.name, {
        dryRun: true,
        createBackup: false,
      });

      setSyncResults(dryRunResult);

      if (!dryRunResult.success) {
        toast.error('Dry run failed. No data was changed.');
        return;
      }

      if (dryRunResult.productsUpdated === 0) {
        toast.success('Safe check complete. No discrepancies found.');
        await fetchFinishedGoods();
        return;
      }

      const applyConfirmed = window.confirm(
        `Dry run found ${dryRunResult.productsUpdated} product(s) to update.\n` +
        'A backup snapshot will be created before write.\n\n' +
        'Apply reconciliation now?'
      );

      if (!applyConfirmed) {
        toast('Dry run completed. No changes applied.');
        return;
      }

      // Step 2: Apply with backup
      const applyResult = await syncFinishedGoodsSoldQuantities(user.storeId, user.id, user.name, {
        dryRun: false,
        createBackup: true,
      });

      setSyncResults(applyResult);

      if (applyResult.success) {
        toast.success(
          `Reconciliation complete! Updated ${applyResult.productsUpdated} products` +
          (applyResult.backupId ? ` (Backup: ${applyResult.backupId})` : '')
        );
      } else {
        toast.error('Reconciliation completed with errors. Check results for details.');
      }

      await fetchFinishedGoods();
    } catch (error: unknown) {
      console.error("Sync error:", error);
      toast.error(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCheckIntegrity = async () => {
    if (!user?.storeId) {
      toast.error("Store information not available");
      return;
    }

    setIsCheckingIntegrity(true);

    try {
      const db = getFirestore();
      const ordersQuery = query(
        collection(db, 'orders'),
        where('storeId', '==', user.storeId)
      );
      const ordersSnapshot = await getDocs(ordersQuery);

      // Calculate actual sold quantities from delivered/completed orders
      const actualSoldQuantities = new Map<string, { quantity: number; name: string }>();
      ordersSnapshot.forEach((orderDoc) => {
        const order = orderDoc.data();
        if (isCountedSaleStatus(order.status)) {
          order.items?.forEach((item: { productName?: string; quantity?: number; productId?: string; composedProductId?: string; id?: string }) => {
            const key = resolveOrderItemProductKey(item);
            if (key) {
              const existing = actualSoldQuantities.get(key) || { quantity: 0, name: item.productName };
              actualSoldQuantities.set(key, {
                quantity: existing.quantity + (item.quantity || 0),
                name: item.productName
              });
            }
          });
        }
      });

      // Compare with finished goods inventory
      const fgQuery = query(
        collection(db, 'finishedGoodsInventory'),
        where('storeId', '==', user.storeId)
      );
      const fgSnapshot = await getDocs(fgQuery);

      const mismatches: IntegrityMismatch[] = [];
      fgSnapshot.forEach((fgDoc) => {
        const fg = fgDoc.data();
        const productKey = resolveFinishedGoodsProductKey(fg);
        const actual = actualSoldQuantities.get(productKey) || { quantity: 0, name: fg.productName };
        const recorded = fg.quantitySold || 0;
        
        if (Math.abs(actual.quantity - recorded) > 0.001) {
          mismatches.push({
            productId: productKey,
            productName: fg.productName,
            recordedQuantity: recorded,
            actualQuantity: actual.quantity,
            difference: actual.quantity - recorded
          });
        }
      });

      setIntegrityResults(mismatches);
      
      if (mismatches.length === 0) {
        toast.success("Data integrity check passed! All quantities are correct.");
      } else {
        toast.warning(`Found ${mismatches.length} mismatches. Click 'Check Data Integrity' to see details.`);
      }
    } catch (error: unknown) {
      console.error("Integrity check error:", error);
      toast.error(`Integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsCheckingIntegrity(false);
    }
  };

  const handleFixRecipeLinks = async () => {
    if (!user?.storeId) {
      toast({ title: "Error", description: "Store information not available", variant: "destructive" });
      return;
    }

    const confirmed = window.confirm('Align finished goods recipe links to each product\'s currently linked recipe?');
    if (!confirmed) return;

    setIsCheckingIntegrity(true);

    try {
      const db = getFirestore();

      // Get products for this store and map productId -> recipeId
      const productsQuery = query(
        collection(db, 'products'),
        where('storeId', '==', user.storeId)
      );
      const productsSnapshot = await getDocs(productsQuery);

      const productRecipeMap = new Map<string, string>();
      productsSnapshot.forEach((productDoc) => {
        const product = productDoc.data();
        const recipeId = typeof product.recipeId === 'string' ? product.recipeId : '';
        if (recipeId) {
          productRecipeMap.set(productDoc.id, recipeId);
        }
      });

      // Get all finished goods for this store
      const fgQuery = query(
        collection(db, 'finishedGoodsInventory'),
        where('storeId', '==', user.storeId)
      );
      const fgSnapshot = await getDocs(fgQuery);

      let fixedCount = 0;
      const fixes = [];
      let skippedCount = 0;

      // Align each finished good recipeId with product.recipeId
      for (const fgDoc of fgSnapshot.docs) {
        const fg = fgDoc.data();
        const fgProductId = resolveFinishedGoodsProductKey(fg);
        if (!fgProductId) {
          skippedCount++;
          continue;
        }

        const targetRecipeId = productRecipeMap.get(fgProductId);
        if (!targetRecipeId) {
          skippedCount++;
          continue;
        }

        if (fg.recipeId !== targetRecipeId) {
          await updateDoc(doc(db, 'finishedGoodsInventory', fgDoc.id), {
            recipeId: targetRecipeId,
            updatedAt: new Date().toISOString()
          });

          fixes.push({
            productName: fg.productName || fgProductId,
            oldRecipeId: fg.recipeId || 'MISSING',
            newRecipeId: targetRecipeId,
          });

          fixedCount++;
        }
      }

      if (fixedCount === 0) {
        toast({ title: "Success", description: "All recipe links already aligned with products." });
      } else {
        console.log('Fixed recipe links:', fixes);
        toast({ 
          title: "Success", 
          description: `Aligned ${fixedCount} recipe link(s) with product mapping.${skippedCount > 0 ? ` Skipped ${skippedCount} item(s) without product recipe.` : ''}`
        });
        await fetchFinishedGoods(); // Refresh the list
      }
    } catch (error: unknown) {
      console.error("Fix recipe links error:", error);
      toast({ title: "Error", description: `Failed to fix recipe links: ${error instanceof Error ? error.message : 'Unknown error'}`, variant: "destructive" });
    } finally {
      setIsCheckingIntegrity(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  return (
    <AdminPageShell
      title="Finished Goods Inventory"
      description="Track manufactured items ready for sale"
      eyebrow="Stock & Catalog"
      backTo="/admin/inventory"
      backLabel="Back to Inventory"
    >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
          <AdminStatCard title="Total Items" value={finishedGoods.length} icon={Package} gradient="from-teal-500 to-teal-700" />
          <AdminStatCard title="Total Value" value={`$${getTotalValue().toFixed(2)}`} icon={DollarSign} gradient="from-slate-600 to-slate-800" />
          <AdminStatCard title="Current Stock" value={finishedGoods.reduce((sum, item) => sum + item.currentBalance, 0)} icon={History} gradient="from-sky-500 to-blue-700" />
          <AdminStatCard title="Low Stock" value={getLowStockCount()} icon={AlertTriangle} gradient="from-orange-400 to-orange-600" valueClassName="text-orange-600" />
        </div>

        {/* Service Cost Calculation Section */}
        <AdminPanel className="mb-6">
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
        </AdminPanel>

        <AdminPanel className="mb-6">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <CardTitle>Search & Filters</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button onClick={exportToCSV} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                <Button onClick={exportToPDF} variant="outline" size="sm">
                  <FileText className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="search">Search</Label>
                <Input
                  id="search"
                  placeholder="Item code, product name, or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="startDate">From Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="endDate">To Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterLowStock}
                    onChange={(e) => setFilterLowStock(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Show low stock only</span>
                </label>
                {(searchTerm || filterStartDate || filterEndDate || filterLowStock) && (
                  <Button
                    onClick={() => {
                      setSearchTerm('');
                      setFilterStartDate('');
                      setFilterEndDate('');
                      setFilterLowStock(false);
                    }}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </AdminPanel>

        {isMobile ? (
          <div className="space-y-4">
            {filteredGoods.map((item) => (
              <AdminPanel key={item.id} className="overflow-hidden">
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
                    {item.expiryTracking && item.expiryDate && hasExpired(item) && (
                      <Badge variant="destructive" className="ml-2">Expired</Badge>
                    )}
                    {item.expiryTracking && item.expiryDate && isExpiringSoon(item) && (
                      <Badge className="ml-2 bg-orange-500 text-white hover:bg-orange-600">
                        Expires in {getDaysUntilExpiry(item.expiryDate)}d
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

                  </div>
                </CardContent>
              </AdminPanel>
            ))}
          </div>
        ) : (
          <AdminPanel>
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
                          {item.expiryTracking && item.expiryDate && hasExpired(item) && (
                            <Badge variant="destructive" className="mt-1">Expired</Badge>
                          )}
                          {item.expiryTracking && item.expiryDate && isExpiringSoon(item) && (
                            <Badge className="mt-1 bg-orange-500 text-white hover:bg-orange-600">
                              Expires in {getDaysUntilExpiry(item.expiryDate)}d
                            </Badge>
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
                              className="text-purple-600"
                            >
                              <Package className="h-4 w-4" />
                            </Button>

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
          </AdminPanel>
        )}

      {/* Edit Item Dialog */}
      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Finished Goods Details</DialogTitle>
            <DialogDescription>
              Manually correct data for {editingItem?.itemCode} - {editingItem?.productName}
            </DialogDescription>
          </DialogHeader>
          
          {editingItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-costPrice">Cost Price ($)</Label>
                  <Input
                    id="edit-costPrice"
                    type="number"
                    step="0.01"
                    value={editingItem.costPrice}
                    onChange={(e) => setEditingItem({
                      ...editingItem,
                      costPrice: parseFloat(e.target.value) || 0
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-currentBalance">Current Balance</Label>
                  <Input
                    id="edit-currentBalance"
                    type="number"
                    step="0.01"
                    value={editingItem.currentBalance}
                    onChange={(e) => setEditingItem({
                      ...editingItem,
                      currentBalance: parseFloat(e.target.value) || 0
                    })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-quantitySold">Quantity Sold</Label>
                  <Input
                    id="edit-quantitySold"
                    type="number"
                    step="0.01"
                    value={editingItem.quantitySold || 0}
                    onChange={(e) => setEditingItem({
                      ...editingItem,
                      quantitySold: parseFloat(e.target.value) || 0
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-quantityManufactured">Quantity Manufactured</Label>
                  <Input
                    id="edit-quantityManufactured"
                    type="number"
                    step="0.01"
                    value={editingItem.quantityManufactured || 0}
                    onChange={(e) => setEditingItem({
                      ...editingItem,
                      quantityManufactured: parseFloat(e.target.value) || 0
                    })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="edit-reorderPoint">Reorder Point</Label>
                <Input
                  id="edit-reorderPoint"
                  type="number"
                  step="0.01"
                  value={editingItem.reorderPoint || 0}
                  onChange={(e) => setEditingItem({
                    ...editingItem,
                    reorderPoint: parseFloat(e.target.value) || 0
                  })}
                />
              </div>

              {/* Expiry Tracking */}
              <div className="space-y-3 border rounded-md p-3">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="fg-edit-expiryTracking"
                    checked={!!editingItem.expiryTracking}
                    onCheckedChange={(checked) => setEditingItem({ ...editingItem, expiryTracking: checked })}
                  />
                  <Label htmlFor="fg-edit-expiryTracking">Enable Expiry Tracking</Label>
                </div>
                {editingItem.expiryTracking && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="fg-edit-expiryDate">Expiry Date</Label>
                      <Input
                        id="fg-edit-expiryDate"
                        type="date"
                        value={editingItem.expiryDate || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, expiryDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="fg-edit-expiryAlertDays">Alert Before (days)</Label>
                      <Input
                        id="fg-edit-expiryAlertDays"
                        type="number"
                        min="1"
                        value={editingItem.expiryAlertDays ?? 30}
                        onChange={(e) => {
                          const parsed = parseInt(e.target.value, 10);
                          setEditingItem({
                            ...editingItem,
                            expiryAlertDays: Number.isFinite(parsed) ? parsed : undefined,
                          });
                        }}
                        onBlur={(e) => setEditingItem({ ...editingItem, expiryAlertDays: parseInt(e.target.value) || 30 })}
                        placeholder="30"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                <p className="text-sm text-yellow-800">
                  ⚠️ <strong>Warning:</strong> Manual edits will override calculated values. 
                  Use with caution and document the reason for changes.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setEditingItem(null)}
                >
                  Cancel
                </Button>
                <Button onClick={handleEditItem}>
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Adjust Stock Dialog */}
      <Dialog open={!!adjustingItem} onOpenChange={(open) => !open && setAdjustingItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
            <DialogDescription>
              Adjust stock for {adjustingItem?.itemCode} - {adjustingItem?.productName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
              Adjustment is restricted to damage only (material damage or production damage). This action always decreases stock.
            </div>
            <div>
              <Label>Current Balance</Label>
              <div className="text-2xl font-bold">{adjustingItem?.currentBalance} {adjustingItem?.unit}</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Adjustment Type</Label>
                <div className="h-10 px-3 border rounded-md bg-gray-50 text-gray-700 flex items-center">
                  <TrendingDown className="h-4 w-4 mr-2 text-red-600" />
                  Decrease (Damage Only)
                </div>
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
                onValueChange={(value: string) => {
                  const normalizedReason = value === 'production_damage' ? 'production_damage' : 'damage';
                  setAdjustment({ ...adjustment, reason: normalizedReason });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="damage">Material Damage</SelectItem>
                  <SelectItem value="production_damage">Production Damage</SelectItem>
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
                  adjustingItem.currentBalance - adjustment.quantity
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
                  {[...viewingHistory.transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((txn) => (
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

      {/* Sync Confirmation Dialog */}
      <Dialog open={showSyncDialog} onOpenChange={setShowSyncDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sync Sold Quantities</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              This will recalculate the "Quantity Sold" for all products based on actual delivered/completed orders.
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
              <p className="text-sm text-yellow-800 font-medium">⚠️ Warning:</p>
              <p className="text-sm text-yellow-700 mt-1">
                This operation will modify your database. Make sure you have a backup before proceeding.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowSyncDialog(false)}>
                Cancel
              </Button>
              <Button onClick={confirmSync}>
                Proceed with Sync
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sync Results Dialog */}
      {syncResults && (
        <Dialog open={!!syncResults} onOpenChange={() => setSyncResults(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Sync Results</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {syncResults.success ? (
                  <Badge variant="default" className="bg-green-600">Success</Badge>
                ) : (
                  <Badge variant="destructive">Completed with Errors</Badge>
                )}
                <span className="text-sm text-gray-600">
                  Updated {syncResults.productsUpdated} products
                </span>
              </div>

              {syncResults.changes.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Changes Made:</h3>
                  <div className="border rounded overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left">Product</th>
                          <th className="px-3 py-2 text-right">Old Qty</th>
                          <th className="px-3 py-2 text-right">New Qty</th>
                          <th className="px-3 py-2 text-right">Difference</th>
                        </tr>
                      </thead>
                      <tbody>
                        {syncResults.changes.map((change, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="px-3 py-2">{change.productName}</td>
                            <td className="px-3 py-2 text-right">{change.oldQuantitySold.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right">{change.newQuantitySold.toFixed(2)}</td>
                            <td className={`px-3 py-2 text-right font-medium ${
                              change.difference > 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {change.difference > 0 ? '+' : ''}{change.difference.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {syncResults.errors.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2 text-red-600">Errors:</h3>
                  <div className="bg-red-50 border border-red-200 rounded p-3 space-y-1">
                    {syncResults.errors.map((error, idx) => (
                      <p key={idx} className="text-sm text-red-700">{error}</p>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={() => setSyncResults(null)}>
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Integrity Check Results Dialog */}
      {integrityResults && (
        <Dialog open={!!integrityResults} onOpenChange={() => setIntegrityResults(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Data Integrity Check Results</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {integrityResults.length === 0 ? (
                <div className="bg-green-50 border border-green-200 rounded p-4 text-center">
                  <p className="text-green-800 font-medium">✓ All data is correct!</p>
                  <p className="text-sm text-green-700 mt-1">
                    No mismatches found between recorded and actual sold quantities.
                  </p>
                </div>
              ) : (
                <>
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                    <p className="text-sm text-yellow-800">
                      Found {integrityResults.length} products with mismatched quantities.
                    </p>
                  </div>
                  
                  <div className="border rounded overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left">Product</th>
                          <th className="px-3 py-2 text-right">Recorded</th>
                          <th className="px-3 py-2 text-right">Actual</th>
                          <th className="px-3 py-2 text-right">Difference</th>
                        </tr>
                      </thead>
                      <tbody>
                        {integrityResults.map((mismatch, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="px-3 py-2">{mismatch.productName}</td>
                            <td className="px-3 py-2 text-right">{mismatch.recordedQuantity.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right">{mismatch.actualQuantity.toFixed(2)}</td>
                            <td className={`px-3 py-2 text-right font-medium ${
                              mismatch.difference > 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {mismatch.difference > 0 ? '+' : ''}{mismatch.difference.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    <p className="text-sm text-blue-800">
                      💡 Tip: Use the "Sync Sold Quantities" button to fix these mismatches automatically.
                    </p>
                  </div>
                </>
              )}

              <div className="flex justify-end">
                <Button onClick={() => setIntegrityResults(null)}>
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        )}
    </AdminPageShell>
  );
};

export default AdminFinishedGoods;
