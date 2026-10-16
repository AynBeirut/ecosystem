import type {
  NextraBookRequest,
  NextraBookResult,
  NextraBookingSummary,
  NextraOffer,
  NextraSearchParams,
  NextraWalletSnapshot,
} from './types';

export function mockWallet(): NextraWalletSnapshot {
  return {
    balance: 0,
    available: 26670,
    due: 73330,
    currency: 'INR',
    asOf: new Date().toISOString(),
  };
}

export function mockSearch(params: NextraSearchParams): NextraOffer[] {
  const route = `${params.origin || 'DEL'}-${params.destination || 'DXB'}`;
  return [
    {
      offerId: `mock-${route}-1`,
      title: `${route} · Morning non-stop`,
      currency: 'INR',
      totalPrice: 18450,
      supplierName: 'Mock Air',
      summary: `${params.adults} adult(s) · ${params.departureDate || 'TBD'}`,
    },
    {
      offerId: `mock-${route}-2`,
      title: `${route} · Afternoon 1-stop`,
      currency: 'INR',
      totalPrice: 15200,
      supplierName: 'Mock Air',
      summary: `${params.adults} adult(s) · ${params.departureDate || 'TBD'}`,
    },
  ];
}

export function mockBook(req: NextraBookRequest): NextraBookResult {
  const suffix = Math.floor(100000 + Math.random() * 900000);
  return {
    bookingRef: `BK-${suffix}`,
    pnr: `PNR${suffix}`,
    status: 'confirmed',
  };
}

export function mockBookingList(): NextraBookingSummary[] {
  return [
    {
      bookingRef: 'BK-482910',
      pnr: 'PNR482910',
      status: 'confirmed',
      productType: 'flight',
      title: 'DEL → DXB',
      totalPrice: 18450,
      currency: 'INR',
      bookedAt: new Date().toISOString(),
    },
  ];
}
