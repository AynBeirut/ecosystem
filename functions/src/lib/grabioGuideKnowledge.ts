import { MODULE_PRICES, ADDON_PRICING } from './modularPricing';
import { MODULAR_SEAT_PRICING, PACKAGE_PRESETS } from './moduleManifest';
import { buildSallyPlaybookBlock } from './sallyGuidePlaybook';
import { pickStoreNameFromRecord } from './sallyHumanHandoff';

/** Admin nav structure — keep in sync with useAdminNavigation.ts groups. */
export const ADMIN_STRUCTURE = {
  dailyOperations: {
    label: 'Daily Operations',
    items: [
      { route: '/admin/inventory', label: 'Inventory Overview', moduleId: 'stock' },
      { route: '/admin/products', label: 'Products', moduleId: 'stock' },
      { route: '/admin/purchases', label: 'Purchases', moduleId: 'stock' },
      { route: '/admin/delivery', label: 'Delivery', moduleId: 'delivery' },
    ],
  },
  salesCustomers: {
    label: 'Sales & Customers',
    items: [
      { route: '/admin/orders', label: 'Orders', moduleId: 'invoicing' },
      { route: '/admin/scheduled-orders', label: 'Scheduled Orders', moduleId: 'invoicing' },
      { route: '/admin/pos', label: 'Grabio POS', moduleId: 'pos' },
      { route: '/admin/customers', label: 'Customers', moduleId: 'invoicing' },
      { route: '/admin/crm', label: 'Sales CRM', moduleId: 'crm' },
      { route: '/admin/payments', label: 'Payments', moduleId: 'payments' },
      { route: '/admin/analytics', label: 'Analytics', moduleId: 'analytics' },
    ],
  },
  setupSettings: {
    label: 'Setup & Settings',
    items: [
      { route: '/admin/profile', label: 'Store Profile', moduleId: null },
      { route: '/admin/payments', label: 'Payment Settings', moduleId: 'payments' },
      { route: '/admin/announcements', label: 'Announcements', moduleId: 'marketplace' },
      { route: '/admin/marketing', label: 'Email Marketing', moduleId: 'email_marketing' },
      { route: '/subscription', label: 'Subscription', moduleId: null },
    ],
  },
  templateSection: {
    label: 'Template (storefront — all AI-powered)',
    items: [
      { route: '/admin/templates', label: 'Classic Template', moduleId: 'builder' },
      { route: '/admin/theme-editor', label: 'Shopify-style Theme Editor', moduleId: 'builder' },
      { route: '/admin/builder', label: 'WordPress', moduleId: 'builder' },
    ],
  },
  businessTools: {
    label: 'Business Tools',
    items: [
      { route: '/admin/finance/accounting', label: 'Finance Suite / Business Finance', moduleId: 'invoice_manager' },
      { route: '/admin/invoice-manager/invoices', label: 'Invoice Manager', moduleId: 'invoice_manager' },
      { route: '/admin/account-statement', label: 'Account Statement', moduleId: 'analytics' },
      { route: '/admin/cash-collection', label: 'Cash Collection', moduleId: 'payments' },
      { route: '/admin/staff', label: 'Staff (Payroll)', moduleId: 'team' },
      { route: '/admin/sub-accounts', label: 'Sub-Accounts', moduleId: 'team' },
      { route: '/admin/marketplace', label: 'Marketplace Sync', moduleId: 'dropship' },
      { route: '/admin/ai-agent', label: 'AI Agent', moduleId: 'ai_agent' },
      { route: '/admin/ai-builder', label: 'AI Builder', moduleId: 'ai_builder' },
    ],
  },
  aiTools: {
    label: 'AI Tools (when enabled)',
    items: [
      { route: '/admin/ai/content-creator', label: 'Content Creator', moduleId: 'content_creator' },
      { route: '/admin/ai/market-strategy', label: 'Market Strategy', moduleId: 'market_strategy' },
      { route: '/admin/ai/proposal-writer', label: 'Proposal Writer', moduleId: 'proposal_writer' },
      { route: '/admin/ai/seo-assistant', label: 'SEO Assistant', moduleId: 'seo_assistant' },
      { route: '/admin/ai/business-insights', label: 'Business Insights', moduleId: 'analytics_insights' },
      { route: '/admin/ai/campaign-writer', label: 'Campaign Writer', moduleId: 'campaign_writer' },
    ],
  },
} as const;

