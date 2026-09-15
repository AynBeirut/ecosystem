/** Homepage industry selector — venue-first marketing (2026-09-15 pivot). */

export type HomeIndustryCardSlug =
  | 'guest_crm'
  | 'shop'
  | 'cafe'
  | 'restaurant'
  | 'manufacturing'
  | 'ecommerce'
  | 'ngo'
  | 'freelancer'
  | 'publisher'
  | 'custom';

export type HomeIndustryCard = {
  slug: HomeIndustryCardSlug;
  label: string;
  shortLabel: string;
  cardDescription: string;
  phase: 1 | 2;
  href: string;
  /** Primary fine-dining / venue story on homepage */
  featured?: boolean;
};

const GUEST_CRM_CARD: HomeIndustryCard = {
  slug: 'guest_crm',
  label: 'Guest CRM',
  shortLabel: 'Hosts · regulars · follow-ups',
  cardDescription:
    'Reservations, visit history, preferences, and host notes — connected to floor service and POS so every seat feels personal.',
  phase: 1,
  href: '/features/crm/app',
  featured: true,
};

const RESTAURANT_CARD: HomeIndustryCard = {
  slug: 'restaurant',
  label: 'Fine dining & full service',
  shortLabel: 'Live kitchen · venue ops',
  cardDescription:
    'Floor service, reservations, kitchen flow, and POS — built for restaurants that care about experience and control.',
  phase: 1,
  href: '/demo/restaurant',
  featured: true,
};

const CAFE_CARD: HomeIndustryCard = {
  slug: 'cafe',
  label: 'Café & quick service',
  shortLabel: 'High-turnover venues',
  cardDescription: 'Fast counter service, recipes, and stock — same venue stack, lighter service model.',
  phase: 1,
  href: '/demo/cafe',
  featured: true,
};

/** Shown first on homepage — product center. */
export const HOME_INDUSTRY_CARDS_PRIMARY: HomeIndustryCard[] = [RESTAURANT_CARD, CAFE_CARD, GUEST_CRM_CARD];

/** Maintained packages — still on Grabio, not the GTM focus. */
export const HOME_INDUSTRY_CARDS_MAINTAINED: HomeIndustryCard[] = [
  {
    slug: 'shop',
    label: 'Shop',
    shortLabel: 'Retail & wholesale',
    cardDescription: 'POS, stock, invoices, and online orders — one ledger for counter and web.',
    phase: 1,
    href: '/demo/shop',
  },
  {
    slug: 'manufacturing',
    label: 'Manufacturing',
    shortLabel: 'Make & distribute',
    cardDescription: 'BOMs, production runs, raw materials, and sales — shop floor to shipment.',
    phase: 1,
    href: '/demo/manufacturing',
  },
  {
    slug: 'ecommerce',
    label: 'E-commerce',
    shortLabel: 'Online-first brands',
    cardDescription: 'Storefront, payments, and fulfillment — scale online sales on Grabio.',
    phase: 1,
    href: '/demo/ecommerce',
  },
];

/** @deprecated homepage — deferred growth; use /pricing or signup presets instead. */
export const HOME_INDUSTRY_CARDS_LEGACY: HomeIndustryCard[] = [
  {
    slug: 'ngo',
    label: 'NGO',
    shortLabel: 'Non-profits & charities',
    cardDescription: 'Programs, donors, and finance — existing tenants supported.',
    phase: 2,
    href: '/login?tab=signup&preset=pkg_ngo',
  },
  {
    slug: 'freelancer',
    label: 'Freelancer',
    shortLabel: 'Solo professionals',
    cardDescription: 'Quotes and invoices — existing tenants supported.',
    phase: 2,
    href: '/login?tab=signup&preset=pkg_freelancer',
  },
  {
    slug: 'publisher',
    label: 'Publisher',
    shortLabel: 'Blog & content',
    cardDescription: 'Content and catalog — available via custom setup.',
    phase: 2,
    href: '/login?tab=signup&onboarding=custom',
  },
  {
    slug: 'custom',
    label: 'Custom Package',
    shortLabel: 'Build your stack',
    cardDescription: 'Module picker for special setups.',
    phase: 2,
    href: '/login?tab=signup&onboarding=custom',
  },
];

/** Full list for tooling/tests — homepage uses PRIMARY + MAINTAINED only. */
export const HOME_INDUSTRY_CARDS: HomeIndustryCard[] = [
  ...HOME_INDUSTRY_CARDS_PRIMARY,
  ...HOME_INDUSTRY_CARDS_MAINTAINED,
  ...HOME_INDUSTRY_CARDS_LEGACY,
];
