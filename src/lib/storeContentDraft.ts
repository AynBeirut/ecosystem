import type { RatingDisplayType, StorePage, StoreProfile, StoreTemplateColors } from '@/types/storeProfile';

/** Merge partial color edits without dropping extended palette fields from Classic Templates. */
export function mergeTemplateColors(
  base?: Partial<StoreTemplateColors> | null,
  patch?: Partial<StoreTemplateColors> | null,
): StoreTemplateColors | undefined {
  if (!base && !patch) return undefined;
  return { ...(base ?? {}), ...(patch ?? {}) } as StoreTemplateColors;
}

/** Storefront content fields managed in Theme Editor (not invoice profile). */
export type StoreContentDraft = {
  slogan?: string;
  description?: string;
  aboutUs?: string;
  mission?: string;
  vision?: string;
  facebook?: string;
  instagram?: string;
  twitter?: string;
  whatsappBusiness?: string;
  carouselImages?: string[];
  customPages?: StorePage[];
  templateColors?: { primary: string; secondary: string; accent: string };
  logo?: string;
  logoPosition?: 'left' | 'center' | 'right';
  ratingDisplayType?: RatingDisplayType;
};

export function contentDraftFromProfile(profile?: Partial<StoreProfile> | null): StoreContentDraft {
  if (!profile) return {};
  return {
    slogan: profile.slogan,
    description: profile.description,
    aboutUs: profile.aboutUs,
    mission: profile.mission,
    vision: profile.vision,
    facebook: profile.facebook,
    instagram: profile.instagram,
    twitter: profile.twitter,
    whatsappBusiness: profile.whatsappBusiness,
    carouselImages: profile.carouselImages,
    customPages: profile.customPages,
    templateColors: profile.templateColors,
    logo: profile.logo,
    logoPosition: profile.logoPosition,
    ratingDisplayType: profile.ratingDisplayType,
  };
}

export function contentDraftToFirestorePatch(
  draft: StoreContentDraft,
  existingColors?: Partial<StoreTemplateColors> | null,
): Record<string, unknown> {
  const mergedColors = draft.templateColors
    ? mergeTemplateColors(existingColors, draft.templateColors)
    : existingColors ?? null;
  return {
    slogan: draft.slogan ?? null,
    description: draft.description ?? null,
    aboutUs: draft.aboutUs ?? null,
    mission: draft.mission ?? null,
    vision: draft.vision ?? null,
    facebook: draft.facebook ?? null,
    instagram: draft.instagram ?? null,
    twitter: draft.twitter ?? null,
    whatsappBusiness: draft.whatsappBusiness ?? null,
    carouselImages: draft.carouselImages ?? [],
    customPages: draft.customPages ?? [],
    templateColors: mergedColors,
    logo: draft.logo ?? null,
    logoPosition: draft.logoPosition ?? 'left',
    ratingDisplayType: draft.ratingDisplayType ?? 'stars',
  };
}
