import React from 'react';
import { generateSlug } from '@/lib/slugify';
import { buildStoreCategoryPath } from '@/lib/storeUrls';

interface StoreCategoryFiltersProps {
  storeSlug: string;
  categories: string[];
  selectedCategory?: string | null;
  onNavigate: (path: string) => void;
  primaryColor?: string;
  className?: string;
}

const StoreCategoryFilters: React.FC<StoreCategoryFiltersProps> = ({
  storeSlug,
  categories,
  selectedCategory = null,
  onNavigate,
  primaryColor,
  className = '',
}) => {
  if (!storeSlug || categories.length === 0) return null;

  const accent = primaryColor || '#1f2937';
  const inactiveClass = 'bg-white text-gray-700 border-gray-300 hover:border-gray-500';

  const chipClass = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-xs border transition-colors font-medium ${active ? '' : inactiveClass}`;

  const chipStyle = (active: boolean): React.CSSProperties | undefined =>
    active ? { backgroundColor: accent, borderColor: accent, color: '#fff' } : undefined;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => onNavigate(buildStoreCategoryPath(storeSlug))}
        className={chipClass(!selectedCategory)}
        style={chipStyle(!selectedCategory)}
      >
        All Products
      </button>
      {categories.map((category) => {
        const isActive = selectedCategory === category;
        return (
          <button
            type="button"
            key={category}
            onClick={() => onNavigate(buildStoreCategoryPath(storeSlug, category))}
            className={chipClass(isActive)}
            style={chipStyle(isActive)}
          >
            {category}
          </button>
        );
      })}
    </div>
  );
};

export default StoreCategoryFilters;

export function categoriesFromProducts(products: { category?: string }[]): string[] {
  return Array.from(
    new Set(products.map((p) => String(p.category || '').trim()).filter(Boolean)),
  );
}

export function categoryFromSlug(categories: string[], categorySlug: string): string | null {
  const normalized = String(categorySlug || '').trim().toLowerCase();
  if (!normalized) return null;
  return categories.find((c) => generateSlug(c) === normalized) || null;
}