const MODULE_SUMMARIES: Record<string, { name: string; summary: string; status: string }> = {
  invoicing: { name: 'Invoicing & Billing', summary: 'Invoices, PDF/WhatsApp delivery, dual currency', status: 'live' },
  marketplace: { name: 'Online Marketplace', summary: 'Storefront, catalog, orders, custom domain', status: 'live' },
  analytics: { name: 'Analytics & Reports', summary: 'Revenue, inventory turnover, statements', status: 'live' },
  payments: { name: 'Payments & Finance', summary: 'OMT, Stripe, expenses, P&L', status: 'live' },
  delivery: { name: 'Delivery & Fulfillment', summary: 'Delivery workflow, GPS, push alerts', status: 'live' },
  stock: { name: 'Inventory & Stock', summary: 'Real-time stock, expiry alerts, suppliers', status: 'live' },
  factory: { name: 'Factory & Production', summary: 'BOM, production runs, batch manufacturing', status: 'live' },
  restaurant: { name: 'Restaurant Production', summary: 'Live recipe deduction on sale', status: 'beta' },
  crm: { name: 'Sales CRM', summary: 'Pipeline, field reps, visit logging', status: 'live' },
  team: { name: 'Team & Sub-Accounts', summary: 'Staff roles and permissions', status: 'live' },
  dropship: { name: 'Dropship Sync', summary: 'Supplier links and stock sync', status: 'live' },
  services: { name: 'Service Subscriptions', summary: 'Monthly/yearly service billing', status: 'beta' },
  projects: { name: 'Projects (PSA)', summary: 'Agency projects and client portals', status: 'live' },
  builder: { name: 'Web Builder', summary: 'Classic templates + AI Builder (preferred); Theme Editor & WP available for migration', status: 'live' },
  ai_builder: { name: 'AI Builder', summary: 'AI assists all builder paths; usable without picking a template', status: 'live' },
  blog_publisher: { name: 'Blog Publisher', summary: 'Articles on your store page', status: 'live' },
  shopify_importer: { name: 'Shopify Importer', summary: 'Import Shopify catalog/orders; Shopify plugin sync', status: 'live' },
  admin_mobile: { name: 'Grabio Admin App', summary: 'Android owner dashboard on Google Play', status: 'live' },
  pos: { name: 'Grabio POS', summary: 'Windows POS — download, install, sync', status: 'live' },
  invoice_manager: { name: 'Invoice Manager App', summary: 'Mobile billing and finance suite', status: 'live' },
  whitelabel: { name: 'White-Label Store App', summary: 'Branded customer commerce app', status: 'live' },
  ai_agent: { name: 'AI Workflow Agent', summary: 'In-dashboard Grabio assistant', status: 'beta' },
  content_creator: { name: 'Content Creator', summary: 'Product copy, social, blog drafts', status: 'live' },
  market_strategy: { name: 'Market Strategy', summary: 'Growth and positioning insights', status: 'live' },
  email_marketing: { name: 'Email Marketing', summary: 'Campaigns by plan tier', status: 'beta' },
  proposal_writer: { name: 'Proposal Writer', summary: 'Client proposals and SOW drafts', status: 'live' },
  seo_assistant: { name: 'SEO Assistant', summary: 'Meta titles, FAQ schema', status: 'live' },
  analytics_insights: { name: 'Business Insights', summary: 'Plain-language analytics recommendations', status: 'live' },
  campaign_writer: { name: 'Campaign Writer', summary: 'Promotions and announcement copy', status: 'live' },
};

/** Storefront / builder facts — owner preference: Classic + AI Builder first; WP/Shopify-style secondary. */
export const GRABIO_BUILDER_KNOWLEDGE = [
  'STOREFRONT PRIORITY (owner preference — recommend in this order):',
  '1) Classic Template /admin/templates — native Grabio drag-and-drop (default for new stores)',
  '2) AI Builder /admin/ai-builder — AI generates/edits site without picking a template first (pair with Sally /admin/ai-agent)',
  '3) Optional / migration only — Shopify-style Theme Editor /admin/theme-editor; WordPress /admin/builder (only if client already on WP or explicitly asks)',
  'Do NOT push WP or Shopify-style as first choice. Mention them briefly as available for migration or special cases.',
  'IMPORTS (when migrating): import Shopify catalog/orders; import WordPress site — then still prefer Classic or AI Builder for ongoing edits when possible',
  'WP queue admin: /admin/wordpress-queue | WP access: /wordpress/access',
].join('\n');

/** Owner-confirmed pricing overrides (Grabio Guide authoritative — 2026-08-21). */
export const GRABIO_SPECIAL_PRICING: Record<string, string> = {
  whitelabel: '$200 one-time — branded customer store app (Play/App Store build per store)',
  ai_builder: '$8/mo self-serve module; AI Builder white-label for media companies → book meeting at /contact-us',
  ai_agent: '$6/mo Grabio Guide (in-dashboard); private/custom bespoke agent → book meeting at /contact-us',
};

