import type { MarketingPackageContent } from '../packageTypes';

export const MANUFACTURING_PACKAGE: MarketingPackageContent = {
  slug: 'manufacturing',
  label: 'Manufacturing',
  shortLabel: 'Make & distribute',
  cardDescription: 'BOMs, production runs, raw materials, and sales — shop floor to shipment.',
  tagline: 'Production tied to sales and stock',
  presetKey: 'pkg_factory_flow',
  demoStoreSlug: 'grabio-demo-manufacturing',
  comparisonPageSlug: 'grabio-vs-katana-manufacturing',
  metaTitle: 'Manufacturing Software with BOM & Production Tracking | Grabio',
  metaDescription:
    'Small-business manufacturing software — sales orders trigger production runs, bills of materials consume raw materials automatically, and finished goods ship from live stock. Try the demo.',
  heroTitle: 'Sales orders trigger production — raw materials deduct, finished goods ship from live stock',
  heroDescription:
    'Move from make-to-order guesswork to a connected flow: demand schedules runs, BOMs consume materials on completion, and shipping picks against stock you trust.',
  keywords: [
    'manufacturing software small business',
    'bill of materials software',
    'production inventory management',
    'make to order software',
    'manufacturing ERP SMB',
    'production planning software',
    'Grabio manufacturing',
  ],
  pains: [
    'Production is planned from last month’s spreadsheet while this week’s orders already changed',
    'A run starts, then raw material shortages halt the line — nobody saw the gap until the floor did',
    'Shipping picks finished goods that finance’s inventory says are not there, and nobody agrees which number is right',
  ],
  outcomes: [
    'Open sales orders inform what to make next — production is tied to demand, not a detached schedule',
    'Each completed run consumes raw materials per bill of materials and adds finished goods to live stock automatically',
    'Pick, invoice, and deliver from the same ledger your planners and shop floor see in admin',
  ],
  dayInLife: [
    {
      period: 'Morning',
      title: 'Demand drives the schedule',
      description:
        'Review open customer orders, check raw material availability, and schedule production runs for what you actually need to ship — not what a static plan assumed yesterday.',
    },
    {
      period: 'On the floor',
      title: 'Run, consume, complete',
      description:
        'Execute production runs on tablet or PC. Post completions and raw materials deduct per BOM while finished goods increment — no manual spreadsheet to reconcile materials after the shift.',
    },
    {
      period: 'Dispatch',
      title: 'Ship what the ledger shows',
      description:
        'Pick against live finished-goods stock, generate invoices, and hand off to delivery — shipping quantities match what production posted, not a warehouse count taken on faith.',
    },
  ],
  moduleIds: ['factory', 'stock', 'invoicing', 'marketplace', 'analytics', 'delivery'],
  moduleLabelOverrides: { factory: 'Production & BOMs' },
  moduleStripTitle: 'What manufacturing runs on',
  faqs: [
    {
      question: 'Does Grabio support bills of materials and production runs?',
      answer:
        'Yes. Define bills of materials for finished products, schedule production runs, and post completions — raw materials deduct and finished goods increase automatically based on the BOM you set.',
    },
    {
      question: 'Can sales orders trigger what we make?',
      answer:
        'Yes. Open orders and demand inform production planning — you schedule runs against real customer need and available raw materials, not a plan disconnected from sales.',
    },
    {
      question: 'Can we sell finished goods wholesale and online from the same stock?',
      answer:
        'Yes. Invoicing, wholesale accounts, and an online storefront share finished-goods inventory with production output — what you make is what you can sell and ship.',
    },
    {
      question: 'What happens if the internet drops during a production run?',
      answer:
        'Production planning and run completion happen in the web admin and need an active connection. Physical work on the floor can continue offline; post or complete the run once you are back online so raw materials and finished goods stay accurate. If you also sell finished goods at a counter via the Windows POS, those sales follow offline-first rules and sync when reconnected.',
    },
    {
      question: 'Does Grabio support multi-location production or warehouses?',
      answer:
        'Yes. Multi-location stock visibility lets you track raw and finished goods across sites under one account — with consolidated reporting as you add warehouses or production points.',
    },
    {
      question: 'What hardware do we need on the shop floor?',
      answer:
        'Grabio is software-first. Production runs post from standard PCs, laptops, or tablets with a browser — plus barcode scanners if you use them. No proprietary shop-floor terminal or MES hardware bundle required.',
    },
    {
      question: 'Who built Grabio?',
      answer:
        'Grabio is developed by emoove, an engineering company operating since 2013. The platform is built for small and mid-size manufacturers who need production, inventory, and sales aligned without enterprise ERP timelines.',
    },
  ],
};
