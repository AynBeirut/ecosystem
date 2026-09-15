import type { MarketingPackageContent, Phase2PackageEntry } from './packageTypes';
import { SHOP_PACKAGE } from './content/shop';
import { CAFE_PACKAGE } from './content/cafe';
import { RESTAURANT_PACKAGE } from './content/restaurant';
import { MANUFACTURING_PACKAGE } from './content/manufacturing';
import { ECOMMERCE_PACKAGE } from './content/ecommerce';

/** Public nav order — venue-first, then maintained verticals. */
export const PHASE1_PACKAGES: MarketingPackageContent[] = [
  RESTAURANT_PACKAGE,
  CAFE_PACKAGE,
  SHOP_PACKAGE,
  MANUFACTURING_PACKAGE,
  ECOMMERCE_PACKAGE,
];

export const MARKETING_PACKAGE_BY_SLUG: Record<string, MarketingPackageContent> = Object.fromEntries(
  PHASE1_PACKAGES.map((pkg) => [pkg.slug, pkg]),
);

export const PHASE2_PACKAGE_REGISTRY: Phase2PackageEntry[] = [
  { slug: 'ngo', label: 'NGO', enabled: false, phase: 2 },
  { slug: 'freelancer', label: 'Freelancer', enabled: false, phase: 2 },
  { slug: 'publisher', label: 'Publisher', enabled: false, phase: 2 },
  { slug: 'custom', label: 'Custom Package', enabled: false, phase: 2 },
];

export const PACKAGE_INDUSTRY_SUBNAV = PHASE1_PACKAGES.map((pkg) => ({
  label: pkg.label,
  href: `/demo/${pkg.slug}`,
}));
