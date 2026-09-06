import {
  MARKETING_PACKAGE_BY_SLUG,
  PHASE1_PACKAGES,
  PACKAGE_INDUSTRY_SUBNAV,
} from '@/data/marketing/packageRegistry';
import type { MarketingPackageContent, MarketingPackageSlug } from '@/data/marketing/packageTypes';

export { PHASE1_PACKAGES, PACKAGE_INDUSTRY_SUBNAV };
export { HOME_INDUSTRY_CARDS } from '@/data/marketing/homeIndustryCards';

export const HOME_HERO = {
  title: 'Run your shop, kitchen, or online store from one place',
  subtitle: 'Sales, stock, and money in sync.',
} as const;

export function getMarketingPackage(slug: string | undefined): MarketingPackageContent | undefined {
  if (!slug) return undefined;
  return MARKETING_PACKAGE_BY_SLUG[slug];
}

export function isMarketingPackageSlug(slug: string): slug is MarketingPackageSlug {
  return slug in MARKETING_PACKAGE_BY_SLUG;
}

export function packageLandingPath(slug: MarketingPackageSlug): string {
  return `/demo/${slug}`;
}

export function demoStorePath(pkg: MarketingPackageContent): string {
  return `/store/${pkg.demoStoreSlug}`;
}