const SETUP_CHECKLIST = [
  { id: 'profile', route: '/admin/profile', label: 'Complete store profile (name, phone, email, location, logo)' },
  { id: 'payments', route: '/admin/payments', label: 'Configure payment methods and exchange rates' },
  { id: 'products', route: '/admin/products', label: 'Add products or import catalog' },
  { id: 'templates', route: '/admin/templates', label: 'Choose Classic storefront or use AI Builder at /admin/ai-builder' },
  { id: 'subscription', route: '/subscription', label: 'Review subscription modules and upgrade if needed' },
  { id: 'delivery', route: '/admin/delivery', label: 'Set delivery zones and staff (if you deliver)' },
  { id: 'pos', route: '/admin/pos', label: 'Pair Grabio POS device (if you use in-store checkout)' },
  { id: 'team', route: '/admin/sub-accounts', label: 'Create cashier or seller sub-accounts (optional)' },
];

/** Compact knowledge for API prompts — keeps quality, lowers token cost. */
export function buildGrabioGuideKnowledgeBlock(opts?: { includePlaybook?: boolean }): string {
  const includePlaybook = opts?.includePlaybook !== false;
  const packages = Object.entries(PACKAGE_PRESETS)
    .map(([key, p]) => `${key}|${p.label}|$${p.monthlyUsd}/mo|$${p.yearlyUsd}/yr|${p.workflow}|${p.defaultModules.join('+')}`)
    .join('\n');

  const modules = Object.entries(MODULE_SUMMARIES)
    .map(([id, mod]) => {
      if (GRABIO_SPECIAL_PRICING[id]) {
        return `${id}|${mod.name}|${GRABIO_SPECIAL_PRICING[id]}|${mod.status}`;
      }
      const price = MODULE_PRICES[id];
      const usd = price ? (price.monthly === 0 ? 'free' : `$${price.monthly}/mo`) : 'addon';
      return `${id}|${mod.name}|${usd}|${mod.status}`;
    })
    .join('\n');

  const addOns = Object.entries(ADDON_PRICING)
    .map(([k, p]) => `${k}:$${p.monthly}/mo`)
    .join(', ');

  const routes = Object.values(ADMIN_STRUCTURE)
    .flatMap((g) => g.items.map((i) => `${i.route}|${i.label}${i.moduleId ? `|${i.moduleId}` : ''}`))
    .join('\n');

  const checklist = SETUP_CHECKLIST.map((i) => `${i.route}:${i.label}`).join('; ');

  return [
    ...(includePlaybook ? [buildSallyPlaybookBlock(), ''] : []),
    'PACKAGES(key|label|mo|yr|workflow|modules):',
    packages,
    `EXTRAS: +user $${MODULAR_SEAT_PRICING.extraUserMonthlyUsd}/mo; +POS loc $${MODULAR_SEAT_PRICING.extraPosLocationMonthlyUsd}/mo`,
    `ADDONS: ${addOns}`,
    'MODULES(id|name|price|status):',
    modules,
    'BUILDER:',
    GRABIO_BUILDER_KNOWLEDGE,
    'ROUTES(path|label|module?):',
    routes,
    `SETUP: ${checklist}`,
    'SPECIAL: whitelabel=$200 one-time; ai_builder white-label (media co)=book meeting /contact-us "AI Builder White Label"; private custom agent=book meeting /contact-us "Private Custom Agent"',
    'PAID_AI_TOOLS(free guide vs credits): Content Creator|/admin/ai/content-creator; Market Strategy|/admin/ai/market-strategy; Proposal Writer|/admin/ai/proposal-writer; SEO Assistant|/admin/ai/seo-assistant; Business Insights|/admin/ai/business-insights; Campaign Writer|/admin/ai/campaign-writer; credits hub|/admin/ai-builder',
  ].join('\n');
}

const GRABIO_TOPIC_SIGNALS = [
  'grabio', 'store', 'shop', 'product', 'order', 'inventory', 'stock', 'invoice', 'pos',
  'module', 'package', 'subscription', 'admin', 'payment', 'delivery', 'crm', 'finance',
  'template', 'setup', 'set up', 'pricing', 'marketplace', 'catalog', 'customer', 'supplier', 'purchase',
  'analytics', 'restaurant', 'factory', 'freelancer', 'ngo', 'profile', 'builder', 'upgrade',
  'plan', 'tier', 'feature', 'onboard', 'configure', 'account', 'receipt', 'estimate',
  'payroll', 'staff', 'dropship', 'manufacturing', 'kitchen', 'café', 'cafe', 'bakery',
  '/admin', 'whitelabel', 'white label', 'mobile app', 'android', 'windows pos', 'media company', 'media',
  'custom agent', 'private agent', 'bespoke agent',
  'wordpress', 'word press', 'wp plugin', 'shopify plugin', 'theme editor', 'classic template',
  'import wp', 'import shopify', 'import wordpress',
  'what should i', 'help me', 'how do i', 'how to', 'where do i', 'which module', 'get started',
  'first step', 'next step', 'explain',
];

