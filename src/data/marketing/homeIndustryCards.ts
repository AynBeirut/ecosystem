/** Homepage industry selector — Phase 1 (demo pages) + Phase 2 (signup-ready, no /demo yet) */

export type HomeIndustryCardSlug =
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
};

export const HOME_INDUSTRY_CARDS: HomeIndustryCard[] = [
  {
    slug: 'shop',
    label: 'Shop',
    shortLabel: 'Retail & wholesale',
    cardDescription: 'POS, stock, invoices, and online orders — one ledger for counter and web.',
    phase: 1,
    href: '/demo/shop',
  },
  {
    slug: 'cafe',
    label: 'Café',
    shortLabel: 'Coffee & quick service',
    cardDescription: 'Fast counter service, recipes, and stock — built for high-turnover menus.',
    phase: 1,
    href: '/demo/cafe',
  },
  {
    slug: 'restaurant',
    label: 'Restaurant',
    shortLabel: 'Full-service dining',
    cardDescription: 'Table service, kitchen flow, recipes, and delivery — front and back of house aligned.',
    phase: 1,
    href: '/demo/restaurant',
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
    cardDescription: 'Storefront, payments, fulfillment, and builder — launch and scale online sales.',
    phase: 1,
    href: '/demo/ecommerce',
  },
  {
    slug: 'ngo',
    label: 'NGO',
    shortLabel: 'Non-profits & charities',
    cardDescription: 'Programs, donors, and finance — structured ops without enterprise ERP weight.',
    phase: 2,
    href: '/login?tab=signup&preset=pkg_ngo',
  },
  {
    slug: 'freelancer',
    label: 'Freelancer',
    shortLabel: 'Solo professionals',
    cardDescription: 'Quotes, invoices, and client billing — one workspace for your practice.',
    phase: 2,
    href: '/login?tab=signup&preset=pkg_freelancer',
  },
  {
    slug: 'publisher',
    label: 'Publisher',
    shortLabel: 'Blog & content',
    cardDescription: 'Publish articles, capture leads, and sell alongside your catalog.',
    phase: 2,
    href: '/login?tab=signup&onboarding=custom',
  },
  {
    slug: 'custom',
    label: 'Custom Package',
    shortLabel: 'Build your stack',
    cardDescription: 'Toggle only what you need — POS, CRM, factory, AI tools, and more.',
    phase: 2,
    href: '/login?tab=signup&onboarding=custom',
  },
];
