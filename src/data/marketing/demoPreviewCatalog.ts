import type { MarketingPackageSlug } from './packageTypes';

export type DemoPreviewScreenType =
  | 'dashboard'
  | 'pos'
  | 'inventory'
  | 'orders'
  | 'invoicing'
  | 'kitchen'
  | 'recipes'
  | 'production'
  | 'storefront'
  | 'fulfillment'
  | 'crm'
  | 'analytics'
  | 'finance';

export type DemoPreviewScreen = {
  id: string;
  label: string;
  type: DemoPreviewScreenType;
};

export type VerticalAppPreview = {
  slug: MarketingPackageSlug;
  metaTitle: string;
  metaDescription: string;
  heroTitle: string;
  heroDescription: string;
  keywords: string[];
  screens: DemoPreviewScreen[];
};

export type FeatureAppPreview = {
  moduleId: string;
  metaTitle: string;
  metaDescription: string;
  heroTitle: string;
  heroDescription: string;
  keywords: string[];
  screens: DemoPreviewScreen[];
};

const VERTICAL_PREVIEWS: VerticalAppPreview[] = [
  {
    slug: 'shop',
    metaTitle: 'Retail Shop Software Demo Preview | Grabio POS & Inventory',
    metaDescription:
      'Browse a read-only preview of Grabio for retail shops — POS checkout, inventory, orders, and invoicing. Sign in to run the live demo.',
    heroTitle: 'See how a shop runs on Grabio',
    heroDescription:
      'Walk through POS, stock, orders, and billing screens. Preview is read-only — sign in to open your own demo store.',
    keywords: ['retail POS demo', 'shop inventory software preview', 'Grabio shop demo'],
    screens: [
      { id: 'dash', label: 'Dashboard', type: 'dashboard' },
      { id: 'pos', label: 'POS', type: 'pos' },
      { id: 'stock', label: 'Inventory', type: 'inventory' },
      { id: 'orders', label: 'Orders', type: 'orders' },
      { id: 'invoices', label: 'Invoicing', type: 'invoicing' },
    ],
  },
  {
    slug: 'cafe',
    metaTitle: 'Café POS & Recipe Software Demo Preview | Grabio',
    metaDescription:
      'Preview Grabio for cafés — counter POS, recipes, stock, and orders. Read-only tour; sign in to try the live café demo.',
    heroTitle: 'See how a café runs on Grabio',
    heroDescription:
      'Counter service, recipe-linked stock, and daily sales in one workspace. Sign in to use the interactive demo.',
    keywords: ['café POS demo', 'coffee shop inventory preview', 'Grabio café software'],
    screens: [
      { id: 'dash', label: 'Dashboard', type: 'dashboard' },
      { id: 'pos', label: 'POS', type: 'pos' },
      { id: 'recipes', label: 'Recipes', type: 'recipes' },
      { id: 'stock', label: 'Stock', type: 'inventory' },
      { id: 'orders', label: 'Orders', type: 'orders' },
    ],
  },
  {
    slug: 'restaurant',
    metaTitle: 'Restaurant POS & Kitchen Demo Preview | Grabio',
    metaDescription:
      'Preview Grabio restaurant software — floor POS, kitchen queue, recipes, and orders. Sign in to open the live restaurant demo.',
    heroTitle: 'See how a restaurant runs on Grabio',
    heroDescription:
      'Table service, kitchen tickets, and food cost on one platform. This tour is view-only until you sign in.',
    keywords: ['restaurant POS demo', 'kitchen display preview', 'Grabio restaurant software'],
    screens: [
      { id: 'dash', label: 'Dashboard', type: 'dashboard' },
      { id: 'pos', label: 'Floor POS', type: 'pos' },
      { id: 'kitchen', label: 'Kitchen', type: 'kitchen' },
      { id: 'recipes', label: 'Recipes', type: 'recipes' },
      { id: 'orders', label: 'Orders', type: 'orders' },
    ],
  },
  {
    slug: 'manufacturing',
    metaTitle: 'Manufacturing ERP Demo Preview | Grabio BOM & Production',
    metaDescription:
      'Preview Grabio for small manufacturers — production runs, BOMs, inventory, and invoicing. Sign in to try the manufacturing demo.',
    heroTitle: 'See how manufacturing runs on Grabio',
    heroDescription:
      'BOM-driven production, raw materials, and finished goods in one admin. Sign in to run the live environment.',
    keywords: ['manufacturing ERP demo', 'BOM software preview', 'Grabio production demo'],
    screens: [
      { id: 'dash', label: 'Dashboard', type: 'dashboard' },
      { id: 'production', label: 'Production', type: 'production' },
      { id: 'stock', label: 'Materials', type: 'inventory' },
      { id: 'orders', label: 'Sales orders', type: 'orders' },
      { id: 'invoices', label: 'Invoicing', type: 'invoicing' },
    ],
  },
  {
    slug: 'ecommerce',
    metaTitle: 'E-commerce Operations Demo Preview | Grabio Store & Fulfillment',
    metaDescription:
      'Preview Grabio for online brands — storefront admin, fulfillment queue, inventory, and orders. Sign in to launch your demo.',
    heroTitle: 'See how an online brand runs on Grabio',
    heroDescription:
      'Catalog, warehouse picks, and payments behind one admin. Preview screens only — sign in to go live.',
    keywords: ['ecommerce operations demo', 'online store admin preview', 'Grabio ecommerce software'],
    screens: [
      { id: 'dash', label: 'Dashboard', type: 'dashboard' },
      { id: 'store', label: 'Storefront', type: 'storefront' },
      { id: 'fulfill', label: 'Fulfillment', type: 'fulfillment' },
      { id: 'stock', label: 'Inventory', type: 'inventory' },
      { id: 'orders', label: 'Orders', type: 'orders' },
    ],
  },
];