const GUIDE_INTENT_SIGNALS = [
  'set up', 'setup', 'what should i', 'help me', 'how do i', 'how to', 'where do i', 'where is',
  'which module', 'what package', 'which package', 'next step', 'get started', 'enable module',
  'configure', 'explain', 'onboarding', 'sally',
];

const OFF_TOPIC_SIGNALS = [
  'weather', 'football', 'soccer', 'nba', 'recipe for cake', 'write me a poem', 'homework',
  'bitcoin', 'crypto invest', 'stock market tip', 'who won the election', 'tell me a joke',
  'translate to french', 'write python', 'write javascript', 'debug my code', 'leetcode',
  'movie recommendation', 'dating advice', 'medical advice', 'legal advice unrelated',
];

export const GRABIO_PAID_AI_TOOLS = [
  {
    id: 'content_creator',
    label: 'Content Creator',
    route: '/admin/ai/content-creator',
    signals: [
      'product description', 'blog post', 'blog draft', 'social caption', 'instagram caption',
      'write copy', 'write content', 'product copy', 'announcement text', 'write a post',
    ],
  },
  {
    id: 'market_strategy',
    label: 'Market Strategy',
    route: '/admin/ai/market-strategy',
    signals: [
      'market strategy', 'positioning', 'growth strategy', 'competitive analysis', 'go-to-market',
      'target audience strategy', 'pricing strategy for my',
    ],
  },
  {
    id: 'proposal_writer',
    label: 'Proposal Writer',
    route: '/admin/ai/proposal-writer',
    signals: ['proposal', 'scope of work', ' sow ', 'client proposal', 'project proposal'],
  },
  {
    id: 'seo_assistant',
    label: 'SEO Assistant',
    route: '/admin/ai/seo-assistant',
    signals: [
      'meta title', 'meta description', 'seo keyword', 'faq schema', 'seo copy', 'rank for',
      'write meta', 'optimize for search',
    ],
  },
  {
    id: 'analytics_insights',
    label: 'Business Insights',
    route: '/admin/ai/business-insights',
    signals: [
      'business insights', 'analyze my sales', 'analyze my revenue', 'restock suggestion',
      'what should i promote', 'sales analysis', 'margin analysis',
    ],
  },
  {
    id: 'campaign_writer',
    label: 'Campaign Writer',
    route: '/admin/ai/campaign-writer',
    signals: [
      'campaign copy', 'promo copy', 'promotion text', 'ad copy', 'email campaign',
      'discount announcement', 'ramadan campaign', 'black friday',
    ],
  },
] as const;

const SETUP_NAV_SIGNALS = [
  'how do i set up', 'how to set up', 'how do i enable', 'where do i', 'where is the',
  'which module', 'what package', 'configure my', 'setup my store', 'onboarding',
  'first step', 'get started', 'enable module', 'pair pos', 'import wp', 'import shopify',
  'what should i configure', 'navigate to', 'open which',
];

const DELIVERABLE_SIGNALS = [
  'write me', 'write a', 'draft me', 'draft a', 'generate a', 'generate my', 'create a',
  'create my', 'compose', 'produce', 'give me 5', 'give me ten', 'analyze my',
  'review my', 'optimize my', 'consult on my', 'consulting for', 'help me write',
];

export function buildPaidToolRedirectReply(tool: (typeof GRABIO_PAID_AI_TOOLS)[number]): string {
  return [
    `That one's **creative / consulting work** — I'd love to help, but that's what our paid AI tools are for ✨`,
    ``,
    `I'm free for setup and navigation. For this, pop over to **${tool.label}** → \`${tool.route}\` (uses AI credits).`,
    `Credits: \`/admin/ai-builder\` · Modules: \`/subscription\``,
  ].join('\n');
}

