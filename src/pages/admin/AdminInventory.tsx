import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/useAuth';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Wrench, Layers, ShoppingCart, AlertTriangle, DollarSign, TrendingUp, Undo2, Factory, ChefHat } from 'lucide-react';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import MobileHeader from '@/components/MobileHeader';
import BackButton from '@/components/BackButton';
import { useIsMobile } from '@/hooks/use-mobile';

const AdminInventory: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    simpleProducts: { count: 0, totalValue: 0, lowStock: 0 },
    services: { count: 0, totalRevenue: 0 },
    composedProducts: { count: 0, totalValue: 0 },
    rawMaterials: { count: 0, totalValue: 0, lowStock: 0 },
    finishedGoods: { count: 0, totalValue: 0, lowStock: 0 }
  });

  useEffect(() => {
    const fetchInventoryStats = async () => {
      if (!user?.storeId) return;
      
      const db = getFirestore();
      setLoading(true);

      try {
        // Simple Products
        const productsRef = collection(db, 'products');
        const simpleQuery = query(productsRef, where('storeId', '==', user.storeId), where('productType', '==', 'simple'));
        const simpleSnap = await getDocs(simpleQuery);
        
        let simpleCount = 0, simpleValue = 0, simpleLowStock = 0;
        simpleSnap.forEach(doc => {
          const data = doc.data();
          simpleCount++;
          simpleValue += (data.stock || 0) * (data.price || 0);
          if ((data.stock || 0) < 10) simpleLowStock++;
        });

        // Services
        const serviceQuery = query(productsRef, where('storeId', '==', user.storeId), where('productType', '==', 'service'));
        const serviceSnap = await getDocs(serviceQuery);
        
        // Composed Products
        const composedQuery = query(productsRef, where('storeId', '==', user.storeId), where('productType', '==', 'composed'));
        const composedSnap = await getDocs(composedQuery);
        
        let composedCount = 0, composedValue = 0;
        composedSnap.forEach(doc => {
          const data = doc.data();
          composedCount++;
          composedValue += (data.stock || 0) * (data.finalCost || data.price || 0);
        });

        // Raw Materials
        const rawMaterialsRef = collection(db, 'rawMaterials');
        const rawQuery = query(rawMaterialsRef, where('storeId', '==', user.storeId));
        const rawSnap = await getDocs(rawQuery);
        
        let rawCount = 0, rawValue = 0, rawLowStock = 0;
        rawSnap.forEach(doc => {
          const data = doc.data();
          rawCount++;
          rawValue += (data.currentStock || 0) * (data.costPerUnit || 0);
          if ((data.currentStock || 0) <= (data.reorderPoint || 0)) rawLowStock++;
        });

        // Finished Goods
        const finishedGoodsRef = collection(db, 'finishedGoodsInventory');
        const fgQuery = query(finishedGoodsRef, where('storeId', '==', user.storeId));
        const fgSnap = await getDocs(fgQuery);
        
        let fgCount = 0, fgValue = 0, fgLowStock = 0;
        fgSnap.forEach(doc => {
          const data = doc.data();
          fgCount++;
          fgValue += data.totalValue || 0;
          if (data.reorderPoint && (data.currentBalance || 0) < data.reorderPoint) fgLowStock++;
        });

        setStats({
          simpleProducts: { count: simpleCount, totalValue: simpleValue, lowStock: simpleLowStock },
          services: { count: serviceSnap.size, totalRevenue: 0 },
          composedProducts: { count: composedCount, totalValue: composedValue },
          rawMaterials: { count: rawCount, totalValue: rawValue, lowStock: rawLowStock },
          finishedGoods: { count: fgCount, totalValue: fgValue, lowStock: fgLowStock }
        });

      } catch (error) {
        console.error('Failed to fetch inventory stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInventoryStats();
  }, [user?.storeId]);

  const totalInventoryValue = stats.simpleProducts.totalValue + stats.composedProducts.totalValue + stats.rawMaterials.totalValue + stats.finishedGoods.totalValue;
  const totalLowStock = stats.simpleProducts.lowStock + stats.rawMaterials.lowStock + stats.finishedGoods.lowStock;

  return (
    <div className="min-h-screen bg-background">
      {isMobile && <MobileHeader title="Inventory Overview" />}
      <div className="p-4 md:p-6">
        <BackButton />
        
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6" />
            Inventory Overview
          </h1>
          <p className="text-muted-foreground">Comprehensive view of all inventory items and valuation</p>
        </div>

        {/* Quick Navigation */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="cursor-pointer hover:shadow-lg transition" onClick={() => navigate('/admin/products')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-market-primary">
                <Package className="h-5 w-5" />
                Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Manage all product types: Simple items, Services, and Composed products</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition" onClick={() => navigate('/admin/suppliers')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-600">
                <TrendingUp className="h-5 w-5" />
                Suppliers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Manage suppliers and vendor relationships</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition" onClick={() => navigate('/admin/purchases')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-600">
                <ShoppingCart className="h-5 w-5" />
                Purchases
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Create purchase orders for raw materials and finished products</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition" onClick={() => navigate('/admin/supplier-returns')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-600">
                <Undo2 className="h-5 w-5" />
                Supplier Returns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Return defective or incorrect items to suppliers</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition" onClick={() => navigate('/admin/sales-returns')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <Undo2 className="h-5 w-5" />
                Sales Returns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Process customer returns and refunds</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition" onClick={() => navigate('/admin/recipes')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-pink-600">
                <ChefHat className="h-5 w-5" />
                Recipes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Create and manage recipes for composed products</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition" onClick={() => navigate('/admin/production')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-indigo-600">
                <Factory className="h-5 w-5" />
                Production
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Plan and track daily production batches</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition" onClick={() => navigate('/admin/finished-goods')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <Package className="h-5 w-5" />
                Finished Goods
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Track manufactured items ready for sale</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition" onClick={() => navigate('/admin/expenses')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-600">
                <DollarSign className="h-5 w-5" />
                Expenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Track and manage business expenses and operational costs</p>
            </CardContent>
          </Card>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Total Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalInventoryValue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Across all inventory</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4" />
                Simple Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.simpleProducts.count}</div>
              <p className="text-xs text-muted-foreground">${stats.simpleProducts.totalValue.toFixed(2)} value</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Services
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.services.count}</div>
              <p className="text-xs text-muted-foreground">Active services</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                Low Stock Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{totalLowStock}</div>
              <p className="text-xs text-muted-foreground">Items need reordering</p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Tabs */}
        <Tabs defaultValue="simple" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="simple">Simple Items</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="raw">Raw Materials</TabsTrigger>
            <TabsTrigger value="finished">Finished Goods</TabsTrigger>
          </TabsList>

          <TabsContent value="simple">
            <Card>
              <CardHeader>
                <CardTitle>Simple Products</CardTitle>
                <CardDescription>Items purchased and sold with stock tracking</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Items</p>
                      <p className="text-2xl font-bold">{stats.simpleProducts.count}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Value</p>
                      <p className="text-2xl font-bold">${stats.simpleProducts.totalValue.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Low Stock</p>
                      <p className="text-2xl font-bold text-orange-500">{stats.simpleProducts.lowStock}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="services">
            <Card>
              <CardHeader>
                <CardTitle>Services</CardTitle>
                <CardDescription>Services with cost tracking, no stock</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Active Services</p>
                      <p className="text-2xl font-bold">{stats.services.count}</p>
                    </div>
                  </div>
                  <Button onClick={() => navigate('/admin/products')}>
                    Manage Services
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="raw">
            <Card>
              <CardHeader>
                <CardTitle>Raw Materials</CardTitle>
                <CardDescription>Ingredients and materials for production</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Items</p>
                      <p className="text-2xl font-bold">{stats.rawMaterials.count}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Value</p>
                      <p className="text-2xl font-bold">${stats.rawMaterials.totalValue.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Low Stock</p>
                      <p className="text-2xl font-bold text-orange-500">{stats.rawMaterials.lowStock}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => navigate('/admin/raw-materials')}>
                      Manage Raw Materials
                    </Button>
                    <Button variant="outline" onClick={() => navigate('/admin/purchases')}>
                      Purchase Orders
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="finished">
            <Card>
              <CardHeader>
                <CardTitle>Finished Goods</CardTitle>
                <CardDescription>Manufactured items ready for sale with FIFO cost tracking</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Items</p>
                      <p className="text-2xl font-bold">{stats.finishedGoods.count}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Value</p>
                      <p className="text-2xl font-bold">${stats.finishedGoods.totalValue.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Low Stock</p>
                      <p className="text-2xl font-bold text-orange-500">{stats.finishedGoods.lowStock}</p>
                    </div>
                  </div>
                  <Button onClick={() => navigate('/admin/finished-goods')}>
                    Manage Finished Goods
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminInventory;