const FEATURE_PREVIEWS: FeatureAppPreview[] = [
  {
    moduleId: 'pos',
    metaTitle: 'POS Software Demo Preview | Grabio Windows POS',
    metaDescription:
      'Preview Grabio POS — barcode checkout, payments, and stock sync. Read-only tour; sign in to install and pair your register.',
    heroTitle: 'Grabio POS preview',
    heroDescription: 'Counter checkout tied to inventory and invoicing. Sign in to download POS and connect your store.',
    keywords: ['POS software demo', 'retail checkout preview', 'Grabio POS'],
    screens: [
      { id: 'pos', label: 'Checkout', type: 'pos' },
      { id: 'orders', label: 'Orders', type: 'orders' },
      { id: 'stock', label: 'Stock', type: 'inventory' },
    ],
  },
  {
    moduleId: 'stock',
    metaTitle: 'Inventory Management Demo Preview | Grabio',
    metaDescription:
      'Preview Grabio inventory — stock levels, suppliers, purchases, and alerts. Sign in to manage your catalog.',
    heroTitle: 'Inventory & stock preview',
    heroDescription: 'Real-time quantities, receiving, and valuation. Sign in to open your warehouse ledger.',
    keywords: ['inventory management demo', 'stock control preview', 'Grabio inventory'],
    screens: [
      { id: 'stock', label: 'Products', type: 'inventory' },
      { id: 'orders', label: 'Purchases', type: 'orders' },
      { id: 'dash', label: 'Alerts', type: 'dashboard' },
    ],
  },
  {
    moduleId: 'invoicing',
    metaTitle: 'Invoicing Software Demo Preview | Grabio',
    metaDescription:
      'Preview Grabio invoicing — quotes, bills, PDF delivery, and payment status. Sign in to bill from your store.',
    heroTitle: 'Invoicing preview',
    heroDescription: 'Customer invoices and supplier bills on shared accounts. Sign in to create live documents.',
    keywords: ['invoicing software demo', 'billing preview', 'Grabio invoices'],
    screens: [
      { id: 'invoices', label: 'Invoices', type: 'invoicing' },
      { id: 'finance', label: 'Receivables', type: 'finance' },
      { id: 'orders', label: 'Orders', type: 'orders' },
    ],
  },
  {
    moduleId: 'marketplace',
    metaTitle: 'Online Storefront Demo Preview | Grabio Marketplace',
    metaDescription:
      'Preview Grabio storefront admin — catalog, collections, and web orders. Sign in to publish your shop.',
    heroTitle: 'Online storefront preview',
    heroDescription: 'Branded catalog and checkout connected to back-office stock. Sign in to customize your store.',
    keywords: ['online storefront demo', 'ecommerce admin preview', 'Grabio marketplace'],
    screens: [
      { id: 'store', label: 'Catalog', type: 'storefront' },
      { id: 'orders', label: 'Web orders', type: 'orders' },
      { id: 'stock', label: 'Stock', type: 'inventory' },
    ],
  },
  {
    moduleId: 'payments',
    metaTitle: 'Payments & Finance Demo Preview | Grabio',
    metaDescription:
      'Preview Grabio payments — gateways, expenses, and cash visibility. Sign in to connect OMT, Stripe, and more.',
    heroTitle: 'Payments preview',
    heroDescription: 'Track collections, expenses, and P&L in one finance hub. Sign in to connect your accounts.',
    keywords: ['business payments demo', 'expense tracking preview', 'Grabio finance'],
    screens: [
      { id: 'finance', label: 'Cash & P&L', type: 'finance' },
      { id: 'invoices', label: 'Vouchers', type: 'invoicing' },
      { id: 'dash', label: 'Summary', type: 'dashboard' },
    ],
  },
  {
    moduleId: 'analytics',
    metaTitle: 'Business Analytics Demo Preview | Grabio Reports',
    metaDescription:
      'Preview Grabio analytics — revenue, inventory turnover, and statements. Sign in to see your live dashboards.',
    heroTitle: 'Analytics preview',
    heroDescription: 'Sales, margin, and stock reports without spreadsheet exports. Sign in for your store data.',
    keywords: ['business analytics demo', 'ERP reports preview', 'Grabio analytics'],
    screens: [
      { id: 'analytics', label: 'Reports', type: 'analytics' },
      { id: 'dash', label: 'Overview', type: 'dashboard' },
      { id: 'finance', label: 'Statements', type: 'finance' },
    ],
  },
  {
    moduleId: 'factory',
    metaTitle: 'Manufacturing Production Demo Preview | Grabio',
    metaDescription:
      'Preview Grabio manufacturing — BOMs, production runs, and finished goods. Sign in to plan your shop floor.',
    heroTitle: 'Production preview',
    heroDescription: 'Consume raw materials and receive finished SKUs on completion. Sign in to run production.',
    keywords: ['manufacturing software demo', 'BOM preview', 'Grabio factory'],
    screens: [
      { id: 'production', label: 'Production', type: 'production' },
      { id: 'stock', label: 'Materials', type: 'inventory' },
      { id: 'orders', label: 'Sales', type: 'orders' },
    ],
  },
  {
    moduleId: 'restaurant',
    metaTitle: 'Restaurant Kitchen Demo Preview | Grabio',
    metaDescription:
      'Preview Grabio restaurant ops — recipes, kitchen queue, and food cost. Sign in for the full hospitality demo.',
    heroTitle: 'Restaurant ops preview',
    heroDescription: 'Kitchen tickets and ingredient depletion tied to the menu. Sign in to open the restaurant demo.',
    keywords: ['restaurant kitchen demo', 'food cost preview', 'Grabio hospitality'],
    screens: [
      { id: 'kitchen', label: 'Kitchen', type: 'kitchen' },
      { id: 'recipes', label: 'Recipes', type: 'recipes' },
      { id: 'pos', label: 'POS', type: 'pos' },
    ],
  },
  {
    moduleId: 'crm',
    metaTitle: 'Sales CRM Demo Preview | Grabio',
    metaDescription:
      'Preview Grabio CRM — pipeline, clients, and field visits. Sign in to manage your sales team.',
    heroTitle: 'Sales CRM preview',
    heroDescription: 'Deals, territories, and visit routes in one module. Sign in to activate CRM for your store.',
    keywords: ['sales CRM demo', 'field sales preview', 'Grabio CRM'],
    screens: [
      { id: 'crm', label: 'Pipeline', type: 'crm' },
      { id: 'dash', label: 'Targets', type: 'dashboard' },
      { id: 'orders', label: 'Quotes', type: 'orders' },
    ],
  },
  {
    moduleId: 'delivery',
    metaTitle: 'Delivery Workflow Demo Preview | Grabio',
    metaDescription:
      'Preview Grabio delivery — dispatch queue, driver assignment, and tracking. Sign in to fulfill orders.',
    heroTitle: 'Delivery preview',
    heroDescription: 'Route orders from kitchen or warehouse to the customer door. Sign in to enable delivery.',
    keywords: ['delivery management demo', 'dispatch preview', 'Grabio delivery'],
    screens: [
      { id: 'fulfill', label: 'Dispatch', type: 'fulfillment' },
      { id: 'orders', label: 'Orders', type: 'orders' },
      { id: 'dash', label: 'Status', type: 'dashboard' },
    ],
  },
];