export function detectPaidToolRedirect(prompt: string): (typeof GRABIO_PAID_AI_TOOLS)[number] | null {
  const text = prompt.toLowerCase().trim();
  if (!text) return null;

  const isSetupNav = SETUP_NAV_SIGNALS.some((s) => text.includes(s));
  const wantsDeliverable = DELIVERABLE_SIGNALS.some((s) => text.includes(s));

  if (isSetupNav && !wantsDeliverable) return null;

  for (const tool of GRABIO_PAID_AI_TOOLS) {
    if (tool.signals.some((s) => text.includes(s))) {
      if (wantsDeliverable || !isSetupNav) return tool;
    }
  }

  if (wantsDeliverable) {
    if (text.includes('seo') || text.includes('meta ')) {
      return GRABIO_PAID_AI_TOOLS.find((t) => t.id === 'seo_assistant')!;
    }
    if (text.includes('campaign') || text.includes('promo') || text.includes('ad ')) {
      return GRABIO_PAID_AI_TOOLS.find((t) => t.id === 'campaign_writer')!;
    }
    if (text.includes('proposal')) {
      return GRABIO_PAID_AI_TOOLS.find((t) => t.id === 'proposal_writer')!;
    }
    if (text.includes('strategy') || text.includes('positioning') || text.includes('market')) {
      return GRABIO_PAID_AI_TOOLS.find((t) => t.id === 'market_strategy')!;
    }
    if (text.includes('insight') || text.includes('analyze') || text.includes('sales data')) {
      return GRABIO_PAID_AI_TOOLS.find((t) => t.id === 'analytics_insights')!;
    }
    return GRABIO_PAID_AI_TOOLS.find((t) => t.id === 'content_creator')!;
  }

  return null;
}

export const GRABIO_GUIDE_OFF_TOPIC_REPLY =
  "Hey — I'm **Sally** 🙂 I stick to Grabio stuff: setup, modules, pricing, and where to click in admin. Ask me something about your store — like which package fits you, or what to set up first at `/admin/profile`!";

export function classifyGrabioGuidePrompt(prompt: string, hasHistory: boolean): 'on_topic' | 'off_topic' {
  const text = prompt.toLowerCase().trim();
  if (!text) return 'off_topic';

  if (OFF_TOPIC_SIGNALS.some((s) => text.includes(s))) return 'off_topic';

  if (GRABIO_TOPIC_SIGNALS.some((s) => text.includes(s))) return 'on_topic';
  if (GUIDE_INTENT_SIGNALS.some((s) => text.includes(s))) return 'on_topic';

  // Short follow-ups in an active Grabio conversation (yes, ok, why, next step, etc.)
  if (hasHistory && text.length <= 80) return 'on_topic';

  return 'off_topic';
}

type GuideHistoryItem = { role: 'user' | 'assistant'; content: string };

function lastHistoryLine(history: GuideHistoryItem[], role: 'user' | 'assistant'): string {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i]?.role === role) return history[i].content.toLowerCase();
  }
  return '';
}

function isGenericFallbackReply(text: string): boolean {
  return /try asking about profile, products, packages/i.test(text);
}

function userThread(history: GuideHistoryItem[], prompt: string): string {
  const users = history.filter((h) => h.role === 'user').map((h) => h.content.toLowerCase());
  return [...users, prompt.toLowerCase()].join(' ');
}

function assistantThread(history: GuideHistoryItem[]): string {
  return history
    .filter((h) => h.role === 'assistant' && !isGenericFallbackReply(h.content))
    .map((h) => h.content.toLowerCase())
    .join(' ');
}

function lastAssistantAskedBusinessType(history: GuideHistoryItem[]): boolean {
  const last = lastHistoryLine(history, 'assistant');
  return /business type|tell me your business|shop, restaurant|ngo, factory/.test(last);
}

function lastAssistantAskedPackages(history: GuideHistoryItem[]): boolean {
  const last = lastHistoryLine(history, 'assistant');
  return /compare packages|\/subscription|which package|package fit|fits my business|invoice manager|mini shop|live kitchen/.test(last);
}

function recommendPackageForBusiness(text: string): string | null {
  if (/restaurant|cafe|café|bakery|kitchen|food service/.test(text)) {
    return [
      'For food service, Live Kitchen ($27/mo) on /subscription — orders, kitchen flow, stock, POS option.',
      'Next: /admin/profile → menu/products → /admin/templates for your storefront.',
      'In-store checkout? Enable pos → /admin/pos.',
    ].join('\n');
  }
  if (/factory|manufacturing|production|wholesale/.test(text)) {
    return [
      'Factory Flow ($27/mo) on /subscription — manufacturing, BOM, stock, core commerce.',
      'Next: /admin/profile → raw materials & products → review modules on /subscription.',
    ].join('\n');
  }
  if (/shop|retail|store|boutique|ecommerce|e-commerce|supermarket|grocery/.test(text)) {
    return [
      'For retail: Mini Shop ($10/mo) online essentials, or Shop ($27/mo) full retail + stock.',
      'Next: /admin/profile → /admin/products → Classic at /admin/templates.',
      'Add modules anytime on /subscription.',
    ].join('\n');
  }
  if (/freelancer|agency|services|consulting/.test(text)) {
    return [
      'Invoice Manager ($5/mo) or Freelancer ($22/mo) on /subscription — invoicing, customers, mobile billing.',
      'Need proposals or copy? Content Creator / Proposal Writer under /admin/ai/* (uses credits).',
    ].join('\n');
  }
  if (/ngo|nonprofit|non-profit|charity/.test(text)) {
    return [
      'NGO package ($22/mo) on /subscription — light billing + invoice manager.',
      'Next: /admin/profile → /admin/invoice-manager/invoices.',
    ].join('\n');
  }
  return null;
}

