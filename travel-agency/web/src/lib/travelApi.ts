import { auth, apiBase } from './firebase';
import { isTravelDemo } from './demoMode';
import { buildDemoPublicProposalDays } from './demoItineraryData';
import { resolveQuoteTotals } from './quoteItinerary';

function useApiMocks(): boolean {
  return isTravelDemo() || import.meta.env.VITE_TRAVEL_API_MOCK === 'true';
}

const mockOffers = [
  { offerId: 'demo-1', title: 'DEL → DXB · Morning', currency: 'INR', totalPrice: 18450, summary: '2 adults · demo' },
  { offerId: 'demo-2', title: 'DEL → DXB · Afternoon', currency: 'INR', totalPrice: 15200, summary: '2 adults · demo' },
];

async function authFetch(path: string, init?: RequestInit) {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in required');
  const token = await user.getIdToken();
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json;
}

export async function nextraSearchApi(storeId: string, body: Record<string, unknown>) {
  if (useApiMocks()) return { ok: true, offers: mockOffers };
  return authFetch('/travel/nextra/search', { method: 'POST', body: JSON.stringify({ storeId, ...body }) });
}

export async function nextraBookApi(storeId: string, body: Record<string, unknown>) {
  if (useApiMocks()) {
    return { ok: true, result: { bookingRef: 'BK-DEMO-001', pnr: 'PNRDEMO', status: 'confirmed' } };
  }
  return authFetch('/travel/nextra/book', { method: 'POST', body: JSON.stringify({ storeId, ...body }) });
}

export async function nextraWalletApi(storeId: string) {
  const mock = { ok: true, wallet: { balance: 0, available: 26670, due: 73330, currency: 'INR' } };
  if (useApiMocks()) return mock;
  try {
    return await authFetch('/travel/nextra/wallet', { method: 'POST', body: JSON.stringify({ storeId }) });
  } catch {
    return mock;
  }
}

export async function createProposalLinkApi(storeId: string, quoteId: string) {
  if (useApiMocks()) {
    return { ok: true, token: 'demo', publicPath: '/travel/p/demo' };
  }
  return authFetch('/travel/proposal/link', { method: 'POST', body: JSON.stringify({ storeId, quoteId }) });
}

export async function ownerSummaryApi(storeId: string) {
  if (useApiMocks()) {
    return {
      ok: true,
      summary: {
        openDeals: 2,
        bookedDeals: 0,
        totalMargin: 15600,
        byStage: { quoted: 1, deposit_received: 1 },
        wallet: { balance: 0, available: 26670, due: 73330, currency: 'INR' },
        creditAlert: true,
      },
    };
  }
  return authFetch(`/travel/owner/summary?storeId=${encodeURIComponent(storeId)}`);
}

export async function recordDepositApi(storeId: string, quoteId: string, amount: number, method: string) {
  if (useApiMocks()) return { ok: true, receiptNumber: 'RC-DEMO-001' };
  return authFetch('/travel/deposit/record', {
    method: 'POST',
    body: JSON.stringify({ storeId, quoteId, amount, method }),
  });
}

export async function fetchPublicProposal(token: string) {
  if (token === 'demo' || isTravelDemo()) {
    const days = buildDemoPublicProposalDays();
    const totals = resolveQuoteTotals({ days, costTotal: 0, total: 0 });
    return {
      ok: true,
      quote: {
        quoteNumber: 'QT-2026-10-01-001',
        title: 'Dubai honeymoon — 4 pax',
        currency: 'INR',
        total: totals.total,
        costTotal: totals.costTotal,
        margin: totals.margin,
        itinerary: 'Day 1: Arrive DXB\nDay 2–4: Safari & city\nDay 5: Fly home',
        days,
        inclusions: 'Hotel 4★ · Transfers · Desert safari',
      },
      branding: { agencyName: 'Vardhan Travels (demo)' },
    };
  }
  const res = await fetch(`${apiBase()}/travel/proposal/public/${token}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to load');
  return json;
}

export async function acceptPublicProposal(token: string) {
  if (token === 'demo' || isTravelDemo()) return { ok: true, quoteNumber: 'QT-2026-10-01-001' };
  const res = await fetch(`${apiBase()}/travel/proposal/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Accept failed');
  return json;
}
