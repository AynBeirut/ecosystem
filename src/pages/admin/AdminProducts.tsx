import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/context/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Edit3, Package, AlertCircle, RefreshCw } from 'lucide-react';
import {
  buildSupplierFieldsFromUrl,
  formatSupplierPlatformLabel,
  formatSupplierSyncLabel,
  syncDropshipProduct,
} from '@/lib/dropship';
import DropshipSupplierFields from '@/components/admin/DropshipSupplierFields';
import type { SupplierPlatform } from '@/types/product';
import { getActualStoreId } from '@/lib/storeUtils';
import { Switch } from '@/components/ui/switch';
import { Product, ProductType, ServiceBillingType } from '@/types/product';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import ClampedText, {
  FORM_DIALOG_BODY,
  FORM_DIALOG_FOOTER,
  FORM_DIALOG_HEADER,
  FORM_DIALOG_SHELL,
  FORM_FILE_BUTTON_CLASS,
  SelectedFileLabel,
} from '@/components/ClampedText';
import { getFirestore, collection, query, where, getDocs, doc, updateDoc, deleteDoc, getDoc, runTransaction, increment } from 'firebase/firestore';
import { uploadProductImage } from '@/lib/productImageUpload';
import { generateUniqueSlug } from '@/lib/slugify';
import { assertCanCreateProduct, assertCanUploadBytes, assertCanUploadCatalogImage, trackStorageUsageAfterUpload, getSubscriptionSnapshot } from '@/lib/subscriptionEnforcement';
import { CATALOG_PRODUCT_COUNT_VERSION, isCatalogCountableProductData } from '@/lib/catalogProductCount';
import { getDaysUntilExpiry, hasExpired, isExpiringSoon } from '@/lib/expiryUtils';
import { waitForAuthToken } from '@/lib/waitForAuthToken';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useStoreCurrency } from '@/hooks/useStoreCurrency';
import { getCurrencyDecimals } from '@/lib/money/currencies';

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

