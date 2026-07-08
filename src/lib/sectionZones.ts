import type { StoreSectionId } from '@/types/storeProfile';

export type SectionZoneId = 'header' | 'template' | 'footer';

export const SECTION_ZONE_LABELS: Record<SectionZoneId, string> = {
  header: 'Header',
  template: 'Template',
  footer: 'Footer',
};

/** Which zone each section belongs to (Shopify-style tree grouping). */
export const SECTION_ZONE_MAP: Record<StoreSectionId, SectionZoneId> = {
  hero: 'header',
  announcements: 'header',
  about: 'template',
  products: 'template',
  gallery: 'template',
  reviews: 'template',
  contact: 'footer',
};

export const ZONE_ORDER: SectionZoneId[] = ['header', 'template', 'footer'];
