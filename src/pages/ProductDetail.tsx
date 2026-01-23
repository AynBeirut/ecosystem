
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProductById, getStoreById } from '@/data/mockData';
import { Product, Store } from '@/types/product';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/CartContext';
import { useFavorites } from '@/context/FavoritesContext';
import { Heart, Minus, Plus, Clock, Store as StoreIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import ShareButtons from '@/components/ui/ShareButtons';

const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  const { addToCart } = useCart();
  const { isFavorite, addToFavorites, removeFromFavorites } = useFavorites();

  useEffect(() => {
    if (!id) {
      setError('Product ID is missing');
      setIsLoading(false);
      return;
    }

    const loadProduct = async () => {
      setIsLoading(true);
      try {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const productData = getProductById(id);
        if (!productData) {
          setError('Product not found');
          return;
        }
        
        setProduct(productData);
        
        const storeData = getStoreById(productData.storeId);
        setStore(storeData || null);
      } catch (err) {
        setError('Failed to load product data');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadProduct();
  }, [id]);

  const handleAddToCart = () => {
    if (product) {
      addToCart(product, quantity);
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
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
        <Header />
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Product Image */}
            <div>
              <div className="bg-white rounded-lg overflow-hidden shadow-sm">
                <img 
                  src={product.image} 
                  alt={product.name} 
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>
            
            {/* Product Info */}
            <div>
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="mb-2">
                  <span className="text-sm text-gray-500">{product.category}</span>
                </div>
                
                <h1 className="text-3xl font-bold mb-2">{product.name}</h1>
                
                <div className="flex items-center mb-4">
                  <span className="text-2xl font-semibold text-market-primary">
                    ${product.price.toFixed(2)}
                  </span>
                  
                  {!product.inStock && (
                    <Badge variant="destructive" className="ml-3">
                      Out of Stock
                    </Badge>
                  )}
                </div>
                
                <div className="mb-6">
                  <p className="text-gray-700">{product.description}</p>
                </div>
                
                <div className="flex items-center text-gray-600 mb-2">
                  <Clock size={18} className="mr-2" />
                  Delivery: {product.deliveryTime}
                </div>
                
                {store && (
                  <Link to={`/store/${store.id}`} className="flex items-center text-market-secondary hover:underline mb-6">
                    <StoreIcon size={18} className="mr-2" />
                    Sold by: {store.name}
                  </Link>
                )}
                
                {/* Quantity Selector */}
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
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProductDetail;
