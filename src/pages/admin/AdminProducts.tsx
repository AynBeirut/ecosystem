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
import { Product } from '@/types/product';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import MobileHeader from '@/components/MobileHeader';
import BackButton from '@/components/BackButton';
import { useIsMobile } from '@/hooks/use-mobile';
import { getFirestore, collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { generateUniqueSlug } from '@/lib/slugify';

const AdminProducts: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [products, setProducts] = useState<Product[]>([]);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    deliveryTime: '',
    image: '',
    imageFile: null as File | null,
    stock: '',
    productType: 'simple' as 'simple' | 'service' | 'composed',
    serviceCost: ''
  });
  // Load products from Firestore on mount and when user changes
  useEffect(() => {
    const db = getFirestore();
    const fetchProducts = async () => {
      if (!user?.storeId) return setProducts([]);
      const productsRef = collection(db, 'products');
      const q = query(productsRef, where('storeId', '==', user.storeId));
      const snapshot = await getDocs(q);
      const productsList: Product[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(productsList);
    };
    fetchProducts();
  }, [user?.storeId]);
  const handleAddProduct = async () => {
    const db = getFirestore();
    if (!newProduct.name || !newProduct.price) {
      toast({ title: "Error", description: "Please fill in required fields", variant: "destructive" });
      return;
    }
    if (!user?.storeId) {
      toast({
        title: "Error",
        description: "Your store is not set up correctly. Please refresh the page or contact support.",
        variant: "destructive"
      });
      console.warn("Attempted to add product but user.storeId is missing! User:", user);
      return;
    }
    let imageUrl = newProduct.image;
    if (newProduct.imageFile) {
      try {
        const safeFileName = encodeURIComponent(newProduct.imageFile.name);
        const imageRef = ref(storage, `products/${Date.now()}_${safeFileName}`);
        await uploadBytes(imageRef, newProduct.imageFile);
        imageUrl = await getDownloadURL(imageRef);
      } catch (error) {
        console.error('Image upload failed:', error);
        toast({ title: "Error", description: `Image upload failed: ${error.message || 'Unknown error'}`, variant: "destructive" });
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
        inStock: (newProduct.stock === '' || Number(newProduct.stock) > 0),
        stock: newProduct.stock === '' ? 0 : Number(newProduct.stock),
        rating: 0,
        productType: newProduct.productType,
        isService: newProduct.productType === 'service',
        serviceCost: newProduct.productType === 'service' && newProduct.serviceCost ? parseFloat(newProduct.serviceCost) : undefined
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
      
    setNewProduct({ name: '', description: '', price: '', category: '', deliveryTime: '', image: '', imageFile: null, stock: '', productType: 'simple', serviceCost: '' });
      setIsAddingProduct(false);
      toast({ title: "Success", description: "Product added successfully!" });
    } catch (err) {
      console.error('Failed to add product:', err);
      toast({ title: "Error", description: `Failed to add product: ${err.message || 'Unknown error'}`, variant: "destructive" });
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      const db = getFirestore();
      await deleteDoc(doc(db, 'products', productId));
      setProducts(products.filter(p => p.id !== productId));
      toast({ title: "Success", description: "Product deleted successfully!" });
    } catch (err) {
      toast({ title: "Error", description: "Failed to delete product.", variant: "destructive" });
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setNewProduct({
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      category: product.category,
      deliveryTime: product.deliveryTime,
      image: product.image,
      imageFile: null,
      stock: typeof product.stock === 'number' ? product.stock.toString() : ''
    });
  };

  const handleUpdateProduct = async () => {
    const db = getFirestore();
    if (!editingProduct || !newProduct.name || !newProduct.price) {
      toast({ title: "Error", description: "Please fill in required fields", variant: "destructive" });
      return;
    }
    let imageUrl = newProduct.image;
    if (newProduct.imageFile) {
      try {
        const safeFileName = encodeURIComponent(newProduct.imageFile.name);
        const imageRef = ref(storage, `products/${Date.now()}_${safeFileName}`);
        await uploadBytes(imageRef, newProduct.imageFile);
        imageUrl = await getDownloadURL(imageRef);
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
        inStock: (newProduct.stock === '' || Number(newProduct.stock) > 0),
        stock: newProduct.stock === '' ? 0 : Number(newProduct.stock),
        rating: editingProduct.rating
      };
      const cleanUpdatedProduct = Object.fromEntries(
        Object.entries(updatedProduct).map(([k, v]) => [k, v === undefined ? null : v])
      );
  await updateDoc(doc(db, 'products', editingProduct.id), cleanUpdatedProduct);
      setProducts(products.map(p => p.id === editingProduct.id ? { id: editingProduct.id, ...updatedProduct } : p));
      setEditingProduct(null);
  setNewProduct({ name: '', description: '', price: '', category: '', deliveryTime: '', image: '', imageFile: null, stock: '' });
      toast({ title: "Success", description: "Product updated successfully!" });
    } catch (err) {
      toast({ title: "Error", description: "Failed to update product.", variant: "destructive" });
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
        <BackButton to="/admin/inventory" label="Back to Inventory" />
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Package className="h-6 w-6" />
                Manage Products
              </h1>
              <p className="text-muted-foreground">Add, edit, and manage your store products</p>
            </div>
            
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
                      onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
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
                      onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value === '' ? 0 : e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select value={newProduct.category} onValueChange={(value) => setNewProduct({ ...newProduct, category: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Electronics">Electronics</SelectItem>
                        <SelectItem value="Outdoor Gear">Outdoor Gear</SelectItem>
                        <SelectItem value="Home & Decor">Home & Decor</SelectItem>
                        <SelectItem value="Clothing">Clothing</SelectItem>
                        <SelectItem value="Digital Product">Digital Product</SelectItem>
                        <SelectItem value="Books">Books</SelectItem>
                        <SelectItem value="Beauty & Health">Beauty & Health</SelectItem>
                        <SelectItem value="Toys & Games">Toys & Games</SelectItem>
                        <SelectItem value="Sports">Sports</SelectItem>
                        <SelectItem value="Food & Beverage">Food & Beverage</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={newProduct.description}
                      onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                      placeholder="Product description"
                      rows={3}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="deliveryTime">Delivery Time</Label>
                    <Input
                      id="deliveryTime"
                      value={newProduct.deliveryTime}
                      onChange={(e) => setNewProduct({ ...newProduct, deliveryTime: e.target.value })}
                      placeholder="e.g., 3-5 days"
                    />
                  </div>

                  <div>
                    <Label htmlFor="productType">Product Type *</Label>
                    <Select
                      value={newProduct.productType}
                      onValueChange={(value: any) => setNewProduct({ ...newProduct, productType: value })}
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
                    <div>
                      <Label htmlFor="serviceCost">Service Cost</Label>
                      <Input
                        id="serviceCost"
                        type="number"
                        step="0.01"
                        value={newProduct.serviceCost === 0 || newProduct.serviceCost === '' ? '' : newProduct.serviceCost}
                        onChange={(e) => setNewProduct({ ...newProduct, serviceCost: e.target.value === '' ? 0 : e.target.value })}
                        placeholder="0.00"
                      />
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
                  <div>
                    <Label htmlFor="stock">Stock Quantity</Label>
                    <Input
                      id="stock"
                      type="number"
                      min="0"
                      value={newProduct.stock === 0 || newProduct.stock === '' ? '' : newProduct.stock}
                      onChange={e => setNewProduct({ ...newProduct, stock: e.target.value === '' ? 0 : e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  )}
                  
                  <div>
                    <Label htmlFor="image">Image URL</Label>
                    <Input
                      id="image"
                      value={newProduct.image}
                      onChange={(e) => setNewProduct({ ...newProduct, image: e.target.value })}
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
                        onChange={e => setNewProduct({ ...newProduct, imageFile: e.target.files?.[0] || null })}
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
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddingProduct(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddProduct}>
                    Add Product
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Extend My Store Button for storage upgrade */}
        <div className="flex justify-center mt-8">
          <Button
            className="bg-market-primary text-white px-6 py-2 rounded-lg font-semibold shadow"
            onClick={() => {
              // Trigger payment flow for storage upgrade
              window.location.href = '/upgrade-storage';
            }}
          >
            Extend My Store (10GB for $5/month)
          </Button>
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
                      {product.productType === 'service' ? 'Service' : 
                       product.productType === 'composed' ? 'Composed' : 
                       'Item'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <img 
                  src={product.image} 
                  alt={product.name}
                  className="w-full h-32 object-cover rounded-md mb-3"
                />
                
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {product.description}
                </p>
                

                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                  <span>Delivery: {product.deliveryTime}</span>
                  <span>•</span>
                  <span className={product.inStock ? "text-green-600" : "text-red-600"}>
                    {product.inStock ? "In Stock" : "Out of Stock"}
                  </span>
                  <Switch checked={product.inStock} onCheckedChange={() => handleToggleStock(product)} className="ml-2" />
                  <span className="ml-1">Toggle Stock</span>
                </div>
                
                <div className="flex gap-2">
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
                    Start building your store by adding your first product
                  </p>
                  <Button onClick={() => setIsAddingProduct(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Product
                  </Button>
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
                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
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
                onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value === '' ? 0 : e.target.value })}
                placeholder="0.00"
              />
            </div>
            
            <div>
              <Label htmlFor="edit-category">Category</Label>
              <Select value={newProduct.category} onValueChange={(value) => setNewProduct({ ...newProduct, category: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Electronics">Electronics</SelectItem>
                  <SelectItem value="Outdoor Gear">Outdoor Gear</SelectItem>
                  <SelectItem value="Home & Decor">Home & Decor</SelectItem>
                  <SelectItem value="Clothing">Clothing</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={newProduct.description}
                onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                placeholder="Product description"
                rows={3}
              />
            </div>
            
            <div>
              <Label htmlFor="edit-deliveryTime">Delivery Time</Label>
              <Input
                id="edit-deliveryTime"
                value={newProduct.deliveryTime}
                onChange={(e) => setNewProduct({ ...newProduct, deliveryTime: e.target.value })}
                placeholder="e.g., 3-5 days"
              />
            </div>
            <div>
              <Label htmlFor="edit-stock">Stock Quantity</Label>
              <Input
                id="edit-stock"
                type="number"
                min="0"
                value={newProduct.stock === 0 || newProduct.stock === '' ? '' : newProduct.stock}
                onChange={e => setNewProduct({ ...newProduct, stock: e.target.value === '' ? 0 : e.target.value })}
                placeholder="0"
              />
            </div>
            
            <div>
              <Label htmlFor="edit-image">Image URL</Label>
              <Input
                id="edit-image"
                value={newProduct.image}
                onChange={(e) => setNewProduct({ ...newProduct, image: e.target.value })}
                placeholder="https://example.com/image.jpg"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProduct(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateProduct}>
              Update Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminProducts;