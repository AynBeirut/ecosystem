import React, { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, getDocs, doc, updateDoc, addDoc } from 'firebase/firestore';
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
import { Package, AlertTriangle, History, Download, Plus, Edit, TrendingUp, TrendingDown } from 'lucide-react';
import MobileHeader from '@/components/MobileHeader';
import BackButton from '@/components/BackButton';
import { useIsMobile } from '@/hooks/use-mobile';
import { FinishedGoodsItem, StockTransaction, FinishedGoodsAdjustment } from '@/types/finishedGoods';
import { logAction } from '@/lib/auditLog';

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

  useEffect(() => {
    fetchFinishedGoods();
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

  const handleAdjustStock = async () => {
    if (!adjustingItem || !user?.storeId) return;
    
    if (adjustment.quantity <= 0) {
      toast({ title: "Error", description: "Please enter a valid quantity", variant: "destructive" });
      return;
    }

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
      
      toast({ title: "Success", description: "Stock adjusted successfully" });
      setAdjustingItem(null);
      fetchFinishedGoods();
    } catch (error) {
      console.error('Error adjusting stock:', error);
      toast({ title: "Error", description: "Failed to adjust stock", variant: "destructive" });
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
      {isMobile && <MobileHeader title="Finished Goods" />}
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
                        <td className="p-4 text-right font-semibold">${(item.totalValue || 0).toFixed(2)}</td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setViewingHistory(item)}
                            >
                              <History className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setAdjustingItem(item)}
                            >
                              <Edit className="h-4 w-4" />
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
    </div>
  );
};

export default AdminFinishedGoods;
