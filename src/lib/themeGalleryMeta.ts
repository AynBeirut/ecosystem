import type { StoreThemeId } from '@/lib/storeThemeCatalog';

export type ThemeGalleryLayout =
  | 'fullscreen-grid'
  | 'split-grid'
  | 'centered-large'
  | 'minimal-list'
  | 'masonry'
  | 'spotlight'
  | 'fullwidth-masonry';

export type ThemeGalleryMeta = {
  industry: string;
  layout: ThemeGalleryLayout;
  features: string[];
  /** Unsplash hero used in gallery card + optional default store banner */
  previewHeroImage: string;
  /** Small product thumbs in grid area */
  productImages: string[];
  shell: string;
  header: string;
  block: string;
  title: string;
};

const PRODUCT_A =
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=120&h=120&fit=crop';
const PRODUCT_B =
  'https://images.unsplash.com/photo-1505744386214-51dba16a26fc?w=120&h=120&fit=crop';
const PRODUCT_C =
  'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=120&h=120&fit=crop';
const PRODUCT_D =
  'https://images.unsplash.com/photo-1560343090-f0409e52124d?w=120&h=120&fit=crop';

export const THEME_GALLERY_META: Record<StoreThemeId, ThemeGalleryMeta> = {
  modern: {
    industry: 'General retail',
    layout: 'fullscreen-grid',
    features: ['Full hero', '4-col grid', 'Sticky menu'],
    previewHeroImage:
      'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&h=420&fit=crop',
    productImages: [PRODUCT_A, PRODUCT_B, PRODUCT_C, PRODUCT_D],
    shell: 'bg-gradient-to-br from-cyan-50 via-white to-indigo-50',
    header: 'from-cyan-600 to-indigo-700',
    block: 'bg-white shadow-sm border border-cyan-100',
    title: 'text-white',
  },
  minimalist: {
    industry: 'Editorial / lifestyle',
    layout: 'centered-large',
    features: ['Centered hero', 'Large cards', 'Minimal nav'],
    previewHeroImage:
      'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&h=420&fit=crop',
    productImages: [PRODUCT_B, PRODUCT_C, PRODUCT_A, PRODUCT_D],
    shell: 'bg-stone-50',
    header: 'from-stone-400 to-stone-700',
    block: 'bg-white border border-stone-200',
    title: 'text-white',
  },
  classic: {
    industry: 'Services & local',
    layout: 'split-grid',
    features: ['Split hero', '3-col catalog', 'Classic menu'],
    previewHeroImage:
      'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&h=420&fit=crop',
    productImages: [PRODUCT_C, PRODUCT_A, PRODUCT_B, PRODUCT_D],
    shell: 'bg-gradient-to-br from-blue-50 to-indigo-50',
    header: 'from-blue-700 to-indigo-800',
    block: 'bg-white shadow-sm border border-blue-100',
    title: 'text-white',
  },
  classic_ecom: {
    industry: 'E-commerce',
    layout: 'split-grid',
    features: ['Conversion grid', 'Trust colors', 'Catalog focus'],
    previewHeroImage:
      'https://images.unsplash.com/photo-1472851297150-8807a8dc0ffe?w=800&h=420&fit=crop',
    productImages: [PRODUCT_A, PRODUCT_D, PRODUCT_B, PRODUCT_C],
    shell: 'bg-gradient-to-br from-slate-50 to-blue-50',
    header: 'from-[#1E3A5F] to-[#0F2942]',
    block: 'bg-white shadow-sm border border-slate-200',
    title: 'text-white',
  },
  food_restaurant: {
    industry: 'Food & restaurant',
    layout: 'fullscreen-grid',
    features: ['Menu hero', 'Large dishes', 'Warm palette'],
    previewHeroImage:
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=420&fit=crop',
    productImages: [
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=120&h=120&fit=crop',
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=120&h=120&fit=crop',
      'https://images.unsplash.com/photo-1565958011703-44f9828941?w=120&h=120&fit=crop',
      'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=120&h=120&fit=crop',
    ],
    shell: 'bg-gradient-to-br from-orange-50 to-amber-50',
    header: 'from-orange-700 to-amber-900',
    block: 'bg-white shadow-sm border border-orange-100',
    title: 'text-white',
  },
  fashion_boutique: {
    industry: 'Fashion & boutique',
    layout: 'masonry',
    features: ['Editorial masonry', 'Centered hero', 'Premium feel'],
    previewHeroImage:
      'https://images.unsplash.com/photo-1483985988354-763728e3685b?w=800&h=420&fit=crop',
    productImages: [
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=120&h=120&fit=crop',
      'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=120&h=120&fit=crop',
      'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=120&h=120&fit=crop',
      'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=120&h=120&fit=crop',
    ],
    shell: 'bg-gradient-to-br from-rose-50 to-fuchsia-50',
    header: 'from-[#8B5E7A] to-[#2E2330]',
    block: 'bg-white shadow-sm border border-rose-100',
    title: 'text-white',
  },
  minimal: {
    industry: 'Minimal catalog',
    layout: 'minimal-list',
    features: ['List products', 'Sharp edges', 'Clean header'],
    previewHeroImage:
      'https://images.unsplash.com/photo-1449247709967-d4461a6a6103?w=800&h=420&fit=crop',
    productImages: [PRODUCT_B, PRODUCT_A, PRODUCT_C],
    shell: 'bg-gray-50',
    header: 'from-gray-500 to-gray-800',
    block: 'bg-white border border-gray-200',
    title: 'text-white',
  },
  tech_electronics: {
    industry: 'Tech & gadgets',
    layout: 'split-grid',
    features: ['Split hero', 'Glass menu', 'Product clarity'],
    previewHeroImage:
      'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800&h=420&fit=crop',
    productImages: [PRODUCT_A, PRODUCT_C, PRODUCT_D, PRODUCT_B],
    shell: 'bg-gradient-to-br from-slate-900/5 to-cyan-50',
    header: 'from-[#0EA5E9] to-[#0F172A]',
    block: 'bg-white shadow-sm border border-cyan-100',
    title: 'text-white',
  },
  vibrant: {
    industry: 'Bold brands',
    layout: 'fullwidth-masonry',
    features: ['Full-width', 'Masonry grid', 'Bold menu'],
    previewHeroImage:
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=420&fit=crop',
    productImages: [PRODUCT_D, PRODUCT_B, PRODUCT_A, PRODUCT_C],
    shell: 'bg-gradient-to-br from-orange-100 via-pink-50 to-purple-100',
    header: 'from-orange-500 via-pink-500 to-purple-600',
    block: 'bg-white shadow-md border-2 border-pink-200',
    title: 'text-white',
  },
  professional: {
    industry: 'Corporate & B2B',
    layout: 'centered-large',
    features: ['Large cards', 'Split store card', 'Formal'],
    previewHeroImage:
      'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=420&fit=crop',
    productImages: [PRODUCT_C, PRODUCT_A, PRODUCT_B, PRODUCT_D],
    shell: 'bg-gradient-to-br from-slate-100 to-gray-200',
    header: 'from-slate-700 to-gray-900',
    block: 'bg-white shadow-md border border-slate-200',
    title: 'text-white',
  },
  artistic: {
    industry: 'Creative & art',
    layout: 'spotlight',
    features: ['Spotlight products', 'Full hero', 'Expressive'],
    previewHeroImage:
      'https://images.unsplash.com/photo-1460661414731-3151a6ccfc3b?w=800&h=420&fit=crop',
    productImages: [
      'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=120&h=120&fit=crop',
      'https://images.unsplash.com/photo-1579783902610-fdc5c0f2a6f0?w=120&h=120&fit=crop',
      PRODUCT_B,
      PRODUCT_C,
    ],
    shell: 'bg-gradient-to-tr from-violet-100 via-fuchsia-50 to-amber-100',
    header: 'from-violet-600 via-purple-500 to-pink-500',
    block: 'bg-white/95 shadow-lg border border-violet-200',
    title: 'text-white',
  },
};

export function themeGalleryMeta(themeId: StoreThemeId): ThemeGalleryMeta {
  return THEME_GALLERY_META[themeId];
}