/** Instant Sally replies — no Cursor call (fast, free). */
export function tryLocalGuideReply(prompt: string, history: GuideHistoryItem[] = []): string | null {
  const text = prompt.toLowerCase().trim();
  const prevUser = lastHistoryLine(history, 'user');
  const prevAssistant = lastHistoryLine(history, 'assistant');
  const users = userThread(history, text);
  const assistants = assistantThread(history);
  const ctx = `${users} ${assistants}`;

  // —— Classic / Theme / Builder (before short-message rules) ——
  if (
    /^classic\??$/.test(text) ||
    /classic builder|classic template|what.*classic|the classic/.test(text)
  ) {
    return [
      'Classic Template is Grabio’s native drag-and-drop storefront — the default we recommend.',
      '→ /admin/templates — layout, colors, sections, publish.',
      '',
      'Or skip templates: AI Builder at /admin/ai-builder builds your site with AI (works great with Sally here).',
      'Shopify-style editor and WordPress exist for migration — only if you need them.',
    ].join('\n');
  }

  if (/theme editor|shopify-style|shopify style/.test(text)) {
    return [
      'Shopify-style Theme Editor is available at /admin/theme-editor — mainly for teams used to that workflow or migrating.',
      'For most stores we recommend Classic at /admin/templates or AI Builder at /admin/ai-builder instead.',
    ].join('\n');
  }

  // —— Business-type answer after package question ——
  if (
    recommendPackageForBusiness(text) &&
    (lastAssistantAskedBusinessType(history) || lastAssistantAskedPackages(history) || /package|fit my business/.test(users))
  ) {
    return recommendPackageForBusiness(text)!;
  }

  if (recommendPackageForBusiness(text) && text.length <= 24) {
    return recommendPackageForBusiness(text)!;
  }

  if (/what should i set up|set up first|get started|first step|onboarding|what to configure/.test(text)) {
    const steps = SETUP_CHECKLIST.map((s, i) => `${i + 1}. ${s.label} → \`${s.route}\``).join('\n');
    return `Best **Grabio setup order**:\n\n${steps}\n\nStart with anything missing — usually \`/admin/profile\` first.`;
  }

  if (/classic vs|shopify.*wordpress|wordpress.*shopify|explain classic|theme editor vs|3 storefront|storefront option/.test(text)) {
    return [
      'Best paths for a new Grabio store:',
      '1. Classic Template → /admin/templates (native, fastest — our default)',
      '2. AI Builder → /admin/ai-builder (AI builds/edits your site — no template pick required)',
      '',
      'Also available if you need them: Theme Editor /admin/theme-editor, WordPress /admin/builder (migration/legacy).',
    ].join('\n');
  }

  if (/what.*package|which package|package fit|fits my business/.test(text)) {
    return [
      'Compare starting packages on /subscription:',
      '- Invoice Manager ($5/mo) — freelancer invoicing',
      '- Mini Shop ($10/mo) — online essentials',
      '- Shop ($27/mo) — full retail + stock',
      '- Live Kitchen ($27/mo) — restaurant / café',
      '- Factory Flow ($27/mo) — manufacturing',
      '- NGO ($22/mo) — light billing',
      '- Freelancer ($22/mo) — services',
      '',
      'Tell me your business type (shop, restaurant, NGO, factory…) and I’ll pick one.',
    ].join('\n');
  }

  if (/^ngo\??$|nonprofit|non-profit|charity/.test(text)) {
    return [
      'NGO package ($22/mo) on /subscription — light billing + invoice manager.',
      'Next: /admin/profile → /admin/invoice-manager/invoices.',
    ].join('\n');
  }

  if (/^wordpress\??$|^word press\??$/.test(text) || text.includes('wordpress builder')) {
    return [
      'WordPress on Grabio → /admin/builder — mainly if you already run WP or are migrating.',
      'For new stores, Classic /admin/templates or AI Builder /admin/ai-builder is usually simpler.',
      'WP imports: /admin/wordpress-queue',
    ].join('\n');
  }

  if (/^why\??$/.test(text) || text === 'why though') {
    if (/shop|retail|package|starter|pro|subscription|fit my business/.test(users) || lastAssistantAskedPackages(history)) {
      return [
        '**Why starter for a shop?** It covers catalog, orders, payments, and stock without paying for modules you don’t need yet.',
        'Upgrade to **pro** on `/subscription` when you want CRM, analytics, or marketing.',
        'Packages are changeable anytime — you’re not locked in.',
      ].join('\n');
    }
    if (/classic|template|theme editor|storefront|builder/.test(users)) {
      return [
        'Classic keeps everything in one Grabio admin — orders, stock, and storefront together.',
        'AI Builder at /admin/ai-builder is great if you want AI to design the site for you.',
        'Theme Editor and WordPress are there if you need migration paths — not our first pick for new stores.',
      ].join('\n');
    }
    if (/wordpress/.test(users) && !/classic|shop/.test(users)) {
      return 'WordPress works if your team already lives in WP. Otherwise try Classic /admin/templates or AI Builder /admin/ai-builder first — same Grabio backend for orders and stock.';
    }
    if (/package|subscription/.test(assistants)) {
      return 'Packages bundle modules by workflow so you don’t pay for tools you won’t use. Compare on **`/subscription`** and add modules à la carte anytime.';
    }
    return 'Happy to explain — **why** which part? (package choice, Classic vs WordPress, a module, or a setup step?)';
  }

  if (/^(yes|ok|okay|thanks|next|continue|tell me more|more|and then|what next)\??$/.test(text)) {
    if (/set up|setup order|profile/.test(ctx)) {
      return 'After profile: /admin/products → storefront: Classic /admin/templates or AI Builder /admin/ai-builder → review modules on /subscription.';
    }
    if (/shop|retail|starter|package/.test(ctx)) {
      return 'Next: /subscription → pick your package → /admin/profile → /admin/products → Classic /admin/templates or AI Builder /admin/ai-builder.';
    }
    if (/wordpress/.test(users)) {
      return 'If you must stay on WP: /admin/builder and /admin/wordpress-queue. Otherwise Classic or AI Builder is usually easier for a Grabio-native store.';
    }
    return 'What should we tackle — setup, packages, **Classic** storefront, or modules?';
  }

  if (text.includes('shopify') && text.length <= 40) {
    return 'Coming from Shopify? You can import your catalog — but for your live store we recommend Classic /admin/templates or AI Builder /admin/ai-builder. Theme Editor /admin/theme-editor exists if you prefer that workflow.';
  }

  if (text.includes('pos') || text.includes('point of sale')) {
    return '**Grabio POS** → `/admin/pos` — pair your device after enabling **pos** on **`/subscription`**.';
  }

  if (text.includes('payment') || text.includes('exchange rate')) {
    return '**Payments & rates** → `/admin/payments` — methods, COD, USD/LBP exchange.';
  }

  if (text.includes('module') || text.includes('subscription') || text.includes('upgrade')) {
    return 'Enable or upgrade modules on **`/subscription`** — each module unlocks matching **`/admin/*`** routes.';
  }

  return null;
}

