import {
  MARKETING_PACKAGE_BY_SLUG,
  PHASE1_PACKAGES,
  PACKAGE_INDUSTRY_SUBNAV,
} from '@/data/marketing/packageRegistry';
import type { MarketingPackageContent, MarketingPackageSlug } from '@/data/marketing/packageTypes';

export { PHASE1_PACKAGES, PACKAGE_INDUSTRY_SUBNAV };
export { HOME_INDUSTRY_CARDS } from '@/data/marketing/homeIndustryCards';

export const HOME_HERO = {
  title: 'Fine dining and full-service restaurants — run the room on one platform',
  subtitle:
    'Floor service, reservations, kitchen flow, and POS for venues that care about experience. Guest CRM, inventory, and finance when you need them.',
} as const;

/** Hero quick links — venue-first (not full industry list). */
export const HOME_HERO_PACKAGE_SLUGS = ['restaurant', 'cafe'] as const;

export const HOME_HERO_RESTAURANT_DEMO_HREF = '/demo/restaurant';
export const HOME_HERO_CRM_HREF = '/features/crm/app';

/** Homepage — follows venue cards; restaurant ops only (no generic ERP feature grid). */
export const HOME_VENUE_HIGHLIGHTS = [
  {
    icon: 'reservations' as const,
    title: 'Reservations & events',
    desc: 'Hold tables, track occasions, and keep hosts aligned before guests arrive.',
  },
  {
    icon: 'floor' as const,
    title: 'Service floor & POS',
    desc: 'Run the room — tabs, splits, and counter flow that match how your team serves.',
  },
  {
    icon: 'kitchen' as const,
    title: 'Kitchen & recipes',
    desc: 'Ticket flow and recipe-aware sales — optional stock and food cost when you need control.',
  },
  {
    icon: 'owner' as const,
    title: 'Owner mobile view',
    desc: 'Android dashboard, service alerts, and USD/LBP visibility while you are on the floor.',
  },
] as const;

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
