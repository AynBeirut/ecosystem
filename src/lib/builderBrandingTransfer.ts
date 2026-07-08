/** Design fields stored on storeProfiles or demo branding docs — copied on demo transfer. */

export const STORE_DESIGN_FIELD_KEYS = [
  'template',
  'templateColors',
  'storeBackgroundImage',
  'carouselImages',
  'galleryImages',
  'productDisplayType',
  'productCardAnimation',
  'heroLayout',
  'menuStyle',
  'aboutLayout',
  'pageLayout',
  'storeCardStyle',
  'visualStyle',
  'contactFormStyle',
  'ratingDisplayType',
  'sectionOrder',
  'hasImportedDesign',
] as const;

export type StoreDesignFieldKey = (typeof STORE_DESIGN_FIELD_KEYS)[number];

export function pickStoreDesignFields(
  source: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!source) return {};
  const out: Record<string, unknown> = {};
  for (const key of STORE_DESIGN_FIELD_KEYS) {
    if (source[key] !== undefined) {
      out[key] = source[key];
    }
  }
  return out;
}

export function mergeBrandingIntoStoreProfile(
  branding: Record<string, unknown>,
  base: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...base,
    name: branding.name ?? base.name,
    slug: branding.slug ?? base.slug,
    description: branding.description ?? base.description ?? '',
    slogan: branding.slogan ?? base.slogan ?? '',
    logo: branding.logo ?? base.logo ?? '',
    template: branding.template ?? base.template ?? 'modern',
    ...pickStoreDesignFields(branding),
  };
}
