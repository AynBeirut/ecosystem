import { GRABIO_NAP } from '@/lib/grabioBrandSchema';

export type SallyHumanHandoff = {
  whatsappUrl: string;
  reason?: string;
};

const NAME_KEYS = ['name', 'storeName', 'businessName', 'displayName', 'companyName', 'title'] as const;

export function storeLabelFromProfile(data: Record<string, unknown> | null | undefined): string | null {
  if (!data) return null;
  for (const key of NAME_KEYS) {
    const v = String(data[key] || '').trim();
    if (v) return v;
  }
  return null;
}

/** Client fallback when API fails — same WhatsApp, pre-filled context. */
export function buildClientHumanHandoffUrl(input: {
  storeId: string;
  storeName?: string | null;
  userEmail?: string | null;
  prompt: string;
  page?: string;
}): string {
  const label =
    input.storeName?.trim() ||
    (input.userEmail?.includes('@') ? input.userEmail.split('@')[0] : null) ||
    `Store ${input.storeId.slice(0, 8)}`;

  const body = [
    'Hi Grabio team — I came from Grabio (Sally chat) and need a human.',
    '',
    `Store: ${label} (${input.storeId})`,
    input.userEmail ? `Email: ${input.userEmail}` : '',
    `Page: ${input.page || '/admin'}`,
    `Question: ${input.prompt.slice(0, 500)}`,
    '',
    'Please respond directly — came from Sally chat only.',
  ]
    .filter(Boolean)
    .join('\n');

  const base = GRABIO_NAP.whatsappUrl.replace(/\/?$/, '');
  return `${base}?text=${encodeURIComponent(body)}`;
}
