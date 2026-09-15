import type { DemoPreviewScreenType } from '@/data/marketing/demoPreviewCatalog';
import type { MarketingPackageSlug } from '@/data/marketing/packageTypes';

export type DemoOsModuleId =
  | 'dashboard'
  | 'v-pos'
  | 'orders'
  | 'products'
  | 'inventory'
  | 'purchases'
  | 'invoices'
  | 'expenses'
  | 'accounting'
  | 'crm-pipeline'
  | 'theme-editor'
  | 'ai-assistant';

export type DemoOsGroupId = 'executive' | 'sales' | 'inventory' | 'finance' | 'growth';

export type DemoOsModule = {
  id: DemoOsModuleId;
  label: string;
  group: DemoOsGroupId;
  screenType: DemoPreviewScreenType;
  adminLabel: string;
  metaTitle: string;
  metaDescription: string;
  heroTitle: string;
  heroDescription: string;
  keywords: string[];
  verticals: MarketingPackageSlug[];
};

export const DEMO_OS_GROUPS: Record<DemoOsGroupId, { title: string; description: string }> = {
  executive: {
    title: 'Executive overview',
    description: 'Daily KPIs, revenue, and business health at a glance.',
  },
  sales: {
    title: 'Sales & customers',
    description: 'Counter POS, orders, and customer records on one ledger.',
  },
  inventory: {
    title: 'Stock & purchasing',
    description: 'Products, warehouse quantities, and supplier purchases.',
  },
  finance: {
    title: 'Finance & accounting',
    description: 'Invoices, expenses, payables, receivables, and statements.',
  },
  growth: {
    title: 'Growth & intelligence',
    description: 'CRM pipeline, storefront design, and AI operations assistant.',
  },
};

