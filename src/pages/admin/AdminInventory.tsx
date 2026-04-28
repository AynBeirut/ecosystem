import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/useAuth';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Wrench, Layers, ShoppingCart, AlertTriangle, DollarSign, TrendingUp, Undo2, Factory, ChefHat, Clock, Activity, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import MobileHeader from '@/components/MobileHeader';
import BackButton from '@/components/BackButton';
import { useIsMobile } from '@/hooks/use-mobile';
import SwipeableLayout from '@/components/SwipeableLayout';
import { getDaysUntilExpiry } from '@/lib/expiryUtils';

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
  const [expiryStats, setExpiryStats] = useState<{
    expired: number;
    expiringSoon: number;
    items: { name: string; type: string; expiryDate: string; daysLeft: number }[];
  }>({ expired: 0, expiringSoon: 0, items: [] });

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

        // Expiry stats — scan all items with expiryTracking on
        const expiryItems: { name: string; type: string; expiryDate: string; daysLeft: number }[] = [];
        let expiredCount = 0, expiringSoonCount = 0;

        rawSnap.forEach(doc => {
          const d = doc.data();
          if (d.expiryTracking && d.expiryDate) {
            const daysLeft = getDaysUntilExpiry(d.expiryDate);
            const item = { name: d.name || d.sku || 'Unknown', type: 'Raw Material', expiryDate: d.expiryDate, daysLeft };
            if (daysLeft < 0) { expiredCount++; expiryItems.push(item); }
            else if (daysLeft <= (d.expiryAlertDays ?? 30)) { expiringSoonCount++; expiryItems.push(item); }
          }
        });
        simpleSnap.forEach(doc => {
          const d = doc.data();
          if (d.expiryTracking && d.expiryDate) {
            const daysLeft = getDaysUntilExpiry(d.expiryDate);
            const item = { name: d.name || 'Unknown', type: 'Product', expiryDate: d.expiryDate, daysLeft };
            if (daysLeft < 0) { expiredCount++; expiryItems.push(item); }
            else if (daysLeft <= (d.expiryAlertDays ?? 30)) { expiringSoonCount++; expiryItems.push(item); }
          }
        });
        composedSnap.forEach(doc => {
          const d = doc.data();
          if (d.expiryTracking && d.expiryDate) {
            const daysLeft = getDaysUntilExpiry(d.expiryDate);
            const item = { name: d.name || 'Unknown', type: 'Composed', expiryDate: d.expiryDate, daysLeft };
            if (daysLeft < 0) { expiredCount++; expiryItems.push(item); }
            else if (daysLeft <= (d.expiryAlertDays ?? 30)) { expiringSoonCount++; expiryItems.push(item); }
          }
        });
        fgSnap.forEach(doc => {
          const d = doc.data();
          if (d.expiryTracking && d.expiryDate) {
            const daysLeft = getDaysUntilExpiry(d.expiryDate);
            const item = { name: d.productName || d.itemCode || 'Unknown', type: 'Finished Good', expiryDate: d.expiryDate, daysLeft };
            if (daysLeft < 0) { expiredCount++; expiryItems.push(item); }
            else if (daysLeft <= (d.expiryAlertDays ?? 30)) { expiringSoonCount++; expiryItems.push(item); }
          }
        });

        setExpiryStats({
          expired: expiredCount,
          expiringSoon: expiringSoonCount,
          items: expiryItems.sort((a, b) => a.daysLeft - b.daysLeft),
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
  const totalTrackedItems = stats.simpleProducts.count + stats.composedProducts.count + stats.rawMaterials.count + stats.finishedGoods.count;
  const attentionCount = totalLowStock + expiryStats.expired + expiryStats.expiringSoon;
  const inventoryHealthScore = totalTrackedItems > 0
    ? Math.max(0, Math.round(((totalTrackedItems - Math.min(totalTrackedItems, attentionCount)) / totalTrackedItems) * 100))
    : 100;

  return (
    <SwipeableLayout>
      <div className="min-h-screen bg-background">
        {isMobile && <MobileHeader title="Inventory Overview" />}
        <div className="p-4 md:p-6">
          <div className="hidden md:block">
            <BackButton />
          </div>
        
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

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-red-500" />
                Expiry Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                {expiryStats.expired > 0 && (
                  <span className="text-2xl font-bold text-red-600">{expiryStats.expired} expired</span>
                )}
                {expiryStats.expiringSoon > 0 && (
                  <span className="text-xl font-bold text-orange-500">{expiryStats.expiringSoon} soon</span>
                )}
                {expiryStats.expired === 0 && expiryStats.expiringSoon === 0 && (
                  <span className="text-2xl font-bold text-green-600">0</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Items expiring or expired</p>
            </CardContent>
          </Card>
        </div>

        {/* Inventory Activity Dashboard */}
        <div className="mb-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-market-primary" />
                Inventory Activity Dashboard
              </CardTitle>
              <CardDescription>Quick activity snapshot so staff can act without searching through tabs.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Reorder Queue</p>
                  <p className="mt-1 text-2xl font-bold text-orange-800">{totalLowStock}</p>
                  <p className="text-xs text-orange-700">Low stock items pending purchase</p>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Expiry Risk</p>
                  <p className="mt-1 text-2xl font-bold text-red-800">{expiryStats.expired + expiryStats.expiringSoon}</p>
                  <p className="text-xs text-red-700">Expired or expiring items</p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Healthy Items</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-800">{Math.max(0, totalTrackedItems - attentionCount)}</p>
                  <p className="text-xs text-emerald-700">Items not in alert state</p>
                </div>
              </div>

              <div className="mt-4 rounded-lg border bg-muted/30 p-3">
                <p className="text-sm font-medium mb-2">Priority Actions</p>
                <div className="space-y-2 text-sm">
                  {totalLowStock > 0 && (
                    <div className="flex items-center justify-between rounded-md border bg-white p-2">
                      <span className="flex items-center gap-2 text-orange-700"><AlertTriangle className="h-4 w-4" /> Restock low-stock items</span>
                      <Button size="sm" variant="outline" onClick={() => navigate('/admin/purchases')}>Create PO</Button>
                    </div>
                  )}
                  {(expiryStats.expired + expiryStats.expiringSoon) > 0 && (
                    <div className="flex items-center justify-between rounded-md border bg-white p-2">
                      <span className="flex items-center gap-2 text-red-700"><ShieldAlert className="h-4 w-4" /> Review expiry items</span>
                      <Button size="sm" variant="outline" onClick={() => navigate('/admin/finished-goods')}>Open Expiry View</Button>
                    </div>
                  )}
                  {totalLowStock === 0 && (expiryStats.expired + expiryStats.expiringSoon) === 0 && (
                    <div className="flex items-center gap-2 rounded-md border bg-white p-2 text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" /> No urgent inventory actions right now.
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Stock Health</CardTitle>
              <CardDescription>Overall status for this store</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Health score</p>
                  <p className="text-3xl font-bold">{inventoryHealthScore}%</p>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className={`h-full ${inventoryHealthScore >= 80 ? 'bg-emerald-500' : inventoryHealthScore >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${inventoryHealthScore}%` }} />
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>Tracked items: {totalTrackedItems}</div>
                  <div>Attention needed: {attentionCount}</div>
                  <div>Expired: {expiryStats.expired}</div>
                  <div>Expiring soon: {expiryStats.expiringSoon}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Tabs */}
        <Tabs defaultValue="simple" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="simple">Simple Items</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="raw">Raw Materials</TabsTrigger>
            <TabsTrigger value="finished">Finished Goods</TabsTrigger>
            <TabsTrigger value="expiry" className={expiryStats.expired > 0 ? 'text-red-600' : expiryStats.expiringSoon > 0 ? 'text-orange-500' : ''}>
              Expiry {(expiryStats.expired + expiryStats.expiringSoon) > 0 && `(${expiryStats.expired + expiryStats.expiringSoon})`}
            </TabsTrigger>
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

          <TabsContent value="expiry">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Expiring Items
                </CardTitle>
                <CardDescription>
                  {expiryStats.expired} expired · {expiryStats.expiringSoon} expiring soon
                </CardDescription>
              </CardHeader>
              <CardContent>
                {expiryStats.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No items expiring or expired.</p>
                ) : (
                  <div className="space-y-2">
                    {expiryStats.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded-md border">
                        <div>
                          <span className="font-medium">{item.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{item.type}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{item.expiryDate}</span>
                          {item.daysLeft < 0 ? (
                            <Badge variant="destructive">Expired {Math.abs(item.daysLeft)}d ago</Badge>
                          ) : (
                            <Badge className="bg-orange-500 text-white hover:bg-orange-600">Expires in {item.daysLeft}d</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
    </SwipeableLayout>
  );
};

export default AdminInventory;

