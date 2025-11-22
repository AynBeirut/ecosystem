
import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, Trash2 } from 'lucide-react';
import Header from '@/components/Header';
import ProductCard from '@/components/ProductCard';
import { useFavorites } from '@/context/FavoritesContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const Favorites: React.FC = () => {
  const { favorites, removeFromFavorites } = useFavorites();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Your Favorites</h1>
          {favorites.length > 0 && (
            <Button 
              variant="outline" 
              onClick={() => favorites.forEach(p => removeFromFavorites(p.id))}
            >
              Clear All
            </Button>
          )}
        </div>

        {favorites.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {favorites.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                <Heart size={32} className="text-gray-400" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">No favorites yet</h2>
              <p className="text-gray-600 mb-6">Start adding some products to your favorites.</p>
              <Button asChild>
                <Link to="/">Explore Products</Link>
              </Button>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Favorites;
