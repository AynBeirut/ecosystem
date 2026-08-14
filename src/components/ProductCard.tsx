
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
import { buildWhatsAppOrderURL } from '@/lib/whatsapp';
import { generateSlug } from '@/lib/slugify';
import { pixelAddToCart, trackMetaConversionEvent } from '@/lib/metaPixel';
import ClampedText from '@/components/ClampedText';
import ProductVisual from '@/components/ProductVisual';
import { formatMoney } from '@/lib/money/format';

type ProductDisplayType = 'grid-standard' | 'grid-large' | 'list' | 'masonry' | 'spotlight';
type ProductCardAnimation = 'none' | 'parallax' | 'lift-3d' | 'glow-pulse' | 'slide-reveal' | 'zoom-tilt';

type ProductCardProps = {
  product: Product;
  linkToStore?: boolean;
  whatsappNumber?: string;
  storeName?: string;
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
  whatsappNumber,
  storeName,
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
  const priceText = formatMoney(Number(product.price || 0), {
    currency: priceCurrency,
    style: 'full',
    secondary: secCurrency && secRate && secRate > 0 ? { currency: secCurrency, rate: secRate } : undefined,
  });
  const { addToCart } = useCart();
  const { isFavorite, addToFavorites, removeFromFavorites } = useFavorites();
  const favorite = isFavorite(product.id);

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

  const handleWhatsAppOrder = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!whatsappNumber) return;
    const url = buildWhatsAppOrderURL(
      [{ name: product.name, qty: 1, price: product.price }],
      { storeName: storeName || product.store?.name || 'this store', whatsappNumber, currency },
    );
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const commerceFooter = showCommerceActions || (whatsappNumber && product.inStock) ? (
    <div className={`flex gap-2 ${displayType === 'list' ? 'mt-2' : ''}`}>
      {showCommerceActions && (
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
      )}
      {whatsappNumber && product.inStock && (
        <Button
          type="button"
          size="sm"
          onClick={handleWhatsAppOrder}
          className={displayType === 'list' ? 'h-8 w-8 p-0 bg-green-500 hover:bg-green-600 border-0' : 'w-full bg-green-500 hover:bg-green-600 text-white border-0 gap-2'}
          variant="outline"
        >
          {displayType === 'list' ? (
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
          ) : (
            <>
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
              Order on WhatsApp
            </>
          )}
        </Button>
      )}
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
                  {showPrice && Number(product.price) > 0 ? (
                    <span className="font-medium text-market-primary">{priceText}</span>
                  ) : null}
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
              {showPrice && Number(product.price) > 0 ? (
                <span className="font-medium text-market-primary">{priceText}</span>
              ) : (
                <span className="text-xs text-gray-400">Menu item</span>
              )}
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
