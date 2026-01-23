
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFirestore, doc, getDoc, collection, query, where, getDocs, runTransaction, orderBy, serverTimestamp } from 'firebase/firestore';
import { auth as firebaseAuth } from '@/lib/firebase';
import { useAuth } from '@/context/useAuth';
import { toast } from '@/components/ui/sonner';
import { pushDebugLog } from '@/lib/debugLogger';
import { StoreReview } from '@/types/product';
import { Button } from '@/components/ui/button';
import { Star } from 'lucide-react';
import { Store, Product, StoreAnnouncement } from '@/types/product';
import Header from '@/components/Header';
import ProductCard from '@/components/ProductCard';
import { MapPin, Globe, Facebook, Instagram, Twitter, Phone, Mail } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const StoreDetail: React.FC = () => {
  const { id, slug } = useParams<{ id?: string; slug?: string }>();
  const navigate = useNavigate();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
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
        let storeData: any = null;
        let docId: string = identifier;
        
        // Check if identifier is a slug or Firebase ID
        // Slugs: lowercase, hyphens, no uppercase (e.g., "johns-coffee-shop")
        // Firebase IDs: mixed case, no hyphens, 20-28 chars (e.g., "1HfsBr45XYM5SkaaazWegmyqGpA3")
        const isSlug = identifier.includes('-') && !/[A-Z0-9]{10,}/.test(identifier);
        
        if (isSlug) {
          // Search by slug
          const storesRef = collection(db, 'storeProfiles');
          const slugQuery = query(storesRef, where('slug', '==', identifier));
          const slugSnap = await getDocs(slugQuery);
          
          if (!slugSnap.empty) {
            docId = slugSnap.docs[0].id;
            storeData = slugSnap.docs[0].data();
            setStoreId(docId);
          } else {
            setError('Store not found');
            setIsLoading(false);
            return;
          }
        } else {
          // Direct ID lookup (backward compatibility)
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
          
          // Redirect to slug URL if store has a slug
          if (storeData.slug) {
            navigate(`/store/${storeData.slug}`, { replace: true });
            return;
          }
        }
        
        setStore({ id: docId, ...storeData } as Store);

        // Fetch products for this store
        const productsRef = collection(db, 'products');
        const productsQuery = query(productsRef, where('storeId', '==', docId));
        const productsSnap = await getDocs(productsQuery);
        setProducts(productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));

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

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-6">
        {/* Store Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            <img 
              src={store.logo} 
              alt={store.name} 
              className="h-32 w-32 object-cover rounded-full border-4 border-white shadow-sm"
            />
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-3xl font-bold mb-2">{store.name}</h1>
              <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                {avgRating !== null ? (
                  <div className="flex items-center text-yellow-500">
                    <Star size={16} className="mr-2" />
                    <span className="font-semibold">{avgRating.toFixed(1)}</span>
                    <span className="text-sm text-gray-600 ml-2">({reviews.length} reviews)</span>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">No ratings yet</div>
                )}
                <div className="ml-4">
                  <Button size="sm" variant={isFollowing ? 'ghost' : 'outline'} onClick={async () => {
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
              </div>
              {store.slogan && (
                <p className="text-lg text-gray-600 italic mb-4">"{store.slogan}"</p>
              )}
              <p className="text-gray-700 mb-4">{store.description}</p>
              
              <div className="flex flex-wrap justify-center md:justify-start gap-4">
                <div className="flex items-center text-gray-600">
                  <MapPin size={18} className="mr-2" />
                  {store.location}
                </div>
                
                {store.website && (
                  <a href={store.website} target="_blank" rel="noopener noreferrer" className="flex items-center text-market-primary hover:underline">
                    <Globe size={18} className="mr-2" />
                    Website
                  </a>
                )}
                
                {store.contactInfo?.phone && (
                  <div className="flex items-center text-gray-600">
                    <Phone size={18} className="mr-2" />
                    {store.contactInfo.phone}
                  </div>
                )}
                
                {store.contactInfo?.email && (
                  <div className="flex items-center text-gray-600">
                    <Mail size={18} className="mr-2" />
                    {store.contactInfo.email}
                  </div>
                )}
              </div>
              
              <div className="flex mt-4 justify-center md:justify-start gap-3">
                {store.socialLinks?.facebook && (
                  <a href={store.socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800" title="Facebook">
                    <Facebook size={22} />
                  </a>
                )}
                {store.socialLinks?.instagram && (
                  <a href={store.socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-pink-600 hover:text-pink-800" title="Instagram">
                    <Instagram size={22} />
                  </a>
                )}
                {store.socialLinks?.twitter && (
                  <a href={store.socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-600" title="Twitter">
                    <Twitter size={22} />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Announcements */}
        {announcements.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Announcements</h2>
            <div className="space-y-4">
              {announcements.map((announcement) => (
                <Alert key={announcement.id} className="bg-market-primary/10 border-market-primary">
                  <AlertTitle className="text-market-primary">{announcement.title}</AlertTitle>
                  <AlertDescription>
                    {announcement.message}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </div>
        )}
        
        {/* Products */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Products</h2>
          {products.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
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

        {/* Reviews */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Reviews</h2>
          {reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.map(r => (
                <div key={r.id} className="p-4 bg-white rounded shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="font-semibold">{r.userName || 'Anonymous'}</div>
                      <div className="text-yellow-500 flex items-center">{Array.from({length: r.rating}).map((_,i)=>(<Star key={i} size={14}/>))}</div>
                    </div>
                    <div className="text-sm text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</div>
                  </div>
                  {r.comment && <p className="mt-2 text-gray-700">{r.comment}</p>}
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
            <div className="text-gray-500">No reviews yet. Be the first to review this store.</div>
          )}

          <div className="mt-6 bg-white p-4 rounded shadow-sm">
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
