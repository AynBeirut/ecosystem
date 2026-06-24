import React from 'react';
import { EMOOVE_BRAND } from '@/lib/branding';

type Props = {
  className?: string;
  /** Light text on dark backgrounds */
  variant?: 'default' | 'muted' | 'onDark';
};

const variantClass: Record<NonNullable<Props['variant']>, string> = {
  default: 'text-gray-600 hover:text-teal-600',
  muted: 'text-gray-500 hover:text-gray-700',
  onDark: 'text-slate-400 hover:text-teal-300',
};

const PoweredByEmoove: React.FC<Props> = ({ className = '', variant = 'default' }) => (
  <span className={`text-xs ${className}`}>
    Powered by{' '}
    <a
      href={EMOOVE_BRAND.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`font-semibold underline-offset-2 hover:underline ${variantClass[variant]}`}
    >
      {EMOOVE_BRAND.name}
    </a>
  </span>
);

export default PoweredByEmoove;
