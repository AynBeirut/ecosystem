
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { buildProductRelativePath, buildStoreRelativePath, isExternalUrl } from '@/lib/storeUrls';
import { Heart } from 'lucide-react';
import { Product } from '@/types/product';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { useFavorites } from '@/context/FavoritesContext';
import { useCart } from '@/context/CartContext';
import { Badge } from '@/components/ui/badge';
import { generateSlug } from '@/lib/slugify';
import { pixelAddToCart, trackMetaConversionEvent } from '@/lib/metaPixel';
import ClampedText from '@/components/ClampedText';
import ProductVisual from '@/components/ProductVisual';
import { formatDualMoneyLines, formatMoney } from '@/lib/money/format';

type ProductDisplayType = 'grid-standard' | 'grid-large' | 'list' | 'masonry' | 'spotlight';
type ProductCardAnimation = 'none' | 'parallax' | 'lift-3d' | 'glow-pulse' | 'slide-reveal' | 'zoom-tilt';

type ProductCardProps = {
  product: Product;
  linkToStore?: boolean;
  currency?: string;
  secondaryCurrency?: string;
  exchangeRate?: number;
  displayType?: ProductDisplayType;
  animation?: ProductCardAnimation;
  showCommerceActions?: boolean;
  showPrice?: boolean;
};

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  linkToStore,
  currency,
  secondaryCurrency,
  exchangeRate,
  displayType = 'grid-standard',
  animation = 'none',
  showCommerceActions = true,
  showPrice = true,
}) => {
  const navigate = useNavigate();
  const storeMeta = product.store as { mainCurrency?: string; secondaryCurrency?: string; customExchangeRate?: number } | undefined;
  const priceCurrency = currency || storeMeta?.mainCurrency || 'USD';
  const secCurrency = secondaryCurrency || storeMeta?.secondaryCurrency;
  const secRate = exchangeRate ?? storeMeta?.customExchangeRate;
  const secondaryOpt =
    secCurrency && secRate && secRate > 0
      ? { currency: secCurrency, rate: secRate }
      : undefined;
  const priceLines = formatDualMoneyLines(Number(product.price || 0), {
    currency: priceCurrency,
    style: 'full',
    numbersOnly: Boolean(secondaryOpt),
    secondary: secondaryOpt,
  });
  const priceText = formatMoney(Number(product.price || 0), {
    currency: priceCurrency,
    style: 'full',
    secondary: secondaryOpt,
  });
  const { addToCart } = useCart();
  const { isFavorite, addToFavorites, removeFromFavorites } = useFavorites();
  const favorite = isFavorite(product.id);

  const renderPrice = () => {
    if (!showPrice || Number(product.price) <= 0) {
      return <span className="text-xs text-gray-400">Menu item</span>;
    }
    if (priceLines.secondary) {
      return (
        <div className="flex flex-col leading-tight">
          <span className="font-medium text-market-primary">{priceLines.primary}</span>
          <span className="text-xs text-gray-600">{priceLines.secondary}</span>
        </div>
      );
    }
    return <span className="font-medium text-market-primary">{priceText}</span>;
  };

  const cardLink = linkToStore
    ? buildStoreRelativePath(product.store?.slug || product.storeId, '/')
    : buildProductRelativePath(product, product.store?.slug || product.storeId);

  const goToProduct = () => {
    if (isExternalUrl(cardLink)) {
      window.location.href = cardLink;
      return;
    }
    navigate(cardLink);
  };

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
    if (!product.inStock) return;
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
    navigate(buildStoreRelativePath(storeSlug, `/category/${generateSlug(category)}`));
  };

  const commerceFooter = showCommerceActions ? (
    <div className={`flex gap-2 ${displayType === 'list' ? 'mt-2' : ''}`}>
      <Button
        type="button"
        size={displayType === 'list' ? 'sm' : 'default'}
        onClick={handleAddToCart}
        variant="outline"
        disabled={!product.inStock}
        className={displayType === 'list' ? 'flex-1 h-8 text-xs' : 'w-full'}
      >
        Add to Cart
      </Button>
    </div>
  ) : null;

  if (displayType === 'list') {
    return (
      <Card className="overflow-hidden card-hover h-full min-w-0">
        <div className="flex gap-0">
          <button
            type="button"
            onClick={goToProduct}
            className="relative flex-shrink-0 w-32 sm:w-40 block text-left"
          >
            <ProductVisual product={product} className="h-full w-full object-cover min-h-[96px]" />
            {!product.inStock && (
              <Badge variant="destructive" className="absolute top-2 left-2 text-[10px]">Out of Stock</Badge>
            )}
          </button>
          <div className="flex flex-col flex-1 p-3 justify-between min-w-0">
            <button type="button" onClick={goToProduct} className="block min-w-0 text-left hover:opacity-90">
              <div>
                {product.store?.slug ? (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={handleCategoryClick}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCategoryClick(e as unknown as React.MouseEvent); }}
                    className="mb-1 inline-block rounded-full border px-2 py-0.5 text-[10px] text-gray-600 hover:border-gray-500"
                  >
                    {product.category}
                  </span>
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
                  {renderPrice()}
                  {product.deliveryTime && <span className="text-xs text-gray-400">{product.deliveryTime}</span>}
                </div>
              </div>
            </button>
            {commerceFooter}
          </div>
        </div>
      </Card>
    );
  }

  const imgClass =
    displayType === 'grid-large' ? 'h-44 w-full object-cover' :
    displayType === 'masonry' ? 'w-full object-cover aspect-[4/3]' :
    'h-36 w-full object-cover';

  const animationClass =
    animation === 'parallax' ? 'product-card-parallax' :
    animation === 'lift-3d' ? 'product-card-lift-3d' :
    animation === 'glow-pulse' ? 'product-card-glow-pulse' :
    animation === 'slide-reveal' ? 'product-card-slide-reveal' :
    animation === 'zoom-tilt' ? 'product-card-zoom-tilt' :
    '';

  return (
    <Card className={`h-full overflow-hidden card-hover min-w-0 flex flex-col ${displayType === 'masonry' ? 'border-0 shadow-sm bg-white/80' : ''} ${displayType === 'spotlight' ? 'ring-1 ring-market-primary/15' : ''} ${animationClass}`}>
      <div className="relative min-w-0 flex-1">
        <button type="button" onClick={goToProduct} className="block w-full text-left">
          <ProductVisual product={product} className={imgClass} />
        </button>
        <button
          type="button"
          onClick={handleFavoriteToggle}
          className="absolute top-2 right-2 p-1.5 bg-white rounded-full shadow-md hover:bg-gray-100 transition-colors z-10"
          aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
          title={favorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart
            size={18}
            className={favorite ? 'fill-market-accent text-market-accent' : 'text-gray-400'}
          />
        </button>
        {!product.inStock && (
          <Badge variant="destructive" className="absolute top-2 left-2 z-10">
            Out of Stock
          </Badge>
        )}
        <CardContent className="pt-4 min-w-0">
          <button type="button" onClick={goToProduct} className="w-full text-left">
            <div className="mb-2">
              {product.store?.slug ? (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={handleCategoryClick}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCategoryClick(e as unknown as React.MouseEvent); }}
                  className="inline-block rounded-full border px-2 py-0.5 text-[11px] text-gray-600 hover:border-gray-500"
                >
                  {product.category}
                </span>
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
              {renderPrice()}
              <span className="text-xs text-gray-500">{product.deliveryTime}</span>
            </div>
          </button>
        </CardContent>
      </div>
      {commerceFooter ? (
        <CardFooter className="pt-0 flex flex-col gap-2">{commerceFooter}</CardFooter>
      ) : null}
    </Card>
  );
};

export default ProductCard;
