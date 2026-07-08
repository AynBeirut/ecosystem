
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { Product } from '@/types/product';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { useFavorites } from '@/context/FavoritesContext';
import { useCart } from '@/context/CartContext';
import { Badge } from '@/components/ui/badge';
import { buildWhatsAppOrderURL } from '@/lib/whatsapp';
import { generateSlug } from '@/lib/slugify';
import { pixelAddToCart, trackMetaConversionEvent } from '@/lib/metaPixel';
import ClampedText from '@/components/ClampedText';

  type ProductDisplayType = 'grid-standard' | 'grid-large' | 'list' | 'masonry' | 'spotlight';
  type ProductCardAnimation = 'none' | 'parallax' | 'lift-3d' | 'glow-pulse' | 'slide-reveal' | 'zoom-tilt';

  type ProductCardProps = {
    product: Product;
    linkToStore?: boolean;
    whatsappNumber?: string; // Store's WhatsApp Business number
    storeName?: string;      // Store display name (used in WhatsApp message)
    currency?: string;       // Store currency, e.g. "USD"
    displayType?: ProductDisplayType;
    animation?: ProductCardAnimation;
    /** When false, hides cart/checkout actions (display-only storefronts). Defaults to true. */
    showCommerceActions?: boolean;
  };

const ProductCard: React.FC<ProductCardProps> = ({ product, linkToStore, whatsappNumber, storeName, currency, displayType = 'grid-standard', animation = 'none', showCommerceActions = true }) => {
  const navigate = useNavigate();
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
    pixelAddToCart({
      contentId: product.id,
      contentName: product.name,
      value: Number(product.price || 0),
      currency: 'USD',
    });
    void trackMetaConversionEvent({
      storeId: product.storeId,
      eventName: 'AddToCart',
      contentIds: [product.id],
      contentName: product.name,
      value: Number(product.price || 0),
      currency: 'USD',
    });
  };

  const handleCategoryClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const storeSlug = product.store?.slug;
    const category = String(product.category || '').trim();
    if (!storeSlug || !category) return;
    navigate(`/${storeSlug}/category/${generateSlug(category)}`);
  };

  const handleWhatsAppOrder = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!whatsappNumber) return;
    const url = buildWhatsAppOrderURL(
      [{ name: product.name, qty: 1, price: product.price }],
      { storeName: storeName || product.store?.name || 'this store', whatsappNumber, currency }
    );
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const cardLink = linkToStore 
    ? `/${product.store?.slug || product.storeId}` 
    : product.slug && product.store?.slug
      ? `/${product.store.slug}/product/${product.slug}`
      : `/product/id/${product.id}`;

  // ── list display ──────────────────────────────────────────────────────────
  if (displayType === 'list') {
    return (
      <Link to={cardLink} className="min-w-0 block h-full">
        <Card className="overflow-hidden card-hover">
          <div className="flex gap-0">
            <div className="relative flex-shrink-0 w-32 sm:w-40">
              <img src={product.image} alt={product.imageAlt || product.name} className="h-full w-full object-cover min-h-[96px]" />
              {!product.inStock && (
                <Badge variant="destructive" className="absolute top-2 left-2 text-[10px]">Out of Stock</Badge>
              )}
            </div>
            <div className="flex flex-col flex-1 p-3 justify-between min-w-0">
              <div>
                {product.store?.slug ? (
                  <button
                    type="button"
                    onClick={handleCategoryClick}
                    className="mb-1 rounded-full border px-2 py-0.5 text-[10px] text-gray-600 hover:border-gray-500"
                  >
                    {product.category}
                  </button>
                ) : (
                  <div className="text-xs text-gray-500 mb-0.5">{product.category}</div>
                )}
                <ClampedText text={product.name} maxLines={2} className="font-semibold text-sm mb-1 block" as="h3" />
                {(product.rating ?? 0) > 0 && (product.ratingCount ?? 0) > 0 && (
                  <div className="text-xs text-amber-600 mb-1">
                    {'★'.repeat(Math.round(product.rating || 0)).padEnd(5, '☆')} {Number(product.rating).toFixed(1)} ({product.ratingCount})
                  </div>
                )}
                <div className="flex items-baseline gap-2">
                  <span className="font-medium text-market-primary">${product.price.toFixed(2)}</span>
                  {product.deliveryTime && <span className="text-xs text-gray-400">{product.deliveryTime}</span>}
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                {showCommerceActions && (
                  <Button size="sm" onClick={handleAddToCart} variant="outline" disabled={!product.inStock} className="flex-1 h-8 text-xs">
                    Add to Cart
                  </Button>
                )}
                {whatsappNumber && product.inStock && (
                  <Button size="sm" onClick={handleWhatsAppOrder} className="h-8 w-8 p-0 bg-green-500 hover:bg-green-600 border-0" variant="outline">
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      </Link>
    );
  }

  // ── image height by display type ──────────────────────────────────────────
  const imgClass =
    displayType === 'grid-large' ? 'h-64 w-full object-cover' :
    displayType === 'masonry'    ? 'w-full object-cover aspect-[4/3]' :
    'h-48 w-full object-cover'; // grid-standard & spotlight

  // ── animation classes ──────────────────────────────────────────────────────
  const animationClass =
    animation === 'parallax' ? 'product-card-parallax' :
    animation === 'lift-3d' ? 'product-card-lift-3d' :
    animation === 'glow-pulse' ? 'product-card-glow-pulse' :
    animation === 'slide-reveal' ? 'product-card-slide-reveal' :
    animation === 'zoom-tilt' ? 'product-card-zoom-tilt' :
    '';

  return (
    <Link to={cardLink} className="min-w-0 block h-full">
      <Card className={`h-full overflow-hidden card-hover min-w-0 ${displayType === 'masonry' ? 'border-0 shadow-sm bg-white/80' : ''} ${displayType === 'spotlight' ? 'ring-1 ring-market-primary/15' : ''} ${animationClass}`}>
        <div className="relative">
          <img 
            src={product.image} 
            alt={product.imageAlt || product.name} 
            className={imgClass}
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
        <CardContent className="pt-4 min-w-0">
          <div className="mb-2">
            {product.store?.slug ? (
              <button
                type="button"
                onClick={handleCategoryClick}
                className="rounded-full border px-2 py-0.5 text-[11px] text-gray-600 hover:border-gray-500"
              >
                {product.category}
              </button>
            ) : (
              <span className="text-xs text-gray-500">{product.category}</span>
            )}
          </div>
          <ClampedText text={product.name} maxLines={2} className="font-semibold text-base mb-1 text-left block" as="h3" />
          {(product.rating ?? 0) > 0 && (product.ratingCount ?? 0) > 0 && (
            <div className="text-xs text-amber-600 mb-1 text-left">
              {'★'.repeat(Math.round(product.rating || 0)).padEnd(5, '☆')} {Number(product.rating).toFixed(1)} ({product.ratingCount})
            </div>
          )}
          <div className="flex justify-between items-baseline">
            <span className="font-medium text-market-primary">
              ${product.price.toFixed(2)}
            </span>
            <span className="text-xs text-gray-500">
              {product.deliveryTime}
            </span>
          </div>
        </CardContent>
        <CardFooter className="pt-0 flex flex-col gap-2">
          {showCommerceActions && (
            <Button 
              onClick={handleAddToCart} 
              className="w-full"
              variant="outline"
              disabled={!product.inStock}
            >
              Add to Cart
            </Button>
          )}
          {whatsappNumber && product.inStock && (
            <Button
              onClick={handleWhatsAppOrder}
              className="w-full bg-green-500 hover:bg-green-600 text-white border-0 gap-2"
              variant="outline"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
              Order on WhatsApp
            </Button>
          )}
        </CardFooter>
      </Card>
    </Link>
  );
};

export default ProductCard;
