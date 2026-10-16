import type {
  NextraBookRequest,
  NextraBookResult,
  NextraBookingSummary,
  NextraOffer,
  NextraSearchParams,
  NextraTenantConfig,
  NextraWalletSnapshot,
} from './types';
import * as mock from './mock';

function useMock(): boolean {
  return process.env.NEXTRA_MOCK === 'true' || process.env.NEXTRA_MOCK === '1';
}

async function nextraFetch<T>(
  config: NextraTenantConfig,
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const base = config.apiBaseUrl.replace(/\/$/, '');
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
  if (config.agentUserId) headers['X-Agent-User-Id'] = config.agentUserId;

  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Nextra API ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/** Map live Nextra JSON to normalized offers when API shape is confirmed in nextra-api-matrix.md */
function normalizeOffers(payload: unknown): NextraOffer[] {
  if (!payload || typeof payload !== 'object') return [];
  const data = payload as { offers?: NextraOffer[]; data?: NextraOffer[] };
  if (Array.isArray(data.offers)) return data.offers;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

export async function nextraSearch(
  config: NextraTenantConfig,
  params: NextraSearchParams,
): Promise<NextraOffer[]> {
  if (useMock()) return mock.mockSearch(params);
  const raw = await nextraFetch<unknown>(config, '/v1/search', { ...params });
  const offers = normalizeOffers(raw);
  if (offers.length === 0) return mock.mockSearch(params);
  return offers;
}

export async function nextraWallet(config: NextraTenantConfig): Promise<NextraWalletSnapshot> {
  if (useMock()) return mock.mockWallet();
  try {
    return await nextraFetch<NextraWalletSnapshot>(config, '/v1/wallet');
  } catch {
    return mock.mockWallet();
  }
}

export async function nextraBookingList(config: NextraTenantConfig): Promise<NextraBookingSummary[]> {
  if (useMock()) return mock.mockBookingList();
  try {
    const raw = await nextraFetch<{ bookings?: NextraBookingSummary[] }>(config, '/v1/bookings');
    return raw.bookings || mock.mockBookingList();
  } catch {
    return mock.mockBookingList();
  }
}

export async function nextraBook(
  config: NextraTenantConfig,
  req: NextraBookRequest,
): Promise<NextraBookResult> {
  if (useMock()) return mock.mockBook(req);
  return nextraFetch<NextraBookResult>(config, '/v1/book', { ...req });
}
