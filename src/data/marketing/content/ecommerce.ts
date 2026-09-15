import type { MarketingPackageContent } from '../packageTypes';

export const ECOMMERCE_PACKAGE: MarketingPackageContent = {
  slug: 'ecommerce',
  label: 'E-commerce',
  shortLabel: 'Online-first brands',
  cardDescription: 'Storefront, payments, fulfillment, and builder — launch and scale online sales.',
  tagline: 'Launch online. Operate from one place.',
  presetKey: 'pkg_shop',
  demoStoreSlug: 'grabio-demo-ecommerce',
  comparisonPageSlug: 'grabio-vs-shopify-ecommerce',
  metaTitle: 'E-commerce Platform with Inventory & Fulfillment | Grabio',
  metaDescription:
    'Launch a branded online store with catalog, payments, and warehouse fulfillment on one platform. Stock and orders stay in sync from checkout to ship — try the demo.',
  heroTitle: 'Launch your storefront — catalog, payments, and fulfillment on one platform',
  heroDescription:
    'Publish a branded shop, take payments, and run pick-pack-ship from the same admin your catalog lives in — no plugin stack bridging checkout to the warehouse.',
  keywords: [
    'ecommerce platform small business',
    'online store with inventory management',
    'ecommerce fulfillment software',
    'branded online storefront',
    'D2C ecommerce platform',
    'online store builder and inventory',
    'Grabio ecommerce',
  ],
  pains: [
    'Customers checkout on a storefront that still shows items your warehouse already sold out',
    'Orders arrive in one tool, picking happens in another, and shipping updates go out by hand',
    'Every catalog or collection change waits on a developer — the site and the ops layer never move together',
  ],
  outcomes: [
    'Product pages, variants, and collections pull from live warehouse stock — overselling drops before checkout completes',
    'Order-to-ship workflow in one queue: payment confirmed, inventory reserved, pick status, delivery tracking',
    'Customize storefront branding and layout without leaving the platform that runs your catalog and fulfillment',
  ],
  dayInLife: [
    {
      period: 'Launch',
      title: 'Publish the storefront',
      description:
        'Configure your catalog, collections, and branded storefront — payment methods and stock rules apply the moment pages go live.',
    },
    {
      period: 'Orders',
      title: 'Checkout to pick list',
      description:
        'Overnight orders land in a fulfillment queue with customer, payment, and line items attached. Your team picks against warehouse stock — not a CSV export from the storefront.',
    },
    {
      period: 'Ship',
      title: 'Dispatch and close the loop',
      description:
        'Mark orders shipped, notify customers, and watch inventory and revenue update together — ready for the next merchandising push without reconciling two systems.',
    },
  ],
  moduleIds: ['marketplace', 'builder', 'stock', 'payments', 'delivery', 'analytics'],
  moduleLabelOverrides: {
    marketplace: 'Online Storefront',
    builder: 'Storefront Builder',
  },
  moduleStripTitle: 'What an online brand runs on',
  faqs: [
    {
      question: 'Can I use my own custom domain?',
      answer:
        'Yes. Run your storefront on a branded domain with your catalog and checkout — alongside platform-hosted shops if you are staging or testing first.',
    },
    {
      question: 'Which payment methods are supported?',
      answer:
        'Grabio supports online payment flows including card payments via Stripe and local gateways where configured — with order and payment status tied to fulfillment in the same admin.',
    },
    {
      question: 'How does shipping and fulfillment work?',
      answer:
        'Orders move through a fulfillment workflow in admin — pick, pack, ship, and delivery tracking — with inventory deducting as you confirm dispatch. Grabio is software-first: run fulfillment from standard PCs or tablets; barcode scanners optional. Fulfillment and the live storefront require an active connection; brief outages delay status updates until you are back online.',
    },
    {
      question: 'Does the storefront stay in sync with warehouse stock?',
      answer:
        'Yes. Catalog and availability reflect live inventory. When warehouse quantity changes, what customers can buy online updates with it — reducing oversells and manual stock uploads.',
    },
    {
      question: 'Can I customize the look of my store without code?',
      answer:
        'Yes. Storefront builder tools let you adjust branding, layout, and presentation while catalog and checkout stay connected to the same back office.',
    },
    {
      question: 'What if we add physical retail later?',
      answer:
        'Grabio is modular. Online-first brands can add point-of-sale or wholesale invoicing later on the same stock ledger — but you do not need a register to launch and run the storefront today.',
    },
    {
      question: 'Who built Grabio?',
      answer:
        'Grabio is developed by emoove, an engineering company operating since 2013. The platform is built for online brands that want storefront and operations in one place — without enterprise implementation timelines.',
    },
  ],
};
