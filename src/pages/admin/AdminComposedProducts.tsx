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
import { Trash2, Plus, Edit3, Package2, Minus, AlertTriangle } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ComposedProduct, Recipe, RawMaterial } from '@/types/inventory';
import { Product } from '@/types/product';
import { StoreProfile } from '@/types/storeProfile';
import { hasComposedAccess } from '@/lib/subscriptionHelper';
import { logAction } from '@/lib/auditLog';
import { calculateAvailableStock, getComposedStockStatus } from '@/lib/composedProductStock';
import { getActualStoreId } from '@/lib/storeUtils';
import { assertCanCreateProduct } from '@/lib/subscriptionEnforcement';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';

const AdminComposedProducts: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  // Check if user has permission to manage inventory
  const canManageInventory = user?.role === 'admin' || 
    (user?.role === 'sub_account' && user?.permissions?.includes('manage_inventory'));
    
  const [composedProducts, setComposedProducts] = useState<ComposedProduct[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [finishedGoods, setFinishedGoods] = useState<any[]>([]);
  const [storeProfile, setStoreProfile] = useState<StoreProfile | null>(null);
  const [categories, setCategories] = useState<string[]>(['Food', 'Beverages', 'Desserts', 'Bakery', 'Manufactured Goods', 'Electronics', 'Clothing', 'Services', 'Package', 'Box', 'Bag', 'Other']);
  const [priceMultiplier, setPriceMultiplier] = useState<number>(2.5);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ComposedProduct | null>(null);
  const [newProduct, setNewProduct] = useState({
    name: '',
    category: '',
    icon: '📦',
    materials: [] as { rawMaterialId: string; quantity: number | string }[],
    sellingPrice: 0,
  });

  // Load composed products, recipes, products, and raw materials
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.storeId) return;
      const db = getFirestore();

      // Fetch composed products
      const composedRef = collection(db, 'composedProducts');
      const composedQuery = query(composedRef, where('storeId', '==', user.storeId));
      const composedSnapshot = await getDocs(composedQuery);
      const composedList: ComposedProduct[] = composedSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ComposedProduct));
      setComposedProducts(composedList);

      // Fetch recipes
      const recipesRef = collection(db, 'recipes');
      const recipesQuery = query(recipesRef, where('storeId', '==', user.storeId));
      const recipesSnapshot = await getDocs(recipesQuery);
      const recipesList: Recipe[] = recipesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Recipe));
      setRecipes(recipesList);

      // Fetch products (filter for type='composed')
      const productsRef = collection(db, 'products');
      const productsQuery = query(productsRef, where('storeId', '==', user.storeId));
      const productsSnapshot = await getDocs(productsQuery);
      const productsList: Product[] = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Product));
      setProducts(productsList.filter(p => p.productType === 'composed'));

      // Fetch raw materials
      const rawMaterialsRef = collection(db, 'rawMaterials');
      const rawMaterialsQuery = query(rawMaterialsRef, where('storeId', '==', user.storeId));
      const rawMaterialsSnapshot = await getDocs(rawMaterialsQuery);
      const rawMaterialsList: RawMaterial[] = rawMaterialsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as RawMaterial));
      setRawMaterials(rawMaterialsList);

      // Fetch finished goods inventory
      const finishedGoodsRef = collection(db, 'finishedGoodsInventory');
      const finishedGoodsQuery = query(finishedGoodsRef, where('storeId', '==', user.storeId));
      const finishedGoodsSnapshot = await getDocs(finishedGoodsQuery);
      const finishedGoodsList = finishedGoodsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setFinishedGoods(finishedGoodsList);

      // Fetch store profile for subscription check, categories and price multiplier
      const profileDocIds = Array.from(new Set([
        getActualStoreId(user),
        user.storeId,
        user.id,
      ].filter(Boolean)));

      for (const profileDocId of profileDocIds) {
        const profileSnap = await getDoc(doc(db, 'storeProfiles', profileDocId));
        if (!profileSnap.exists()) continue;

        const profileData = profileSnap.data() as StoreProfile;
        setStoreProfile(profileData);
        setCategories(profileData.productCategories || ['Food', 'Beverages', 'Desserts', 'Bakery', 'Manufactured Goods', 'Electronics', 'Clothing', 'Services', 'Package', 'Box', 'Bag', 'Other']);
        setPriceMultiplier(profileData.priceMultiplier || 2.5);
        break;
      }
    };
    fetchData();
  }, [user?.storeId]);

  const calculateTotalCost = (): number => {
    const materialCost = newProduct.materials.reduce((sum, material) => {
      const raw = rawMaterials.find(r => r.id === material.rawMaterialId);
      if (!raw) return sum;
      const qty = typeof material.quantity === 'number' ? material.quantity : (parseFloat(material.quantity as any) || 0);
      return sum + (raw.costPerUnit * qty);
    }, 0);
    return materialCost; // Service cost calculated separately from expenses
  };

  const calculateLineCost = (materialId: string, quantity: number | string): number => {
    const raw = rawMaterials.find(r => r.id === materialId);
    if (!raw) return 0;
    const qty = typeof quantity === 'number' ? quantity : (parseFloat(quantity as any) || 0);
    return raw.costPerUnit * qty;
  };

  const calculateSuggestedPrice = (): number => {
    return calculateTotalCost() * priceMultiplier;
  };

  const addMaterial = () => {
    setNewProduct(prev => ({
      ...prev,
      materials: [...prev.materials, { rawMaterialId: '', quantity: '' }]
    }));
  };

  const removeMaterial = (index: number) => {
    setNewProduct({
      ...newProduct,
      materials: newProduct.materials.filter((_, i) => i !== index)
    });
  };

  const updateMaterial = (index: number, field: 'rawMaterialId' | 'quantity', value: any) => {
    const updated = [...newProduct.materials];
    updated[index] = { ...updated[index], [field]: value };
    setNewProduct({ ...newProduct, materials: updated });
  };

  const calculateSuggestedPriceOld = (recipeId: string, markupPercentage: number): number => {
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) return 0;
    const costPerUnit = recipe.costPerUnit || 0;
    return costPerUnit * (1 + markupPercentage / 100);
  };

  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.category || newProduct.materials.length === 0 || !user?.storeId) {
      toast({ title: "Error", description: "Product name, category, and at least one material are required", variant: "destructive" });
      return;
    }

    try {
      const db = getFirestore();

      await assertCanCreateProduct(db, user.storeId, 'composed');
      
      // Normalize materials
      const normalizedMaterials = newProduct.materials.map(m => ({
        rawMaterialId: m.rawMaterialId,
        quantity: typeof m.quantity === 'number' ? m.quantity : (parseFloat(m.quantity as any) || 0)
      }));

      const totalCost = calculateTotalCost();
      const finalPrice = newProduct.sellingPrice || calculateSuggestedPrice();

      // Create recipe first
      const recipeData = {
        name: `Recipe for ${newProduct.name}`,
        description: `Auto-generated recipe for ${newProduct.name}`,
        materials: normalizedMaterials,
        yieldQuantity: 1,
        yieldUnit: 'unit',
        costPerUnit: totalCost,
        storeId: user.storeId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const recipeRef = await addDoc(collection(db, 'recipes'), recipeData);

      // Create product
      const productData = {
        name: newProduct.name,
        description: `${newProduct.icon} ${newProduct.category}`,
        category: newProduct.category,
        icon: newProduct.icon,
        price: finalPrice,
        costPrice: totalCost,
        serviceCost: 0, // Always 0 - calculated automatically from expenses
        productType: 'composed' as const,
        inStock: true,
        stock: 0,
        recipeId: recipeRef.id,
        storeId: user.storeId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const productDocRef = await addDoc(collection(db, 'products'), productData);

      // Create composed product link
      const composedData = {
        productId: productDocRef.id,
        recipeId: recipeRef.id,
        sellingPrice: finalPrice,
        costPrice: totalCost,
        serviceCost: 0, // Always 0 - calculated automatically from expenses
        category: newProduct.category,
        icon: newProduct.icon,
        storeId: user.storeId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const composedDocRef = await addDoc(collection(db, 'composedProducts'), composedData);
      setComposedProducts([...composedProducts, { id: composedDocRef.id, ...composedData }]);

      // Audit log
      await logAction(
        user.id,
        user.name,
        user.role,
        'create',
        'composedProduct',
        composedDocRef.id,
        { newValue: composedData },
        user.storeId
      );

      setNewProduct({
        name: '',
        category: '',
        icon: '📦',
        materials: [],
        sellingPrice: 0,
      });
      setIsAddingProduct(false);
      toast({ title: "Success", description: "Composed product created successfully!" });
    } catch (error) {
      console.error('Error adding composed product:', error);
      toast({ title: "Error", description: "Failed to create composed product", variant: "destructive" });
    }
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct || !user?.storeId) return;

    try {
      const db = getFirestore();
      const productRef = doc(db, 'composedProducts', editingProduct.id);

      const recipe = recipes.find(r => r.id === editingProduct.recipeId);
      const suggestedPrice = calculateSuggestedPrice(editingProduct.recipeId, editingProduct.markupPercentage);

      const updatedData = {
        ...editingProduct,
        costPrice: recipe?.costPerUnit || 0,
        updatedAt: new Date().toISOString(),
      };

      await updateDoc(productRef, updatedData);
      setComposedProducts(composedProducts.map(p => p.id === editingProduct.id ? updatedData : p));

      // Update related product
      const mainProductRef = doc(db, 'products', editingProduct.productId);
      await updateDoc(mainProductRef, {
        recipeId: editingProduct.recipeId,
        costPrice: updatedData.costPrice,
        price: updatedData.sellingPrice,
        margin: editingProduct.markupPercentage,
        updatedAt: new Date().toISOString(),
      });

      // Audit log
      const oldProduct = composedProducts.find(p => p.id === editingProduct.id);
      await logAction(
        user.id,
        user.name,
        user.role,
        'update',
        'composedProduct',
        editingProduct.id,
        { oldValue: oldProduct, newValue: updatedData },
        user.storeId
      );

      toast({ title: "Success", description: "Composed product updated successfully!" });
      setEditingProduct(null);
    } catch (error) {
      console.error('Error updating composed product:', error);
      toast({ title: "Error", description: "Failed to update composed product", variant: "destructive" });
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to unlink this product from its recipe?')) return;

    try {
      const db = getFirestore();
      await deleteDoc(doc(db, 'composedProducts', productId));
      const deletedProduct = composedProducts.find(p => p.id === productId);
      setComposedProducts(composedProducts.filter(p => p.id !== productId));

      // Remove recipeId from product
      if (deletedProduct) {
        const productRef = doc(db, 'products', deletedProduct.productId);
        await updateDoc(productRef, {
          recipeId: null,
          updatedAt: new Date().toISOString(),
        });
      }

      // Audit log
      if (deletedProduct && user) {
        await logAction(
          user.id,
          user.name,
          user.role,
          'delete',
          'composedProduct',
          productId,
          { oldValue: deletedProduct },
          user.storeId
        );
      }

      toast({ title: "Success", description: "Composed product unlinked successfully!" });
    } catch (error) {
      console.error('Error deleting composed product:', error);
      toast({ title: "Error", description: "Failed to unlink composed product", variant: "destructive" });
    }
  };

  const handleDeleteRecipe = async (recipeId: string) => {
    try {
      const db = getFirestore();
      const deletedRecipe = recipes.find(r => r.id === recipeId);
      
      // Find products using this recipe
      const affectedProducts = composedProducts.filter(cp => cp.recipeId === recipeId);
      
      // Show warning if products are using this recipe
      const confirmMessage = affectedProducts.length > 0
        ? `This recipe is used by ${affectedProducts.length} product(s). Deleting it will unlink all these products. Continue?`
        : `Are you sure you want to delete "${deletedRecipe?.name}"?`;
      
      if (!confirm(confirmMessage)) return;
      
      // Delete the recipe
      await deleteDoc(doc(db, 'recipes', recipeId));
      
      for (const composedProduct of affectedProducts) {
        // Delete composed product entry
        await deleteDoc(doc(db, 'composedProducts', composedProduct.id));
        
        // Remove recipeId from the actual product
        const productRef = doc(db, 'products', composedProduct.productId);
        await updateDoc(productRef, {
          recipeId: null,
          updatedAt: new Date().toISOString(),
        });
      }
      
      // Refetch data to ensure sync
      if (user?.storeId) {
        // Refetch recipes
        const recipesRef = collection(db, 'recipes');
        const recipesQuery = query(recipesRef, where('storeId', '==', user.storeId));
        const recipesSnapshot = await getDocs(recipesQuery);
        const recipesList: Recipe[] = recipesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Recipe));
        setRecipes(recipesList);
        
        // Refetch composed products
        const composedRef = collection(db, 'composedProducts');
        const composedQuery = query(composedRef, where('storeId', '==', user.storeId));
        const composedSnapshot = await getDocs(composedQuery);
        const composedList: ComposedProduct[] = composedSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as ComposedProduct));
        setComposedProducts(composedList);
      }

      // Audit log
      if (deletedRecipe && user) {
        await logAction(
          user.id,
          user.name,
          user.role,
          'delete',
          'recipe',
          recipeId,
          { oldValue: deletedRecipe, affectedProducts: affectedProducts.length },
          user.storeId
        );
      }

      toast({ 
        title: "Success", 
        description: `Recipe deleted and ${affectedProducts.length} product(s) unlinked successfully!` 
      });
    } catch (error) {
      console.error('Error deleting recipe:', error);
      toast({ title: "Error", description: "Failed to delete recipe", variant: "destructive" });
    }
  };

  return (
    <AdminPageShell
      title={canManageInventory ? 'Composed Products' : 'View Composed Products'}
      description="Create products from recipes with automatic cost calculation"
      eyebrow="Inventory"
      actions={
        canManageInventory && hasComposedAccess(storeProfile) ? (
          <Dialog open={isAddingProduct} onOpenChange={setIsAddingProduct}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Composed Product
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Composed Product</DialogTitle>
                <DialogDescription>Create a product from raw materials with automatic cost calculation</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                {/* Product Name */}
                <div>
                  <Label htmlFor="productName">Product Name *</Label>
                  <Input
                    id="productName"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Chicken Sandwich"
                  />
                </div>

                {/* Category */}
                <div>
                  <Label htmlFor="category">Category *</Label>
                  <Select
                    value={newProduct.category}
                    onValueChange={(value) => setNewProduct(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Icon */}
                <div>
                  <Label htmlFor="icon">Icon (Emoji)</Label>
                  <Input
                    id="icon"
                    value={newProduct.icon}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, icon: e.target.value }))}
                    placeholder="📦"
                    maxLength={2}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Paste an emoji to represent this product
                  </p>
                </div>

                {/* Raw Materials Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Raw Materials *</Label>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={addMaterial}
                      disabled={rawMaterials.length === 0}
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Add Material
                    </Button>
                  </div>

                  {rawMaterials.length === 0 ? (
                    <div className="p-4 border border-dashed rounded text-center text-yellow-600 text-sm">
                      ⚠️ No raw materials found. Please add raw materials first in the Raw Materials section.
                    </div>
                  ) : newProduct.materials.length === 0 ? (
                    <div className="p-4 border border-dashed rounded text-center text-gray-500 text-sm">
                      No materials added yet. Click "Add Material" to start.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {newProduct.materials.map((material, index) => {
                        const rawMat = rawMaterials.find(rm => rm.id === material.rawMaterialId);
                        const lineCost = calculateLineCost(material.rawMaterialId, material.quantity);
                        return (
                          <div key={index} className="flex gap-2 items-center p-3 border rounded">
                            <div className="flex-1">
                              <Select
                                value={material.rawMaterialId}
                                onValueChange={(value) => updateMaterial(index, 'rawMaterialId', value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="-- Select raw material --" />
                                </SelectTrigger>
                                <SelectContent>
                                  {rawMaterials.map(rm => (
                                    <SelectItem key={rm.id} value={rm.id}>
                                      {rm.name} (${(rm.costPerUnit || 0).toFixed(2)}/{rm.unit})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="w-24">
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0"
                                value={material.quantity === 0 || material.quantity === '' ? '' : material.quantity}
                                onChange={(e) => updateMaterial(index, 'quantity', e.target.value === '' ? 0 : e.target.value)}
                              />
                            </div>
                            <div className="w-20 text-sm text-gray-600 font-medium text-right">
                              ${(lineCost || 0).toFixed(2)}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeMaterial(index)}
                              className="text-destructive"
                            >
                              🗑️
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Cost Calculation Display */}
                {newProduct.materials.length > 0 && (
                  <div className="p-4 bg-blue-50 rounded space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Material Cost</span>
                      <span className="font-bold">
                        ${newProduct.materials.reduce((sum, m) => {
                          const raw = rawMaterials.find(r => r.id === m.rawMaterialId);
                          if (!raw) return sum;
                          const qty = typeof m.quantity === 'number' ? m.quantity : (parseFloat(m.quantity as any) || 0);
                          return sum + (raw.costPerUnit * qty);
                        }, 0).toFixed(2)}
                        {newProduct.materials.some(m => {
                          const raw = rawMaterials.find(r => r.id === m.rawMaterialId);
                          return raw && raw.costPerUnit === 0;
                        }) && (
                          <span className="text-yellow-700 text-xs ml-2">⚠️ Some materials have $0 cost</span>
                        )}
                      </span>
                    </div>
                    
                    <div className="flex justify-between text-sm border-t pt-2">
                      <span className="font-semibold">Total Cost (Materials Only)</span>
                      <span className="font-bold">${calculateTotalCost().toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Service cost (labor/overhead) is calculated monthly from actual expenses
                    </p>
                    
                    <div className="flex justify-between text-sm">
                      <span>Suggested Price</span>
                      <span className="font-medium text-green-600">${calculateSuggestedPrice().toFixed(2)} (Cost × {priceMultiplier})</span>
                    </div>

                    <div className="border-t pt-2">
                      <Label htmlFor="sellingPrice" className="text-sm">Final Sell Price ($) *</Label>
                      <Input
                        id="sellingPrice"
                        type="number"
                        min="0"
                        step="0.01"
                        value={newProduct.sellingPrice === 0 ? '' : (newProduct.sellingPrice || parseFloat(calculateSuggestedPrice().toFixed(2)))}
                        onChange={(e) => setNewProduct(prev => ({ ...prev, sellingPrice: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0) }))}
                        placeholder={calculateSuggestedPrice().toFixed(2)}
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        You can adjust this price manually or use the suggested price
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddingProduct(false)}>Cancel</Button>
                <Button onClick={handleAddProduct}>Create Product</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null
      }
    >

        {/* Upgrade Prompt for Premium Users */}
        {!hasComposedAccess(storeProfile) ? (
          <AdminPanel className="border-2 border-amber-500 bg-amber-50">
            <CardContent className="py-12">
              <div className="text-center max-w-md mx-auto">
                <AlertTriangle className="h-16 w-16 text-amber-600 mx-auto mb-4" />
                <h3 className="text-2xl font-semibold mb-3">Upgrade to Pro Required</h3>
                <p className="text-gray-600 mb-6">
                  Composed Products and Services are available exclusively in the Pro plan.
                  Upgrade now to create products from recipes, manage recurring services, and access the POS system.
                </p>
                <Button onClick={() => window.location.href = '/subscription'} className="bg-amber-600 hover:bg-amber-700" size="lg">
                  <span className="mr-2">🚀</span> Upgrade to Pro
                </Button>
              </div>
            </CardContent>
          </AdminPanel>
        ) : (
          <>
            {/* Composed Products List */}
            <div className="grid gap-4">
              {composedProducts.length === 0 ? (
                <AdminPanel>
                  <CardContent className="py-12 text-center">
                    <Package2 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-500">No composed products yet. Link products to recipes to get started.</p>
                  </CardContent>
                </AdminPanel>
              ) : (
                composedProducts.map((composedProduct) => {
              const product = products.find(p => p.id === composedProduct.productId);
              const recipe = recipes.find(r => r.id === composedProduct.recipeId);
              const profitMargin = composedProduct.sellingPrice - composedProduct.costPrice;
              const profitPercentage = (profitMargin / composedProduct.costPrice) * 100;
              
              // Check actual finished goods inventory
              const finishedGood = finishedGoods.find(fg => fg.composedProductId === composedProduct.id);
              const actualStock = finishedGood?.currentBalance || 0;
              
              // Also check if we can produce more from raw materials
              const stockStatus = getComposedStockStatus(recipe, rawMaterials);
              const availableUnits = calculateAvailableStock(recipe, rawMaterials);

              return (
                <AdminPanel key={composedProduct.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                          {product?.name || 'Unknown Product'}
                          <Badge variant="secondary">Composed</Badge>
                          {actualStock > 0 ? (
                            <Badge variant={actualStock <= 5 ? "outline" : "default"} className={actualStock <= 5 ? "border-orange-500 text-orange-700" : "bg-green-600"}>
                              {actualStock} in stock
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Out of Stock
                            </Badge>
                          )}
                          {stockStatus.inStock && actualStock === 0 && (
                            <Badge variant="outline" className="border-blue-500 text-blue-700">
                              Can produce {availableUnits}
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription>Recipe: {recipe?.name || 'Unknown Recipe'}</CardDescription>
                      </div>
                      {canManageInventory ? (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingProduct(composedProduct)}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteProduct(composedProduct.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Badge variant="secondary">View Only</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Cost Price</p>
                        <p className="font-medium">${composedProduct.costPrice.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Markup</p>
                        <p className="font-medium">{composedProduct.markupPercentage}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Selling Price</p>
                        <p className="font-bold text-lg">${composedProduct.sellingPrice.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Profit Margin</p>
                        <p className="font-bold text-green-600">${profitMargin.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Profit %</p>
                        <p className="font-bold text-green-600">{profitPercentage.toFixed(1)}%</p>
                      </div>
                    </div>
                    {recipe && (
                      <div className="mt-4 p-3 bg-gray-50 rounded">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold mb-1">Recipe Details:</p>
                            <p className="text-sm">Output: {recipe.outputQuantity} {recipe.outputUnit} | Prep: {recipe.preparationTime} min</p>
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteRecipe(recipe.id)}
                            title="Delete this recipe"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </AdminPanel>
              );
            })
          )}
            </div>
          </>
        )}

        {/* Edit Composed Product Dialog */}
        {editingProduct && (
          <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
            <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Composed Product</DialogTitle>
                <DialogDescription>Update recipe link and pricing</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div>
                  <Label>Product</Label>
                  <Input value={products.find(p => p.id === editingProduct.productId)?.name || ''} disabled />
                </div>
                <div>
                  <Label htmlFor="edit-recipeId">Recipe *</Label>
                  <Select
                    value={editingProduct.recipeId}
                    onValueChange={(value) => {
                      const recipe = recipes.find(r => r.id === value);
                      const suggestedPrice = calculateSuggestedPrice(value, editingProduct.markupPercentage);
                      setEditingProduct({
                        ...editingProduct,
                        recipeId: value,
                        costPrice: recipe?.costPerUnit || 0,
                        sellingPrice: suggestedPrice
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {recipes.map(recipe => (
                        <SelectItem key={recipe.id} value={recipe.id}>
                          {recipe.name} (Cost: ${recipe.costPerUnit.toFixed(2)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    For changes starting from now, create a new recipe and select it here for this product.
                  </p>
                </div>
                <div>
                  <Label htmlFor="edit-markupPercentage">Markup Percentage</Label>
                  <Input
                    id="edit-markupPercentage"
                    type="number"
                    min="0"
                    step="1"
                    value={editingProduct.markupPercentage === 0 ? '' : editingProduct.markupPercentage}
                    onChange={(e) => {
                      const markup = e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0);
                      const suggestedPrice = calculateSuggestedPrice(editingProduct.recipeId, markup);
                      setEditingProduct({ ...editingProduct, markupPercentage: markup, sellingPrice: suggestedPrice });
                    }}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-sellingPrice">Selling Price</Label>
                  <Input
                    id="edit-sellingPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editingProduct.sellingPrice === 0 ? '' : editingProduct.sellingPrice}
                    onChange={(e) => setEditingProduct(prev => prev ? { ...prev, sellingPrice: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0) } : null)}
                    placeholder="0.00"
                  />
                </div>
                {editingProduct.recipeId && (
                  <div className="p-4 bg-blue-50 rounded">
                    <div className="flex justify-between text-sm mb-2">
                      <span>Recipe Cost Per Unit:</span>
                      <span className="font-bold">${recipes.find(r => r.id === editingProduct.recipeId)?.costPerUnit.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Suggested Price (with {editingProduct.markupPercentage}% markup):</span>
                      <span className="font-bold text-green-600">${calculateSuggestedPrice(editingProduct.recipeId, editingProduct.markupPercentage).toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingProduct(null)}>Cancel</Button>
                <Button onClick={handleUpdateProduct}>Update Product</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
    </AdminPageShell>
  );
};

export default AdminComposedProducts;