export function polishSallyOutput(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').trim();
}

export function buildGuideFallbackReply(prompt: string, history: GuideHistoryItem[] = []): string {
  const text = prompt.toLowerCase().trim();
  const users = userThread(history, text);
  if (/package|subscription|starter|business type|fit my business/.test(users)) {
    return 'Tell me your business type — shop, restaurant, factory, or services — and I’ll point you to the right starter / pro / business package on /subscription.';
  }
  if (/classic|template|builder|storefront|theme/.test(users + text)) {
    return 'Storefront: Classic /admin/templates or AI Builder /admin/ai-builder (recommended). Theme Editor and WordPress available for migration — ask if you need those.';
  }
  return tryLocalGuideReply(prompt, history) || GRABIO_GUIDE_CURSOR_FALLBACK;
}

export const GRABIO_GUIDE_CURSOR_FALLBACK =
  'One moment — try that again. Quick path: /admin/profile → /admin/products → Classic /admin/templates or AI Builder /admin/ai-builder. Modules on /subscription.';

export const GRABIO_GUIDE_SYSTEM_RULES = `You are **Sally** — Grabio's cute, friendly in-product AI assistant (grabio.space). You're the **live demo** of Grabio custom AI agents: warm, upbeat, a little playful, never stiff or corporate.

PERSONALITY:
- Talk like a helpful teammate — short sentences, light emoji okay (✨ 🙂 — sparingly, 0–2 max).
- Be encouraging: "You've got this", "Great question", "Happy to help".
- Remember the conversation — use context from history; short replies ("shop", "why", "classic") continue the last topic.
- Never robotic menus ("try asking about profile, products…"). Never cold or preachy.

CONVERSATION (critical):
- Read full history before answering.
- "why" must match the **current thread** (packages → explain packages; Classic → explain Classic).
- One clarifying question is fine if truly needed — then stop.

FREE SCOPE: setup, onboarding, modules/packages/pricing, admin navigation. Prefer Classic + AI Builder for storefront; mention WP/Theme Editor only when asked or migrating.

PAID SCOPE (sweet redirect — don't do the work): Content Creator, Market Strategy, Proposal Writer, SEO Assistant, Business Insights, Campaign Writer → \`/admin/ai/*\` (uses credits).

BOUNDARIES: Grabio only · tenantContext facts only · guide only · \`/subscription\` for upgrades.

STYLE: Warm natural voice in plain text only — no markdown, no asterisks, no backticks. Routes like /admin/profile (UI links them). ~150 words. Never mention API keys, models, or errors. Unreleased features → "coming soon".

RESPONSE PLAN (every reply):
1. Read CHAT history — short user words (shop, why, classic) continue the last topic.
2. One warm opener (optional, short).
3. Clear answer — specific to this store when context allows.
4. Best next step with /admin/... path.
5. At most one short follow-up question if needed.`;

