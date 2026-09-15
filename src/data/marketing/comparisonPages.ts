import type { MarketingPackageSlug } from './packageTypes';

export type ComparisonRow = {
  section: string;
  grabio: string;
  competitor: string;
};

export type ComparisonPageContent = {
  slug: string;
  competitorName: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  heroTitle: string;
  heroDescription: string;
  intro: string;
  rows: ComparisonRow[];
  whenCompetitorFits: string;
  whenGrabioFits: string;
  demoVertical: MarketingPackageSlug;
  demoCtaLabel: string;
};

export const COMPARISON_PAGES: ComparisonPageContent[] = [
  {
    slug: 'grabio-vs-square-retail',
    competitorName: 'Square',
    metaTitle: 'Grabio vs Square for Retail Shops | Comparison',
    metaDescription:
      'Compare Grabio and Square for retail: POS, inventory, wholesale invoicing, and online storefront on one ledger versus payments-first POS with add-ons.',
    keywords: [
      'Grabio vs Square',
      'Square alternative retail',
      'retail POS and inventory software',
      'small business ERP retail',
    ],
    heroTitle: 'Grabio vs Square for retail shops',
    heroDescription:
      'Square leads on payments hardware. Grabio leads when counter, web, and wholesale need one stock ledger and back office.',
    intro:
      'Both serve small and mid-size retailers. This page compares operational depth for shops selling in-store, online, and to trade accounts — without competitor logos or marketing claims.',
    rows: [
      {
        section: 'Core positioning',
        grabio: 'Modular business platform: POS, inventory, invoicing, storefront, payments, reporting in one account',
        competitor: 'Payments-first ecosystem; retail POS with optional add-ons and app marketplace',
      },
      {
        section: 'Inventory',
        grabio: 'Unified stock ledger across counter, web, and admin; purchase receiving tied to suppliers',
        competitor: 'Inventory tools available; multi-channel sync often depends on Square Online or third-party apps',
      },
      {
        section: 'Wholesale / B2B invoicing',
        grabio: 'B2B invoicing on shared customer and stock records',
        competitor: 'Invoicing available; wholesale workflows may need Square Invoices or integrations',
      },
      {
        section: 'Online storefront',
        grabio: 'Built-in catalog and order flow connected to back-office stock',
        competitor: 'Square Online or external ecommerce; deeper ops integration varies by setup',
      },
      {
        section: 'Reporting',
        grabio: 'Sales, stock valuation, and payments in one dashboard',
        competitor: 'Sales reporting strong; cross-channel operational reporting may span multiple Square products',
      },
      {
        section: 'Hardware',
        grabio: 'Software-first; Windows POS on your existing PC',
        competitor: 'Strong native hardware (readers, registers, terminals)',
      },
    ],
    whenCompetitorFits:
      'Shops that primarily need payment terminals and a simple register, with minimal wholesale or multi-channel inventory complexity.',
    whenGrabioFits:
      'Retailers selling through counter, web, and trade accounts who want one stock count and one admin without end-of-day reconciliation across tools.',
    demoVertical: 'shop',
    demoCtaLabel: 'Try the retail demo',
  },
  {
    slug: 'grabio-vs-touchbistro-restaurant',
    competitorName: 'TouchBistro',
    metaTitle: 'Grabio vs TouchBistro for Restaurants | Comparison',
    metaDescription:
      'Compare Grabio and TouchBistro for full-service restaurants: table service, kitchen flow, food cost, delivery, and back-office on one platform.',
    keywords: [
      'Grabio vs TouchBistro',
      'TouchBistro alternative',
      'restaurant POS and food cost software',
      'hospitality management platform',
    ],
    heroTitle: 'Grabio vs TouchBistro for full-service restaurants',
    heroDescription:
      'TouchBistro is strong on dine-in POS. Grabio fits operators who want floor, kitchen, food cost, and back office on one ledger.',
    intro:
      'Both serve full-service restaurants. This page compares table service, kitchen tickets, food cost, and delivery margin visibility.',
    rows: [
      {
        section: 'Core positioning',
        grabio: 'Modular hospitality + business platform: floor, kitchen, inventory, delivery, storefront, finance',
        competitor: 'Restaurant-focused POS built around table service and floor operations',
      },
      {
        section: 'Table service',
        grabio: 'Table tabs, courses, splits, and payments on shared platform data',
        competitor: 'Strong native table management and floor workflows',
      },
      {
        section: 'Food cost & recipes',
        grabio: 'Recipe-linked ingredient depletion and costing tied to live menu changes',
        competitor: 'Menu and costing tools available; full inventory/GL depth may need integrations',
      },
      {
        section: 'Delivery & aggregators',
        grabio: 'Delivery and online orders in same queue as dine-in with shared stock',
        competitor: 'Delivery integrations available; margin/stock alignment depends on connected tools',
      },
      {
        section: 'Back office',
        grabio: 'Inventory, invoicing, payments, analytics in same account',
        competitor: 'POS-centric; extended accounting/inventory often via partners',
      },
    ],
    whenCompetitorFits:
      'Single-location dine-in restaurants that primarily need proven table-service POS and are satisfied adding inventory/accounting through separate tools.',
    whenGrabioFits:
      'Full-service restaurants that want table service, kitchen tickets, live food cost, delivery, and back-office reporting on one platform.',
    demoVertical: 'restaurant',
    demoCtaLabel: 'Try the restaurant demo',
  },
  {
    slug: 'grabio-vs-katana-manufacturing',
    competitorName: 'Katana',
    metaTitle: 'Grabio vs Katana for Small Manufacturers | Comparison',
    metaDescription:
      'Compare Grabio and Katana for SMB manufacturing: BOMs, production runs, inventory, and selling finished goods wholesale or online.',
    keywords: [
      'Grabio vs Katana',
      'Katana alternative',
      'manufacturing ERP small business',
      'BOM production software',
    ],
    heroTitle: 'Grabio vs Katana for small manufacturers',
    heroDescription:
      'Katana is MRP-first. Grabio fits makers who also sell, invoice, and ship finished goods from the same platform.',
    intro:
      'Both serve small and mid-size manufacturers. This page compares make-to-order workflows for businesses that also sell and ship finished goods.',
    rows: [
      {
        section: 'Core positioning',
        grabio: 'Production, inventory, invoicing, storefront, delivery, analytics in one account',
        competitor: 'Manufacturing inventory and production scheduling with sales channel integrations',
      },
      {
        section: 'BOM & production runs',
        grabio: 'BOM-driven runs; raw consumption and finished goods on completion',
        competitor: 'Strong BOM and production order workflows',
      },
      {
        section: 'Finished goods sales',
        grabio: 'Native invoicing, wholesale, and storefront on shared stock',
        competitor: 'Shopify and ecommerce integrations; depth varies by channel setup',
      },
      {
        section: 'Back office',
        grabio: 'Payments, analytics, CRM, delivery in same ecosystem',
        competitor: 'Focused MRP/inventory stack; broader ops via integrations',
      },
    ],
    whenCompetitorFits:
      'Production-first shops already committed to Katana’s MRP workflow and satisfied connecting sales through its integration ecosystem.',
    whenGrabioFits:
      'Small manufacturers who need BOM-driven production, live stock, and sales fulfillment — wholesale, online, or delivery — on one platform.',
    demoVertical: 'manufacturing',
    demoCtaLabel: 'Try the manufacturing demo',
  },
  {
    slug: 'grabio-vs-shopify-ecommerce',
    competitorName: 'Shopify',
    metaTitle: 'Grabio vs Shopify for Online Brands | Comparison',
    metaDescription:
      'Compare Grabio and Shopify for ecommerce: branded storefront and warehouse fulfillment on one platform versus checkout-first with app-stack ops.',
    keywords: [
      'Grabio vs Shopify',
      'Shopify alternative',
      'ecommerce platform with inventory',
      'online store fulfillment software',
    ],
    heroTitle: 'Grabio vs Shopify for online-first brands',
    heroDescription:
      'Shopify leads on storefront and checkout. Grabio leads when catalog, payments, warehouse fulfillment, and reporting share one admin.',
    intro:
      'Both help businesses sell online. This page compares online-first brands that need warehouse operations behind the storefront.',
    rows: [
      {
        section: 'Core positioning',
        grabio: 'Storefront + warehouse ops + finance on one platform',
        competitor: 'Storefront and checkout ecosystem with apps for extended ops',
      },
      {
        section: 'Storefront & catalog',
        grabio: 'Branded storefront, collections, variants tied to live stock',
        competitor: 'Industry-leading themes, checkout, and app ecosystem',
      },
      {
        section: 'Inventory & fulfillment',
        grabio: 'Native pick-pack-ship queue and stock in same admin',
        competitor: 'Inventory apps and Shopify Fulfillment; depth varies by setup',
      },
      {
        section: 'Back office',
        grabio: 'Invoicing, analytics, delivery, CRM, production optional in same account',
        competitor: 'Extended via Shopify apps and external tools',
      },
    ],
    whenCompetitorFits:
      'Online brands that want maximum theme choice, checkout polish, and are comfortable adding inventory and accounting through Shopify’s app ecosystem.',
    whenGrabioFits:
      'Online-first sellers who need catalog, payments, warehouse fulfillment, and back-office reporting on one platform without stitching checkout to ops through plugins.',
    demoVertical: 'ecommerce',
    demoCtaLabel: 'Try the ecommerce demo',
  },
  {
    slug: 'grabio-vs-odoo-small-business',
    competitorName: 'Odoo',
    metaTitle: 'Grabio vs Odoo for Small Business | Comparison',
    metaDescription:
      'Compare Grabio and Odoo for SMBs: modular POS, inventory, accounting, and industry verticals versus broad ERP with implementation overhead.',
    keywords: [
      'Grabio vs Odoo',
      'Odoo alternative small business',
      'small business ERP software',
      'all-in-one business management software',
    ],
    heroTitle: 'Grabio vs Odoo for small business',
    heroDescription:
      'Odoo is a broad ERP suite. Grabio is a focused modular platform with faster time-to-value for retail, hospitality, manufacturing, and ecommerce.',
    intro:
      'Both offer modular business software for SMBs. This page compares implementation depth, industry fit, and operational focus.',
    rows: [
      {
        section: 'Core positioning',
        grabio: 'Industry presets for shop, café, restaurant, manufacturing, ecommerce with shared ledger',
        competitor: 'Broad ERP modules (CRM, inventory, accounting, manufacturing, website) with deep customization',
      },
      {
        section: 'Implementation',
        grabio: 'Pre-seeded vertical demos; activate modules without migration projects',
        competitor: 'Powerful but often requires partners, configuration, and training for full rollout',
      },
      {
        section: 'POS & retail',
        grabio: 'Windows POS, marketplace, wholesale invoicing on one stock ledger',
        competitor: 'POS and ecommerce modules available; setup complexity varies',
      },
      {
        section: 'Hospitality & manufacturing',
        grabio: 'Recipe costing, kitchen flow, BOM production runs native to vertical packages',
        competitor: 'Manufacturing and POS modules exist; hospitality depth may need customization',
      },
      {
        section: 'Regional fit',
        grabio: 'Dual currency, Lebanese PCG accounting, MENA-ready defaults',
        competitor: 'Global ERP; local accounting may need localization or partners',
      },
    ],
    whenCompetitorFits:
      'Businesses that need a highly customizable ERP across many departments and accept longer implementation with partners or in-house admins.',
    whenGrabioFits:
      'Operators who want POS, inventory, invoicing, and industry-specific workflows live quickly without enterprise ERP timelines.',
    demoVertical: 'shop',
    demoCtaLabel: 'Try the platform demo',
  },
];

export const COMPARISON_BY_SLUG: Record<string, ComparisonPageContent> = Object.fromEntries(
  COMPARISON_PAGES.map((page) => [page.slug, page]),
);

export function getComparisonPage(slug: string | undefined): ComparisonPageContent | undefined {
  if (!slug) return undefined;
  return COMPARISON_BY_SLUG[slug];
}
