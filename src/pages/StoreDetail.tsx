
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFirestore, doc, getDoc, collection, query, where, getDocs, runTransaction, orderBy, serverTimestamp } from 'firebase/firestore';
import SEOHead from '@/components/SEOHead';
import { auth as firebaseAuth } from '@/lib/firebase';
import { useAuth } from '@/context/useAuth';

const API_URL = import.meta.env.VITE_API_URL || 'https://us-central1-market-flow-7b074.cloudfunctions.net/api';
import { toast } from '@/components/ui/sonner';
import { pushDebugLog } from '@/lib/debugLogger';
import { StoreReview } from '@/types/product';
import { Button } from '@/components/ui/button';
import { Star } from 'lucide-react';
import { Store, Product, StoreAnnouncement } from '@/types/product';
import { Recipe, RawMaterial } from '@/types/inventory';
import { calculateAvailableStock } from '@/lib/composedProductStock';
import Header from '@/components/Header';
import ProductCard from '@/components/ProductCard';
import { MapPin, Globe, Facebook, Instagram, Twitter, Phone, Mail } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// ── Store-level contact form (sends message to storeContactMessages/{storeId}/messages) ──
const StoreContactForm: React.FC<{ storeId: string; storeName: string; theme: { cardSoft: string; sectionTitle: string; mutedText: string } }> = ({ storeId, storeName, theme }) => {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setErr('');
    try {
      const res = await fetch(`${API_URL}/contact/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, subject: `Message from ${form.name}`, storeId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || 'Failed to send');
      }
      setDone(true);
      setForm({ name: '', email: '', message: '' });
    } catch {
      setErr('Failed to send. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className={theme.cardSoft}>
      <CardContent className="p-6">
        <h3 className={`font-semibold text-lg mb-4 ${theme.sectionTitle}`}>Send a Message</h3>
        {done ? (
          <div className="flex flex-col items-center py-8 gap-3 text-center">
            <svg className="w-12 h-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className={`font-medium ${theme.sectionTitle}`}>Message Sent!</p>
            <p className={`text-sm ${theme.mutedText}`}>The store will get back to you soon.</p>
            <button onClick={() => setDone(false)} className={`text-xs underline mt-1 ${theme.mutedText}`}>Send another</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="sc-name">Your Name *</Label>
              <Input id="sc-name" name="name" autoComplete="name" placeholder="Your name" value={form.name} onChange={handleChange} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sc-email">Email Address *</Label>
              <Input id="sc-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={handleChange} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sc-message">Message *</Label>
              <Textarea id="sc-message" name="message" autoComplete="off" placeholder="Write your message..." rows={5} value={form.message} onChange={handleChange} required className="resize-none" />
            </div>
            {err && <p className="text-sm text-red-500">{err}</p>}
            <div className="flex justify-end">
              <Button type="submit" disabled={sending}>{sending ? 'Sending...' : 'Send Message'}</Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
};

const StoreDetail: React.FC = () => {
  const { id, slug } = useParams<{ id?: string; slug?: string }>();
  const navigate = useNavigate();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [announcements, setAnnouncements] = useState<StoreAnnouncement[]>([]);
  const [reviews, setReviews] = useState<StoreReview[]>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [newRating, setNewRating] = useState<number>(5);
  const [newComment, setNewComment] = useState<string>('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRating, setEditRating] = useState<number>(5);
  const [editComment, setEditComment] = useState<string>('');
  const { user, followStore, unfollowStore } = useAuth();
  const isFollowing = !!user?.following?.includes(storeId || '');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Banner carousel state (must be here — before any early returns)
  const [bannerIndex, setBannerIndex] = useState(0);
  const bannerTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Read More modal state
  const [readMoreContent, setReadMoreContent] = useState<{ title: string; text: string } | null>(null);
  // Page navigation state
  const [activePage, setActivePage] = useState<string>('home');

  // Derive banner images safely (store may be null before load)
  const bannerImagesCount = React.useMemo(() => {
    if (!store) return 0;
    const bg = typeof store.storeBackgroundImage === 'string' && store.storeBackgroundImage ? 1 : 0;
    const carousel = Array.isArray(store.carouselImages) ? store.carouselImages.filter((u): u is string => typeof u === 'string' && u.trim().length > 0).length : 0;
    return bg + carousel;
  }, [store]);

  // Auto-advance carousel — must be before early returns
  useEffect(() => {
    if (bannerImagesCount <= 1) return;
    bannerTimer.current = setInterval(() => {
      setBannerIndex(i => (i + 1) % bannerImagesCount);
    }, 4000);
    return () => { if (bannerTimer.current) clearInterval(bannerTimer.current); };
  }, [bannerImagesCount]);

  // Fetch reviews helper (declared early so effects can call it)
  const fetchReviews = useCallback(async () => {
    if (!storeId) return;
    try {
      const db = getFirestore();
      const reviewsRef = collection(db, 'storeReviews');
      const q = query(reviewsRef, where('storeId', '==', storeId), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const items: StoreReview[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as StoreReview));
      setReviews(items);
      if (items.length > 0) {
        const sum = items.reduce((s, r) => s + (r.rating || 0), 0);
        setAvgRating(sum / items.length);
      } else {
        setAvgRating(null);
      }
    } catch (e) {
      console.error('Failed to fetch reviews', e);
    }
  }, [storeId]);

  useEffect(() => {
    // Determine if we have a slug or ID
    const identifier = slug || id;
    
    if (!identifier) {
      setError('Store identifier is missing');
      setIsLoading(false);
      return;
    }

    const loadStore = async () => {
      setIsLoading(true);
      try {
        const db = getFirestore();
        let storeData: Record<string, unknown> | null = null;
        let docId: string = identifier;
        
        // Always try slug lookup first (works for any slug format — no hyphen required)
        const storesRef = collection(db, 'storeProfiles');
        const slugQuery = query(storesRef, where('slug', '==', identifier));
        const slugSnap = await getDocs(slugQuery);
        
        if (!slugSnap.empty) {
          docId = slugSnap.docs[0].id;
          storeData = slugSnap.docs[0].data();
          setStoreId(docId);
        } else {
          // Fall back to direct document ID lookup (backward compat with old ID-based links)
          const storeRef = doc(db, 'storeProfiles', identifier);
          const storeSnap = await getDoc(storeRef);
          
          if (!storeSnap.exists()) {
            setError('Store not found');
            setIsLoading(false);
            return;
          }
          
          storeData = storeSnap.data();
          docId = identifier;
          setStoreId(docId);
          
          // Redirect to short slug URL if store has a slug
          if (storeData.slug) {
            navigate(`/${storeData.slug}`, { replace: true });
            return;
          }
        }
        
        setStore({ id: docId, ...storeData } as Store);

        // Fetch recipes and raw materials for stock calculation
        const recipesRef = collection(db, 'recipes');
        const recipesQuery = query(recipesRef, where('storeId', '==', docId));
        const recipesSnap = await getDocs(recipesQuery);
        const recipesList: Recipe[] = recipesSnap.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        } as Recipe));
        setRecipes(recipesList);

        const rawMaterialsRef = collection(db, 'rawMaterials');
        const rawMaterialsQuery = query(rawMaterialsRef, where('storeId', '==', docId));
        const rawMaterialsSnap = await getDocs(rawMaterialsQuery);
        const rawMaterialsList: RawMaterial[] = rawMaterialsSnap.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        } as RawMaterial));
        setRawMaterials(rawMaterialsList);

        // Fetch products for this store
        const productsRef = collection(db, 'products');
        const productsQuery = query(productsRef, where('storeId', '==', docId));
        const productsSnap = await getDocs(productsQuery);
        
        // Attach store information and calculate stock for composed products
        const storeInfo = {
          id: docId,
          name: typeof storeData?.name === 'string' ? storeData.name : 'Unknown Store',
          slug: typeof storeData?.slug === 'string' ? storeData.slug : undefined,
        };
        const productsList = productsSnap.docs.map(doc => {
          const productData = doc.data();
          const product: Product = {
            id: doc.id, 
            ...productData,
            store: storeInfo 
          } as Product;

          // If it's a composed product, calculate available stock from raw materials
          if (product.productType === 'composed' && product.recipeId) {
            const recipe = recipesList.find(r => r.id === product.recipeId);
            const availableStock = calculateAvailableStock(recipe, rawMaterialsList);
            return {
              ...product,
              stock: availableStock,
              inStock: availableStock > 0,
            };
          }

          return product;
        });
        setProducts(productsList);

        // Fetch announcements for this store (optional, if you have this collection)
        let announcementsList: StoreAnnouncement[] = [];
        try {
          const announcementsRef = collection(db, 'announcements');
          const announcementsQuery = query(announcementsRef, where('storeId', '==', docId));
          const announcementsSnap = await getDocs(announcementsQuery);
          announcementsList = announcementsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoreAnnouncement));
        } catch (e) {
          console.error('Failed to load announcements', e);
        }
        setAnnouncements(announcementsList);
      } catch (err) {
        setError('Failed to load store data');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadStore();
  }, [id, slug, navigate]);
  
  // Load reviews when storeId is set
  useEffect(() => {
    if (storeId) {
      fetchReviews();
    }
  }, [storeId, fetchReviews]);

  

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-12 flex justify-center">
          <div className="animate-pulse space-y-8 w-full max-w-4xl">
            <div className="h-40 bg-gray-200 rounded-lg"></div>
            <div className="h-10 bg-gray-200 w-1/3 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="h-64 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-12 flex justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">{error || 'Store not found'}</h2>
            <p className="text-gray-600 mb-6">The store you're looking for doesn't exist or couldn't be loaded.</p>
          </div>
        </div>
      </div>
    );
  }

  const allowedTemplates = new Set(['default', 'modern', 'minimal', 'classic', 'vibrant', 'professional', 'artistic']);
  const resolvedTemplate = typeof store.template === 'string' && allowedTemplates.has(store.template)
    ? store.template
    : 'modern';
  const templateStyles: Record<string, {
    pageBg: string;
    heroBg: string;
    headerCard: string;
    sectionTitle: string;
    card: string;
    cardSoft: string;
    mutedText: string;
    link: string;
    actionButton: string;
    reviewCard: string;
  }> = {
    default: {
      pageBg: 'bg-gray-50',
      heroBg: 'bg-gradient-to-r from-gray-700 to-gray-900',
      headerCard: 'bg-white border border-gray-100',
      sectionTitle: 'text-gray-900',
      card: 'bg-white',
      cardSoft: 'bg-gray-50 border border-gray-200',
      mutedText: 'text-gray-600',
      link: 'text-gray-800 hover:text-gray-900',
      actionButton: 'border-gray-300 text-gray-800 hover:bg-gray-100',
      reviewCard: 'bg-white',
    },
    modern: {
      pageBg: 'bg-gradient-to-b from-cyan-50 via-white to-indigo-50',
      heroBg: 'bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-600',
      headerCard: 'bg-white/90 backdrop-blur border border-cyan-100',
      sectionTitle: 'text-cyan-900',
      card: 'bg-white border border-cyan-100',
      cardSoft: 'bg-cyan-50/70 border border-cyan-100',
      mutedText: 'text-slate-600',
      link: 'text-cyan-700 hover:text-cyan-900',
      actionButton: 'border-cyan-300 text-cyan-800 hover:bg-cyan-50',
      reviewCard: 'bg-white border border-cyan-100',
    },
    minimal: {
      pageBg: 'bg-white',
      heroBg: 'bg-gradient-to-r from-gray-700 to-gray-900',
      headerCard: 'bg-white border border-gray-200 shadow-none',
      sectionTitle: 'text-gray-800',
      card: 'bg-white border border-gray-200 shadow-none',
      cardSoft: 'bg-white border border-gray-200 shadow-none',
      mutedText: 'text-gray-500',
      link: 'text-gray-700 hover:text-gray-900',
      actionButton: 'border-gray-300 text-gray-700 hover:bg-gray-50',
      reviewCard: 'bg-white border border-gray-200 shadow-none',
    },
    classic: {
      pageBg: 'bg-blue-50/40',
      heroBg: 'bg-gradient-to-r from-blue-700 to-blue-900',
      headerCard: 'bg-white border border-blue-200',
      sectionTitle: 'text-blue-900',
      card: 'bg-white border border-blue-100',
      cardSoft: 'bg-blue-50/70 border border-blue-200',
      mutedText: 'text-blue-700',
      link: 'text-blue-700 hover:text-blue-900',
      actionButton: 'border-blue-300 text-blue-800 hover:bg-blue-50',
      reviewCard: 'bg-white border border-blue-100',
    },
    vibrant: {
      pageBg: 'bg-gradient-to-br from-orange-50 via-pink-50 to-violet-100',
      heroBg: 'bg-gradient-to-r from-orange-500 via-pink-500 to-violet-600',
      headerCard: 'bg-white/95 border border-orange-200',
      sectionTitle: 'text-fuchsia-900',
      card: 'bg-white border border-pink-200',
      cardSoft: 'bg-gradient-to-r from-orange-50 to-pink-50 border border-pink-200',
      mutedText: 'text-fuchsia-700',
      link: 'text-fuchsia-700 hover:text-fuchsia-900',
      actionButton: 'border-fuchsia-300 text-fuchsia-800 hover:bg-fuchsia-50',
      reviewCard: 'bg-white border border-violet-200',
    },
    professional: {
      pageBg: 'bg-slate-100',
      heroBg: 'bg-gradient-to-r from-slate-700 to-slate-900',
      headerCard: 'bg-white border border-slate-300',
      sectionTitle: 'text-slate-900',
      card: 'bg-white border border-slate-200',
      cardSoft: 'bg-slate-50 border border-slate-300',
      mutedText: 'text-slate-600',
      link: 'text-slate-700 hover:text-slate-900',
      actionButton: 'border-slate-400 text-slate-800 hover:bg-slate-100',
      reviewCard: 'bg-white border border-slate-200',
    },
    artistic: {
      pageBg: 'bg-gradient-to-tr from-violet-100 via-rose-50 to-amber-50',
      heroBg: 'bg-gradient-to-r from-violet-600 via-fuchsia-500 to-amber-500',
      headerCard: 'bg-white/90 border border-violet-200',
      sectionTitle: 'text-violet-900',
      card: 'bg-white border border-rose-200',
      cardSoft: 'bg-gradient-to-r from-violet-50 to-rose-50 border border-violet-200',
      mutedText: 'text-violet-700',
      link: 'text-violet-700 hover:text-violet-900',
      actionButton: 'border-violet-300 text-violet-800 hover:bg-violet-50',
      reviewCard: 'bg-white border border-fuchsia-200',
    },
  };
  const currentTheme = templateStyles[resolvedTemplate] || templateStyles.modern;
  const backgroundImage = typeof store.storeBackgroundImage === 'string' ? store.storeBackgroundImage : '';
  const carouselImages = Array.isArray(store.carouselImages)
    ? store.carouselImages.filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
    : [];
  const galleryImages = Array.isArray(store.galleryImages)
    ? store.galleryImages.filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
    : [];
  const aboutUs = typeof store.aboutUs === 'string' ? store.aboutUs.trim() : '';
  const mission = typeof store.mission === 'string' ? store.mission.trim() : '';
  const vision = typeof store.vision === 'string' ? store.vision.trim() : '';

  // Merge backgroundImage + carouselImages into one unified banner list
  const bannerImages = [
    ...(backgroundImage ? [backgroundImage] : []),
    ...carouselImages,
  ];

  const goToBanner = (idx: number) => {
    setBannerIndex(idx);
    if (bannerTimer.current) clearInterval(bannerTimer.current);
    bannerTimer.current = setInterval(() => {
      setBannerIndex(i => (i + 1) % bannerImages.length);
    }, 4000);
  };

  const tColors = store.templateColors;
  const colorStyle = tColors ? {
    '--store-primary': tColors.primary,
    '--store-secondary': tColors.secondary,
    '--store-accent': tColors.accent,
  } as React.CSSProperties : {};

  return (
    <div className={`min-h-screen ${currentTheme.pageBg}`} style={colorStyle}>
      {store && (
        <SEOHead
          title={store.name}
          description={store.description || store.slogan || `Shop at ${store.name} on Grabio`}
          image={store.logo}
          url={`https://grabio.space/${store.slug || storeId}`}
        />
      )}
      {/* Read More Modal */}
      {readMoreContent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setReadMoreContent(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-xl font-bold">{readMoreContent.title}</h2>
              <button onClick={() => setReadMoreContent(null)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">&times;</button>
            </div>
            <div className="overflow-y-auto px-6 py-4">
              <p className="text-sm whitespace-pre-line text-gray-700 leading-relaxed">{readMoreContent.text}</p>
            </div>
          </div>
        </div>
      )}

      <Header />
      <main className="container mx-auto px-4 py-6">
        {/* Hero Banner — image carousel OR gradient fallback */}
        {bannerImages.length > 0 ? (
          <div className="relative rounded-xl overflow-hidden shadow-md mb-6 h-64 md:h-80">
            {bannerImages.map((url, idx) => (
              <img
                key={url}
                src={url}
                alt={`Banner ${idx + 1}`}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${idx === bannerIndex ? 'opacity-100' : 'opacity-0'}`}
              />
            ))}
            {/* Slogan overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end">
              <div className="p-6 text-white">
                {store.slogan && <p className="text-base md:text-xl font-semibold drop-shadow">{store.slogan}</p>}
              </div>
            </div>
            {/* Prev / Next arrows */}
            {bannerImages.length > 1 && (
              <>
                <button
                  onClick={() => goToBanner((bannerIndex - 1 + bannerImages.length) % bannerImages.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center"
                >‹</button>
                <button
                  onClick={() => goToBanner((bannerIndex + 1) % bannerImages.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center"
                >›</button>
                {/* Dots */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                  {bannerImages.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => goToBanner(idx)}
                      className={`w-2 h-2 rounded-full transition-all ${idx === bannerIndex ? 'bg-white scale-125' : 'bg-white/50'}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className={`rounded-xl shadow-sm mb-6 text-white ${currentTheme.heroBg}`}>
            <div className="p-6 md:p-8">
              <h2 className="text-2xl md:text-3xl font-bold">{store.name}</h2>
              {store.slogan && <p className="text-sm md:text-base opacity-90 mt-2">{store.slogan}</p>}
            </div>
          </div>
        )}

        {/* Store Header */}
        <div className={`rounded-lg shadow-sm p-6 mb-6 ${currentTheme.headerCard}`}>
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            <img 
              src={store.logo} 
              alt={store.name} 
              className="h-24 w-24 object-cover rounded-full border-4 border-white shadow-sm"
            />
            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-3 mb-3">
                {avgRating !== null ? (
                  <div className="flex items-center text-yellow-500">
                    <Star size={16} className="mr-2" />
                    <span className="font-semibold">{avgRating.toFixed(1)}</span>
                    <span className={`text-sm ml-2 ${currentTheme.mutedText}`}>({reviews.length} reviews)</span>
                  </div>
                ) : (
                  <div className={`text-sm ${currentTheme.mutedText}`}>No ratings yet</div>
                )}
                <Button size="sm" variant={isFollowing ? 'ghost' : 'outline'} className={currentTheme.actionButton} onClick={async () => {
                  if (!user) { toast('Please sign in to follow stores'); return; }
                  try {
                    if (isFollowing) await unfollowStore(store.id); else await followStore(store.id);
                  } catch (err) {
                    const maybeErr = err as { code?: string; name?: string; message?: string } | undefined;
                    const code = maybeErr?.code || maybeErr?.name || '';
                    const msg = maybeErr?.message || String(err);
                    console.error('Follow button failed', { err });
                    const full = code ? `${code}: ${msg}` : msg;
                    pushDebugLog('Follow failed', full, { storeId: store.id, err });
                    toast.error('Failed to update follow status: ' + full);
                  }
                }}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Button>
              </div>
              <p className={`mb-4 text-sm ${currentTheme.mutedText}`}>{store.description}</p>
              
              <div className="flex flex-wrap justify-center md:justify-start gap-4">
                <div className={`flex items-center ${currentTheme.mutedText}`}>
                  <MapPin size={18} className="mr-2" />
                  {store.location}
                </div>
                
                {store.website && (
                  <a href={store.website} target="_blank" rel="noopener noreferrer" className={`flex items-center hover:underline ${currentTheme.link}`}>
                    <Globe size={18} className="mr-2" />
                    Website
                  </a>
                )}
                
                {store.contactInfo?.phone && (
                  <div className={`flex items-center ${currentTheme.mutedText}`}>
                    <Phone size={18} className="mr-2" />
                    {store.contactInfo.phone}
                  </div>
                )}
                
                {store.contactInfo?.email && (
                  <div className={`flex items-center ${currentTheme.mutedText}`}>
                    <Mail size={18} className="mr-2" />
                    {store.contactInfo.email}
                  </div>
                )}
              </div>
              
              <div className="flex mt-4 justify-center md:justify-start gap-3">
                {store.socialLinks?.facebook && (
                  <a href={store.socialLinks.facebook} target="_blank" rel="noopener noreferrer" className={currentTheme.link} title="Facebook">
                    <Facebook size={22} />
                  </a>
                )}
                {store.socialLinks?.instagram && (
                  <a href={store.socialLinks.instagram} target="_blank" rel="noopener noreferrer" className={currentTheme.link} title="Instagram">
                    <Instagram size={22} />
                  </a>
                )}
                {store.socialLinks?.twitter && (
                  <a href={store.socialLinks.twitter} target="_blank" rel="noopener noreferrer" className={currentTheme.link} title="Twitter">
                    <Twitter size={22} />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Page Navigation Bar */}
        {(() => {
          const customPages = Array.isArray(store.customPages) ? store.customPages : [];
          const hasAbout = !!(store.aboutUs || store.mission || store.vision);
          const hasContact = !!(store.contactInfo?.phone || store.contactInfo?.email || store.location || store.website || store.socialLinks?.facebook || store.socialLinks?.instagram || store.socialLinks?.twitter || store.socialLinks?.whatsapp);
          const navPages = [
            { id: 'home', label: 'Home' },
            ...(hasAbout ? [{ id: 'about', label: 'About Us' }] : []),
            { id: 'products', label: 'Products' },
            ...customPages.sort((a, b) => a.order - b.order).map(p => ({ id: p.id, label: p.name })),
            ...(hasContact ? [{ id: 'contact', label: 'Contact Us' }] : []),
          ];
          if (navPages.length <= 1) return null;
          return (
            <div className={`flex gap-1 mb-6 overflow-x-auto rounded-lg p-1 ${currentTheme.cardSoft}`}>
              {navPages.map(p => (
                <button
                  key={p.id}
                  onClick={() => setActivePage(p.id)}
                  className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                    activePage === p.id
                      ? 'bg-white shadow text-gray-900'
                      : `${currentTheme.mutedText} hover:bg-white/60`
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          );
        })()}

        {/* Page Content */}
        {activePage === 'home' && (
          <>
        {/* Announcements */}
        {(aboutUs || mission || vision) && (
          <div className="mb-8">
            <h2 className={`text-xl font-semibold mb-4 ${currentTheme.sectionTitle}`}>About Us</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
              {[
                { title: 'Who We Are', text: aboutUs },
                { title: 'Mission', text: mission },
                { title: 'Vision', text: vision },
              ].filter(c => c.text).map(c => (
                <Card key={c.title} className={`${currentTheme.cardSoft} flex flex-col`}>
                  <CardContent className="p-4 flex flex-col flex-1">
                    <h3 className="font-semibold mb-2">{c.title}</h3>
                    <p className={`text-sm whitespace-pre-line ${currentTheme.mutedText} line-clamp-6 flex-1`}>{c.text}</p>
                    {c.text.length > 200 && (
                      <button
                        onClick={() => setReadMoreContent({ title: c.title, text: c.text })}
                        className={`mt-3 text-xs font-semibold underline self-start ${currentTheme.link}`}
                      >
                        Read More
                      </button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Announcements */}
        {announcements.length > 0 && (
          <div className={`mb-8 rounded-lg p-4 ${currentTheme.cardSoft}`}>
            <h2 className={`text-xl font-semibold mb-4 ${currentTheme.sectionTitle}`}>Announcements</h2>
            <div className="space-y-4">
              {announcements.map((announcement) => (
                <Alert key={announcement.id} className={currentTheme.card}>
                  <AlertTitle className={currentTheme.sectionTitle}>{announcement.title}</AlertTitle>
                  <AlertDescription>
                    {announcement.message}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </div>
        )}
        
        {/* Products */}
        <div className={`rounded-lg p-4 ${currentTheme.cardSoft}`}>
          <h2 className={`text-xl font-semibold mb-4 ${currentTheme.sectionTitle}`}>Products</h2>
          {products.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} whatsappNumber={store.subscriptionTier !== 'trial' ? store.whatsappBusiness : undefined} storeName={store.name} currency={store.mainCurrency} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-40">
                <p className="text-gray-500">This store doesn't have any products yet.</p>
              </CardContent>
            </Card>
          )}
        </div>

        {galleryImages.length > 0 && (
          <div className={`mt-8 rounded-lg p-4 ${currentTheme.cardSoft}`}>
            <h2 className={`text-xl font-semibold mb-4 ${currentTheme.sectionTitle}`}>Gallery</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {galleryImages.map((url, index) => (
                <img
                  key={`${url}-${index}`}
                  src={url}
                  alt={`Store gallery ${index + 1}`}
                  className="w-full h-36 md:h-44 rounded-lg object-cover border"
                />
              ))}
            </div>
          </div>
        )}
          </>
        )}

        {/* About Us Page */}
        {activePage === 'about' && (
          <div className="space-y-6">
            <h2 className={`text-2xl font-bold ${currentTheme.sectionTitle}`}>About Us</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
              {[
                { title: 'Who We Are', text: aboutUs },
                { title: 'Mission', text: mission },
                { title: 'Vision', text: vision },
              ].filter(c => c.text).map(c => (
                <Card key={c.title} className={`${currentTheme.cardSoft} flex flex-col`}>
                  <CardContent className="p-6 flex flex-col flex-1">
                    <h3 className="text-lg font-semibold mb-3">{c.title}</h3>
                    <p className={`text-sm whitespace-pre-line ${currentTheme.mutedText} leading-relaxed flex-1`}>{c.text}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Products Page */}
        {activePage === 'products' && (
          <div className="space-y-4">
            <h2 className={`text-2xl font-bold ${currentTheme.sectionTitle}`}>Products</h2>
            {products.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} whatsappNumber={store.subscriptionTier !== 'trial' ? store.whatsappBusiness : undefined} storeName={store.name} currency={store.mainCurrency} />
                ))}
              </div>
            ) : (
              <Card className={currentTheme.card}>
                <CardContent className="flex items-center justify-center h-40">
                  <p className="text-gray-500">This store doesn't have any products yet.</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Custom Pages */}
        {Array.isArray(store.customPages) && store.customPages.map(page => activePage === page.id && (
          <div key={page.id} className="space-y-6">
            <h2 className={`text-2xl font-bold ${currentTheme.sectionTitle}`}>{page.name}</h2>
            {page.image && (
              <div className="rounded-xl overflow-hidden shadow-md">
                <img src={page.image} alt={page.name} className="w-full max-h-80 object-cover" />
              </div>
            )}
            {page.content && (
              <Card className={currentTheme.cardSoft}>
                <CardContent className="p-6">
                  <p className={`text-sm whitespace-pre-line leading-relaxed ${currentTheme.mutedText}`}>{page.content}</p>
                </CardContent>
              </Card>
            )}
            {!page.image && !page.content && (
              <p className={`${currentTheme.mutedText}`}>This page has no content yet.</p>
            )}
          </div>
        ))}

        {/* Contact Us Page */}
        {activePage === 'contact' && (
          <div className="space-y-6">
            <h2 className={`text-2xl font-bold ${currentTheme.sectionTitle}`}>Contact Us</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Contact Details Card */}
              <Card className={currentTheme.cardSoft}>
                <CardContent className="p-6 space-y-5">
                  {store.location && (
                    <div className="flex items-start gap-4">
                      <div className="rounded-full bg-white/80 shadow p-2 mt-0.5"><MapPin size={18} className={currentTheme.mutedText} /></div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-0.5">Location</p>
                        <p className={`text-sm ${currentTheme.mutedText}`}>{store.location}</p>
                      </div>
                    </div>
                  )}
                  {store.contactInfo?.phone && (
                    <div className="flex items-start gap-4">
                      <div className="rounded-full bg-white/80 shadow p-2 mt-0.5"><Phone size={18} className={currentTheme.mutedText} /></div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-0.5">Phone</p>
                        <a href={`tel:${store.contactInfo.phone}`} className={`text-sm ${currentTheme.link} hover:underline`}>{store.contactInfo.phone}</a>
                      </div>
                    </div>
                  )}
                  {store.contactInfo?.email && (
                    <div className="flex items-start gap-4">
                      <div className="rounded-full bg-white/80 shadow p-2 mt-0.5"><Mail size={18} className={currentTheme.mutedText} /></div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-0.5">Email</p>
                        <a href={`mailto:${store.contactInfo.email}`} className={`text-sm ${currentTheme.link} hover:underline break-all`}>{store.contactInfo.email}</a>
                      </div>
                    </div>
                  )}
                  {store.website && (
                    <div className="flex items-start gap-4">
                      <div className="rounded-full bg-white/80 shadow p-2 mt-0.5"><Globe size={18} className={currentTheme.mutedText} /></div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-0.5">Website</p>
                        <a href={store.website} target="_blank" rel="noopener noreferrer" className={`text-sm ${currentTheme.link} hover:underline break-all`}>{store.website}</a>
                      </div>
                    </div>
                  )}
                  {(store.socialLinks?.facebook || store.socialLinks?.instagram || store.socialLinks?.twitter || store.socialLinks?.whatsapp) && (
                    <div className="flex items-start gap-4">
                      <div className="rounded-full bg-white/80 shadow p-2 mt-0.5"><span className={`text-xs font-bold ${currentTheme.mutedText}`}>@</span></div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Social Media</p>
                        <div className="flex gap-3">
                          {store.socialLinks?.facebook && (
                            <a href={store.socialLinks.facebook} target="_blank" rel="noopener noreferrer" className={`${currentTheme.link} hover:opacity-70`} title="Facebook"><Facebook size={22} /></a>
                          )}
                          {store.socialLinks?.instagram && (
                            <a href={store.socialLinks.instagram} target="_blank" rel="noopener noreferrer" className={`${currentTheme.link} hover:opacity-70`} title="Instagram"><Instagram size={22} /></a>
                          )}
                          {store.socialLinks?.twitter && (
                            <a href={store.socialLinks.twitter} target="_blank" rel="noopener noreferrer" className={`${currentTheme.link} hover:opacity-70`} title="Twitter"><Twitter size={22} /></a>
                          )}
                          {store.socialLinks?.whatsapp && (
                            <a href={`https://wa.me/${store.socialLinks.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className={`${currentTheme.link} hover:opacity-70`} title="WhatsApp">
                              <svg viewBox="0 0 24 24" className="w-[22px] h-[22px] fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Send a Message Card */}
              <StoreContactForm storeId={storeId!} storeName={store.name} theme={currentTheme} />
            </div>
          </div>
        )}

        {/* Reviews — always visible */}
        <div className={`mt-8 rounded-lg p-4 ${currentTheme.cardSoft}`}>
          <h2 className={`text-xl font-semibold mb-4 ${currentTheme.sectionTitle}`}>Reviews</h2>
          {reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.map(r => (
                <div key={r.id} className={`p-4 rounded shadow-sm ${currentTheme.reviewCard}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="font-semibold">{r.userName || 'Anonymous'}</div>
                      <div className="text-yellow-500 flex items-center">{Array.from({length: r.rating}).map((_,i)=>(<Star key={i} size={14}/>))}</div>
                    </div>
                    <div className={`text-sm ${currentTheme.mutedText}`}>
                      {(() => {
                        if (!r.createdAt) return 'Recently';
                        const date = new Date(String(r.createdAt));
                        return Number.isNaN(date.getTime()) ? 'Recently' : date.toLocaleDateString();
                      })()}
                    </div>
                  </div>
                  {r.comment && <p className={`mt-2 ${currentTheme.mutedText}`}>{r.comment}</p>}
                  {user && user.id === r.userId && (
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => {
                        // start editing
                        setEditingId(r.id || null);
                        setEditRating(r.rating || 5);
                        setEditComment(r.comment || '');
                      }}>Edit</Button>
                      <Button size="sm" variant="ghost" onClick={async () => {
                        if (!r.id) return;
                        try {
                          const db = getFirestore();
                          await runTransaction(db, async (tx) => {
                            const storeRef = doc(db, 'storeProfiles', id);
                            const reviewRef = doc(db, 'storeReviews', r.id!);
                            const [storeSnap, reviewSnap] = await Promise.all([tx.get(storeRef), tx.get(reviewRef)]);
                            if (!reviewSnap.exists()) throw new Error('Review not found');
                            const oldRating = reviewSnap.data().rating || 0;
                            const prevCount = storeSnap.exists() ? (storeSnap.data().ratingCount || 0) : 0;
                            const prevAvg = storeSnap.exists() ? (storeSnap.data().rating || 0) : 0;
                            const newCount = Math.max(0, prevCount - 1);
                            if (newCount === 0) {
                              tx.update(storeRef, { rating: 0, ratingCount: 0 });
                            } else {
                              const newAvg = ((prevAvg * prevCount) - oldRating) / newCount;
                              tx.update(storeRef, { rating: newAvg, ratingCount: newCount });
                            }
                            tx.delete(reviewRef);
                          });
                          toast('Review deleted');
                          fetchReviews();
                          // refresh store
                          const db2 = getFirestore();
                          const sref = doc(db2, 'storeProfiles', id);
                          const ssnap = await getDoc(sref);
                          if (ssnap.exists()) setStore({ id, ...ssnap.data() } as Store);
                        } catch (err) {
                          console.error('Failed to delete review', err);
                          toast('Failed to delete review');
                        }
                      }}>Delete</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            ) : (
            <div className={currentTheme.mutedText}>No reviews yet. Be the first to review this store.</div>
          )}

          <div className={`mt-6 p-4 rounded shadow-sm ${currentTheme.card}`}>
            <h3 className="font-semibold mb-2">Write a review</h3>
            {!user ? (
              <div className="text-gray-600">Please sign in to leave a review.</div>
            ) : (
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!id || !user) return;
                if (isSubmittingReview) return; // prevent dupes
                setIsSubmittingReview(true);
                try {
                  const db = getFirestore();
                  // Transaction: create review and update store's aggregated rating/count
                  await runTransaction(db, async (tx) => {
                    const storeRef = doc(db, 'storeProfiles', id);
                    const storeSnap = await tx.get(storeRef);
                    const prevCount = storeSnap.exists() ? (storeSnap.data().ratingCount || 0) : 0;
                    const prevAvg = storeSnap.exists() ? (storeSnap.data().rating || 0) : 0;
                    const reviewRef = doc(collection(db, 'storeReviews'));
                    const reviewData: Partial<StoreReview> = {
                      storeId: id,
                      userId: user.id,
                      userName: user.name,
                      rating: Number(newRating),
                      comment: newComment,
                      createdAt: serverTimestamp()
                    };
                    // Log the actual payload we're about to write (helps debug rules mismatches)
                    console.log('DEBUG reviewData (to write)', reviewData);
                    // Log auth state from both our context user and firebase.auth currentUser to verify they match
                    console.log('DEBUG auth.uids', { contextUid: user.id, firebaseUid: firebaseAuth.currentUser?.uid });
                    // Create the review document only. Aggregating store rating is handled
                    // server-side or via a separate trusted process; client should not
                    // attempt to update the storeProfiles doc because rules restrict that
                    // to the store owner.
                    tx.set(reviewRef, reviewData);
                  });
                  toast('Review submitted');
                  setNewComment('');
                  setNewRating(5);
                  // Refresh reviews and store
                  await fetchReviews();
                  const db2 = getFirestore();
                  const sref = doc(db2, 'storeProfiles', id);
                  const ssnap = await getDoc(sref);
                  if (ssnap.exists()) setStore({ id, ...ssnap.data() } as Store);
                } catch (err) {
                  console.error('Failed to submit review', err);
                  const maybeErr = err as { code?: string; name?: string; message?: string } | undefined;
                  const code = maybeErr?.code || maybeErr?.name || '';
                  const message = maybeErr?.message || String(err);
                  const full = code ? `${code}: ${message}` : message;
                  pushDebugLog('Review submit failed', full, { storeId: id, err });
                  toast.error('Failed to submit review: ' + full);
                } finally {
                  setIsSubmittingReview(false);
                }
              }}>
                <div className="flex items-center gap-4 mb-3">
                  <label className="text-sm">Rating</label>
                  <select value={newRating} onChange={(e) => setNewRating(Number(e.target.value))} className="border px-2 py-1 rounded">
                    {[5,4,3,2,1].map(n => <option key={n} value={n}>{n} star{n>1?'s':''}</option>)}
                  </select>
                </div>
                <textarea value={newComment} onChange={(e)=>setNewComment(e.target.value)} className="w-full border rounded p-2 mb-3" placeholder="Write your comment (optional)" />
                <div className="text-right">
                  <Button type="submit" disabled={isSubmittingReview}>{isSubmittingReview ? 'Submitting...' : 'Submit review'}</Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default StoreDetail;
