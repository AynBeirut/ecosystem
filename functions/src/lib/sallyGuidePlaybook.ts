/**
 * Sally (Grabio Guide) — behavior rules + Q&A playbook + credit-smart routing.
 * Source doc: docs/sally-guide-playbook.md
 *
 * ROUTING (saves Cursor credits):
 * T0 free canned → off_topic, paid_tool redirect
 * T1 local playbook → pattern match + tenant missingChecklist (no API call)
 * T2 Cursor composer-2.5-fast → complex / no local match / long nuanced questions only
 */

export type SallyHistoryItem = { role: 'user' | 'assistant'; content: string };

export type SallyTenantSlice = {
  setupStatus?: { missingChecklist?: string[] };
  profile?: { name?: string | null; businessWorkflow?: string | null };
  subscription?: { startingPackage?: string | null };
};

export const SALLY_BEHAVIOR = `
WHO: Sally — Grabio in-dashboard guide. Warm, clear, remembers chat.

STOREFRONT PRIORITY (owner): Recommend Classic /admin/templates or AI Builder /admin/ai-builder first.
WP and Shopify-style Theme Editor exist for migration — mention only if asked; do not push as default.

ACT: Plain text. Routes as /admin/profile. Grabio only. Disabled module → /subscription.
RESPONSE: (1) warm line optional (2) answer (3) next /admin step (4) one question max.
`.trim();

export const SALLY_QA_PLAYBOOK = `
SETUP ORDER: profile → payments → products → Classic /admin/templates OR AI Builder /admin/ai-builder → /subscription → delivery/POS/team if needed. Skip done items from STORE.setupStatus.missingChecklist.

STOREFRONT (recommend in order):
1 Classic /admin/templates — default native builder
2 AI Builder /admin/ai-builder — AI builds site without picking template
3 Optional: Theme Editor /admin/theme-editor, WordPress /admin/builder — migration/legacy only

PACKAGES:
- shop/retail → Mini Shop $10/mo or Shop $27/mo (/subscription)
- restaurant/café → Live Kitchen $27/mo
- factory → Factory Flow $27/mo
- freelancer → Invoice Manager $5 or Freelancer $22/mo
- NGO → NGO $22/mo

BUILDERS: Prefer Classic + AI Builder. Theme Editor / WordPress = available, not default.

SPECIAL: whitelabel $200 one-time | AI Builder white-label / private agent → /contact-us
PAID AI (redirect): Content Creator, SEO, Campaign, Proposal, Strategy, Insights → /admin/ai/*
`.trim();

/** Simple queries — local playbook handles (0 credits). */
const SIMPLE_QUERY = [
  /^classic\??$/,
  /^wordpress\??$/,
  /^why\??$/,
  /^shop\??$/,
  /^ngo\??$/,
  /^restaurant\??$/,
  /^factory\??$/,
  /^freelancer\??$/,
  /^(yes|ok|okay|next|thanks|continue|tell me more)\??$/,
  /what should i set up|set up first|get started|first step|onboarding/,
  /what.*package|which package|package fit|fits my business/,
  /classic vs|theme editor|shopify-style|3 storefront|explain classic/,
  /\bpos\b|point of sale/,
  /payment|exchange rate/,
  /module|subscription|upgrade/,
  /^shopify\??$/,
];

/** Complex queries — need Cursor (uses credits). */
const COMPLEX_QUERY = [
  /compare|versus|\bvs\b|difference between|pros and cons|which is better/,
  /should i choose|recommend.*for|best package for|best module for/,
  /we run|we sell|we have|our business|multiple locations|both .* and/,
  /custom workflow|unique setup|not sure|help me decide/,
];

export function buildSallyPlaybookBlock(): string {
  return [SALLY_BEHAVIOR, '', 'PLAYBOOK:', SALLY_QA_PLAYBOOK].join('\n');
}

/** Compact knowledge for Cursor — no duplicate playbook (saves tokens). */
export function buildSallyCursorHintBlock(): string {
  return SALLY_QA_PLAYBOOK;
}

export function isSallySetupIntent(prompt: string, hasHistory: boolean): boolean {
  const text = prompt.toLowerCase().trim();
  const setupSignals = [
    'set up', 'setup', 'package', 'module', 'classic', 'template', 'wordpress', 'builder',
    'profile', 'product', 'payment', 'pos', 'delivery', 'shop', 'restaurant', 'why', 'next',
    'how do i', 'where do i', 'what is', 'subscription', 'storefront',
  ];
  if (setupSignals.some((s) => text.includes(s))) return true;
  if (hasHistory && text.length <= 40) return true;
  return false;
}

function lastAssistant(history: SallyHistoryItem[]): string {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i]?.role === 'assistant') return history[i].content.toLowerCase();
  }
  return '';
}

