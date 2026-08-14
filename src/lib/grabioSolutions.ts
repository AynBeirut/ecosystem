import { MODULE_FEATURE_ITEMS } from '@/lib/publicModulesContent';

export type GrabioSolution = {
  slug: string;
  title: string;
  shortTitle: string;
  metaDescription: string;
  heroTitle: string;
  heroDescription: string;
  keywords: string[];
  moduleIds: string[];
  highlights: string[];
  faqs: { question: string; answer: string }[];
};

const SOLUTION_SUBNAV = [
  { label: 'All solutions', href: '/solutions' },
  { label: 'Inventory', href: '/solutions/inventory' },
  { label: 'Accounting', href: '/solutions/accounting' },
  { label: 'POS', href: '/solutions/pos' },
  { label: 'Mobile apps', href: '/solutions/mobile-apps' },
  { label: 'CRM & PSA', href: '/solutions/crm-psa' },
  { label: 'Restaurant', href: '/solutions/restaurant' },
  { label: 'Manufacturing', href: '/solutions/manufacturing' },
  { label: 'AI tools', href: '/solutions/ai' },
  { label: 'Platform', href: '/solutions/platform' },
] as const;

export { SOLUTION_SUBNAV };

export const GRABIO_SOLUTIONS: GrabioSolution[] = [
  {
    slug: 'inventory',
    title: 'Inventory & Stock Management Software',
    shortTitle: 'Inventory',
    metaDescription:
      'Grabio inventory software — real-time stock, purchase orders, suppliers, weighted-average costing, expiry alerts, and multi-location visibility for retail and wholesale.',
    heroTitle: 'Inventory that stays accurate across every sale',
    heroDescription:
      'Track stock, suppliers, purchases, and returns in one web admin — synced with marketplace orders, POS, and the Grabio Admin Android app.',
    keywords: [
      'inventory management software',
      'stock control Lebanon',
      'purchase order software',
      'warehouse management SMB',
      'Grabio inventory',
    ],
    moduleIds: ['stock', 'marketplace', 'invoicing'],
    highlights: [
      'Real-time stock levels across web, POS, and mobile admin',
      'Purchase orders, supplier statements, and returns',
      'Low-stock and expiry alerts with push notifications',
      'Weighted-average costing and inventory valuation reports',
    ],
    faqs: [
      {
        question: 'What is Grabio inventory management?',
        answer:
          'Grabio inventory management is a cloud module inside the Grabio platform that tracks stock levels, purchase orders, suppliers, returns, and costing in real time — synced with your storefront, POS, and mobile admin app.',
      },
      {
        question: 'Does Grabio support multi-location inventory?',
        answer:
          'Yes. Grabio provides multi-location stock visibility in the web admin, with low-stock alerts and purchase workflows tied to suppliers and account statements.',
      },
      {
        question: 'Can inventory sync with online orders?',
        answer:
          'Yes. Marketplace orders, POS sales, and manual adjustments all update the same stock ledger so web and in-store channels stay aligned.',
      },
    ],
  },
  {
    slug: 'accounting',
    title: 'Accounting & General Ledger Software',
    shortTitle: 'Accounting',
    metaDescription:
      'Grabio accounting — general ledger, journal vouchers, chart of accounts, AP/AR aging, bank reconciliation, trial balance, and Lebanese PCG support for SMB finance teams.',
    heroTitle: 'General ledger accounting built into your operations',
    heroDescription:
      'Post from invoices, purchases, and payments into GL — with vouchers, trial balance, aged payables/receivables, and bank reconciliation in one finance suite.',
    keywords: [
      'general ledger software',
      'accounting software Lebanon',
      'Lebanese PCG accounting',
      'SMB finance software',
      'Grabio accounting',
    ],
    moduleIds: ['payments', 'analytics', 'invoicing'],
    highlights: [
      'Chart of accounts with bilingual labels (EN/AR)',
      'Journal vouchers and automated posting from operations',
      'Aged payables, aged receivables, and trial balance',
      'Bank reconciliation and account statements',
      'Lebanese PCG chart support for local compliance',
    ],
    faqs: [
      {
        question: 'Does Grabio have general ledger accounting?',
        answer:
          'Yes. Grabio includes a finance and accounting suite with chart of accounts, journal vouchers, general ledger posting, trial balance, aged payables/receivables, and bank reconciliation — integrated with invoicing and purchases.',
      },
      {
        question: 'Does Grabio support Lebanese accounting (PCG)?',
        answer:
          'Yes. Grabio supports Lebanese PCG chart of accounts templates and bilingual account labels for operators who need local compliance alongside operational workflows.',
      },
      {
        question: 'Are accounting entries automated from invoices and purchases?',
        answer:
          'Yes. Operational documents such as invoices, purchase receives, and payments can post to the general ledger through Grabio’s finance bridge — reducing double entry for store owners.',
      },
    ],
  },
  {
    slug: 'pos',
    title: 'Windows POS & Point of Sale Software',
    shortTitle: 'POS',
    metaDescription:
      'Grabio POS for Windows — barcode scanning, offline mode, dual currency, digital receipts, and real-time sync with inventory and accounting on grabio.space.',
    heroTitle: 'Windows POS that syncs with your back office',
    heroDescription:
      'Run checkout on Windows with barcode scan, multi-payment tenders, and offline resilience — every sale updates inventory and finance in Grabio.',
    keywords: [
      'Windows POS software',
      'point of sale Lebanon',
      'retail POS sync inventory',
      'Grabio POS',
    ],
    moduleIds: ['pos', 'stock', 'invoicing'],
    highlights: MODULE_FEATURE_ITEMS.pos ?? [],
    faqs: [
      {
        question: 'Does Grabio have a Windows POS app?',
        answer:
          'Yes. Grabio POS is a Windows point-of-sale application that syncs with your Grabio store — supporting barcode scanning, offline mode, dual-currency display, and digital receipts.',
      },
      {
        question: 'Does Grabio POS sync inventory automatically?',
        answer:
          'Yes. Each POS sale updates stock levels in the Grabio web admin and connected channels so inventory stays accurate without manual exports.',
      },
    ],
  },
  {
    slug: 'mobile-apps',
    title: 'Mobile Apps — Admin, Invoice Manager & Client Apps',
    shortTitle: 'Mobile apps',
    metaDescription:
      'Grabio mobile apps — Android admin dashboard on Google Play, Invoice Manager app for billing, and white-label customer commerce apps per store.',
    heroTitle: 'Three mobile apps for owners, billers, and your customers',
    heroDescription:
      'Grabio Admin on Google Play for operators, Invoice Manager for standalone billing, and branded client apps so your buyers never see the Grabio marketplace.',
    keywords: [
      'business admin app Android',
      'invoice manager mobile app',
      'white label store app',
      'Grabio mobile app',
    ],
    moduleIds: ['admin_mobile', 'invoice_manager', 'whitelabel'],
    highlights: [
      'Grabio Admin App — orders, inventory, purchases, CRM on Android',
      'Invoice Manager — standalone mobile billing decoupled from full admin',
      'White-label client app — branded storefront app for your customers only',
      'Same Firebase account syncs web and mobile in real time',
    ],
    faqs: [
      {
        question: 'Is there a Grabio admin mobile app?',
        answer:
          'Yes. Grabio Admin is an Android app on Google Play that lets store owners manage orders, products, inventory, purchases, and CRM from mobile — using the same account as the web dashboard.',
      },
      {
        question: 'What is the Grabio Invoice Manager app?',
        answer:
          'Invoice Manager is a standalone Grabio mobile billing app for creating and sending invoices without opening the full admin dashboard — ideal for freelancers and light billing workflows.',
      },
      {
        question: 'Can I get a branded mobile app for my customers?',
        answer:
          'Yes. Grabio offers white-label customer commerce apps — your brand, your domain, your catalog only — built on Expo/React Native and deployable per store to Play Store and App Store.',
      },
    ],
  },
  {
    slug: 'crm-psa',
    title: 'Sales CRM & PSA Project Software',
    shortTitle: 'CRM & PSA',
    metaDescription:
      'Grabio Sales CRM and PSA — pipeline kanban, field rep visits, client projects, proposals, and client portals for agencies and B2B teams.',
    heroTitle: 'CRM for field sales and PSA for client delivery',
    heroDescription:
      'Track deals, log visits with GPS, run client projects with contracts, and generate proposals — inside the same Grabio account as invoicing and inventory.',
    keywords: [
      'sales CRM software',
      'PSA project management',
      'field sales app Lebanon',
      'Grabio CRM',
    ],
    moduleIds: ['crm', 'projects', 'proposal_writer'],
    highlights: [
      'Pipeline kanban, deal stages, and rep activity feed',
      'Mobile rep portal with visit and call logging',
      'PSA projects with monthly/yearly contracts',
      'AI Proposal Writer for agency SOW drafts',
    ],
    faqs: [
      {
        question: 'Does Grabio include a Sales CRM?',
        answer:
          'Yes. Grabio Sales CRM includes pipeline management, deal stages, field rep visit logging with GPS, a mobile rep portal, and performance reporting — available as an add-on on paid plans.',
      },
      {
        question: 'Does Grabio have PSA project management?',
        answer:
          'Yes. Grabio Projects (PSA) supports client project spaces, recurring contracts, client portal reporting, and integrates with invoicing and the AI Proposal Writer.',
      },
    ],
  },
  {
    slug: 'restaurant',
    title: 'Restaurant & Kitchen Production Software',
    shortTitle: 'Restaurant',
    metaDescription:
      'Grabio restaurant software — live recipe deduction on sale, ingredient consumption at checkout, kitchen inventory, and delivery workflow for cafes and cloud kitchens.',
    heroTitle: 'Restaurant operations without a separate manufacturing step',
    heroDescription:
      'Recipes deduct ingredients automatically when you sell — built for cafes, restaurants, and cloud kitchens using Grabio marketplace and delivery modules.',
    keywords: [
      'restaurant inventory software',
      'recipe costing POS',
      'cloud kitchen software',
      'Grabio restaurant',
    ],
    moduleIds: ['restaurant', 'delivery', 'stock'],
    highlights: MODULE_FEATURE_ITEMS.restaurant ?? [],
    faqs: [
      {
        question: 'How does Grabio handle restaurant inventory?',
        answer:
          'Grabio Restaurant Production deducts recipe ingredients automatically at the point of sale — so ingredient consumption is tracked without a separate manufacturing batch step.',
      },
      {
        question: 'Is Grabio suitable for cloud kitchens?',
        answer:
          'Yes. Cloud kitchens use Grabio for marketplace ordering, delivery workflow with GPS, kitchen ingredient deduction, and supplier purchase management in one platform.',
      },
    ],
  },
  {
    slug: 'manufacturing',
    title: 'Manufacturing & Factory Production Software',
    shortTitle: 'Manufacturing',
    metaDescription:
      'Grabio manufacturing — bill of materials (BOM), production runs, raw materials, finished goods, and batch tracking for light factories and food producers.',
    heroTitle: 'BOM, batches, and finished goods in one factory module',
    heroDescription:
      'Plan production from raw materials through finished goods with BOMs, batch runs, and cost visibility — alongside inventory and accounting on Grabio.',
    keywords: [
      'manufacturing software SMB',
      'BOM production tracking',
      'factory inventory software',
      'Grabio manufacturing',
    ],
    moduleIds: ['factory', 'stock', 'analytics'],
    highlights: MODULE_FEATURE_ITEMS.factory ?? [],
    faqs: [
      {
        question: 'Does Grabio support manufacturing and BOM?',
        answer:
          'Yes. Grabio Factory & Production includes bill of materials (BOM), production runs, batch tracking, raw-to-finished goods flow, and manufacturing cost visibility.',
      },
      {
        question: 'Who should use Grabio manufacturing vs restaurant module?',
        answer:
          'Use Factory & Production for batch manufacturing with explicit production runs and finished goods. Use Restaurant Production for live recipe deduction at checkout without a separate manufacturing phase.',
      },
    ],
  },
  {
    slug: 'ai',
    title: 'AI Workflow Agent & Growth Tools',
    shortTitle: 'AI tools',
    metaDescription:
      'Grabio AI — in-dashboard workflow agent, content creator, campaign writer, SEO assistant, business insights, and proposal writer for store operators.',
    heroTitle: 'AI tools inside your dashboard — not another subscription',
    heroDescription:
      'Ask the AI agent about your store, draft product copy and campaigns, get SEO suggestions, and generate client proposals — tied to your live Grabio data.',
    keywords: [
      'AI business assistant',
      'AI inventory software',
      'Grabio AI agent',
    ],
    moduleIds: ['ai_agent', 'content_creator', 'seo_assistant', 'analytics_insights'],
    highlights: [
      'AI Workflow Agent — floating assistant with store context',
      'Content Creator — product descriptions, social, blog drafts',
      'SEO Assistant — meta titles, FAQ schema suggestions',
      'Business Insights — plain-language recommendations from your data',
    ],
    faqs: [
      {
        question: 'Does Grabio have an AI assistant?',
        answer:
          'Yes. Grabio includes an in-dashboard AI Workflow Agent that answers store questions, guides daily tasks, and connects to prepaid AI credits — alongside Content Creator, SEO Assistant, and Business Insights modules.',
      },
      {
        question: 'Can Grabio AI help with SEO?',
        answer:
          'Yes. The Grabio SEO Assistant suggests meta titles, descriptions, and FAQ schema for store pages — complementing the platform’s built-in SEOHead and analytics tooling.',
      },
    ],
  },
  {
    slug: 'platform',
    title: 'Grabio Platform — WordPress, Shopify-style & Classic Builder',
    shortTitle: 'Platform',
    metaDescription:
      'Grabio platform builders — WordPress embed inside Grabio, Shopify-style modular storefront, and classic template builder for store branding and CMS.',
    heroTitle: 'Choose how you publish — WP embed, modular shop, or classic templates',
    heroDescription:
      'Software-first operators still need a storefront. Grabio offers WordPress embedding, a Shopify-like modular shop, and classic drag-and-drop templates — secondary to inventory, finance, and POS.',
    keywords: [
      'Shopify alternative MENA',
      'WordPress embed ecommerce',
      'modular business platform',
      'Grabio builder',
    ],
    moduleIds: ['builder', 'ai_builder', 'blog_publisher', 'shopify_importer'],
    highlights: [
      'WordPress pages embedded inside Grabio admin workflows',
      'Shopify-style modular storefront with catalog and checkout',
      'Classic template builder for colors, sections, and branding',
      'Blog Publisher for per-store SEO content',
      'Shopify Importer (roadmap) for migration from Shopify CSV/API',
    ],
    faqs: [
      {
        question: 'Is Grabio a Shopify alternative?',
        answer:
          'Grabio is a modular business platform — inventory, accounting, POS, CRM, and manufacturing are the core. It includes Shopify-like storefront and checkout capabilities, but is designed for operators who need back-office software, not just a theme store.',
      },
      {
        question: 'Can I embed WordPress in Grabio?',
        answer:
          'Yes. Grabio supports WordPress embedding so operators can manage CMS content alongside operational modules like inventory and finance from one account.',
      },
      {
        question: 'What builder options does Grabio offer?',
        answer:
          'Grabio offers three paths: classic drag-and-drop store templates, a modular Shopify-style shop, and WordPress embed — plus AI Builder and Blog Publisher for content.',
      },
    ],
  },
];

export const GRABIO_SOLUTION_BY_SLUG = Object.fromEntries(
  GRABIO_SOLUTIONS.map((s) => [s.slug, s]),
) as Record<string, GrabioSolution>;

export function getSolutionModuleBullets(moduleIds: string[]): string[] {
  const bullets: string[] = [];
  for (const id of moduleIds) {
    const items = MODULE_FEATURE_ITEMS[id];
    if (items?.length) bullets.push(...items.slice(0, 3));
  }
  return [...new Set(bullets)].slice(0, 8);
}
