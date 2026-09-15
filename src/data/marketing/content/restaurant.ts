import type { MarketingPackageContent } from '../packageTypes';

export const RESTAURANT_PACKAGE: MarketingPackageContent = {
  slug: 'restaurant',
  label: 'Restaurant',
  shortLabel: 'Full-service dining',
  cardDescription: 'Table service, kitchen flow, recipes, and delivery — front and back of house aligned.',
  tagline: 'Dining operations in one flow',
  presetKey: 'pkg_live_kitchen',
  demoStoreSlug: 'grabio-demo-restaurant',
  comparisonPageSlug: 'grabio-vs-touchbistro-restaurant',
  metaTitle: 'Restaurant POS & Food Cost Software | Grabio',
  metaDescription:
    'Full-service restaurant POS with table service, kitchen tickets, live recipe costing, and delivery on one platform. Dine-in and aggregator orders share stock — try the demo.',
  heroTitle: 'Floor, kitchen, and books on one platform — food cost that moves when your menu does',
  heroDescription:
    'Run table service, course firing, and delivery from one stack. Every plate sold updates ingredient use, margin, and reporting — not a spreadsheet you rebuild each month.',
  keywords: [
    'restaurant POS system',
    'restaurant food cost software',
    'table service POS',
    'kitchen display restaurant software',
    'restaurant management platform',
    'Grabio restaurant',
  ],
  pains: [
    'The floor sends tickets one way, the kitchen tracks another — and neither matches what finance thinks sold at close',
    'Food cost lives in a monthly workbook while menu prices and portions change every week',
    'Aggregator delivery orders sit outside your stock and margin picture, so delivery looks profitable until ingredients tell the truth',
  ],
  outcomes: [
    'Table orders flow floor → kitchen → payment on one platform, with open tabs, splits, and courses in the same service flow',
    'Recipe-linked costing refreshes when you change menu items, prices, or yields — margin reflects the menu you run today',
    'Dine-in, takeaway, and delivery share ingredient depletion and reporting so channel mix is visible, not guessed',
  ],
  dayInLife: [
    {
      period: 'Before doors',
      title: 'Prep from live par levels',
      description:
        'Review yesterday’s usage, adjust prep lists, and receive supplier deliveries against purchase orders — prep quantity follows what the menu actually consumes.',
    },
    {
      period: 'During service',
      title: 'Tables, courses, and kitchen',
      description:
        'Seat guests, fire courses to the kitchen, manage open tabs and split checks while delivery tickets land in the same operational queue — no parallel system for off-premise orders.',
    },
    {
      period: 'After close',
      title: 'Margin you can defend',
      description:
        'Item mix, voids, and ingredient movement roll into reports you can use for the next menu change — not a reconciliation job that waits until month-end.',
    },
  ],
  moduleIds: ['pos', 'restaurant', 'stock', 'delivery', 'marketplace', 'analytics'],
  moduleLabelOverrides: { restaurant: 'Recipe Costing' },
  moduleStripTitle: 'What a restaurant runs on',
  faqs: [
    {
      question: 'Does Grabio support table service, courses, and split checks?',
      answer:
        'Yes. Full-service dining workflows — open tables, course firing, splits, and payments — run on the same platform as kitchen tickets and inventory. This is built for sit-down service, not counter-only throughput.',
    },
    {
      question: 'Can we run delivery and aggregators alongside dine-in?',
      answer:
        'Yes. Delivery and online orders enter the same operational queue as floor service, with shared ingredient depletion and reporting — so delivery margin is visible alongside dine-in, not tracked in a separate silo.',
    },
    {
      question: 'How does recipe and food costing work?',
      answer:
        'Menu items link to recipes and raw materials. When a dish sells, ingredient use deducts from stock and costing reflects current purchase prices — so when you change a portion, supplier price, or menu price, margin updates with the menu you run.',
    },
    {
      question: 'What happens if the internet drops during service?',
      answer:
        'The Windows point-of-sale app is built offline-first: register sales and table payments can continue during a brief outage and sync when connectivity returns. Browser-based floor and kitchen screens need an active connection. New delivery or online orders require internet to arrive; open table tabs already on the register are not lost during a short drop.',
    },
    {
      question: 'Does Grabio support multi-location restaurants?',
      answer:
        'Yes. Multi-location stock visibility, shared catalog, and consolidated reporting sit under one account — with additional registers and locations as you grow.',
    },
    {
      question: 'Are there specific hardware requirements?',
      answer:
        'Grabio is software-first. The Windows POS runs on your existing PC; admin and mobile work on standard devices and browsers. You choose printers and scanners that fit your floor plan — no proprietary terminal bundle required.',
    },
    {
      question: 'Who built Grabio?',
      answer:
        'Grabio is developed by emoove, an engineering company operating since 2013. The platform is built for operators who want serious hospitality and back-office tools without enterprise implementation timelines.',
    },
  ],
};