const MODULES: DemoOsModule[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    group: 'executive',
    screenType: 'dashboard',
    adminLabel: 'Admin Dashboard',
    metaTitle: 'Business Dashboard Demo | Grabio ERP & POS',
    metaDescription:
      'Preview Grabio admin dashboard — sales, stock alerts, cash, and channel performance. Read-only tour; sign in to run your store.',
    heroTitle: 'Your business command center',
    heroDescription:
      'See today’s sales, open orders, low stock, and cash position without exporting spreadsheets.',
    keywords: ['business dashboard software', 'ERP dashboard demo', 'Grabio admin preview'],
    verticals: ['shop', 'cafe', 'restaurant', 'manufacturing', 'ecommerce'],
  },
  {
    id: 'v-pos',
    label: 'V·POS',
    group: 'sales',
    screenType: 'pos',
    adminLabel: 'V·POS Checkout',
    metaTitle: 'POS Checkout Demo | Grabio Counter Sales',
    metaDescription:
      'Preview Grabio V·POS — fast counter checkout tied to inventory and invoicing. Sign in to pair your register.',
    heroTitle: 'Counter checkout that updates stock',
    heroDescription:
      'Sell at the register with barcode tiles, holds, and instant stock deduction.',
    keywords: ['POS software demo', 'retail checkout preview', 'Grabio V-POS'],
    verticals: ['shop', 'cafe', 'restaurant'],
  },
  {
    id: 'orders',
    label: 'Orders',
    group: 'sales',
    screenType: 'orders',
    adminLabel: 'Orders',
    metaTitle: 'Order Management Demo | Grabio POS & Web',
    metaDescription:
      'Preview Grabio orders — POS, wholesale, and web channels in one queue. Sign in to manage live orders.',
    heroTitle: 'Every channel in one order list',
    heroDescription:
      'Walk-in, B2B, and online orders with status, payments, and fulfillment context.',
    keywords: ['order management demo', 'omnichannel orders preview', 'Grabio orders'],
    verticals: ['shop', 'restaurant', 'ecommerce'],
  },
  {
    id: 'products',
    label: 'Products',
    group: 'inventory',
    screenType: 'inventory',
    adminLabel: 'Products',
    metaTitle: 'Product Catalog Demo | Grabio Inventory',
    metaDescription:
      'Preview Grabio product catalog — SKUs, pricing, categories, and stock levels. Sign in to manage your catalog.',
    heroTitle: 'Catalog your entire range',
    heroDescription:
      'Products, variants, and stock counts shared across POS, web, and invoices.',
    keywords: ['product catalog demo', 'inventory SKU preview', 'Grabio products'],
    verticals: ['shop', 'cafe', 'ecommerce', 'manufacturing'],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    group: 'inventory',
    screenType: 'inventory',
    adminLabel: 'Inventory Overview',
    metaTitle: 'Inventory Management Demo | Grabio Stock Control',
    metaDescription:
      'Preview Grabio inventory — on-hand, reserved, low stock, and reorder signals. Sign in for your warehouse ledger.',
    heroTitle: 'Stock you can trust',
    heroDescription:
      'Real-time quantities, reservations, and alerts across locations.',
    keywords: ['inventory management demo', 'stock control preview', 'Grabio inventory'],
    verticals: ['shop', 'manufacturing', 'ecommerce'],
  },
  {
    id: 'purchases',
    label: 'Purchases',
    group: 'inventory',
    screenType: 'orders',
    adminLabel: 'Purchases',
    metaTitle: 'Purchase Orders Demo | Grabio Procurement',
    metaDescription:
      'Preview Grabio purchasing — supplier POs, receiving, and stock updates. Sign in to run procurement.',
    heroTitle: 'Buying tied to stock',
    heroDescription:
      'Raise purchase orders, receive goods, and update valuation in one flow.',
    keywords: ['purchase order demo', 'procurement software preview', 'Grabio purchases'],
    verticals: ['shop', 'manufacturing', 'restaurant'],
  },
  {
    id: 'invoices',
    label: 'Invoices',
    group: 'finance',
    screenType: 'invoicing',
    adminLabel: 'Invoice Manager',
    metaTitle: 'Invoicing Software Demo | Grabio Billing',
    metaDescription:
      'Preview Grabio invoicing — quotes, bills, PDF delivery, and payment status. Sign in to bill from your store.',
    heroTitle: 'Bill customers and suppliers',
    heroDescription:
      'Invoices, estimates, and vouchers on shared accounts with your sales ledger.',
    keywords: ['invoicing software demo', 'billing preview', 'Grabio invoices'],
    verticals: ['shop', 'manufacturing', 'ecommerce'],
  },
  {
    id: 'expenses',
    label: 'Expenses',
    group: 'finance',
    screenType: 'finance',
    adminLabel: 'Expenses',
    metaTitle: 'Expense Tracking Demo | Grabio Finance',
    metaDescription:
      'Preview Grabio expenses — payables, vouchers, and cash impact. Sign in to track operating costs.',
    heroTitle: 'Know where cash goes',
    heroDescription:
      'Capture expenses, approve vouchers, and see P&L impact without spreadsheets.',
    keywords: ['expense tracking demo', 'business expenses preview', 'Grabio finance'],
    verticals: ['shop', 'cafe', 'restaurant'],
  },
  {
    id: 'accounting',
    label: 'Accounting',
    group: 'finance',
    screenType: 'finance',
    adminLabel: 'Business Finance',
    metaTitle: 'Accounting Software Demo | Grabio Lebanese PCG',
    metaDescription:
      'Preview Grabio accounting — receivables, payables, bank, and statements. Sign in for live books.',
    heroTitle: 'Books connected to operations',
    heroDescription:
      'GL-ready workflows with receivables, payables, and bank visibility.',
    keywords: ['accounting software demo', 'small business ERP finance preview', 'Grabio accounting'],
    verticals: ['shop', 'manufacturing', 'ecommerce'],
  },
  {
    id: 'crm-pipeline',
    label: 'CRM Pipeline',
    group: 'growth',
    screenType: 'crm',
    adminLabel: 'Sales CRM',
    metaTitle: 'Sales CRM Demo | Grabio Pipeline & Visits',
    metaDescription:
      'Preview Grabio CRM — pipeline stages, deals, and field visit tracking. Sign in to activate CRM.',
    heroTitle: 'Pipeline your field team can run',
    heroDescription:
      'Deals by stage, territories, and visit follow-ups in one module.',
    keywords: ['sales CRM demo', 'pipeline software preview', 'Grabio CRM'],
    verticals: ['shop', 'manufacturing', 'ecommerce'],
  },
  {
    id: 'theme-editor',
    label: 'Theme Editor',
    group: 'growth',
    screenType: 'storefront',
    adminLabel: 'Theme Editor',
    metaTitle: 'Storefront Theme Editor Demo | Grabio Builder',
    metaDescription:
      'Preview Grabio theme editor — catalog layout, hero, and brand colors. Sign in to customize your shop.',
    heroTitle: 'Design your storefront',
    heroDescription:
      'Visual editor for catalog, collections, and brand presentation.',
    keywords: ['storefront builder demo', 'ecommerce theme preview', 'Grabio theme editor'],
    verticals: ['ecommerce', 'shop'],
  },
  {
    id: 'ai-assistant',
    label: 'AI Assistant',
    group: 'growth',
    screenType: 'analytics',
    adminLabel: 'Sally AI',
    metaTitle: 'AI Business Assistant Demo | Grabio Sally',
    metaDescription:
      'Preview Grabio AI assistant — ops questions, reports, and workflow help. Sign in to chat with Sally on your data.',
    heroTitle: 'AI that knows your store',
    heroDescription:
      'Ask about sales, stock, and tasks — grounded in your live business data when signed in.',
    keywords: ['AI business assistant demo', 'ERP AI preview', 'Grabio Sally'],
    verticals: ['shop', 'restaurant', 'ecommerce'],
  },
];

export const DEMO_OS_MODULES: Record<DemoOsModuleId, DemoOsModule> = Object.fromEntries(
  MODULES.map((m) => [m.id, m]),
) as Record<DemoOsModuleId, DemoOsModule>;

export const DEMO_OS_MODULE_LIST = MODULES;

export function getDemoOsModule(id: string | undefined): DemoOsModule | undefined {
  if (!id) return undefined;
  return DEMO_OS_MODULES[id as DemoOsModuleId];
}

export function demoOsModulePath(moduleId: DemoOsModuleId): string {
  return `/demo-os/${moduleId}`;
}

export function demoOsIndexPath(): string {
  return '/demo-os';
}

export function verticalDemoOsPath(slug: MarketingPackageSlug, moduleId: DemoOsModuleId): string {
  return `/demo/${slug}/os/${moduleId}`;
}

export function listDemoOsSitemapUrls(): string[] {
  const base = 'https://grabio.space';
  return [demoOsIndexPath(), ...MODULES.map((m) => demoOsModulePath(m.id))].map((p) => `${base}${p}`);
}

export function modulesForVertical(slug: MarketingPackageSlug): DemoOsModule[] {
  return MODULES.filter((m) => m.verticals.includes(slug));
}

export function modulesByGroup(): { group: DemoOsGroupId; meta: typeof DEMO_OS_GROUPS[DemoOsGroupId]; modules: DemoOsModule[] }[] {
  return (Object.keys(DEMO_OS_GROUPS) as DemoOsGroupId[]).map((group) => ({
    group,
    meta: DEMO_OS_GROUPS[group],
    modules: MODULES.filter((m) => m.group === group),
  }));
}