const AdminProducts: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { money, currency } = useStoreCurrency();
  const [products, setProducts] = useState<Product[]>([]);
  const [finishedGoodsStock, setFinishedGoodsStock] = useState<Record<string, number>>({});
  const [recipes, setRecipes] = useState<Array<{ id: string; name?: string; costPerUnit?: number }>>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_PRODUCT_CATEGORIES);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [syncingProductId, setSyncingProductId] = useState<string | null>(null);
  const [servicePolicy, setServicePolicy] = useState({
    allowServiceProducts: true,
    allowRecurringSubscriptions: true,
    defaultServiceBillingType: 'one-time' as ServiceBillingType,
    minimumServiceDurationMinutes: 0,
    defaultRenewalReminderDays: 7,
  });
  const [firestoreReady, setFirestoreReady] = useState(false);
  const [planLimits, setPlanLimits] = useState<{
    productLimit: number | null;
    storageLimitMb: number | null;
    storageUsedMb: number;
    allowsCatalogImages: boolean;
  } | null>(null);
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);
  const [limitDialogMessage, setLimitDialogMessage] = useState('');
  const storeId = getActualStoreId(user);
  const catalogImagesAllowed = planLimits?.allowsCatalogImages !== false;
  const countableProductsCount = products.filter((product) =>
    isCatalogCountableProductData(product as unknown as Record<string, unknown>),
  ).length;

  useEffect(() => {
    if (!user?.id) {
      setFirestoreReady(false);
      return;
    }
    let cancelled = false;
    void waitForAuthToken().then((firebaseUser) => {
      if (!cancelled) setFirestoreReady(Boolean(firebaseUser));
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);
  
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
    imageAlt: '',
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
    supplierProductUrl: '',
    supplierPlatform: 'shein' as SupplierPlatform,
    dropshipEnabled: false,
  });

  const getSupplierPayload = (
    enabled: boolean,
    platform: SupplierPlatform,
    url: string,
    productType: ProductType,
  ) => {
    if (productType !== 'simple' || !enabled) {
      return {
        supplierPlatform: null,
        supplierProductUrl: null,
        supplierSyncEnabled: false,
      };
    }
    const trimmed = url.trim();
    if (!trimmed) {
      return {
        supplierPlatform: null,
        supplierProductUrl: null,
        supplierSyncEnabled: false,
      };
    }
    return buildSupplierFieldsFromUrl(platform, trimmed);
  };

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
  // Load products from Firestore once auth token is ready for secured collections
  useEffect(() => {
    if (!firestoreReady) return;
    if (!storeId) {
      setProducts([]);
      return;
    }

    const db = getFirestore();
    let cancelled = false;

    const fetchProducts = async () => {
      // Fetch categories from store profile (storeId first, then user.id fallback)
      try {
        const profileDocIds = Array.from(new Set([storeId, user?.id].filter(Boolean)));
        let loadedCategories: string[] = [];

        for (const profileDocId of profileDocIds) {
          const profileSnap = await getDoc(doc(db, 'storeProfiles', profileDocId));
          if (!profileSnap.exists()) continue;

          const profileData = profileSnap.data() as {
            productCategories?: string[];
            serviceCatalogSettings?: {
              allowServiceProducts?: boolean;
              allowRecurringSubscriptions?: boolean;
              defaultServiceBillingType?: ServiceBillingType;
              minimumServiceDurationMinutes?: number;
              defaultRenewalReminderDays?: number;
            };
          };
          if (Array.isArray(profileData.productCategories) && profileData.productCategories.length > 0) {
            loadedCategories = profileData.productCategories
              .map((category) => (typeof category === 'string' ? category.trim() : ''))
              .filter((category) => category.length > 0);
            if (loadedCategories.length > 0) break;
          }

          if (profileData.serviceCatalogSettings) {
            const settings = profileData.serviceCatalogSettings;
            setServicePolicy((prev) => ({
              ...prev,
              allowServiceProducts: settings.allowServiceProducts ?? prev.allowServiceProducts,
              allowRecurringSubscriptions: settings.allowRecurringSubscriptions ?? prev.allowRecurringSubscriptions,
              defaultServiceBillingType: settings.defaultServiceBillingType ?? prev.defaultServiceBillingType,
              minimumServiceDurationMinutes: settings.minimumServiceDurationMinutes ?? prev.minimumServiceDurationMinutes,
              defaultRenewalReminderDays: settings.defaultRenewalReminderDays ?? prev.defaultRenewalReminderDays,
            }));
            setNewProduct((prev) => ({
              ...prev,
              serviceBillingType: settings.defaultServiceBillingType ?? prev.serviceBillingType,
            }));
          }
        }

        setCategories(loadedCategories.length > 0 ? loadedCategories : DEFAULT_PRODUCT_CATEGORIES);
      } catch (error) {
        console.warn('Failed to load profile categories for products, using defaults:', error);
        setCategories(DEFAULT_PRODUCT_CATEGORIES);
      }

      try {
        // Fetch products
        const productsRef = collection(db, 'products');
        const q = query(productsRef, where('storeId', '==', storeId));
        const snapshot = await getDocs(q);
        if (cancelled) return;
        const productsList: Product[] = snapshot.docs.map((productDoc) => ({
          id: productDoc.id,
          ...productDoc.data(),
        } as Product));
        setProducts(productsList);

        // Fetch finished goods stock for composed products
        const finishedGoodsRef = collection(db, 'finishedGoodsInventory');
        const fgQuery = query(finishedGoodsRef, where('storeId', '==', storeId));
        const fgSnapshot = await getDocs(fgQuery);
        if (cancelled) return;
        const stockMap: Record<string, number> = {};
        fgSnapshot.docs.forEach((fgDoc) => {
          const data = fgDoc.data();
          if (data.productId && typeof data.currentBalance === 'number') {
            stockMap[data.productId] = data.currentBalance;
          }
        });
        setFinishedGoodsStock(stockMap);

        // Fetch recipes for composed products
        const recipesRef = collection(db, 'recipes');
        const recipesQuery = query(recipesRef, where('storeId', '==', storeId));
        const recipesSnapshot = await getDocs(recipesQuery);
        if (cancelled) return;
        const recipesList = recipesSnapshot.docs.map((recipeDoc) => ({
          id: recipeDoc.id,
          ...recipeDoc.data(),
        }));
        setRecipes(recipesList);
      } catch (error) {
        console.error('[AdminProducts] Failed to load products:', error);
        if (!cancelled) {
          setProducts([]);
          setFinishedGoodsStock({});
          setRecipes([]);
        }
      }
    };

    void fetchProducts();
    return () => {
      cancelled = true;
    };
  }, [firestoreReady, storeId, user?.id]);

  useEffect(() => {
    if (!firestoreReady || !storeId) {
      setPlanLimits(null);
      return;
    }
    const db = getFirestore();
    void getSubscriptionSnapshot(db, storeId)
      .then((snapshot) => {
        setPlanLimits({
          productLimit: snapshot.productLimit,
          storageLimitMb: snapshot.storageLimitMb,
          storageUsedMb: snapshot.storageUsedMb,
          allowsCatalogImages: snapshot.allowsCatalogImages,
        });
      })
      .catch(() => setPlanLimits(null));
  }, [firestoreReady, storeId, products.length]);

  const openAddProductDialog = async () => {
    if (!storeId) {
      toast({ title: 'Error', description: 'Store not found', variant: 'destructive' });
      return;
    }
    const db = getFirestore();
    try {
      await assertCanCreateProduct(db, storeId, newProduct.productType);
      setIsAddingProduct(true);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Your current plan does not allow adding more products.';
      setLimitDialogMessage(message);
      setLimitDialogOpen(true);
      toast({
        title: 'Plan limit reached',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const categoryOptions = Array.from(new Set([
    ...categories,
    ...(newProduct.category ? [newProduct.category] : []),
  ].map((category) => (typeof category === 'string' ? category.trim() : '')).filter((category) => category.length > 0)));
  const handleSyncSupplier = async (product: Product) => {
    if (!storeId) {
      toast({ title: 'Error', description: 'Store not found', variant: 'destructive' });
      return;
    }
    if (!product.supplierProductUrl?.trim()) {
      toast({
        title: 'No supplier link',
        description: 'Add a supplier product link on this product first.',
        variant: 'destructive',
      });
      return;
    }
    if (product.supplierPlatform && product.supplierPlatform !== 'shein') {
      toast({
        title: 'Sync not available',
        description: `${formatSupplierPlatformLabel(product.supplierPlatform)} link saved for reference. Stock sync is Shein-only for now.`,
        variant: 'destructive',
      });
      return;
    }

    setSyncingProductId(product.id);
    const db = getFirestore();
    try {
      const result = await syncDropshipProduct(storeId, product.id);
      const refreshed = {
        ...product,
        inStock: Boolean(result.inStock),
        stock: result.stock ?? (result.inStock ? 1 : 0),
        supplierLastSyncAt: result.syncedAt,
        supplierLastSyncStatus: 'ok' as const,
        supplierLastSyncMessage: result.message,
        ...(result.imageUpdated && product.image ? {} : {}),
      };
      setProducts((prev) => prev.map((p) => (p.id === product.id ? refreshed : p)));
      if (editingProduct?.id === product.id) {
        setEditingProduct(refreshed);
      }
      toast({
        title: result.inStock ? 'In stock on Shein' : 'Out of stock on Shein',
        description: result.message || 'Supplier availability updated.',
      });
      const productsRef = collection(db, 'products');
      const q = query(productsRef, where('storeId', '==', storeId));
      const snapshot = await getDocs(q);
      setProducts(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
    } catch (error) {
      toast({
        title: 'Sync failed',
        description: error instanceof Error ? error.message : 'Could not sync with Shein',
        variant: 'destructive',
      });
    } finally {
      setSyncingProductId(null);
    }
  };

  const parseProductPrice = (rawPrice: string | number): number | null => {
    const priceText = String(rawPrice ?? '').trim();
    if (!priceText) return null;
    const parsed = Number(priceText);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const handleAddProduct = async () => {
    if (isSaving) return;
    setIsSaving(true);
    const db = getFirestore();
    const parsedPrice = parseProductPrice(newProduct.price);
    if (!newProduct.name.trim() || parsedPrice === null) {
      toast({ title: "Error", description: "Please enter a product name and valid price", variant: "destructive" });
      setIsSaving(false);
      return;
    }
    if (!storeId) {
      toast({
        title: "Error",
        description: "Your store is not set up correctly. Please refresh the page or contact support.",
        variant: "destructive"
      });
      console.warn("Attempted to add product but storeId is missing! User:", user);
      setIsSaving(false);
      return;
    }

    try {
      await waitForAuthToken();
    } catch (authErr) {
      console.error('[AdminProducts] Auth token not ready:', authErr);
      toast({
        title: 'Error',
        description: 'Sign-in is still loading. Please wait a moment and try again.',
        variant: 'destructive',
      });
      setIsSaving(false);
      return;
    }

    if (newProduct.productType === 'service' && !servicePolicy.allowServiceProducts) {
      toast({
        title: 'Service Products Disabled',
        description: 'Service product creation is disabled in your store policy settings.',
        variant: 'destructive',
      });
      setIsSaving(false);
      return;
    }

    if (
      newProduct.productType === 'service' &&
      !servicePolicy.allowRecurringSubscriptions &&
      newProduct.serviceBillingType !== 'one-time'
    ) {
      toast({
        title: 'Recurring Billing Disabled',
        description: 'Recurring subscriptions are disabled in your store policy settings.',
        variant: 'destructive',
      });
      setIsSaving(false);
      return;
    }

    if (
      newProduct.productType === 'service' &&
      Number(newProduct.serviceDuration || 0) > 0 &&
      Number(newProduct.serviceDuration) < servicePolicy.minimumServiceDurationMinutes
    ) {
      toast({
        title: 'Service Duration Too Short',
        description: `Minimum service duration is ${servicePolicy.minimumServiceDurationMinutes} minutes by store policy.`,
        variant: 'destructive',
      });
      setIsSaving(false);
      return;
    }

    try {
      await assertCanCreateProduct(db, storeId, newProduct.productType);
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
    const catalogImagesAllowed = planLimits?.allowsCatalogImages !== false;
    if (!catalogImagesAllowed) {
      imageUrl = '';
    } else if (newProduct.imageFile) {
      try {
        await assertCanUploadCatalogImage(db, storeId);
        await assertCanUploadBytes(db, storeId, newProduct.imageFile.size);
        imageUrl = await uploadProductImage(
          newProduct.imageFile,
          storeId,
          (percent) => setUploadProgress(percent),
        );
        setUploadProgress(null);
        await trackStorageUsageAfterUpload(db, storeId, newProduct.imageFile.size);
      } catch (error) {
        setUploadProgress(null);
        console.error('Image upload failed:', error);
        const message = error instanceof Error ? error.message : 'Image upload failed.';
        if (message.toLowerCase().includes('storage limit')) {
          setLimitDialogMessage(message);
          setLimitDialogOpen(true);
        }
        toast({ title: 'Storage limit reached', description: message, variant: 'destructive' });
        setIsSaving(false);
        return;
      }
    }
    let supplierFields: Record<string, unknown> = {};
    try {
      supplierFields = getSupplierPayload(
        newProduct.dropshipEnabled,
        newProduct.supplierPlatform,
        newProduct.supplierProductUrl,
        newProduct.productType,
      );
    } catch (supplierErr) {
      toast({
        title: 'Invalid supplier link',
        description: supplierErr instanceof Error ? supplierErr.message : 'Check the supplier URL',
        variant: 'destructive',
      });
      setIsSaving(false);
      return;
    }

    try {
      // Generate unique slug for the product
      const productSlug = await generateUniqueSlug(newProduct.name, 'products', undefined);
      
      const productData = {
        name: newProduct.name,
        description: newProduct.description,
        price: parsedPrice,
        category: newProduct.category,
        deliveryTime: newProduct.deliveryTime || '3-5 days',
        image: imageUrl || `https://placehold.co/400x300/38B2AC/fff?text=${encodeURIComponent(newProduct.name)}`,
        imageAlt: String(newProduct.imageAlt || newProduct.name || '').trim(),
        storeId: storeId,
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
          : newProduct.productType === 'service' && newProduct.serviceBillingType !== 'one-time'
            ? servicePolicy.defaultRenewalReminderDays
          : undefined,
        recipeId: newProduct.productType === 'composed' && newProduct.recipeId ? newProduct.recipeId : undefined,
        expiryTracking: newProduct.productType !== 'service' ? newProduct.expiryTracking : undefined,
        expiryDate: newProduct.productType !== 'service' && newProduct.expiryTracking && newProduct.expiryDate ? newProduct.expiryDate : undefined,
        expiryAlertDays: newProduct.productType !== 'service' && newProduct.expiryTracking ? newProduct.expiryAlertDays : undefined,
        ...supplierFields,
      };
      const cleanProductData = Object.fromEntries(
        Object.entries(productData).map(([k, v]) => [k, v === undefined ? null : v])
      );
      const productRef = doc(collection(db, 'products'));
      await runTransaction(db, async (tx) => {
        tx.set(productRef, cleanProductData);
        tx.update(doc(db, 'storeProfiles', storeId), {
          catalogProductCount: increment(1),
          catalogProductCountVersion: CATALOG_PRODUCT_COUNT_VERSION,
          updatedAt: new Date().toISOString(),
        });
      });
      setProducts((prev) => [...prev, { id: productRef.id, ...(cleanProductData as Product) }]);

      if (
        newProduct.dropshipEnabled &&
        newProduct.supplierProductUrl.trim() &&
        newProduct.supplierPlatform === 'shein' &&
        storeId
      ) {
        try {
          await syncDropshipProduct(storeId, productRef.id);
        } catch (syncErr) {
          console.warn('Initial Shein sync failed after create', syncErr);
          toast({
            title: 'Product saved',
            description: 'Shein sync failed — use Sync now on the product card to retry.',
            variant: 'destructive',
          });
        }
      }
      
      // Refetch products to get complete data
      const productsRef = collection(db, 'products');
      const q = query(productsRef, where('storeId', '==', storeId));
      const snapshot = await getDocs(q);
      const productsList: Product[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(productsList);
      
    setNewProduct({
      name: '', description: '', price: '', category: '', deliveryTime: '', image: '', imageAlt: '', imageFile: null, stock: '',
      productType: 'simple', serviceCost: '', serviceDuration: '', serviceBillingType: 'one-time', renewalReminderDays: '', recipeId: '',
      expiryTracking: false, expiryDate: '', expiryAlertDays: 30,
      supplierProductUrl: '', supplierPlatform: 'shein', dropshipEnabled: false,
    });
      setIsAddingProduct(false);
      toast({ title: "Success", description: "Product added successfully!" });
    } catch (err) {
      console.error('Failed to add product:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('permission') || message.includes('PERMISSION_DENIED') || message.includes('plan limit')) {
        setLimitDialogMessage(
          message.includes('permission') || message.includes('PERMISSION_DENIED')
            ? 'Your subscription or product limit blocks new products. Subscribe or upgrade to continue.'
            : message,
        );
        setLimitDialogOpen(true);
      }
      toast({ title: 'Error', description: `Failed to add product: ${message}`, variant: 'destructive' });
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
      if (!storeId) throw new Error('Store not found');
      await runTransaction(db, async (tx) => {
        tx.delete(doc(db, 'products', productId));
        tx.update(doc(db, 'storeProfiles', storeId), {
          catalogProductCount: increment(-1),
          catalogProductCountVersion: CATALOG_PRODUCT_COUNT_VERSION,
          updatedAt: new Date().toISOString(),
        });
      });
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
      price:
        product.price != null && Number.isFinite(Number(product.price))
          ? Number(product.price).toFixed(getCurrencyDecimals(currency))
          : '',
      category: product.category || '',
      deliveryTime: product.deliveryTime || '',
      image: product.image || '',
      imageAlt: product.imageAlt || product.name || '',
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
      supplierProductUrl: product.supplierProductUrl || '',
      supplierPlatform: (product.supplierPlatform || 'shein') as SupplierPlatform,
      dropshipEnabled: Boolean(product.supplierProductUrl?.trim()),
    });
  };

  const handleUpdateProduct = async () => {
    if (isSaving) return;
    const db = getFirestore();
    const parsedPrice = parseProductPrice(newProduct.price);
    if (!editingProduct || !newProduct.name.trim() || parsedPrice === null) {
      toast({ title: "Error", description: "Please fill in required fields", variant: "destructive" });
      return;
    }
    if (!storeId) {
      toast({
        title: "Error",
        description: "Your store is not set up correctly. Please refresh the page or contact support.",
        variant: "destructive",
      });
      return;
    }

    try {
      await waitForAuthToken();
    } catch (authErr) {
      console.error('[AdminProducts] Auth token not ready:', authErr);
      toast({
        title: 'Error',
        description: 'Sign-in is still loading. Please wait a moment and try again.',
        variant: 'destructive',
      });
      return;
    }

    if (newProduct.productType === 'service' && !servicePolicy.allowServiceProducts) {
      toast({
        title: 'Service Products Disabled',
        description: 'Service products are disabled in your store policy settings.',
        variant: 'destructive',
      });
      return;
    }

    if (
      newProduct.productType === 'service' &&
      !servicePolicy.allowRecurringSubscriptions &&
      newProduct.serviceBillingType !== 'one-time'
    ) {
      toast({
        title: 'Recurring Billing Disabled',
        description: 'Recurring subscriptions are disabled in your store policy settings.',
        variant: 'destructive',
      });
      return;
    }
    
    // Check if recipe is changing for composed product
    if (newProduct.productType === 'composed' && newProduct.recipeId !== editingProduct.recipeId) {
      // Check for active production batches
      const batchesRef = collection(db, 'productionBatches');
      const batchesQuery = query(batchesRef, 
        where('storeId', '==', storeId),
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

    if (editingProduct.productType !== 'composed' && newProduct.productType === 'composed' && storeId) {
      try {
        await assertCanCreateProduct(db, storeId, 'composed');
      } catch (error) {
        toast({
          title: 'Plan Limit Reached',
          description: error instanceof Error ? error.message : 'Your current plan does not allow switching to composed products.',
          variant: 'destructive',
        });
        return;
      }
    }

    let supplierFields: Record<string, unknown> = {};
    try {
      supplierFields = getSupplierPayload(
        newProduct.dropshipEnabled,
        newProduct.supplierPlatform,
        newProduct.supplierProductUrl,
        newProduct.productType,
      );
    } catch (supplierErr) {
      toast({
        title: 'Invalid supplier link',
        description: supplierErr instanceof Error ? supplierErr.message : 'Check the supplier URL',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    let imageUrl = newProduct.image;
    const catalogImagesAllowed = planLimits?.allowsCatalogImages !== false;
    if (!catalogImagesAllowed) {
      imageUrl = editingProduct?.image?.includes('placehold.co') ? editingProduct.image : '';
    } else if (newProduct.imageFile) {
      try {
        if (storeId) {
          await assertCanUploadCatalogImage(db, storeId);
          await assertCanUploadBytes(db, storeId, newProduct.imageFile.size);
        }
        imageUrl = await uploadProductImage(
          newProduct.imageFile,
          storeId,
          (percent) => setUploadProgress(percent),
        );
        setUploadProgress(null);
        if (storeId) {
          await trackStorageUsageAfterUpload(db, storeId, newProduct.imageFile.size);
        }
      } catch {
        setUploadProgress(null);
        toast({ title: "Error", description: "Image upload failed.", variant: "destructive" });
        setIsSaving(false);
        return;
      }
    }

    const resolvedImage = newProduct.imageFile
      ? imageUrl
      : newProduct.image.trim() || editingProduct.image || '';

    try {
      // Generate slug if product doesn't have one yet
      const productSlug = editingProduct.slug || await generateUniqueSlug(newProduct.name, 'products', editingProduct.id);
      
      const hasDropshipLink =
        newProduct.dropshipEnabled &&
        newProduct.productType === 'simple' &&
        Boolean(newProduct.supplierProductUrl.trim());

      const updatedProduct = {
        name: newProduct.name,
        description: newProduct.description,
        price: parsedPrice,
        category: newProduct.category,
        deliveryTime: newProduct.deliveryTime,
        image: resolvedImage,
        imageAlt: String(newProduct.imageAlt || newProduct.name || '').trim(),
        storeId: editingProduct.storeId,
        slug: productSlug,
        // Dropship: stock/inStock updated via Sync now. Otherwise stock comes from purchases.
        ...(hasDropshipLink
          ? {}
          : {
              inStock: newProduct.productType === 'service' ? true : (editingProduct.stock ?? 0) > 0,
            }),
        rating: editingProduct.rating,
        productType: newProduct.productType,
        isService: newProduct.productType === 'service',
        serviceCost: newProduct.productType === 'service' && newProduct.serviceCost ? Number(newProduct.serviceCost) : null,
        serviceDuration: newProduct.productType === 'service' && newProduct.serviceDuration ? Number(newProduct.serviceDuration) : null,
        serviceBillingType: newProduct.productType === 'service' ? newProduct.serviceBillingType : null,
        renewalReminderDays: newProduct.productType === 'service' && newProduct.serviceBillingType !== 'one-time' && newProduct.renewalReminderDays
          ? Number(newProduct.renewalReminderDays)
          : newProduct.productType === 'service' && newProduct.serviceBillingType !== 'one-time'
            ? servicePolicy.defaultRenewalReminderDays
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
        ...supplierFields,
      };
      const cleanUpdatedProduct = Object.fromEntries(
        Object.entries(updatedProduct).map(([k, v]) => [k, v === undefined ? null : v])
      );
  await updateDoc(doc(db, 'products', editingProduct.id), cleanUpdatedProduct);

      if (hasDropshipLink && newProduct.supplierPlatform === 'shein' && storeId) {
        try {
          await syncDropshipProduct(storeId, editingProduct.id);
        } catch (syncErr) {
          console.warn('Shein sync failed after update', syncErr);
          toast({
            title: 'Saved',
            description: 'Product saved but Shein sync failed — tap Sync now to retry.',
            variant: 'destructive',
          });
        }
      }
      
      // Update composedProducts collection if this is a composed product
      if (newProduct.productType === 'composed' && newProduct.recipeId) {
        const composedRef = collection(db, 'composedProducts');
        const composedQuery = query(composedRef, 
          where('storeId', '==', storeId),
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
      
      if (storeId) {
        const productsRef = collection(db, 'products');
        const q = query(productsRef, where('storeId', '==', storeId));
        const snapshot = await getDocs(q);
        setProducts(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
      }
      setEditingProduct(null);
  setNewProduct({
    name: '', description: '', price: '', category: '', deliveryTime: '', image: '', imageAlt: '', imageFile: null, stock: '',
    productType: 'simple', serviceCost: '', serviceDuration: '', serviceBillingType: 'one-time', renewalReminderDays: '', recipeId: '',
    expiryTracking: false, expiryDate: '', expiryAlertDays: 30,
    supplierProductUrl: '', supplierPlatform: 'shein', dropshipEnabled: false,
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
    toast({ title: 'Storefront Visibility Updated', description: `Product is now ${updatedStock ? 'visible online' : 'hidden online'}.` });
  };

  const productTypeLabel = (product: Product) => {
    if (product.productType === 'service') {
      return product.serviceBillingType === 'monthly'
        ? 'Service · Monthly'
        : product.serviceBillingType === 'yearly'
          ? 'Service · Yearly'
          : 'Service · One-time';
    }
    if (product.productType === 'composed') return 'Composed';
    return 'Item';
  };

  const productStockQty = (product: Product) => {
    if (product.productType === 'service') return '—';
    return String(finishedGoodsStock[product.id] ?? product.stock ?? 0);
  };

  const embeddedPriceList = embedded ? (
    <AdminPanel className="overflow-hidden p-0">
      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Package className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-slate-700">No items yet</p>
          <p className="text-xs text-muted-foreground mt-1">Products added in catalog will appear here.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="hidden sm:table-cell">SKU</TableHead>
              <TableHead className="hidden md:table-cell">Category</TableHead>
              <TableHead className="hidden lg:table-cell">Type</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right hidden sm:table-cell">Cost</TableHead>
              <TableHead className="text-right">Stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium max-w-[14rem]">
                  <ClampedText text={product.name} maxLines={2} className="text-sm" as="span" />
                </TableCell>
                <TableCell className="hidden sm:table-cell text-muted-foreground">
                  {product.sku?.trim() || '—'}
                </TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">
                  {product.category || '—'}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-muted-foreground">
                  {productTypeLabel(product)}
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {money(Number(product.price) || 0)}
                </TableCell>
                <TableCell className="text-right tabular-nums hidden sm:table-cell text-muted-foreground">
                  {product.costPrice != null && product.costPrice > 0
                    ? money(Number(product.costPrice))
                    : '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums">{productStockQty(product)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </AdminPanel>
  ) : null;

  const productsBody = (
    <>
        {!embedded && planLimits?.productLimit != null && countableProductsCount >= planLimits.productLimit && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You have {countableProductsCount} sellable products but your plan allows {planLimits.productLimit}.
              {' '}
              Add modules or upgrade (+10 products per $10/mo above $27 Shop).
              {' '}
              <Link to="/admin/subscription" className="font-medium underline">
                Upgrade your plan
              </Link>
              .
            </AlertDescription>
          </Alert>
        )}
        {!embedded && !catalogImagesAllowed && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Business Backend plan: catalog is text/SKU only — product images are not included.
              {' '}
              <Link to="/admin/subscription" className="font-medium underline">
                Upgrade to Mini Shop or Shop
              </Link>
              {' '}
              to add images.
            </AlertDescription>
          </Alert>
        )}
        {!embedded && planLimits?.storageLimitMb != null && planLimits.storageUsedMb >= planLimits.storageLimitMb * 0.9 && (
          <Alert className="mb-4 border-amber-500/50 bg-amber-50 text-amber-900">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Storage is nearly full ({planLimits.storageUsedMb.toFixed(1)} MB of {planLimits.storageLimitMb} MB).
              {' '}
              <Link to="/admin/subscription" className="font-medium underline">
                Upgrade for more storage
              </Link>
              .
            </AlertDescription>
          </Alert>
        )}
        {embedded ? embeddedPriceList : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <AdminPanel key={product.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <ClampedText
                      text={product.name}
                      maxLines={2}
                      className="text-lg font-semibold leading-none tracking-tight"
                      as="h3"
                    />
                    <CardDescription className="text-xl font-bold text-primary tabular-nums">
                      {money(Number(product.price) || 0)}
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
                    {product.supplierProductUrl && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {formatSupplierPlatformLabel(product.supplierPlatform)}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <img 
                  src={product.image || (product as any).imageUrl} 
                  alt={product.imageAlt || product.name}
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

                {product.supplierProductUrl && (
                  <p className="text-[10px] text-muted-foreground mb-2 line-clamp-2">
                    {formatSupplierSyncLabel(product)}
                  </p>
                )}

                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                  <span>Delivery: {product.deliveryTime}</span>
                  <span>•</span>
                  <span className={product.inStock ? "text-green-600" : "text-red-600"}>
                    {product.inStock ? "Visible Online" : "Hidden Online"}
                  </span>
                  {canManageInventory && (
                    <>
                      <Switch checked={product.inStock} onCheckedChange={() => handleToggleStock(product)} className="ml-2" />
                      <span className="ml-1">Display Online</span>
                    </>
                  )}
                </div>
                
                <div className="flex flex-col gap-2">
                  {canManageInventory &&
                    product.supplierProductUrl &&
                    product.productType === 'simple' &&
                    (product.supplierPlatform === 'shein' || !product.supplierPlatform) && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full h-8 text-xs"
                      disabled={syncingProductId === product.id}
                      onClick={() => handleSyncSupplier(product)}
                    >
                      <RefreshCw className={`h-3 w-3 mr-1 ${syncingProductId === product.id ? 'animate-spin' : ''}`} />
                      {syncingProductId === product.id ? 'Syncing…' : 'Sync stock (Shein)'}
                    </Button>
                  )}
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
                </div>
              </CardContent>
            </AdminPanel>
          ))}
          
          {products.length === 0 && (
            <div className="col-span-full">
              <AdminPanel>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Products Yet</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    {canManageInventory 
                      ? "Start building your store by adding your first product"
                      : "No products available to view"}
                  </p>
                  {canManageInventory && (
                    <Button onClick={() => void openAddProductDialog()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Your First Product
                    </Button>
                  )}
                </CardContent>
              </AdminPanel>
            </div>
          )}
        </div>
        )}


      {/* Add Product Dialog */}
      <Dialog open={isAddingProduct} onOpenChange={setIsAddingProduct}>
        <DialogContent className={FORM_DIALOG_SHELL}>
                <DialogHeader className={FORM_DIALOG_HEADER}>
                  <DialogTitle>Add New Product</DialogTitle>
                  <DialogDescription className="text-xs">
                    Fill in the details below.
                  </DialogDescription>
                </DialogHeader>

                <div className={FORM_DIALOG_BODY}>
                <div className="space-y-4 min-w-0 max-w-full">
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
                      onChange={(e) => setNewProduct(prev => ({ ...prev, price: e.target.value }))}
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
                    <div>
                      <Label htmlFor="recipeId">Recipe</Label>
                      {recipes.length > 0 ? (
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
                      ) : (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            No recipes yet. Create a recipe on the Recipes page first, then select it here to link raw materials to this product.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
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

                  {newProduct.productType === 'simple' && (
                    <DropshipSupplierFields
                      idPrefix="add"
                      enabled={newProduct.dropshipEnabled}
                      platform={newProduct.supplierPlatform}
                      productUrl={newProduct.supplierProductUrl}
                      onEnabledChange={(enabled) =>
                        setNewProduct((prev) => ({
                          ...prev,
                          dropshipEnabled: enabled,
                          ...(enabled ? {} : { supplierProductUrl: '' }),
                        }))
                      }
                      onPlatformChange={(platform) =>
                        setNewProduct((prev) => ({ ...prev, supplierPlatform: platform }))
                      }
                      onUrlChange={(url) =>
                        setNewProduct((prev) => ({ ...prev, supplierProductUrl: url }))
                      }
                    />
                  )}
                  
                  {catalogImagesAllowed ? (
                  <div>
                    <Label htmlFor="image">Image URL</Label>
                    {newProduct.image && (
                      <>
                        <img
                          src={newProduct.image}
                          alt={newProduct.imageAlt || newProduct.name || 'Product'}
                          className="w-full h-32 object-cover rounded-md border mb-2 mt-1"
                        />
                        {(newProduct.imageAlt || newProduct.name) && (
                          <p className="text-xs text-muted-foreground mb-2 min-w-0">
                            Alt preview:{' '}
                            <ClampedText
                              text={newProduct.imageAlt || newProduct.name}
                              maxLines={2}
                              className="inline"
                            />
                          </p>
                        )}
                      </>
                    )}
                    <Input
                      id="image"
                      value={newProduct.image}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, image: e.target.value }))}
                      placeholder="https://example.com/image.jpg"
                    />
                    <Label htmlFor="imageAlt" className="mt-2 block">Image Alt Text</Label>
                    <Input
                      id="imageAlt"
                      value={newProduct.imageAlt}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, imageAlt: e.target.value }))}
                      placeholder="Describe this product image for accessibility"
                    />
                    <Label className="mt-2 block">Or upload image</Label>
                    <div className="flex flex-col gap-2 mt-1">
                      <Input
                        id="imageFileGallery"
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                        className="hidden"
                        onChange={(e) =>
                          setNewProduct((prev) => ({ ...prev, imageFile: e.target.files?.[0] || null }))
                        }
                      />
                      <Input
                        id="imageFileCamera"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) =>
                          setNewProduct((prev) => ({ ...prev, imageFile: e.target.files?.[0] || null }))
                        }
                      />
                      <Button
                        type="button"
                        variant="default"
                        className={FORM_FILE_BUTTON_CLASS}
                        onClick={() => document.getElementById('imageFileGallery')?.click()}
                      >
                        <SelectedFileLabel file={newProduct.imageFile} idleLabel="Choose from gallery" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => document.getElementById('imageFileCamera')?.click()}
                      >
                        Take photo (camera)
                      </Button>
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
                  ) : (
                    <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-3">
                      Products use a name-based placeholder — image uploads are not on your plan.
                    </p>
                  )}
                </div>
                </div>

                <DialogFooter className={FORM_DIALOG_FOOTER}>
                  <Button type="button" variant="outline" onClick={() => setIsAddingProduct(false)}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={handleAddProduct} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Add Product'}
                  </Button>
                </DialogFooter>
              </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
        <DialogContent className={FORM_DIALOG_SHELL}>
          <DialogHeader className={FORM_DIALOG_HEADER}>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription className="text-xs">
              Update product details below.
            </DialogDescription>
          </DialogHeader>

          <div className={FORM_DIALOG_BODY}>
          <div className="space-y-4 min-w-0 max-w-full">
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
                onChange={(e) => setNewProduct(prev => ({ ...prev, price: e.target.value }))}
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
            {newProduct.productType !== 'service' && editingProduct && (
              <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3">
                <p className="text-xs font-semibold text-green-700 mb-0.5">Current Stock</p>
                <p className="text-2xl font-bold text-green-800">
                  {finishedGoodsStock[editingProduct.id] ?? editingProduct.stock ?? 0}
                </p>
                <p className="text-xs text-green-600 mt-1">Stock is updated automatically via Purchase entries and Damage/Waste records. It cannot be edited manually.</p>
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

            {newProduct.productType === 'simple' && (
              <DropshipSupplierFields
                idPrefix="edit"
                enabled={newProduct.dropshipEnabled}
                platform={newProduct.supplierPlatform}
                productUrl={newProduct.supplierProductUrl}
                onEnabledChange={(enabled) =>
                  setNewProduct((prev) => ({
                    ...prev,
                    dropshipEnabled: enabled,
                    ...(enabled ? {} : { supplierProductUrl: '' }),
                  }))
                }
                onPlatformChange={(platform) =>
                  setNewProduct((prev) => ({ ...prev, supplierPlatform: platform }))
                }
                onUrlChange={(url) =>
                  setNewProduct((prev) => ({ ...prev, supplierProductUrl: url }))
                }
              />
            )}
            
            {catalogImagesAllowed ? (
            <div>
              <Label htmlFor="edit-image">Image URL</Label>
              {(editingProduct?.image || newProduct.imageFile) && (
                <>
                <img
                  src={
                    newProduct.imageFile
                      ? URL.createObjectURL(newProduct.imageFile)
                      : newProduct.image || editingProduct?.image
                  }
                  alt={newProduct.imageAlt || editingProduct?.name || 'Product'}
                  className="w-full h-32 object-cover rounded-md border mb-2"
                />
                {(newProduct.imageAlt || editingProduct?.name) && (
                  <p className="text-xs text-muted-foreground mb-2 min-w-0">
                    Alt preview:{' '}
                    <ClampedText
                      text={newProduct.imageAlt || editingProduct?.name || ''}
                      maxLines={2}
                      className="inline"
                    />
                  </p>
                )}
                </>
              )}
              <Input
                id="edit-image"
                value={newProduct.image}
                onChange={(e) => setNewProduct(prev => ({ ...prev, image: e.target.value }))}
                placeholder="https://example.com/image.jpg"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Direct image URL or upload below.</p>
              <Label htmlFor="edit-imageAlt" className="mt-2 block">Image Alt Text</Label>
              <Input
                id="edit-imageAlt"
                value={newProduct.imageAlt}
                onChange={(e) => setNewProduct(prev => ({ ...prev, imageAlt: e.target.value }))}
                placeholder="Describe this product image for accessibility"
              />
              <Label className="mt-2 block">Or replace image from device</Label>
              <div className="flex flex-col gap-2 mt-1">
                <Input
                  id="editImageFileGallery"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) =>
                    setNewProduct((prev) => ({
                      ...prev,
                      imageFile: e.target.files?.[0] || null,
                    }))
                  }
                />
                <Input
                  id="editImageFileCamera"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) =>
                    setNewProduct((prev) => ({
                      ...prev,
                      imageFile: e.target.files?.[0] || null,
                    }))
                  }
                />
                <Button
                  type="button"
                  variant="default"
                  className={FORM_FILE_BUTTON_CLASS}
                  onClick={() => document.getElementById('editImageFileGallery')?.click()}
                >
                  <SelectedFileLabel file={newProduct.imageFile} idleLabel="Choose from gallery" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => document.getElementById('editImageFileCamera')?.click()}
                >
                  Take photo (camera)
                </Button>
              </div>
              {uploadProgress !== null && editingProduct && (
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
            ) : (
              <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-3">
                Products use a name-based placeholder — image uploads are not on your plan.
              </p>
            )}

          </div>
          </div>

          <DialogFooter className={FORM_DIALOG_FOOTER}>
            <Button variant="outline" onClick={() => setEditingProduct(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateProduct} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Update Product'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={limitDialogOpen} onOpenChange={setLimitDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Plan limit reached</AlertDialogTitle>
            <AlertDialogDescription>{limitDialogMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction asChild>
              <Link to="/admin/subscription">View plans &amp; upgrade</Link>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  if (embedded) {
    return <div className="min-w-0">{productsBody}</div>;
  }

  return (
    <AdminPageShell
      title={canManageInventory ? 'Manage Products' : 'View Products'}
      description={canManageInventory ? 'Add, edit, and manage your store products' : 'View your store products'}
      eyebrow="Daily Operations"
      backTo={user?.role === 'admin' ? '/admin/inventory' : '/team/dashboard'}
      backLabel="Back to Inventory"
      actions={
        canManageInventory ? (
          <Button type="button" onClick={() => void openAddProductDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        ) : undefined
      }
    >
      {productsBody}
    </AdminPageShell>
  );
};

export default AdminProducts;