export const VERTICAL_APP_PREVIEWS: Record<MarketingPackageSlug, VerticalAppPreview> = Object.fromEntries(
  VERTICAL_PREVIEWS.map((entry) => [entry.slug, entry]),
) as Record<MarketingPackageSlug, VerticalAppPreview>;

export const FEATURE_APP_PREVIEWS: Record<string, FeatureAppPreview> = Object.fromEntries(
  FEATURE_PREVIEWS.map((entry) => [entry.moduleId, entry]),
);

export function getVerticalAppPreview(slug: string | undefined): VerticalAppPreview | undefined {
  if (!slug) return undefined;
  return VERTICAL_APP_PREVIEWS[slug as MarketingPackageSlug];
}

export function getFeatureAppPreview(moduleId: string | undefined): FeatureAppPreview | undefined {
  if (!moduleId) return undefined;
  return FEATURE_APP_PREVIEWS[moduleId];
}

export function verticalAppPreviewPath(slug: MarketingPackageSlug): string {
  return `/demo/${slug}/app`;
}

export function featureAppPreviewPath(moduleId: string): string {
  return `/features/${moduleId}/app`;
}

export function listVerticalAppPreviewUrls(): string[] {
  return VERTICAL_PREVIEWS.map((entry) => `https://grabio.space${verticalAppPreviewPath(entry.slug)}`);
}

export function listFeatureAppPreviewUrls(): string[] {
  return FEATURE_PREVIEWS.map((entry) => `https://grabio.space${featureAppPreviewPath(entry.moduleId)}`);
}