export type TenantGuideContext = {
  storeId: string;
  profile: Record<string, unknown>;
  enabledModules: string[];
  setupStatus: {
    hasStoreName: boolean;
    hasPhone: boolean;
    hasEmail: boolean;
    hasLocation: boolean;
    hasLogo: boolean;
    hasProducts: boolean;
    hasOrders: boolean;
    missingChecklist: string[];
  };
  subscription: {
    tier: string | null;
    startingPackage: string | null;
    pricingVersion: string | null;
    billing: string | null;
    seatCount: number | null;
    posLocationCount: number | null;
  };
};

export async function buildTenantGuideContext(
  db: FirebaseFirestore.Firestore,
  storeId: string,
): Promise<TenantGuideContext> {
  const profileSnap = await db.collection('storeProfiles').doc(storeId).get();
  const profile = (profileSnap.data() || {}) as Record<string, unknown>;
  const enabledModulesRecord = (profile.enabledModules || {}) as Record<string, boolean>;
  const enabledModules = Object.entries(enabledModulesRecord)
    .filter(([, on]) => Boolean(on))
    .map(([id]) => id);

  const [productsSnap, ordersSnap] = await Promise.all([
    db.collection('products').where('storeId', '==', storeId).limit(1).get(),
    db.collection('orders').where('storeId', '==', storeId).limit(1).get(),
  ]);

  const hasStoreName = Boolean(pickStoreNameFromRecord(profile));
  const hasPhone = Boolean(String(profile.phone || '').trim());
  const hasEmail = Boolean(String(profile.email || '').trim());
  const hasLocation = Boolean(String(profile.location || profile.address || '').trim());
  const hasLogo = Boolean(String(profile.logo || profile.logoUrl || '').trim());

  const missingChecklist: string[] = [];
  if (!hasStoreName || !hasPhone || !hasEmail) {
    missingChecklist.push('Complete store profile at /admin/profile');
  }
  if (!hasLocation) missingChecklist.push('Add store location at /admin/profile');
  if (!hasLogo) missingChecklist.push('Upload store logo at /admin/profile');
  const hasProducts = !productsSnap.empty;
  if (!hasProducts) missingChecklist.push('Add products at /admin/products');
  if (!enabledModules.includes('payments')) {
    missingChecklist.push('Enable Payments module via /subscription if you need OMT/Stripe/expenses');
  }

  return {
    storeId,
    profile: {
      name:
        pickStoreNameFromRecord(profile) ||
        profile.name ||
        profile.storeName ||
        null,
      phone: profile.phone || null,
      email: profile.email || null,
      location: profile.location || profile.address || null,
      businessWorkflow: profile.businessWorkflow || null,
    },
    enabledModules,
    setupStatus: {
      hasStoreName,
      hasPhone,
      hasEmail,
      hasLocation,
      hasLogo,
      hasProducts,
      hasOrders: !ordersSnap.empty,
      missingChecklist,
    },
    subscription: {
      tier: String(profile.subscriptionTier || profile.tier || '') || null,
      startingPackage: String(profile.startingPackage || '') || null,
      pricingVersion: String(profile.pricingVersion || '') || null,
      billing: String(profile.subscriptionPlan || '') || null,
      seatCount: Number(profile.seatCount) || null,
      posLocationCount: Number(profile.posLocationCount) || null,
    },
  };
}
