import React, { useState } from 'react';
import { Package } from 'lucide-react';
import type { Product } from '@/types/product';
import { isEmojiProductImage } from '@/lib/productEmojiImage';
import { isPlaceholderImageUrl, productFallbackEmoji, productPalette } from '@/lib/visualFallbacks';

type Props = {
  product: Pick<Product, 'name' | 'image' | 'imageAlt' | 'icon' | 'category'>;
  className?: string;
  /** Larger emoji tile for product detail hero */
  variant?: 'card' | 'hero';
};

export function isPlaceholderProductImage(image?: string): boolean {
  return isPlaceholderImageUrl(image) || isEmojiProductImage(image);
}

function ProductFallbackTile({
  product,
  className,
  variant,
}: {
  product: Pick<Product, 'name' | 'icon' | 'category'>;
  className: string;
  variant: 'card' | 'hero';
}) {
  const emoji = productFallbackEmoji(product.icon, product.category, product.name);
  const gradient = productPalette(product.name);
  const emojiSize = variant === 'hero' ? 'text-6xl sm:text-7xl' : 'text-4xl sm:text-5xl';
  const iconSize = variant === 'hero' ? 'h-10 w-10' : 'h-8 w-8';

  return (
    <div
      className={`relative flex items-center justify-center bg-gradient-to-br ${gradient} ${className}`}
      aria-hidden
    >
      <Package className={`absolute top-3 right-3 ${iconSize} text-black/10`} strokeWidth={1.5} />
      <span className={`${emojiSize} leading-none select-none drop-shadow-sm`}>{emoji}</span>
    </div>
  );
}

export default function ProductVisual({ product, className = '', variant = 'card' }: Props) {
  const [broken, setBroken] = useState(false);
  const hasRealPhoto =
    Boolean(product.image?.trim()) && !isPlaceholderProductImage(product.image) && !broken;

  if (!hasRealPhoto) {
    return <ProductFallbackTile product={product} className={className} variant={variant} />;
  }

  return (
    <img
      src={product.image}
      alt={product.imageAlt || product.name}
      className={className}
      onError={() => setBroken(true)}
    />
  );
}
