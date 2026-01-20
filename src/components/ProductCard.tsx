
import React from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { Product } from '@/types/product';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { useFavorites } from '@/context/FavoritesContext';
import { useCart } from '@/context/CartContext';
import { Badge } from '@/components/ui/badge';

  type ProductCardProps = {
    product: Product;
    linkToStore?: boolean;
  };

const ProductCard: React.FC<ProductCardProps> = ({ product, linkToStore }) => {
  const { addToCart } = useCart();
  const { isFavorite, addToFavorites, removeFromFavorites } = useFavorites();
  const favorite = isFavorite(product.id);

  const handleFavoriteToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (favorite) {
      removeFromFavorites(product.id);
    } else {
      addToFavorites(product);
    }
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product);
  };

  const cardLink = linkToStore ? `/store/${product.storeId}` : `/product/${product.id}`;
  return (
    <Link to={cardLink}>
      <Card className="h-full overflow-hidden card-hover">
        <div className="relative">
          <img 
            src={product.image} 
            alt={product.name} 
            className="h-48 w-full object-cover"
          />
          <button
            onClick={handleFavoriteToggle}
            className="absolute top-2 right-2 p-1.5 bg-white rounded-full shadow-md hover:bg-gray-100 transition-colors"
            aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
            title={favorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Heart 
              size={18} 
              className={favorite ? "fill-market-accent text-market-accent" : "text-gray-400"} 
            />
          </button>
          {!product.inStock && (
            <Badge variant="destructive" className="absolute top-2 left-2">
              Out of Stock
            </Badge>
          )}
        </div>
        <CardContent className="pt-4">
          <div className="mb-1 text-xs text-gray-500">
            {product.category}
          </div>
          <h3 className="font-semibold text-base mb-1 text-left">{product.name}</h3>
          <div className="flex justify-between items-baseline">
            <span className="font-medium text-market-primary">
              ${product.price.toFixed(2)}
            </span>
            <span className="text-xs text-gray-500">
              {product.deliveryTime}
            </span>
          </div>
        </CardContent>
        <CardFooter className="pt-0">
          <Button 
            onClick={handleAddToCart} 
            className="w-full"
            variant="outline"
            disabled={!product.inStock}
          >
            Add to Cart
          </Button>
        </CardFooter>
      </Card>
    </Link>
  );
};

export default ProductCard;
