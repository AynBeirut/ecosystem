import { Link } from 'react-router-dom';
import { BRAND } from '@/lib/branding';
import { cn } from '@/lib/utils';

type BrandMarkProps = {
  size?: 'sm' | 'md' | 'lg';
  linked?: boolean;
  className?: string;
};

const sizeClass = {
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-4xl md:text-5xl',
} as const;

export default function BrandMark({ size = 'md', linked = false, className }: BrandMarkProps) {
  const content = (
    <span className={cn('font-bold tracking-tight text-foreground', sizeClass[size], className)}>
      {BRAND.product}{' '}
      <span className="text-[#38B2AC]">{size === 'lg' ? BRAND.module : 'Invoice'}</span>
    </span>
  );

  if (linked) {
    return (
      <Link to="/" className="inline-block hover:opacity-90 transition-opacity">
        {content}
      </Link>
    );
  }

  return content;
}
