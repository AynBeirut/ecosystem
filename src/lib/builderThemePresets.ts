/** Curated wizard themes — subset of AdminTemplates presets for M1. */

export type WizardThemeId =
  | 'modern'
  | 'minimalist'
  | 'classic'
  | 'classic_ecom'
  | 'food_restaurant'
  | 'fashion_boutique';

export type WizardThemePreset = {
  id: WizardThemeId;
  name: string;
  description: string;
  colors: string[];
  defaultPalette: { primary: string; secondary: string; accent: string };
  layoutConfig: Record<string, unknown>;
};

export const WIZARD_THEME_PRESETS: WizardThemePreset[] = [
  {
    id: 'modern',
    name: 'Modern',
    description: 'Clean, contemporary design with bold typography and full-width hero',
    colors: ['#38B2AC', '#2C5282', '#ED8936'],
    defaultPalette: { primary: '#38B2AC', secondary: '#2C5282', accent: '#ED8936' },
    layoutConfig: {
      heroLayout: 'fullscreen',
      productDisplayType: 'grid-standard',
      productCardAnimation: 'lift-3d',
      menuStyle: 'sticky-glass',
      aboutLayout: 'left',
      contactFormStyle: 2,
      ratingDisplayType: 'pill',
      pageLayout: 'hybrid',
      storeCardStyle: 'standard',
      visualStyle: 'rounded',
    },
  },
  {
    id: 'minimalist',
    name: 'Modern Minimalist',
    description: 'Editorial minimal design with calm neutrals and generous spacing',
    colors: ['#6B7280', '#111827', '#C08457'],
    defaultPalette: { primary: '#6B7280', secondary: '#111827', accent: '#C08457' },
    layoutConfig: {
      heroLayout: 'centered',
      productDisplayType: 'grid-large',
      productCardAnimation: 'none',
      menuStyle: 'centered',
      aboutLayout: 'centered',
      contactFormStyle: 8,
      ratingDisplayType: 'minimal',
      pageLayout: 'contained',
      storeCardStyle: 'minimal',
      visualStyle: 'mixed',
    },
  },
  {
    id: 'classic',
    name: 'Classic',
    description: 'Timeless design with split hero and traditional grid layout',
    colors: ['#2C5282', '#3182CE', '#63B3ED'],
    defaultPalette: { primary: '#2C5282', secondary: '#3182CE', accent: '#63B3ED' },
    layoutConfig: {
      heroLayout: 'split',
      productDisplayType: 'grid-standard',
      productCardAnimation: 'none',
      menuStyle: 'classic',
      aboutLayout: 'left',
      contactFormStyle: 1,
      ratingDisplayType: 'stars',
      pageLayout: 'contained',
      storeCardStyle: 'standard',
      visualStyle: 'rounded',
    },
  },
  {
    id: 'classic_ecom',
    name: 'Classic E-Commerce',
    description: 'Conversion-focused storefront with trusted colors and catalog grid',
    colors: ['#1E3A5F', '#0F2942', '#C28B36'],
    defaultPalette: { primary: '#1E3A5F', secondary: '#0F2942', accent: '#C28B36' },
    layoutConfig: {
      heroLayout: 'split',
      productDisplayType: 'grid-standard',
      productCardAnimation: 'slide-reveal',
      menuStyle: 'classic',
      aboutLayout: 'left',
      contactFormStyle: 3,
      ratingDisplayType: 'stars',
      pageLayout: 'contained',
      storeCardStyle: 'standard',
      visualStyle: 'rounded',
    },
  },
  {
    id: 'food_restaurant',
    name: 'Food / Restaurant',
    description: 'Warm hospitality layout tuned for menus and kitchen workflows',
    colors: ['#C05621', '#744210', '#F6AD55'],
    defaultPalette: { primary: '#C05621', secondary: '#744210', accent: '#F6AD55' },
    layoutConfig: {
      heroLayout: 'fullscreen',
      productDisplayType: 'grid-large',
      productCardAnimation: 'zoom-tilt',
      menuStyle: 'bold',
      aboutLayout: 'with-image',
      contactFormStyle: 11,
      ratingDisplayType: 'pill',
      pageLayout: 'hybrid',
      storeCardStyle: 'standard',
      visualStyle: 'rounded',
    },
  },
  {
    id: 'fashion_boutique',
    name: 'Fashion / Boutique',
    description: 'Editorial boutique storefront with premium palette and style-first layout',
    colors: ['#8B5E7A', '#2E2330', '#D4A373'],
    defaultPalette: { primary: '#8B5E7A', secondary: '#2E2330', accent: '#D4A373' },
    layoutConfig: {
      heroLayout: 'centered',
      productDisplayType: 'masonry',
      productCardAnimation: 'parallax',
      menuStyle: 'centered',
      aboutLayout: 'centered',
      contactFormStyle: 2,
      ratingDisplayType: 'minimal',
      pageLayout: 'contained',
      storeCardStyle: 'minimal',
      visualStyle: 'mixed',
    },
  },
];

export function themePatchForWizard(themeId: WizardThemeId): Record<string, unknown> {
  const found = WIZARD_THEME_PRESETS.find((t) => t.id === themeId);
  if (!found) return { template: themeId };
  return {
    template: found.id,
    templateColors: found.defaultPalette,
    ...found.layoutConfig,
  };
}
