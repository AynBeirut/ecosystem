
import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getFirestore, doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import SEOHead from '@/components/SEOHead';
import { pixelAddToCart, pixelViewContent, trackMetaConversionEvent } from '@/lib/metaPixel';
import { Product, ProductReview, Store } from '@/types/product';
import { Recipe, RawMaterial } from '@/types/inventory';
import { calculateAvailableStock } from '@/lib/composedProductStock';
import { ECOSYSTEM_FLAGS } from '@/lib/ecosystemFlags';
import { fetchPublicProductStock } from '@/lib/publicProductStockService';
import Header from '@/components/Header';
import WhatsAppChatWidget from '@/components/WhatsAppChatWidget';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/CartContext';
import { useFavorites } from '@/context/FavoritesContext';
import { Heart, Minus, Plus, Clock, Store as StoreIcon, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import ShareButtons from '@/components/ui/ShareButtons';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/useAuth';
import { toast } from '@/components/ui/sonner';
import { generateSlug } from '@/lib/slugify';
import ClampedText from '@/components/ClampedText';

const ProductDetail: React.FC = () => {
  const { id, productSlug, storeSlug } = useParams<{ id?: string; productSlug?: string; storeSlug?: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [hasPurchasedProduct, setHasPurchasedProduct] = useState(false);
  const [existingUserReview, setExistingUserReview] = useState<ProductReview | null>(null);

  const { user } = useAuth();
  
  const { addToCart } = useCart();
  const { isFavorite, addToFavorites, removeFromFavorites } = useFavorites();

  useEffect(() => {
    const identifier = productSlug || id;
    
    if (!identifier) {
      setError('Product identifier is missing');
      setIsLoading(false);
      return;
    }

    const loadProduct = async () => {
      setIsLoading(true);
      try {
        const db = getFirestore();
        let productData: any = null;
        let productId: string = identifier;
        
        // Check if identifier is a slug or Firebase ID
        // Slugs: lowercase, hyphens, no uppercase (e.g., "iphone-15-pro")
        // Firebase IDs: mixed case, no hyphens, 20-28 chars
        const isSlug = identifier.includes('-') && !/[A-Z0-9]{10,}/.test(identifier);
        
        if (isSlug && storeSlug) {
          // Search by slug within store
          // First get store ID from store slug
          const storesRef = collection(db, 'storeProfiles');
          const storeQuery = query(storesRef, where('slug', '==', storeSlug));
          const storeSnap = await getDocs(storeQuery);
          
          if (!storeSnap.empty) {
            const storeId = storeSnap.docs[0].id;
            const storeData = { id: storeId, ...storeSnap.docs[0].data() };
            setStore(storeData as Store);
            
            // Now search for product by slug within this store
            const productsRef = collection(db, 'products');
            const productQuery = query(
              productsRef, 
              where('slug', '==', identifier),
              where('storeId', '==', storeId)
            );
            const productSnap = await getDocs(productQuery);
            
            if (!productSnap.empty) {
              productId = productSnap.docs[0].id;
              productData = productSnap.docs[0].data();
            } else {
              setError('Product not found');
              setIsLoading(false);
              return;
            }
          } else {
            setError('Store not found');
            setIsLoading(false);
            return;
          }
        } else {
          // Direct ID lookup (backward compatibility)
          const productRef = doc(db, 'products', identifier);
          const productSnap = await getDoc(productRef);
          
          if (!productSnap.exists()) {
            setError('Product not found');
            setIsLoading(false);
            return;
          }
          
          productData = productSnap.data();
          productId = identifier;
          
          // Fetch store
          if (productData.storeId) {
            const storeRef = doc(db, 'storeProfiles', productData.storeId);
            const storeSnap = await getDoc(storeRef);
            if (storeSnap.exists()) {
              const storeData = { id: productData.storeId, ...storeSnap.data() };
              setStore(storeData as Store);
              
              // Redirect to slug URL if both product and store have slugs
              if (productData.slug && storeData.slug) {
                navigate(`/${storeData.slug}/product/${productData.slug}`, { replace: true });
                return;
              }
            }
          }
        }
        
        // Calculate stock for composed products
        let finalProduct: Product = { id: productId, ...productData } as Product;
        if (finalProduct.productType === 'composed' && finalProduct.recipeId && productData.storeId) {
          if (ECOSYSTEM_FLAGS.publicProductStockApi) {
            try {
              const stockItems = await fetchPublicProductStock(productData.storeId, [productId]);
              const stock = stockItems[0];
              if (stock) {
                finalProduct.stock = stock.availableStock;
                finalProduct.inStock = stock.inStock;
              }
            } catch (stockErr) {
              console.error('ProductDetail: public stock API failed', stockErr);
            }
          } else {
            const recipesRef = collection(db, 'recipes');
            const recipeQuery = query(recipesRef, where('storeId', '==', productData.storeId));
            const recipesSnap = await getDocs(recipeQuery);
            const recipesList: Recipe[] = recipesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recipe));

            const rawMaterialsRef = collection(db, 'rawMaterials');
            const rawMaterialsQuery = query(rawMaterialsRef, where('storeId', '==', productData.storeId));
            const rawMaterialsSnap = await getDocs(rawMaterialsQuery);
            const rawMaterialsList: RawMaterial[] = rawMaterialsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RawMaterial));

            const recipe = recipesList.find(r => r.id === finalProduct.recipeId);
            const availableStock = calculateAvailableStock(recipe, rawMaterialsList);
            finalProduct.stock = availableStock;
            finalProduct.inStock = availableStock > 0;
          }
        }
        
        setProduct(finalProduct);
      } catch (err) {
        setError('Failed to load product data');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadProduct();
  }, [id, productSlug, storeSlug, navigate]);

  useEffect(() => {
    const pixelEnabled = store?.metaIntegrationSettings?.pixelEnabled;
    const pixelId = store?.metaIntegrationSettings?.pixelId?.trim();
    if (!pixelEnabled || !pixelId || typeof window === 'undefined') return;

    try {
      if (localStorage.getItem('grabio_cookie_consent') !== 'accepted') return;
    } catch {
      return;
    }

    if (window.fbq) {
      window.fbq('init', pixelId);
      window.fbq('track', 'PageView');
      return;
    }

    const fbq: any = function (...args: any[]) {
      fbq.callMethod ? fbq.callMethod(...args) : fbq.queue.push(args);
    };
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.queue = [];
    window.fbq = fbq;
    if (!window._fbq) window._fbq = fbq;

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);

    window.fbq('init', pixelId);
    window.fbq('track', 'PageView');
  }, [store?.metaIntegrationSettings?.pixelEnabled, store?.metaIntegrationSettings?.pixelId]);

  useEffect(() => {
    const loadReviews = async () => {
      if (!product?.id) {
        setReviews([]);
        return;
      }

      setReviewsLoading(true);
      try {
        const db = getFirestore();
        const reviewsRef = collection(db, 'productReviews');
        const q = query(
          reviewsRef,
          where('productId', '==', product.id),
          where('status', '==', 'approved')
        );
        const snap = await getDocs(q);
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ProductReview));
        rows.sort((a, b) => {
          const ta = Number(new Date(String(a.createdAt || 0)).getTime() || 0);
          const tb = Number(new Date(String(b.createdAt || 0)).getTime() || 0);
          return tb - ta;
        });
        setReviews(rows);
      } catch (err) {
        console.error('Failed to load product reviews', err);
      } finally {
        setReviewsLoading(false);
      }
    };

    loadReviews();
  }, [product?.id]);

  useEffect(() => {
    const loadCustomerReviewState = async () => {
      if (!user?.id || !product?.id) {
        setHasPurchasedProduct(false);
        setExistingUserReview(null);
        return;
      }

      try {
        const db = getFirestore();

        const userOrdersQuery = query(collection(db, 'orders'), where('customerId', '==', user.id));
        const userOrdersSnap = await getDocs(userOrdersQuery);
        const purchased = userOrdersSnap.docs.some((orderDoc) => {
          const items = (orderDoc.data().items || []) as Array<{ productId?: string }>;
          return items.some((item) => item.productId === product.id);
        });
        setHasPurchasedProduct(purchased);

        const reviewQuery = query(
          collection(db, 'productReviews'),
          where('userId', '==', user.id),
          where('productId', '==', product.id)
        );
        const reviewSnap = await getDocs(reviewQuery);
        if (!reviewSnap.empty) {
          const first = reviewSnap.docs[0];
          setExistingUserReview({ id: first.id, ...first.data() } as ProductReview);
        } else {
          setExistingUserReview(null);
        }
      } catch (err) {
        console.error('Failed to load review eligibility', err);
      }
    };

    loadCustomerReviewState();
  }, [user?.id, product?.id]);

  useEffect(() => {
    if (!product) return;
    pixelViewContent({
      contentId: product.id,
      contentName: product.name,
      value: Number(product.price || 0),
      currency: 'USD',
    });
    void trackMetaConversionEvent({
      storeId: product.storeId,
      eventName: 'ViewContent',
      contentIds: [product.id],
      contentName: product.name,
      value: Number(product.price || 0),
      currency: 'USD',
      userData: {
        externalId: String(user?.id || ''),
        email: String(user?.email || ''),
      },
    });
  }, [product?.id, user?.id]);

  const handleSubmitReview = async () => {
    if (!user?.id || !product || !store?.id) {
      toast.error('Please sign in first.');
      return;
    }
    if (!hasPurchasedProduct) {
      toast.error('Only customers who purchased this product can review it.');
      return;
    }
    if (existingUserReview) {
      toast.error('You already submitted a review for this product.');
      return;
    }

    setIsSubmittingReview(true);
    try {
      const db = getFirestore();
      await addDoc(collection(db, 'productReviews'), {
        storeId: store.id,
        productId: product.id,
        userId: user.id,
        userName: user.name || user.email || 'Customer',
        rating: Number(reviewRating),
        comment: reviewComment.trim(),
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      setReviewComment('');
      setReviewRating(5);
      toast.success('Review submitted and pending moderation.');

      setExistingUserReview({
        storeId: store.id,
        productId: product.id,
        userId: user.id,
        userName: user.name || user.email || 'Customer',
        rating: Number(reviewRating),
        comment: reviewComment.trim(),
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Failed to submit product review', err);
      toast.error('Failed to submit review.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleAddToCart = () => {
    if (product) {
      addToCart(product, quantity);
      pixelAddToCart({
        contentId: product.id,
        contentName: product.name,
        value: product.price,
        currency: 'USD',
      });
      void trackMetaConversionEvent({
        storeId: product.storeId,
        eventName: 'AddToCart',
        contentIds: [product.id],
        contentName: product.name,
        value: Number(product.price || 0),
        currency: 'USD',
        userData: {
          externalId: String(user?.id || ''),
          email: String(user?.email || ''),
        },
      });
    }
  };

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0) {
      setQuantity(value);
    }
  };

  const incrementQuantity = () => {
    setQuantity(prev => prev + 1);
  };

  const decrementQuantity = () => {
    if (quantity > 1) {
      setQuantity(prev => prev - 1);
    }
  };

  const toggleFavorite = () => {
    if (!product) return;
    
    if (isFavorite(product.id)) {
      removeFromFavorites(product.id);
    } else {
      addToFavorites(product);
    }
  };

  const productStructuredData: Array<Record<string, unknown>> = product
    ? [
        {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.name,
          description: store?.seoSettings?.metaDescription || product.description || '',
          image: store?.seoSettings?.ogImage || product.image,
          sku: product.sku || undefined,
          category: product.category,
          brand: store?.name ? { '@type': 'Brand', name: store.name } : undefined,
          offers: {
            '@type': 'Offer',
            url: store?.slug
              ? `https://grabio.space/${store.slug}/product/${product.slug || product.id}`
              : `https://grabio.space/product/id/${product.id}`,
            priceCurrency: store?.mainCurrency || 'USD',
            price: Number(product.price || 0).toFixed(2),
            availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          },
        },
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Marketplace', item: 'https://grabio.space/' },
            ...(store?.slug
              ? [{ '@type': 'ListItem', position: 2, name: store.name || 'Store', item: `https://grabio.space/${store.slug}` }]
              : []),
            {
              '@type': 'ListItem',
              position: store?.slug ? 3 : 2,
              name: product.name,
              item: store?.slug
                ? `https://grabio.space/${store.slug}/product/${product.slug || product.id}`
                : `https://grabio.space/product/id/${product.id}`,
            },
          ],
        },
      ]
    : [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header
          storeName={store?.name}
          storeLogo={store?.logo}
          storeSlug={store?.slug}
          logoPosition={store?.logoPosition}
          primaryColor={store?.templateColors?.primary}
          subscriptionTier={store?.subscriptionTier}
          hasCustomDomain={!!store?.customDomain}
          hasImportedDesign={store?.hasImportedDesign}
        />
        <div className="container mx-auto px-4 py-12">
          <div className="animate-pulse max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="h-96 bg-gray-200 rounded-lg"></div>
              <div className="space-y-4">
                <div className="h-8 bg-gray-200 w-3/4 rounded"></div>
                <div className="h-6 bg-gray-200 w-1/4 rounded"></div>
                <div className="h-4 bg-gray-200 w-full rounded"></div>
                <div className="h-4 bg-gray-200 w-full rounded"></div>
                <div className="h-4 bg-gray-200 w-3/4 rounded"></div>
                <div className="h-10 bg-gray-200 w-full rounded mt-8"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header
          storeName={store?.name}
          storeLogo={store?.logo}
          storeSlug={store?.slug}
          logoPosition={store?.logoPosition}
          primaryColor={store?.templateColors?.primary}
          subscriptionTier={store?.subscriptionTier}
          hasCustomDomain={!!store?.customDomain}
          hasImportedDesign={store?.hasImportedDesign}
        />
        <div className="container mx-auto px-4 py-12 flex justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">{error || 'Product not found'}</h2>
            <p className="text-gray-600 mb-6">The product you're looking for doesn't exist or couldn't be loaded.</p>
            <Button asChild>
              <Link to="/">Return to Marketplace</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const showCommerceActions = store?.storefrontMode !== 'display';

  return (
    <div className="min-h-screen bg-gray-50">
      <SEOHead
        title={product.name}
        description={store?.seoSettings?.metaDescription || product.description || `Buy ${product.name} from ${store?.name || 'a local store'} on Grabio`}
        image={store?.seoSettings?.ogImage || product.image}
        url={store?.seoSettings?.canonicalBaseUrl || (store?.slug
          ? `https://grabio.space/${store.slug}/product/${product.slug || product.id}`
          : `https://grabio.space/product/id/${product.id}`
        )}
        type="product"
        price={product.price}
        currency={store ? undefined : 'USD'}
        keywords={store?.seoSettings?.keywords}
        robotsIndex={store?.seoSettings?.robotsIndex ?? true}
        robotsFollow={store?.seoSettings?.robotsFollow ?? true}
        twitterHandle={store?.seoSettings?.twitterHandle}
        facebookAppId={store?.metaIntegrationSettings?.facebookAppId}
        structuredData={productStructuredData}
      />
      <Header
        storeName={store?.name}
        storeLogo={store?.logo}
        storeSlug={store?.slug}
        logoPosition={store?.logoPosition}
        primaryColor={store?.templateColors?.primary}
        subscriptionTier={store?.subscriptionTier}
        hasCustomDomain={!!store?.customDomain}
        hasImportedDesign={store?.hasImportedDesign}
      />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Product Image */}
            <div>
              <div className="bg-white rounded-lg overflow-hidden shadow-sm">
                <img 
                  src={product.image} 
                  alt={product.imageAlt || product.name} 
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>
            
            {/* Product Info */}
            <div>
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="mb-2">
                  {store?.slug ? (
                    <Link to={`/${store.slug}/category/${generateSlug(product.category || 'general')}`} className="text-sm text-gray-500 hover:underline">
                      {product.category}
                    </Link>
                  ) : (
                    <span className="text-sm text-gray-500">{product.category}</span>
                  )}
                </div>
                
                <ClampedText
                  text={product.name}
                  maxLines={3}
                  className="text-3xl font-bold mb-2 block"
                  as="h1"
                />
                
                <div className="flex items-center mb-4">
                  <span className="text-2xl font-semibold text-market-primary">
                    ${product.price.toFixed(2)}
                  </span>
                  
                  {product.productType === 'composed' && product.stock !== undefined && (
                    <Badge variant={product.stock > 5 ? "default" : product.stock > 0 ? "outline" : "destructive"} className={`ml-3 ${product.stock <= 5 && product.stock > 0 ? "border-orange-500 text-orange-700" : ""}`}>
                      {product.stock > 0 ? `${product.stock} units available` : 'Out of Stock'}
                    </Badge>
                  )}
                  
                  {product.productType !== 'composed' && !product.inStock && (
                    <Badge variant="destructive" className="ml-3">
                      Out of Stock
                    </Badge>
                  )}
                </div>
                
                <div className="mb-6">
                  {product.description ? (
                    <ClampedText
                      text={product.description}
                      maxLines={4}
                      className="text-gray-700 block"
                      as="p"
                    />
                  ) : null}
                </div>
                
                <div className="flex items-center text-gray-600 mb-2">
                  <Clock size={18} className="mr-2" />
                  Delivery: {product.deliveryTime}
                </div>
                
                {store && (
                  <Link to={`/${store.slug || store.id}`} className="flex items-center text-market-secondary hover:underline mb-6">
                    <StoreIcon size={18} className="mr-2" />
                    Sold by: {store.name}
                  </Link>
                )}
                
                {store && (
                  <Link to={`/${store.slug || store.id}`} className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6">
                    <ArrowLeft size={18} className="mr-2" />
                    Back to Store
                  </Link>
                )}
                
                {/* Quantity + cart — hidden on display-only storefronts */}
                {showCommerceActions && (
                <>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantity
                  </label>
                  <div className="flex items-center w-full max-w-[160px]">
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={decrementQuantity}
                      disabled={quantity <= 1 || !product.inStock}
                    >
                      <Minus size={14} />
                    </Button>
                    <Input
                      type="number"
                      min="1"
                      value={quantity === 0 ? '' : quantity}
                      onChange={handleQuantityChange}
                      className="text-center mx-2"
                      disabled={!product.inStock}
                      placeholder="1"
                    />
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={incrementQuantity}
                      disabled={!product.inStock}
                    >
                      <Plus size={14} />
                    </Button>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                  <div className="flex-1 w-full">
                    <Button 
                      onClick={handleAddToCart} 
                      className="w-full"
                      disabled={!product.inStock}
                    >
                      Add to Cart
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={toggleFavorite}
                      className="sm:flex-none"
                    >
                      <Heart 
                        className={isFavorite(product.id) ? "mr-2 fill-market-accent text-market-accent" : "mr-2"} 
                        size={18} 
                      />
                      {isFavorite(product.id) ? 'Saved' : 'Save'}
                    </Button>
                    <ShareButtons url={window.location.href} title={product.name} description={product.description} />
                  </div>
                </div>
                </>
                )}

                {!showCommerceActions && (
                  <div className="flex items-center gap-2 mb-6">
                    <Button
                      variant="outline"
                      onClick={toggleFavorite}
                      className="sm:flex-none"
                    >
                      <Heart 
                        className={isFavorite(product.id) ? "mr-2 fill-market-accent text-market-accent" : "mr-2"} 
                        size={18} 
                      />
                      {isFavorite(product.id) ? 'Saved' : 'Save'}
                    </Button>
                    <ShareButtons url={window.location.href} title={product.name} description={product.description} />
                  </div>
                )}

                <div className="mt-8 border-t pt-6">
                  <h2 className="text-xl font-semibold mb-3">Customer Reviews</h2>

                  {reviewsLoading ? (
                    <div className="text-sm text-gray-500">Loading reviews...</div>
                  ) : reviews.length === 0 ? (
                    <div className="text-sm text-gray-500 mb-4">No approved reviews yet for this product.</div>
                  ) : (
                    <div className="space-y-3 mb-5">
                      {reviews.slice(0, 6).map((review) => (
                        <div key={review.id} className="rounded-md border border-gray-200 p-3">
                          <div className="text-sm font-medium text-gray-900">{review.userName || 'Customer'}</div>
                          <div className="text-xs text-amber-600">
                            {'★'.repeat(Math.round(review.rating || 0)).padEnd(5, '☆')} {Number(review.rating || 0).toFixed(1)}
                          </div>
                          {review.comment && <div className="text-sm text-gray-700 mt-1">{review.comment}</div>}
                        </div>
                      ))}
                    </div>
                  )}

                  {!user && (
                    <div className="text-sm text-gray-600">Please sign in to submit a review.</div>
                  )}

                  {user && !hasPurchasedProduct && (
                    <div className="text-sm text-gray-600">You can review this product after purchasing it.</div>
                  )}

                  {user && hasPurchasedProduct && existingUserReview && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      Your review is already submitted ({existingUserReview.status}).
                    </div>
                  )}

                  {user && hasPurchasedProduct && !existingUserReview && (
                    <div className="space-y-3 rounded-md border border-gray-200 p-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
                        <select
                          value={reviewRating}
                          onChange={(e) => setReviewRating(Number(e.target.value))}
                          className="h-10 rounded-md border border-gray-300 px-3 text-sm"
                        >
                          {[5, 4, 3, 2, 1].map((n) => (
                            <option key={n} value={n}>{n} star{n > 1 ? 's' : ''}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Comment</label>
                        <Textarea
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          placeholder="Share your experience with this product"
                        />
                      </div>
                      <Button onClick={handleSubmitReview} disabled={isSubmittingReview}>
                        {isSubmittingReview ? 'Submitting...' : 'Submit Review'}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <WhatsAppChatWidget
        phone={store?.subscriptionTier !== 'trial' ? store?.whatsappBusiness : undefined}
        storeName={store?.name}
      />
    </div>
  );
};

export default ProductDetail;
