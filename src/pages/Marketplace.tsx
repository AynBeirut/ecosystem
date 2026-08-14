import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import SEOHead from '@/components/SEOHead';
import ProductCard from '@/components/ProductCard';
import StoreCard from '@/components/StoreCard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import Header from '@/components/Header';
import MobileHeader from '@/components/MobileHeader';
import { Product, Store } from '@/types/product';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { cachedPublicRead } from '@/lib/publicReadCache';
import { Package, Search, SlidersHorizontal, Store as StoreIcon } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

type BrowseTab = 'stores' | 'products';

const Marketplace: React.FC = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<BrowseTab>('stores');
  const [searchQuery, setSearchQuery] = useState('');
  const [priceRange, setPriceRange] = useState([0, 20000]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [filteredStores, setFilteredStores] = useState<Store[]>([]);
  const [allStores, setAllStores] = useState<Store[]>([]);
  const [location_, setLocation] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const query = params.get('q');
    if (query) setSearchQuery(query);
  }, [location]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [storesList, productsList] = await Promise.all([
          cachedPublicRead('marketplace:storeProfiles', async () => {
            const db = getFirestore();
            const snapshot = await getDocs(collection(db, 'storeProfiles'));
            return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Store));
          }),
          cachedPublicRead('marketplace:products', async () => {
            const db = getFirestore();
            const snapshot = await getDocs(collection(db, 'products'));
            return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Product));
          }),
        ]);
        if (cancelled) return;
        setAllStores(storesList.filter((store) => store.status === 'online'));
        setAllProducts(productsList);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onlineStoreIds = new Set(allStores.map((store) => store.id));

    const isMarketplaceVisible = (product: Product): boolean => {
      if (!onlineStoreIds.has(product.storeId)) return false;
      if (product.inStock === false) return false;
      if (product.productType === 'service' || product.supplierSyncEnabled) return true;
      if (product.inStock === true) return true;
      return typeof product.stock !== 'number' || product.stock > 0;
    };

    const filtered = allProducts.filter((product) => {
      const matchesSearch =
        searchQuery === '' ||
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPrice = product.price >= priceRange[0] && product.price <= priceRange[1];
      const matchesLocation =
        !location_ ||
        allStores
          .find((store) => store.id === product.storeId)
          ?.location.toLowerCase()
          .includes(location_.toLowerCase());
      return matchesSearch && matchesPrice && matchesLocation && isMarketplaceVisible(product);
    });

    const deduped = Array.from(new Map(filtered.map((p) => [p.id, p])).values());
    let ordered = deduped;
    if (user?.following?.length) {
      const followingSet = new Set(user.following);
      ordered = deduped.slice().sort((a, b) => {
        const aFollow = followingSet.has(a.storeId) ? 0 : 1;
        const bFollow = followingSet.has(b.storeId) ? 0 : 1;
        return aFollow - bFollow;
      });
    }
    setFilteredProducts(ordered);

    let nextStores = allStores.filter((store) => {
      const matchesSearch =
        searchQuery === '' ||
        store.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (store.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesLocation =
        !location_ || store.location.toLowerCase().includes(location_.toLowerCase());
      return matchesSearch && matchesLocation;
    });
    if (nextStores.length === 0 && allStores.length > 0) nextStores = allStores;
    setFilteredStores(nextStores);
  }, [searchQuery, priceRange, location_, allStores, allProducts, user]);

  const resetFilters = () => {
    setSearchQuery('');
    setPriceRange([0, 20000]);
    setLocation('');
  };

  const resultCount = activeTab === 'stores' ? filteredStores.length : filteredProducts.length;

  return (
    <div className="marketplace-page min-h-screen flex flex-col bg-[#f5f5f7] text-neutral-900">
      <SEOHead
        title="Marketplace"
        description="Discover and shop from local stores in Lebanon."
        url="https://grabio.space/search"
      />
      {!isMobile ? (
        <Header variant="light" />
      ) : (
        <MobileHeader title="Marketplace" showBackButton={false} showHomeButton variant="light" />
      )}

      <div className="marketplace-toolbar sticky top-14 z-40 border-b border-black/[0.06] bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:gap-4 md:py-3.5">
          <form onSubmit={(e) => e.preventDefault()} className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              type="search"
              placeholder="Search stores and products"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="marketplace-search h-10 rounded-full border-0 bg-neutral-100 pl-10 pr-4 text-[15px] shadow-none ring-0 focus-visible:ring-2 focus-visible:ring-teal-500/30"
            />
          </form>

          <div className="flex items-center gap-2">
            <div className="marketplace-segment flex flex-1 rounded-full bg-neutral-100 p-1 md:flex-none">
              <button
                type="button"
                onClick={() => setActiveTab('stores')}
                className={cn('marketplace-segment__btn', activeTab === 'stores' && 'marketplace-segment__btn--active')}
              >
                <StoreIcon className="h-3.5 w-3.5" aria-hidden />
                Stores
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('products')}
                className={cn('marketplace-segment__btn', activeTab === 'products' && 'marketplace-segment__btn--active')}
              >
                <Package className="h-3.5 w-3.5" aria-hidden />
                Products
              </button>
            </div>

            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0 rounded-full border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                  <SheetDescription>Refine what you see</SheetDescription>
                </SheetHeader>
                <div className="grid gap-6 py-6">
                  <div className="space-y-2">
                    <Label>Price: ${priceRange[0]} – ${priceRange[1]}</Label>
                    <Slider max={20000} step={50} value={priceRange} onValueChange={setPriceRange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      placeholder="City or area"
                      value={location_}
                      onChange={(e) => setLocation(e.target.value)}
                    />
                  </div>
                  <Button onClick={resetFilters} variant="outline" className="rounded-full">
                    Reset filters
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:py-8">
        {!loading && (
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">
            {resultCount} {activeTab}
          </p>
        )}

        {activeTab === 'stores' ? (
          loading ? (
            <GridSkeleton />
          ) : filteredStores.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredStores.map((store) => (
                <StoreCard key={store.id} store={store} />
              ))}
            </div>
          ) : (
            <EmptyState onReset={resetFilters} label="No stores match your search" />
          )
        ) : loading ? (
          <GridSkeleton />
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} linkToStore />
            ))}
          </div>
        ) : (
          <EmptyState onReset={resetFilters} label="No products match your search" />
        )}
      </main>
    </div>
  );
};

function EmptyState({ label, onReset }: { label: string; onReset: () => void }) {
  return (
    <div className="rounded-3xl border border-dashed border-neutral-200 bg-white px-6 py-16 text-center">
      <p className="text-[15px] text-neutral-600">{label}</p>
      <Button onClick={onReset} variant="outline" className="mt-4 rounded-full px-5">
        Reset filters
      </Button>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="h-[280px] animate-pulse rounded-3xl bg-neutral-200/70" />
      ))}
    </div>
  );
}

export default Marketplace;
