import React, { useState } from 'react';
import { Store as StoreIcon } from 'lucide-react';
import { isPlaceholderImageUrl, storeInitial, storePalette } from '@/lib/visualFallbacks';

type Props = {
  name: string;
  logo?: string;
  className?: string;
  iconClassName?: string;
  variant?: 'card' | 'header';
};

export function isPlaceholderStoreLogo(logo?: string): boolean {
  return isPlaceholderImageUrl(logo);
}

export default function StoreVisual({
  name,
  logo,
  className = '',
  iconClassName = '',
  variant = 'card',
}: Props) {
  const [broken, setBroken] = useState(false);
  const palette = storePalette(name);
  const showPhoto = Boolean(logo?.trim()) && !isPlaceholderStoreLogo(logo) && !broken;
  const initial = storeInitial(name);
  const iconSize = variant === 'header' ? 'h-5 w-5' : 'h-7 w-7';
  const initialSize = variant === 'header' ? 'text-sm font-bold' : 'text-xl font-semibold';

  if (!showPhoto) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br ${palette.gradient} ring-1 ${palette.ring} ${className}`}
        aria-hidden
      >
        <StoreIcon className={`${iconSize} ${palette.icon} ${iconClassName}`} strokeWidth={1.75} />
        {variant === 'card' && (
          <span className={`mt-1 ${initialSize} ${palette.icon} leading-none`}>{initial}</span>
        )}
      </div>
    );
  }

  return (
    <img
      src={logo}
      alt={name}
      className={className}
      onError={() => setBroken(true)}
    />
  );
}
