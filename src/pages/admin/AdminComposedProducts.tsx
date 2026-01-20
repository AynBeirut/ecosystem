import React, { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Edit3, Package2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ComposedProduct, Recipe } from '@/types/inventory';
import { Product } from '@/types/product';
import { logAction } from '@/lib/auditLog';
import MobileHeader from '@/components/MobileHeader';
import BackButton from '@/components/BackButton';
import { useIsMobile } from '@/hooks/use-mobile';

const AdminComposedProducts: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [composedProducts, setComposedProducts] = useState<ComposedProduct[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ComposedProduct | null>(null);
  const [newProduct, setNewProduct] = useState({
    productId: '',
    recipeId: '',
    markupPercentage: 30,
    sellingPrice: 0,
    useAutoPrice: true,
  });

  // Load composed products, recipes, and products
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
    };
    fetchData();
  }, [user?.storeId]);

  const calculateSuggestedPrice = (recipeId: string, markupPercentage: number): number => {
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) return 0;
    const costPerUnit = recipe.costPerUnit || 0;
    return costPerUnit * (1 + markupPercentage / 100);
  };

  const handleAddProduct = async () => {
    if (!newProduct.productId || !newProduct.recipeId || !user?.storeId) {
      toast({ title: "Error", description: "Product and recipe are required", variant: "destructive" });
      return;
    }

    try {
      const db = getFirestore();
      const recipe = recipes.find(r => r.id === newProduct.recipeId);
      const suggestedPrice = calculateSuggestedPrice(newProduct.recipeId, newProduct.markupPercentage);
      const finalPrice = newProduct.useAutoPrice ? suggestedPrice : newProduct.sellingPrice;

      const productData = {
        productId: newProduct.productId,
        recipeId: newProduct.recipeId,
        markupPercentage: newProduct.markupPercentage,
        sellingPrice: finalPrice,
        costPrice: recipe?.costPerUnit || 0,
        storeId: user.storeId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, 'composedProducts'), productData);
      setComposedProducts([...composedProducts, { id: docRef.id, ...productData }]);

      // Update the product with recipeId and pricing
      const productRef = doc(db, 'products', newProduct.productId);
      await updateDoc(productRef, {
        recipeId: newProduct.recipeId,
        costPrice: productData.costPrice,
        price: finalPrice,
        margin: newProduct.markupPercentage,
        updatedAt: new Date().toISOString(),
      });

      // Audit log
      await logAction(
        user.id,
        user.name,
        user.role,
        'create',
        'composedProduct',
        docRef.id,
        { newValue: productData },
        user.storeId
      );

      setNewProduct({
        productId: '',
        recipeId: '',
        markupPercentage: 30,
        sellingPrice: 0,
        useAutoPrice: true,
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

      setEditingProduct(null);
      toast({ title: "Success", description: "Composed product updated successfully!" });
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

  return (
    <div className="min-h-screen bg-gray-50">
      {isMobile ? <MobileHeader title="Composed Products" /> : null}
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {!isMobile && <BackButton />}
            <h1 className="text-2xl font-bold">Composed Products</h1>
          </div>
          <Dialog open={isAddingProduct} onOpenChange={setIsAddingProduct}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Link Product to Recipe
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Link Product to Recipe</DialogTitle>
                <DialogDescription>Connect a product with its production recipe and set pricing</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="productId">Product *</Label>
                  <Select
                    value={newProduct.productId}
                    onValueChange={(value) => setNewProduct({ ...newProduct, productId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map(product => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="recipeId">Recipe *</Label>
                  <Select
                    value={newProduct.recipeId}
                    onValueChange={(value) => {
                      const suggestedPrice = calculateSuggestedPrice(value, newProduct.markupPercentage);
                      setNewProduct({ ...newProduct, recipeId: value, sellingPrice: suggestedPrice });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select recipe" />
                    </SelectTrigger>
                    <SelectContent>
                      {recipes.map(recipe => (
                        <SelectItem key={recipe.id} value={recipe.id}>
                          {recipe.name} (Cost: ${recipe.costPerUnit.toFixed(2)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="markupPercentage">Markup Percentage</Label>
                  <Input
                    id="markupPercentage"
                    type="number"
                    min="0"
                    step="1"
                    value={newProduct.markupPercentage}
                    onChange={(e) => {
                      const markup = parseFloat(e.target.value) || 0;
                      const suggestedPrice = calculateSuggestedPrice(newProduct.recipeId, markup);
                      setNewProduct({ ...newProduct, markupPercentage: markup, sellingPrice: suggestedPrice });
                    }}
                  />
                </div>
                {newProduct.recipeId && (
                  <div className="p-4 bg-blue-50 rounded">
                    <div className="flex justify-between text-sm mb-2">
                      <span>Recipe Cost Per Unit:</span>
                      <span className="font-bold">${recipes.find(r => r.id === newProduct.recipeId)?.costPerUnit.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Markup: {newProduct.markupPercentage}%</span>
                      <span className="font-bold">${((recipes.find(r => r.id === newProduct.recipeId)?.costPerUnit || 0) * (newProduct.markupPercentage / 100)).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-base border-t pt-2">
                      <span className="font-semibold">Suggested Selling Price:</span>
                      <span className="font-bold text-green-600">${calculateSuggestedPrice(newProduct.recipeId, newProduct.markupPercentage).toFixed(2)}</span>
                    </div>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="useAutoPrice"
                    checked={newProduct.useAutoPrice}
                    onChange={(e) => setNewProduct({ ...newProduct, useAutoPrice: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="useAutoPrice">Use suggested price automatically</Label>
                </div>
                {!newProduct.useAutoPrice && (
                  <div>
                    <Label htmlFor="sellingPrice">Custom Selling Price</Label>
                    <Input
                      id="sellingPrice"
                      type="number"
                      min="0"
                      step="0.01"
                      value={newProduct.sellingPrice}
                      onChange={(e) => setNewProduct({ ...newProduct, sellingPrice: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddingProduct(false)}>Cancel</Button>
                <Button onClick={handleAddProduct}>Link Product</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Composed Products List */}
        <div className="grid gap-4">
          {composedProducts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Package2 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500">No composed products yet. Link products to recipes to get started.</p>
              </CardContent>
            </Card>
          ) : (
            composedProducts.map((composedProduct) => {
              const product = products.find(p => p.id === composedProduct.productId);
              const recipe = recipes.find(r => r.id === composedProduct.recipeId);
              const profitMargin = composedProduct.sellingPrice - composedProduct.costPrice;
              const profitPercentage = (profitMargin / composedProduct.costPrice) * 100;

              return (
                <Card key={composedProduct.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {product?.name || 'Unknown Product'}
                          <Badge variant="secondary">Composed</Badge>
                        </CardTitle>
                        <CardDescription>Recipe: {recipe?.name || 'Unknown Recipe'}</CardDescription>
                      </div>
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
                        <p className="text-sm font-semibold mb-1">Recipe Details:</p>
                        <p className="text-sm">Output: {recipe.outputQuantity} {recipe.outputUnit} | Prep: {recipe.preparationTime} min</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Edit Composed Product Dialog */}
        {editingProduct && (
          <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
            <DialogContent className="max-w-2xl">
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
                </div>
                <div>
                  <Label htmlFor="edit-markupPercentage">Markup Percentage</Label>
                  <Input
                    id="edit-markupPercentage"
                    type="number"
                    min="0"
                    step="1"
                    value={editingProduct.markupPercentage}
                    onChange={(e) => {
                      const markup = parseFloat(e.target.value) || 0;
                      const suggestedPrice = calculateSuggestedPrice(editingProduct.recipeId, markup);
                      setEditingProduct({ ...editingProduct, markupPercentage: markup, sellingPrice: suggestedPrice });
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-sellingPrice">Selling Price</Label>
                  <Input
                    id="edit-sellingPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editingProduct.sellingPrice}
                    onChange={(e) => setEditingProduct({ ...editingProduct, sellingPrice: parseFloat(e.target.value) || 0 })}
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
      </main>
    </div>
  );
};

export default AdminComposedProducts;