function userThread(history: SallyHistoryItem[], prompt: string): string {
  return [...history.filter((h) => h.role === 'user').map((h) => h.content), prompt]
    .join(' ')
    .toLowerCase();
}

function packageForBusiness(text: string): string | null {
  if (/restaurant|cafe|café|bakery|kitchen|food/.test(text)) {
    return [
      'Live Kitchen fits food service — orders, kitchen flow, stock, POS option ($27/mo).',
      'Enable on /subscription, then /admin/profile → products → Classic /admin/templates or AI Builder /admin/ai-builder.',
      'In-store? Add POS at /admin/pos after enabling pos module.',
    ].join('\n');
  }
  if (/factory|manufacturing|production/.test(text)) {
    return [
      'Factory Flow bundles manufacturing + stock + core commerce ($27/mo).',
      'Start /admin/profile → raw materials & products → review /subscription modules.',
    ].join('\n');
  }
  if (/shop|retail|store|boutique|ecommerce|supermarket/.test(text)) {
    return [
      'For retail: Mini Shop ($10/mo) for online essentials, or Shop ($27/mo) for full retail + stock.',
      'Next: /admin/profile → /admin/products → Classic /admin/templates or AI Builder /admin/ai-builder.',
      'Upgrade modules anytime on /subscription.',
    ].join('\n');
  }
  if (/freelancer|invoice only|consulting|services/.test(text)) {
    return [
      'Invoice Manager ($5/mo) or Freelancer ($22/mo) — invoicing, PDF, mobile billing.',
      'Open /subscription, then /admin/profile and /admin/invoice-manager/invoices.',
    ].join('\n');
  }
  if (/ngo|nonprofit|non-profit/.test(text)) {
    return [
      'NGO package ($22/mo) on /subscription — invoicing + invoice manager.',
      'Next: /admin/profile → /admin/invoice-manager/invoices.',
    ].join('\n');
  }
  return null;
}

function lastHistoryLine(history: SallyHistoryItem[], role: 'user' | 'assistant'): string {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i]?.role === role) return history[i].content.toLowerCase();
  }
  return '';
}

/** Personalized setup reply using store missingChecklist (T1 — free). */
export function tryPlaybookWithTenant(
  prompt: string,
  history: SallyHistoryItem[],
  tenant: SallyTenantSlice,
): string | null {
  const text = prompt.toLowerCase().trim();
  const missing = tenant.setupStatus?.missingChecklist || [];
  const storeName = String(tenant.profile?.name || '').trim();

  if (/what should i set up|set up first|get started|first step|onboarding|what to configure/.test(text)) {
    const greet = storeName ? `Hey ${storeName} — ` : '';
    if (missing.length === 0) {
      return `${greet}Your core setup looks good ✨ Next: polish storefront at /admin/templates or review modules on /subscription.`;
    }
    const top = missing.slice(0, 4).map((m, i) => `${i + 1}. ${m}`).join('\n');
    return `${greet}Start with what's still missing:\n\n${top}\n\nUsually /admin/profile first if profile isn't complete.`;
  }

  const biz = packageForBusiness(text);
  if (
    biz &&
    (text.length <= 32 ||
      /package|fit|business type/.test(userThread(history, text)) ||
      lastHistoryLine(history, 'assistant').includes('business type'))
  ) {
    return biz;
  }

  if (/^why\??$/.test(text)) {
    const thread = userThread(history, text);
    if (/shop|retail|mini shop|pkg_shop/.test(thread)) {
      return 'Mini Shop keeps cost low for online retail; Shop adds full stock ops when you need it. Both upgrade on /subscription anytime.';
    }
    if (/classic|template|storefront/.test(thread)) {
      return 'Classic is native Grabio — one login, orders and stock together. AI Builder at /admin/ai-builder if you want AI to design the site. WP/Theme Editor only if you need migration.';
    }
  }

  return null;
}

/** True when Cursor is worth the credit cost. */
export function shouldUseCursor(
  prompt: string,
  history: SallyHistoryItem[],
  localReply: string | null,
): boolean {
  const text = prompt.toLowerCase().trim();

  if (!localReply) return true;

  if (text.length > 160) return true;
  if (COMPLEX_QUERY.some((re) => re.test(text))) return true;

  if (SIMPLE_QUERY.some((re) => re.test(text))) return false;

  if (history.length > 0 && text.length <= 50) return false;

  const words = text.split(/\s+/).length;
  if (words > 22) return true;

  return false;
}

export function isSimpleGuideQuery(prompt: string, history: SallyHistoryItem[]): boolean {
  const text = prompt.toLowerCase().trim();
  return SIMPLE_QUERY.some((re) => re.test(text)) || (history.length > 0 && text.length <= 40);
}
