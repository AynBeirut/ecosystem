import type { MarketingPackageContent } from '../packageTypes';

export const CAFE_PACKAGE: MarketingPackageContent = {
  slug: 'cafe',
  label: 'Café',
  shortLabel: 'Coffee & quick service',
  cardDescription: 'Fast counter service, recipes, and stock — built for high-turnover menus.',
  tagline: 'Counter speed with back-office control',
  presetKey: 'pkg_mini_shop',
  demoStoreSlug: 'grabio-demo-cafe',
  metaTitle: 'Café POS Software for Coffee Shops | Grabio',
  metaDescription:
    'Quick-service café POS with recipe-linked inventory, modifiers, and pickup orders in one queue. Run counter and online from one platform — try the interactive demo.',
  heroTitle: 'Keep the line moving and the stock honest',
  heroDescription:
    'Ring up drinks and bites fast while ingredients deduct from recipes. Pickup orders and walk-ins share one kitchen view.',
  keywords: ['cafe POS software', 'coffee shop inventory', 'quick service POS', 'Grabio cafe'],
  pains: [
    'Ingredient waste is invisible until margin disappears',
    'Pickup and delivery orders live in a separate app from the register',
    'Menu changes do not update costing or stock rules',
  ],
  outcomes: [
    'Recipe-linked depletion when items sell',
    'Unified queue for counter, pickup, and delivery',
    'Menu and modifier updates reflected across POS and online',
  ],
  dayInLife: [
    {
      period: 'Open',
      title: 'Prep and par levels',
      description: 'Check milk, beans, and pastry par levels. Receive supplier delivery against purchase orders.',
    },
    {
      period: 'Rush',
      title: 'Fast checkout',
      description: 'Modifiers and combos on POS. Online pickup tickets appear in the same order flow.',
    },
    {
      period: 'Close',
      title: 'Know what moved',
      description: 'Item-level sales and ingredient usage feed reports without manual tally sheets.',
    },
  ],
  moduleIds: ['pos', 'stock', 'restaurant', 'marketplace', 'payments', 'delivery'],
  moduleLabelOverrides: { restaurant: 'Recipes & Kitchen' },
  moduleStripTitle: 'What a café runs on',
  faqs: [
    {
      question: 'Does Grabio support modifiers and combo items?',
      answer:
        'Yes. Point of sale supports modifiers, sizes, and structured menus — each sale ties back to stock depletion and reporting.',
    },
    {
      question: 'Can customers order online for pickup?',
      answer:
        'Yes. Your online storefront and pickup orders feed the same queue your counter team sees — no separate tablet app for web tickets.',
    },
    {
      question: 'What happens if the internet drops during a rush?',
      answer:
        'The Windows point-of-sale app is built offline-first: counter sales continue during a brief outage and sync to your store when connectivity returns. Browser-based admin checkout needs an active connection. New online pickup orders require internet to arrive; tickets already on the register are not blocked by a short drop.',
    },
    {
      question: 'Does Grabio support multi-location cafés?',
      answer:
        'Yes. Grabio supports multi-location stock visibility and additional registers as you grow — shared catalog, reporting, and customer records under one account.',
    },
    {
      question: 'Are there specific hardware requirements?',
      answer:
        'Grabio is software-first. The Windows POS runs on your existing PC; admin and mobile work on standard devices and browsers. You choose your own receipt printer and barcode scanner — no proprietary terminal bundle required.',
    },
    {
      question: 'Is this only for large chains?',
      answer:
        'No. Grabio fits independent cafés and growing groups alike — start with counter, recipes, and stock, then add locations or channels when you need them.',
    },
    {
      question: 'Who built Grabio?',
      answer:
        'Grabio is developed by emoove, an engineering company operating since 2013. The platform is built for operators who want serious tools without enterprise implementation timelines.',
    },
  ],
};
