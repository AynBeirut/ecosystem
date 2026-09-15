import type { MarketingPackageContent } from '../packageTypes';

export const SHOP_PACKAGE: MarketingPackageContent = {
  slug: 'shop',
  label: 'Shop',
  shortLabel: 'Retail & wholesale',
  cardDescription: 'POS, stock, invoices, and online orders — one ledger for counter and web.',
  tagline: 'Retail that stays in sync',
  presetKey: 'pkg_shop',
  demoStoreSlug: 'grabio-demo-shop',
  metaTitle: 'Retail POS & Inventory Software for Shops | Grabio',
  metaDescription:
    'Retail POS and inventory software for shops — counter sales, wholesale invoicing, and online orders on one stock ledger. Try the interactive demo.',
  comparisonPageSlug: 'grabio-vs-square-retail',
  heroTitle: 'Run your shop without juggling spreadsheets',
  heroDescription:
    'Sell in-store and online from one stock count. Every sale updates inventory, invoices, and reports automatically.',
  keywords: [
    'retail POS software',
    'retail ERP software',
    'shop inventory management',
    'POS and inventory system',
    'integrated retail operations software',
    'wholesale invoicing software',
    'Grabio shop',
  ],
  pains: [
    'Stock counts drift between the counter and online channel',
    'Invoices are recreated manually after every sale',
    'Reports need exports from three different tools',
  ],
  outcomes: [
    'One stock ledger for POS, marketplace, and admin',
    'Invoices and receipts generated from live orders',
    'Dashboards that reflect today’s sales, not last week’s export',
  ],
  dayInLife: [
    {
      period: 'Morning',
      title: 'Open with accurate stock',
      description: 'Review low-stock alerts, receive a purchase delivery, and print shelf labels — all from admin.',
    },
    {
      period: 'Afternoon',
      title: 'Serve walk-ins and web orders',
      description: 'POS checkout and marketplace orders deduct the same SKUs. No end-of-day reconciliation spreadsheet.',
    },
    {
      period: 'Evening',
      title: 'Close with clear numbers',
      description: 'Daily sales, payment totals, and inventory valuation update as transactions post.',
    },
  ],
  moduleIds: ['pos', 'stock', 'invoicing', 'marketplace', 'payments', 'analytics'],
  moduleStripTitle: 'What a shop runs on',
  faqs: [
    {
      question: 'Can Grabio handle both retail and wholesale?',
      answer:
        'Yes. Grabio supports counter POS, B2B invoicing, and an online storefront on shared inventory and customer records.',
    },
    {
      question: 'Does online checkout affect in-store stock?',
      answer:
        'Yes. Marketplace and POS share one stock ledger, so web orders reserve or deduct the same quantities your team sees in admin.',
    },
    {
      question: 'Can I start with shop essentials and add modules later?',
      answer:
        'Yes. Grabio is modular — activate POS, CRM, delivery, or AI tools when your operation needs them without migrating data.',
    },
  ],
};
