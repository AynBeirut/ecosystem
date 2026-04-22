import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Edit3, Package, AlertCircle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Product, ProductType, ServiceBillingType } from '@/types/product';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import MobileHeader from '@/components/MobileHeader';
import BackButton from '@/components/BackButton';
import { useIsMobile } from '@/hooks/use-mobile';
import { getFirestore, collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { generateUniqueSlug } from '@/lib/slugify';
import { assertCanCreateProduct, assertCanUploadBytes, trackStorageUsageAfterUpload } from '@/lib/subscriptionEnforcement';
import { getDaysUntilExpiry, hasExpired, isExpiringSoon } from '@/lib/expiryUtils';

const DEFAULT_PRODUCT_CATEGORIES = [
  'Electronics',
  'Outdoor Gear',
  'Home & Decor',
  'Clothing',
  'Digital Product',
  'Books',
  'Beauty & Health',
  'Toys & Games',
  'Sports',
  'Food & Beverage',
  'Other',
];

const AdminProducts: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [products, setProducts] = useState<Product[]>([]);
  const [finishedGoodsStock, setFinishedGoodsStock] = useState<Record<string, number>>({});
  const [recipes, setRecipes] = useState<Array<{ id: string; name?: string; costPerUnit?: number }>>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_PRODUCT_CATEGORIES);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  // Check if user has permission to manage inventory
  const canManageInventory = user?.role === 'admin' || 
    (user?.role === 'sub_account' && user?.permissions?.includes('manage_inventory'));
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    deliveryTime: '',
    image: '',
    imageFile: null as File | null,
    stock: '',
    productType: 'simple' as ProductType,
    serviceCost: '',
    serviceDuration: '',
    serviceBillingType: 'one-time' as ServiceBillingType,
    renewalReminderDays: '',
    recipeId: '',
    expiryTracking: false,
    expiryDate: '',
    expiryAlertDays: 30,
  });

  const getStockPayload = (productType: ProductType, rawStock: string | number) => {
    if (productType === 'service') {
      return { stock: 0, inStock: true };
    }

    const numericStock = rawStock === '' ? 0 : Number(rawStock);
    return {
      stock: numericStock,
      inStock: numericStock > 0,
    };
  };
  // Load products from Firestore on mount and when user changes
  useEffect(() => {
    const db = getFirestore();
    const fetchProducts = async () => {
      if (!user?.storeId) return setProducts([]);

      // Fetch categories from store profile (storeId first, then user.id fallback)
      try {
        const profileDocIds = Array.from(new Set([user.storeId, user.id].filter(Boolean)));
        let loadedCategories: string[] = [];

        for (const profileDocId of profileDocIds) {
          const profileSnap = await getDoc(doc(db, 'storeProfiles', profileDocId));
          if (!profileSnap.exists()) continue;

          const profileData = profileSnap.data() as { productCategories?: string[] };
          if (Array.isArray(profileData.productCategories) && profileData.productCategories.length > 0) {
            loadedCategories = profileData.productCategories
              .map((category) => (typeof category === 'string' ? category.trim() : ''))
              .filter((category) => category.length > 0);
            if (loadedCategories.length > 0) break;
          }
        }

        setCategories(loadedCategories.length > 0 ? loadedCategories : DEFAULT_PRODUCT_CATEGORIES);
      } catch (error) {
        console.warn('Failed to load profile categories for products, using defaults:', error);
        setCategories(DEFAULT_PRODUCT_CATEGORIES);
      }
      
      // Fetch products
      const productsRef = collection(db, 'products');
      const q = query(productsRef, where('storeId', '==', user.storeId));
      const snapshot = await getDocs(q);
      const productsList: Product[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(productsList);
      
      // Fetch finished goods stock for composed products
      const finishedGoodsRef = collection(db, 'finishedGoodsInventory');
      const fgQuery = query(finishedGoodsRef, where('storeId', '==', user.storeId));
      const fgSnapshot = await getDocs(fgQuery);
      const stockMap: Record<string, number> = {};
      fgSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.productId && typeof data.currentBalance === 'number') {
          stockMap[data.productId] = data.currentBalance;
        }
      });
      setFinishedGoodsStock(stockMap);
      
      // Fetch recipes for composed products
      const recipesRef = collection(db, 'recipes');
      const recipesQuery = query(recipesRef, where('storeId', '==', user.storeId));
      const recipesSnapshot = await getDocs(recipesQuery);
      const recipesList = recipesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecipes(recipesList);
    };
    fetchProducts();
  }, [user?.storeId, user?.id]);

  const categoryOptions = Array.from(new Set([
    ...categories,
    ...(newProduct.category ? [newProduct.category] : []),
  ].map((category) => (typeof category === 'string' ? category.trim() : '')).filter((category) => category.length > 0)));
  const handleAddProduct = async () => {
    if (isSaving) return;
    setIsSaving(true);
    const db = getFirestore();
    if (!newProduct.name || !newProduct.price) {
      toast({ title: "Error", description: "Please fill in required fields", variant: "destructive" });
      setIsSaving(false);
      return;
    }
    if (!user?.storeId) {
      toast({
        title: "Error",
        description: "Your store is not set up correctly. Please refresh the page or contact support.",
        variant: "destructive"
      });
      console.warn("Attempted to add product but user.storeId is missing! User:", user);
      setIsSaving(false);
      return;
    }

    try {
      await assertCanCreateProduct(db, user.storeId, newProduct.productType);
    } catch (error) {
      toast({
        title: 'Plan Limit Reached',
        description: error instanceof Error ? error.message : 'Your current plan does not allow adding this product.',
        variant: 'destructive',
      });
      setIsSaving(false);
      return;
    }

    setIsSaving(true);
    let imageUrl = newProduct.image;
    if (newProduct.imageFile) {
      try {
        await assertCanUploadBytes(db, user.storeId, newProduct.imageFile.size);
        const safeFileName = encodeURIComponent(newProduct.imageFile.name);
        const imageRef = ref(storage, `products/${Date.now()}_${safeFileName}`);
        await new Promise<void>((resolve, reject) => {
          const task = uploadBytesResumable(imageRef, newProduct.imageFile!);
          task.on('state_changed',
            (snap) => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
            (err) => { setUploadProgress(null); reject(err); },
            () => { setUploadProgress(null); resolve(); }
          );
        });
        imageUrl = await getDownloadURL(imageRef);
        await trackStorageUsageAfterUpload(db, user.storeId, newProduct.imageFile.size);
      } catch (error) {
        console.error('Image upload failed:', error);
        toast({ title: "Error", description: `Image upload failed: ${error.message || 'Unknown error'}`, variant: "destructive" });
        setIsSaving(false);
        return;
      }
    }
    try {
      // Generate unique slug for the product
      const productSlug = await generateUniqueSlug(newProduct.name, 'products', undefined);
      
      const productData = {
        name: newProduct.name,
        description: newProduct.description,
        price: parseFloat(newProduct.price),
        category: newProduct.category,
        deliveryTime: newProduct.deliveryTime || '3-5 days',
        image: imageUrl || `https://placehold.co/400x300/38B2AC/fff?text=${encodeURIComponent(newProduct.name)}`,
        storeId: user?.storeId || '',
        slug: productSlug,
        ...getStockPayload(newProduct.productType, 0),
        rating: 0,
        productType: newProduct.productType,
        isService: newProduct.productType === 'service',
        serviceCost: newProduct.productType === 'service' && newProduct.serviceCost ? parseFloat(newProduct.serviceCost) : undefined,
        serviceDuration: newProduct.productType === 'service' && newProduct.serviceDuration
          ? Number(newProduct.serviceDuration)
          : undefined,
        serviceBillingType: newProduct.productType === 'service'
          ? newProduct.serviceBillingType
          : undefined,
        renewalReminderDays: newProduct.productType === 'service' && newProduct.serviceBillingType !== 'one-time' && newProduct.renewalReminderDays
          ? Number(newProduct.renewalReminderDays)
          : undefined,
        recipeId: newProduct.productType === 'composed' && newProduct.recipeId ? newProduct.recipeId : undefined,
        expiryTracking: newProduct.productType !== 'service' ? newProduct.expiryTracking : undefined,
        expiryDate: newProduct.productType !== 'service' && newProduct.expiryTracking && newProduct.expiryDate ? newProduct.expiryDate : undefined,
        expiryAlertDays: newProduct.productType !== 'service' && newProduct.expiryTracking ? newProduct.expiryAlertDays : undefined,
      };
      const cleanProductData = Object.fromEntries(
        Object.entries(productData).map(([k, v]) => [k, v === undefined ? null : v])
      );
  const docRef = await addDoc(collection(db, 'products'), cleanProductData);
      
      // Refetch products to get complete data
      const productsRef = collection(db, 'products');
      const q = query(productsRef, where('storeId', '==', user.storeId));
      const snapshot = await getDocs(q);
      const productsList: Product[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(productsList);
      
    setNewProduct({
      name: '', description: '', price: '', category: '', deliveryTime: '', image: '', imageFile: null, stock: '',
      productType: 'simple', serviceCost: '', serviceDuration: '', serviceBillingType: 'one-time', renewalReminderDays: '', recipeId: '',
      expiryTracking: false, expiryDate: '', expiryAlertDays: 30,
    });
      setIsAddingProduct(false);
      toast({ title: "Success", description: "Product added successfully!" });
    } catch (err) {
      console.error('Failed to add product:', err);
      toast({ title: "Error", description: `Failed to add product: ${err.message || 'Unknown error'}`, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
      return;
    }
    
    try {
      console.log('Attempting to delete product:', productId);
      const db = getFirestore();
      await deleteDoc(doc(db, 'products', productId));
      setProducts(products.filter(p => p.id !== productId));
      toast({ title: "Success", description: "Product deleted successfully!" });
      console.log('Product deleted successfully');
    } catch (err) {
      console.error('Delete error:', err);
      toast({ title: "Error", description: `Failed to delete product: ${err.message}`, variant: "destructive" });
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setNewProduct({
      name: product.name || '',
      description: product.description || '',
      price: product.price?.toString() || '',
      category: product.category || '',
      deliveryTime: product.deliveryTime || '',
      image: product.image || '',
      imageFile: null,
      stock: typeof product.stock === 'number' ? product.stock.toString() : '',
      productType: product.productType || 'simple',
      serviceCost: product.serviceCost?.toString() || '',
      serviceDuration: product.serviceDuration?.toString() || '',
      serviceBillingType: product.serviceBillingType || 'one-time',
      renewalReminderDays: product.renewalReminderDays?.toString() || '',
      recipeId: product.recipeId || '',
      expiryTracking: product.expiryTracking || false,
      expiryDate: product.expiryDate || '',
      expiryAlertDays: product.expiryAlertDays ?? 30,
    });
  };

  const handleUpdateProduct = async () => {
    if (isSaving) return;
    const db = getFirestore();
    if (!editingProduct || !newProduct.name || !newProduct.price) {
      toast({ title: "Error", description: "Please fill in required fields", variant: "destructive" });
      return;
    }
    
    // Check if recipe is changing for composed product
    if (newProduct.productType === 'composed' && newProduct.recipeId !== editingProduct.recipeId) {
      // Check for active production batches
      const batchesRef = collection(db, 'productionBatches');
      const batchesQuery = query(batchesRef, 
        where('storeId', '==', user.storeId),
        where('productId', '==', editingProduct.id),
        where('status', 'in', ['pending', 'in-progress'])
      );
      const batchesSnapshot = await getDocs(batchesQuery);
      
      if (!batchesSnapshot.empty) {
        toast({ 
          title: "Cannot Change Recipe", 
          description: "This product has active production batches. Complete or cancel them first.", 
          variant: "destructive" 
        });
        return;
      }
    }

    if (editingProduct.productType !== 'composed' && newProduct.productType === 'composed' && user?.storeId) {
      try {
        await assertCanCreateProduct(db, user.storeId, 'composed');
      } catch (error) {
        toast({
          title: 'Plan Limit Reached',
          description: error instanceof Error ? error.message : 'Your current plan does not allow switching to composed products.',
          variant: 'destructive',
        });
        return;
      }
    }

    setIsSaving(true);
    let imageUrl = newProduct.image;
    if (newProduct.imageFile) {
      try {
        if (user?.storeId) {
          await assertCanUploadBytes(db, user.storeId, newProduct.imageFile.size);
        }
        const safeFileName = encodeURIComponent(newProduct.imageFile.name);
        const imageRef = ref(storage, `products/${Date.now()}_${safeFileName}`);
        await new Promise<void>((resolve, reject) => {
          const task = uploadBytesResumable(imageRef, newProduct.imageFile!);
          task.on('state_changed',
            (snap) => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
            (err) => { setUploadProgress(null); reject(err); },
            () => { setUploadProgress(null); resolve(); }
          );
        });
        imageUrl = await getDownloadURL(imageRef);
        if (user?.storeId) {
          await trackStorageUsageAfterUpload(db, user.storeId, newProduct.imageFile.size);
        }
      } catch {
        toast({ title: "Error", description: "Image upload failed.", variant: "destructive" });
        return;
      }
    }
    try {
      // Generate slug if product doesn't have one yet
      const productSlug = editingProduct.slug || await generateUniqueSlug(newProduct.name, 'products', editingProduct.id);
      
      const updatedProduct = {
        name: newProduct.name,
        description: newProduct.description,
        price: parseFloat(newProduct.price),
        category: newProduct.category,
        deliveryTime: newProduct.deliveryTime,
        image: imageUrl || editingProduct.image,
        storeId: editingProduct.storeId,
        slug: productSlug,
        ...getStockPayload(newProduct.productType, newProduct.stock),
        rating: editingProduct.rating,
        productType: newProduct.productType,
        isService: newProduct.productType === 'service',
        serviceCost: newProduct.productType === 'service' && newProduct.serviceCost ? Number(newProduct.serviceCost) : null,
        serviceDuration: newProduct.productType === 'service' && newProduct.serviceDuration ? Number(newProduct.serviceDuration) : null,
        serviceBillingType: newProduct.productType === 'service' ? newProduct.serviceBillingType : null,
        renewalReminderDays: newProduct.productType === 'service' && newProduct.serviceBillingType !== 'one-time' && newProduct.renewalReminderDays
          ? Number(newProduct.renewalReminderDays)
          : null,
        recipeId: newProduct.productType === 'composed'
          ? (newProduct.recipeId || editingProduct.recipeId || null)
          : null,
        costPrice: newProduct.productType === 'composed' && newProduct.recipeId 
          ? (recipes.find(r => r.id === newProduct.recipeId)?.costPerUnit || 0)
          : (newProduct.productType === 'composed' ? (editingProduct.costPrice || 0) : null),
        expiryTracking: newProduct.productType !== 'service' ? newProduct.expiryTracking : undefined,
        expiryDate: newProduct.productType !== 'service' && newProduct.expiryTracking && newProduct.expiryDate ? newProduct.expiryDate : undefined,
        expiryAlertDays: newProduct.productType !== 'service' && newProduct.expiryTracking ? newProduct.expiryAlertDays : undefined,
      };
      const cleanUpdatedProduct = Object.fromEntries(
        Object.entries(updatedProduct).map(([k, v]) => [k, v === undefined ? null : v])
      );
  await updateDoc(doc(db, 'products', editingProduct.id), cleanUpdatedProduct);
      
      // Update composedProducts collection if this is a composed product
      if (newProduct.productType === 'composed' && newProduct.recipeId) {
        const composedRef = collection(db, 'composedProducts');
        const composedQuery = query(composedRef, 
          where('storeId', '==', user.storeId),
          where('productId', '==', editingProduct.id)
        );
        const composedSnapshot = await getDocs(composedQuery);
        
        if (!composedSnapshot.empty) {
          const composedDoc = composedSnapshot.docs[0];
          const recipe = recipes.find(r => r.id === newProduct.recipeId);
          await updateDoc(doc(db, 'composedProducts', composedDoc.id), {
            recipeId: newProduct.recipeId,
            costPrice: recipe?.costPerUnit || 0,
            updatedAt: new Date().toISOString()
          });
        }
      }
      
      setProducts(products.map(p => p.id === editingProduct.id ? { id: editingProduct.id, ...updatedProduct } : p));
      setEditingProduct(null);
  setNewProduct({
    name: '', description: '', price: '', category: '', deliveryTime: '', image: '', imageFile: null, stock: '',
    productType: 'simple', serviceCost: '', serviceDuration: '', serviceBillingType: 'one-time', renewalReminderDays: '', recipeId: '',
    expiryTracking: false, expiryDate: '', expiryAlertDays: 30,
  });
      toast({ title: "Success", description: "Product updated successfully!" });
    } catch (err) {
      toast({ title: "Error", description: "Failed to update product.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStock = async (product: Product) => {
    const db = getFirestore();
    const updatedStock = !product.inStock;
    await updateDoc(doc(db, 'products', product.id), { inStock: updatedStock });
    setProducts(products.map(p => p.id === product.id ? { ...p, inStock: updatedStock } : p));
    toast({ title: 'Stock Updated', description: `Product is now ${updatedStock ? 'in stock' : 'out of stock'}.` });
  };

  return (
    <div className="min-h-screen bg-background">
      {isMobile && <MobileHeader title="Manage Products" />}
      <div className="p-4 md:p-6">
        <BackButton label="Back to Dashboard" />
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Package className="h-6 w-6" />
                {canManageInventory ? 'Manage Products' : 'View Products'}
              </h1>
              <p className="text-muted-foreground">
                {canManageInventory 
                  ? 'Add, edit, and manage your store products'
                  : 'View your store products'}
              </p>
            </div>
            
            {canManageInventory && (
              <Dialog open={isAddingProduct} onOpenChange={setIsAddingProduct}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Product
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Product</DialogTitle>
                  <DialogDescription>
                    Fill in the product details below.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Product Name *</Label>
                    <Input
                      id="name"
                      value={newProduct.name}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter product name"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="price">Price *</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={newProduct.price === 0 || newProduct.price === '' ? '' : newProduct.price}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, price: e.target.value === '' ? 0 : e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select value={newProduct.category} onValueChange={(value) => setNewProduct(prev => ({ ...prev, category: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map((category) => (
                          <SelectItem key={category} value={category}>{category}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={newProduct.description}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Product description"
                      rows={3}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="deliveryTime">Delivery Time</Label>
                    <Input
                      id="deliveryTime"
                      value={newProduct.deliveryTime}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, deliveryTime: e.target.value }))}
                      placeholder="e.g., 3-5 days"
                    />
                  </div>

                  <div>
                    <Label htmlFor="productType">Product Type *</Label>
                    <Select
                      value={newProduct.productType}
                      onValueChange={(value: ProductType) => setNewProduct(prev => ({ ...prev, productType: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="simple">Simple Item - Buy & Sell with Stock</SelectItem>
                        <SelectItem value="service">Service - No Stock, Has Cost</SelectItem>
                        <SelectItem value="composed">Composed Product - Use Recipes Page</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {newProduct.productType === 'service' && (
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="serviceCost">Service Cost</Label>
                        <Input
                          id="serviceCost"
                          type="number"
                          step="0.01"
                          value={newProduct.serviceCost === 0 || newProduct.serviceCost === '' ? '' : newProduct.serviceCost}
                          onChange={(e) => setNewProduct(prev => ({ ...prev, serviceCost: e.target.value === '' ? 0 : e.target.value }))}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label htmlFor="serviceDuration">Service Duration (minutes)</Label>
                        <Input
                          id="serviceDuration"
                          type="number"
                          min="1"
                          value={newProduct.serviceDuration === 0 || newProduct.serviceDuration === '' ? '' : newProduct.serviceDuration}
                          onChange={(e) => setNewProduct(prev => ({ ...prev, serviceDuration: e.target.value === '' ? 0 : e.target.value }))}
                          placeholder="60"
                        />
                      </div>
                      <div>
                        <Label htmlFor="serviceBillingType">Service Billing Type</Label>
                        <Select
                          value={newProduct.serviceBillingType}
                          onValueChange={(value: ServiceBillingType) => setNewProduct(prev => ({ ...prev, serviceBillingType: value }))}
                        >
                          <SelectTrigger id="serviceBillingType">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="one-time">One-Time Service</SelectItem>
                            <SelectItem value="monthly">Monthly Renewable Service</SelectItem>
                            <SelectItem value="yearly">Yearly Renewable Service</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {newProduct.serviceBillingType !== 'one-time' && (
                        <div>
                          <Label htmlFor="renewalReminderDays">Renewal Reminder (days before)</Label>
                          <Input
                            id="renewalReminderDays"
                            type="number"
                            min="1"
                            value={newProduct.renewalReminderDays === 0 || newProduct.renewalReminderDays === '' ? '' : newProduct.renewalReminderDays}
                            onChange={(e) => setNewProduct(prev => ({ ...prev, renewalReminderDays: e.target.value === '' ? 0 : e.target.value }))}
                            placeholder="7"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {newProduct.productType === 'composed' && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        For composed products, create the product here first, then go to Composed Products page to set up the recipe.
                      </AlertDescription>
                    </Alert>
                  )}



                  {newProduct.productType !== 'service' && (
                  <div className="space-y-3 border rounded-md p-3">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="expiryTracking"
                        checked={newProduct.expiryTracking}
                        onCheckedChange={(checked) => setNewProduct(prev => ({ ...prev, expiryTracking: checked }))}
                      />
                      <Label htmlFor="expiryTracking">Enable Expiry Tracking</Label>
                    </div>
                    {newProduct.expiryTracking && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="expiryDate">Expiry Date</Label>
                          <Input
                            id="expiryDate"
                            type="date"
                            value={newProduct.expiryDate}
                            onChange={(e) => setNewProduct(prev => ({ ...prev, expiryDate: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="expiryAlertDays">Alert Before (days)</Label>
                          <Input
                            id="expiryAlertDays"
                            type="number"
                            min="1"
                            value={newProduct.expiryAlertDays}
                            onChange={(e) => setNewProduct(prev => ({ ...prev, expiryAlertDays: e.target.value === '' ? '' as any : parseInt(e.target.value) }))}
                            onBlur={(e) => setNewProduct(prev => ({ ...prev, expiryAlertDays: parseInt(e.target.value) || 30 }))}
                            placeholder="30"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  )}
                  
                  <div>
                    <Label htmlFor="image">Image URL</Label>
                    <Input
                      id="image"
                      value={newProduct.image}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, image: e.target.value }))}
                      placeholder="https://example.com/image.jpg"
                    />
                    <Label htmlFor="imageFile" className="mt-2 block">Or upload image</Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        id="imageFile"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        style={{ display: 'none' }}
                        onChange={e => setNewProduct(prev => ({ ...prev, imageFile: e.target.files?.[0] || null }))}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full md:w-auto"
                        onClick={() => document.getElementById('imageFile')?.click()}
                      >
                        {newProduct.imageFile ? 'Image Selected' : 'Upload from Device'}
                      </Button>
                      {newProduct.imageFile && (
                        <span className="truncate text-xs text-gray-500 max-w-[120px]">{newProduct.imageFile.name}</span>
                      )}
                    </div>
                    {uploadProgress !== null && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Uploading...</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all duration-200"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddingProduct(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddProduct} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Add Product'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <Card key={product.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{product.name}</CardTitle>
                    <CardDescription className="text-xl font-bold text-primary">
                      ${product.price}
                    </CardDescription>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <Badge variant="secondary">{product.category}</Badge>
                    <Badge variant={
                      product.productType === 'service' ? 'default' : 
                      product.productType === 'composed' ? 'outline' : 
                      'secondary'
                    }>
                      {product.productType === 'service'
                        ? (product.serviceBillingType === 'monthly'
                            ? 'Service • Monthly'
                            : product.serviceBillingType === 'yearly'
                              ? 'Service • Yearly'
                              : 'Service • One-Time')
                        : 
                       product.productType === 'composed' ? 'Composed' : 
                       'Item'}
                    </Badge>
                    {product.expiryTracking && product.expiryDate && hasExpired(product) && (
                      <Badge variant="destructive">Expired</Badge>
                    )}
                    {product.expiryTracking && product.expiryDate && isExpiringSoon(product) && (
                      <Badge className="bg-orange-500 text-white hover:bg-orange-600">
                        Expires in {getDaysUntilExpiry(product.expiryDate)}d
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <img 
                  src={product.image || (product as any).imageUrl} 
                  alt={product.name}
                  className="w-full h-32 object-cover rounded-md mb-3"
                />
                
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {product.description}
                </p>
                
                {/* Stock Information */}
                <div className="mb-3 p-2 bg-muted rounded-md">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Stock Quantity:</span>
                    <span className={`text-lg font-bold ${
                      (() => {
                        if (product.productType === 'service') return 'text-muted-foreground';
                        const actualStock = finishedGoodsStock[product.id] ?? product.stock ?? 0;
                        return actualStock <= 10 ? 'text-red-600' : 
                               actualStock <= 50 ? 'text-yellow-600' : 
                               'text-green-600';
                      })()
                    }`}>
                      {product.productType === 'service' ? 'N/A' : (finishedGoodsStock[product.id] ?? product.stock ?? 0)}
                    </span>
                  </div>
                  {(() => {
                    if (product.productType === 'service') return null;
                    const actualStock = finishedGoodsStock[product.id] ?? product.stock ?? 0;
                    return actualStock <= 10 && (
                      <p className="text-xs text-red-600 mt-1">⚠️ Low stock alert!</p>
                    );
                  })()}
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                  <span>Delivery: {product.deliveryTime}</span>
                  <span>•</span>
                  <span className={product.inStock ? "text-green-600" : "text-red-600"}>
                    {product.inStock ? "In Stock" : "Out of Stock"}
                  </span>
                  {canManageInventory && (
                    <>
                      <Switch checked={product.inStock} onCheckedChange={() => handleToggleStock(product)} className="ml-2" />
                      <span className="ml-1">Toggle</span>
                    </>
                  )}
                </div>
                
                <div className="flex gap-2">
                  {canManageInventory && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditProduct(product)}
                        className="flex-1"
                      >
                        <Edit3 className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteProduct(product.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                  {!canManageInventory && (
                    <Badge variant="secondary" className="w-full justify-center">View Only</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          
          {products.length === 0 && (
            <div className="col-span-full">
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Products Yet</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    {canManageInventory 
                      ? "Start building your store by adding your first product"
                      : "No products available to view"}
                  </p>
                  {canManageInventory && (
                    <Button onClick={() => setIsAddingProduct(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Your First Product
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Edit Product Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>
              Update your product details below.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Product Name *</Label>
              <Input
                id="edit-name"
                value={newProduct.name}
                onChange={(e) => setNewProduct(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter product name"
              />
            </div>
            
            <div>
              <Label htmlFor="edit-price">Price *</Label>
              <Input
                id="edit-price"
                type="number"
                step="0.01"
                value={newProduct.price === 0 || newProduct.price === '' ? '' : newProduct.price}
                onChange={(e) => setNewProduct(prev => ({ ...prev, price: e.target.value === '' ? 0 : e.target.value }))}
                placeholder="0.00"
              />
            </div>
            
            <div>
              <Label htmlFor="edit-category">Category</Label>
              <Select value={newProduct.category} onValueChange={(value) => setNewProduct(prev => ({ ...prev, category: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((category) => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="edit-productType">Product Type *</Label>
              <Select
                value={newProduct.productType}
                onValueChange={(value: ProductType) => setNewProduct(prev => ({ ...prev, productType: value }))}
              >
                <SelectTrigger id="edit-productType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple">Simple Item - Buy & Sell with Stock</SelectItem>
                  <SelectItem value="service">Service - No Stock, Has Cost</SelectItem>
                  <SelectItem value="composed">Composed Product - Use Recipes Page</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newProduct.productType === 'service' && (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="edit-serviceCost">Service Cost</Label>
                  <Input
                    id="edit-serviceCost"
                    type="number"
                    step="0.01"
                    value={newProduct.serviceCost === 0 || newProduct.serviceCost === '' ? '' : newProduct.serviceCost}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, serviceCost: e.target.value === '' ? 0 : e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-serviceDuration">Service Duration (minutes)</Label>
                  <Input
                    id="edit-serviceDuration"
                    type="number"
                    min="1"
                    value={newProduct.serviceDuration === 0 || newProduct.serviceDuration === '' ? '' : newProduct.serviceDuration}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, serviceDuration: e.target.value === '' ? 0 : e.target.value }))}
                    placeholder="60"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-serviceBillingType">Service Billing Type</Label>
                  <Select
                    value={newProduct.serviceBillingType}
                    onValueChange={(value: ServiceBillingType) => setNewProduct(prev => ({ ...prev, serviceBillingType: value }))}
                  >
                    <SelectTrigger id="edit-serviceBillingType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="one-time">One-Time Service</SelectItem>
                      <SelectItem value="monthly">Monthly Renewable Service</SelectItem>
                      <SelectItem value="yearly">Yearly Renewable Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newProduct.serviceBillingType !== 'one-time' && (
                  <div>
                    <Label htmlFor="edit-renewalReminderDays">Renewal Reminder (days before)</Label>
                    <Input
                      id="edit-renewalReminderDays"
                      type="number"
                      min="1"
                      value={newProduct.renewalReminderDays === 0 || newProduct.renewalReminderDays === '' ? '' : newProduct.renewalReminderDays}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, renewalReminderDays: e.target.value === '' ? 0 : e.target.value }))}
                      placeholder="7"
                    />
                  </div>
                )}
              </div>
            )}
            
            {newProduct.productType === 'composed' && (
              <div>
                <Label htmlFor="edit-recipeId">Recipe</Label>
                <Select 
                  value={newProduct.recipeId || ''} 
                  onValueChange={(value) => {
                    const recipe = recipes.find(r => r.id === value);
                    setNewProduct(prev => ({ 
                      ...prev, 
                      recipeId: value,
                      price: recipe?.costPerUnit ? (recipe.costPerUnit * 2.5).toFixed(2) : prev.price
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select recipe" />
                  </SelectTrigger>
                  <SelectContent>
                    {recipes.map(recipe => (
                      <SelectItem key={recipe.id} value={recipe.id}>
                        {recipe.name} (Cost: ${recipe.costPerUnit?.toFixed(2) || '0.00'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={newProduct.description}
                onChange={(e) => setNewProduct(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Product description"
                rows={3}
              />
            </div>
            
            <div>
              <Label htmlFor="edit-deliveryTime">Delivery Time</Label>
              <Input
                id="edit-deliveryTime"
                value={newProduct.deliveryTime}
                onChange={(e) => setNewProduct(prev => ({ ...prev, deliveryTime: e.target.value }))}
                placeholder="e.g., 3-5 days"
              />
            </div>
            {newProduct.productType !== 'service' && (
              <div>
                <Label htmlFor="edit-stock">Stock Quantity</Label>
                <Input
                  id="edit-stock"
                  type="number"
                  min="0"
                  value={newProduct.stock === 0 || newProduct.stock === '' ? '' : newProduct.stock}
                  onChange={e => setNewProduct(prev => ({ ...prev, stock: e.target.value === '' ? 0 : e.target.value }))}
                  placeholder="0"
                />
              </div>
            )}

            {newProduct.productType !== 'service' && (
            <div className="space-y-3 border rounded-md p-3">
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-expiryTracking"
                  checked={newProduct.expiryTracking}
                  onCheckedChange={(checked) => setNewProduct(prev => ({ ...prev, expiryTracking: checked }))}
                />
                <Label htmlFor="edit-expiryTracking">Enable Expiry Tracking</Label>
              </div>
              {newProduct.expiryTracking && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="edit-expiryDate">Expiry Date</Label>
                    <Input
                      id="edit-expiryDate"
                      type="date"
                      value={newProduct.expiryDate}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, expiryDate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-expiryAlertDays">Alert Before (days)</Label>
                    <Input
                      id="edit-expiryAlertDays"
                      type="number"
                      min="1"
                      value={newProduct.expiryAlertDays}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, expiryAlertDays: e.target.value === '' ? '' as any : parseInt(e.target.value) }))}
                      onBlur={(e) => setNewProduct(prev => ({ ...prev, expiryAlertDays: parseInt(e.target.value) || 30 }))}
                      placeholder="30"
                    />
                  </div>
                </div>
              )}
            </div>
            )}
            
            <div>
              <Label htmlFor="edit-image">Image URL</Label>
              <Input
                id="edit-image"
                value={newProduct.image}
                onChange={(e) => setNewProduct(prev => ({ ...prev, image: e.target.value }))}
                placeholder="https://example.com/image.jpg"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProduct(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateProduct} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Update Product'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminProducts;