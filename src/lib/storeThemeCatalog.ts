import { WIZARD_THEME_PRESETS, type WizardThemeId } from '@/lib/builderThemePresets';
import { THEME_GALLERY_META } from '@/lib/themeGalleryMeta';

export type StoreThemeId =
  | WizardThemeId
  | 'minimal'
  | 'vibrant'
  | 'professional'
  | 'artistic'
  | 'tech_electronics';

export type StoreThemeCatalogEntry = {
  id: StoreThemeId;
  name: string;
  description: string;
  colors: string[];
  defaultPalette: { primary: string; secondary: string; accent: string };
  layoutConfig: Record<string, unknown>;
  isPremium?: boolean;
};

const EXTRA_THEMES: StoreThemeCatalogEntry[] = [
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Simple, elegant design with centered layout',
    colors: ['#718096', '#2D3748', '#E2E8F0'],
    defaultPalette: { primary: '#718096', secondary: '#2D3748', accent: '#E2E8F0' },
    layoutConfig: {
      heroLayout: 'minimal',
      productDisplayType: 'list',
      productCardAnimation: 'none',
      menuStyle: 'classic',
      aboutLayout: 'centered',
      contactFormStyle: 1,
      ratingDisplayType: 'minimal',
      pageLayout: 'contained',
      storeCardStyle: 'minimal',
      visualStyle: 'sharp',
    },
  },
  {
    id: 'tech_electronics',
    name: 'Tech / Electronics',
    description: 'High-clarity layout for gadgets and digital products',
    colors: ['#0EA5E9', '#0F172A', '#22D3EE'],
    defaultPalette: { primary: '#0EA5E9', secondary: '#0F172A', accent: '#22D3EE' },
    layoutConfig: {
      heroLayout: 'split',
      productDisplayType: 'grid-standard',
      productCardAnimation: 'zoom-tilt',
      menuStyle: 'sticky-glass',
      aboutLayout: 'left',
      contactFormStyle: 12,
      ratingDisplayType: 'number',
      pageLayout: 'hybrid',
      storeCardStyle: 'split',
      visualStyle: 'sharp',
    },
  },
  {
    id: 'vibrant',
    name: 'Vibrant',
    description: 'Energetic design with masonry products and bold layout',
    colors: ['#ED8936', '#F56565', '#9F7AEA'],
    defaultPalette: { primary: '#ED8936', secondary: '#F56565', accent: '#9F7AEA' },
    isPremium: true,
    layoutConfig: {
      heroLayout: 'fullscreen',
      productDisplayType: 'masonry',
      productCardAnimation: 'slide-reveal',
      menuStyle: 'bold',
      aboutLayout: 'left',
      contactFormStyle: 3,
      ratingDisplayType: 'number',
      pageLayout: 'full-width',
      storeCardStyle: 'full-width',
      visualStyle: 'mixed',
    },
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'Corporate-style with large grid and split store card',
    colors: ['#2D3748', '#4A5568', '#718096'],
    defaultPalette: { primary: '#2D3748', secondary: '#4A5568', accent: '#718096' },
    isPremium: true,
    layoutConfig: {
      heroLayout: 'centered',
      productDisplayType: 'grid-large',
      productCardAnimation: 'zoom-tilt',
      menuStyle: 'classic',
      aboutLayout: 'centered',
      contactFormStyle: 4,
      ratingDisplayType: 'card',
      pageLayout: 'contained',
      storeCardStyle: 'split',
      visualStyle: 'rounded',
    },
  },
  {
    id: 'artistic',
    name: 'Artistic',
    description: 'Creative layout with spotlight products and expressive visuals',
    colors: ['#9F7AEA', '#ED64A6', '#F6AD55'],
    defaultPalette: { primary: '#9F7AEA', secondary: '#ED64A6', accent: '#F6AD55' },
    isPremium: true,
    layoutConfig: {
      heroLayout: 'fullscreen',
      productDisplayType: 'spotlight',
      productCardAnimation: 'glow-pulse',
      menuStyle: 'hamburger',
      aboutLayout: 'with-image',
      contactFormStyle: 6,
      ratingDisplayType: 'pill',
      pageLayout: 'full-width',
      storeCardStyle: 'full-width',
      visualStyle: 'mixed',
    },
  },
];

export const STORE_THEME_CATALOG: StoreThemeCatalogEntry[] = [
  ...WIZARD_THEME_PRESETS.map((t) => ({ ...t, isPremium: false })),
  ...EXTRA_THEMES,
];

export function buildThemeProfilePatch(
  themeId: StoreThemeId,
  options?: { includeDemoMedia?: boolean; hasExistingHero?: boolean },
): Record<string, unknown> {
  const found = STORE_THEME_CATALOG.find((t) => t.id === themeId);
  if (!found) return { template: themeId };
  const patch: Record<string, unknown> = {
    template: found.id,
    templateColors: found.defaultPalette,
    ...found.layoutConfig,
  };
  if (options?.includeDemoMedia && !options?.hasExistingHero) {
    const hero = THEME_GALLERY_META[themeId]?.previewHeroImage;
    if (hero) patch.storeBackgroundImage = hero;
  }
  return patch;
}

export function themeDisplayName(themeId?: string): string {
  return STORE_THEME_CATALOG.find((t) => t.id === themeId)?.name ?? themeId ?? 'Theme';
}
