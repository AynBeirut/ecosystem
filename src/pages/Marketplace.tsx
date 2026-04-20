
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import SEOHead from '@/components/SEOHead';
// import { PRODUCTS } from '@/data/mockData';
import ProductCard from '@/components/ProductCard';
import StoreCard from '@/components/StoreCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import Header from '@/components/Header';
import MobileHeader from '@/components/MobileHeader';
import { Product, Store } from '@/types/product';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { Search, Filter } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/context/useAuth';

const Marketplace: React.FC = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [priceRange, setPriceRange] = useState([0, 20000]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [filteredStores, setFilteredStores] = useState<Store[]>([]);
  const [allStores, setAllStores] = useState<Store[]>([]);
  const [location_, setLocation] = useState('');

  // Set search query from URL parameter if present
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const query = params.get('q');
    if (query) {
      setSearchQuery(query);
    }
  }, [location]);

  // Fetch stores from Firestore on mount
  useEffect(() => {
    const fetchStores = async () => {
      const db = getFirestore();
      const storesRef = collection(db, 'storeProfiles');
      const snapshot = await getDocs(storesRef);
  const storesList: Store[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Store));
  // Only show stores that are online
  setAllStores(storesList.filter(store => store.status === 'online'));
    };
    fetchStores();
  }, []);

  // Fetch products from Firestore on mount
  useEffect(() => {
    const fetchProducts = async () => {
      const db = getFirestore();
      const productsRef = collection(db, 'products');
      const snapshot = await getDocs(productsRef);
      const productsList: Product[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setAllProducts(productsList);
    };
    fetchProducts();
  }, []);

  // Apply filters when dependencies change
  useEffect(() => {
    // Filter products and deduplicate by id
    const filtered = allProducts.filter(product => {
      const matchesSearch = searchQuery === '' || 
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        product.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPrice = product.price >= priceRange[0] && product.price <= priceRange[1];
      const matchesLocation = !location_ || 
        allStores.find(store => store.id === product.storeId)?.location.toLowerCase().includes(location_.toLowerCase());
      return matchesSearch && matchesPrice && matchesLocation && product.inStock && (typeof product.stock !== 'number' || product.stock > 0);
    });
    // Deduplicate by product id
    const deduped = Array.from(new Map(filtered.map(p => [p.id, p])).values());
    // Prioritize products from followed stores (if user has follows)
    // useAuth provides user directly
    let ordered = deduped;
    if (user && user.following && user.following.length > 0) {
      const followingSet = new Set(user.following);
      ordered = deduped.slice().sort((a, b) => {
        const aFollow = followingSet.has(a.storeId) ? 0 : 1;
        const bFollow = followingSet.has(b.storeId) ? 0 : 1;
        return aFollow - bFollow;
      });
    }
    setFilteredProducts(ordered);

    // Filter stores
    let filteredStores = allStores.filter(store => {
      const matchesSearch = searchQuery === '' || 
        store.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        store.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesLocation = !location_ || 
        store.location.toLowerCase().includes(location_.toLowerCase());
      return matchesSearch && matchesLocation;
    });
    // If no stores match, show all online stores as fallback
    if (filteredStores.length === 0 && allStores.length > 0) {
      filteredStores = allStores;
    }
    setFilteredStores(filteredStores);
  }, [searchQuery, priceRange, location_, allStores, allProducts, user]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Search is already applied via the effect
  };

  const resetFilters = () => {
    setSearchQuery('');
  setPriceRange([0, 20000]);
    setLocation('');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <SEOHead
        title="Market Space"
        description="Discover and shop from local stores in Lebanon. Browse thousands of products and support local businesses on Grabio."
        url="https://grabio.space/"
      />
      {!isMobile ? <Header /> : <MobileHeader title="Market Space" showBackButton={false} />}
      <main className="container mx-auto px-3 md:px-4 py-3 md:py-6 flex-1">
        <div className="flex flex-col md:flex-row justify-between items-start gap-3 md:gap-4 mb-3 md:mb-6">
          {!isMobile && <h1 className="text-2xl font-bold whitespace-nowrap">Market Space</h1>}
          <div className="flex items-center w-full gap-2">
            <form onSubmit={handleSearch} className="relative flex-grow">
              <Input
                type="search"
                placeholder="Search Market Space..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 h-10 text-sm md:text-base"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            </form>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0 h-10 w-10">
                  <Filter size={18} />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                  <SheetDescription>
                    Narrow down your search results
                  </SheetDescription>
                </SheetHeader>
                <div className="grid gap-6 py-6">
                  <div className="space-y-2">
                    <Label>Price Range: ${priceRange[0]} - ${priceRange[1]}</Label>
                    <Slider
                      defaultValue={[0, 20000]}
                      max={20000}
                      step={50}
                      value={priceRange}
                      onValueChange={setPriceRange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      placeholder="Filter by location..."
                      value={location_}
                      onChange={(e) => setLocation(e.target.value)}
                    />
                  </div>
                  <Button onClick={resetFilters} variant="outline">
                    Reset Filters
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
        {/* Debug: Show store counts */}
        {/* <div className="mb-4 text-sm text-gray-500">Total stores fetched: {allStores.length} | Filtered stores: {filteredStores.length}</div> */}

        <Tabs defaultValue="products" className="mb-4 md:mb-8">
          <TabsList className="w-full md:w-auto grid grid-cols-2 md:flex h-10">
            <TabsTrigger value="products" className="flex-1 md:flex-none text-sm">Products</TabsTrigger>
            <TabsTrigger value="stores" className="flex-1 md:flex-none text-sm">Stores</TabsTrigger>
          </TabsList>
          
          <TabsContent value="products">
            {filteredProducts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6 animate-fade-in">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} linkToStore />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 md:py-12 text-gray-500">
                <div className="mb-4">No products found matching your criteria</div>
                <Button onClick={resetFilters} variant="outline">Reset Filters</Button>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="stores">
            {filteredStores.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6 animate-fade-in">
                {filteredStores.map((store) => (
                  <StoreCard key={store.id} store={store} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 md:py-12 text-gray-500">
                <div className="mb-4">No stores found matching your criteria</div>
                <Button onClick={resetFilters} variant="outline">Reset Filters</Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Marketplace;
