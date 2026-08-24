/** Direct human handoff — Sally → WhatsApp (Grabio team). One agent only; no second bot. */

import * as admin from 'firebase-admin';
import type { Firestore } from 'firebase-admin/firestore';

export const GRABIO_HUMAN_WHATSAPP_E164 = '96171110952';

export type HumanHandoffReason = 'requested' | 'off_topic' | 'no_answer' | 'limit';

export type HumanHandoffPayload = {
  whatsappUrl: string;
  reason: HumanHandoffReason;
};

const NAME_KEYS = ['name', 'storeName', 'businessName', 'displayName', 'companyName', 'title'] as const;

export function pickStoreNameFromRecord(data: Record<string, unknown> | null | undefined): string | null {
  if (!data) return null;
  for (const key of NAME_KEYS) {
    const v = String(data[key] || '').trim();
    if (v) return v;
  }
  return null;
}

/** Resolve a human-readable store label — never "Unknown" if we can avoid it. */
export async function resolveStoreLabel(
  db: Firestore,
  storeId: string,
  opts?: { userEmail?: string | null; hint?: string | null; profileData?: Record<string, unknown> | null },
): Promise<string> {
  const hint = String(opts?.hint || '').trim();
  if (hint) return hint;

  const fromCtx = pickStoreNameFromRecord(opts?.profileData ?? undefined);
  if (fromCtx) return fromCtx;

  const profileSnap = await db.collection('storeProfiles').doc(storeId).get();
  const fromProfile = pickStoreNameFromRecord(profileSnap.data() as Record<string, unknown> | undefined);
  if (fromProfile) return fromProfile;

  const storeSnap = await db.collection('stores').doc(storeId).get();
  const fromStore = pickStoreNameFromRecord(storeSnap.data() as Record<string, unknown> | undefined);
  if (fromStore) return fromStore;

  try {
    const authUser = await admin.auth().getUser(storeId);
    const dn = String(authUser.displayName || '').trim();
    if (dn) return dn;
  } catch {
    /* storeId may not be an auth uid */
  }

  const email = String(opts?.userEmail || '').trim();
  if (email.includes('@')) {
    const local = email.split('@')[0]?.replace(/[._+-]/g, ' ').trim();
    if (local) return local;
  }

  return `Store ${storeId.slice(0, 8)}`;
}

const HUMAN_REQUEST_SIGNALS = [
  'talk to human',
  'speak to human',
  'real human',
  'real person',
  'actual person',
  'human support',
  'transfer to human',
  'connect me to',
  'whatsapp support',
  'need a person',
  'need someone',
  'customer service',
  'speak to someone',
  'talk to someone',
  'contact support',
  'grabio team',
  'transfer me',
  'human agent',
];

/** User explicitly wants a person — skip AI entirely. */
export function detectHumanTransferRequest(prompt: string): boolean {
  const text = prompt.toLowerCase().trim();
  if (HUMAN_REQUEST_SIGNALS.some((s) => text.includes(s))) return true;
  if (/^(human|agent|support)\??$/.test(text)) return true;
  return false;
}

export function buildHumanHandoffWhatsAppUrl(input: {
  storeId: string;
  storeName?: string | null;
  userEmail?: string | null;
  prompt: string;
  page?: string;
  reason: HumanHandoffReason;
}): string {
  const reasonLabel =
    input.reason === 'requested'
      ? 'Customer asked for a human'
      : input.reason === 'off_topic'
        ? 'Question outside Sally scope'
        : input.reason === 'limit'
          ? 'Sally daily limit reached'
          : 'Sally could not answer';

  const body = [
    'Hi Grabio team — I came from Grabio (Sally chat) and need a human.',
    '',
    `Handoff: ${reasonLabel}`,
    `Store: ${input.storeName || 'Store'} (${input.storeId})`,
    input.userEmail ? `Email: ${input.userEmail}` : '',
    `Admin page: ${input.page || '/admin'}`,
    `Question: ${input.prompt.slice(0, 500)}`,
    '',
    'Please respond directly — customer already went through Sally only (no other bot).',
  ]
    .filter(Boolean)
    .join('\n');

  return `https://wa.me/${GRABIO_HUMAN_WHATSAPP_E164}?text=${encodeURIComponent(body)}`;
}

export function buildHumanHandoffReply(reason: HumanHandoffReason): string {
  switch (reason) {
    case 'requested':
      return 'Opening WhatsApp with our team — your question and store details will be included.';
    case 'limit':
      return "I've reached my limit for today. You can continue with our team on WhatsApp below.";
    case 'no_answer':
    default:
      return "I don't have a good answer for that. Our team can help on WhatsApp below.";
  }
}

export function buildHumanHandoff(input: {
  storeId: string;
  storeName?: string | null;
  userEmail?: string | null;
  prompt: string;
  page?: string;
  reason: HumanHandoffReason;
}): HumanHandoffPayload & { reply: string } {
  return {
    reason: input.reason,
    reply: buildHumanHandoffReply(input.reason),
    whatsappUrl: buildHumanHandoffWhatsAppUrl(input),
  };
}

export function isUncertainGuideAnswer(content: string, modelId: string): boolean {
  if (modelId !== 'sally-fallback') return false;
  const t = content.toLowerCase();
  return (
    /try that again|give me a sec|not sure|couldn't reach|one moment/.test(t) ||
    /tell me your business type or what you're setting up/.test(t)
  );
}
