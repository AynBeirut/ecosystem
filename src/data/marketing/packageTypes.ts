import type { StartingPackageKey } from '@/lib/moduleManifest';

export type MarketingPackageSlug =
  | 'shop'
  | 'cafe'
  | 'restaurant'
  | 'manufacturing'
  | 'ecommerce';

/** Phase 2 — registry only, not shown in Phase 1 UI */
export type Phase2PackageSlug = 'ngo' | 'freelancer' | 'publisher' | 'custom';

export type MarketingPackageContent = {
  slug: MarketingPackageSlug;
  label: string;
  shortLabel: string;
  cardDescription: string;
  tagline: string;
  presetKey: StartingPackageKey;
  /** Separate demo store per vertical — update slug when live store exists */
  demoStoreSlug: string;
  /** SEO `<title>` — buyer-language keywords; falls back to `Grabio for {label}` */
  metaTitle?: string;
  metaDescription: string;
  heroTitle: string;
  heroDescription: string;
  keywords: string[];
  pains: string[];
  outcomes: string[];
  dayInLife: { period: string; title: string; description: string }[];
  moduleIds: string[];
  /** Per-page display labels for module chips (underlying module id unchanged) */
  moduleLabelOverrides?: Record<string, string>;
  moduleStripTitle: string;
  faqs: { question: string; answer: string }[];
};

export type Phase2PackageEntry = {
  slug: Phase2PackageSlug;
  label: string;
  enabled: false;
  phase: 2;
};
