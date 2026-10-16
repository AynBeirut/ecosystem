export type NextraProductType = 'flight' | 'hotel' | 'activity' | 'cab' | 'group_tour';

export interface NextraSearchParams {
  productType: NextraProductType;
  origin?: string;
  destination?: string;
  departureDate?: string;
  returnDate?: string;
  adults: number;
  children?: number;
  infants?: number;
}

export interface NextraOffer {
  offerId: string;
  title: string;
  currency: string;
  totalPrice: number;
  supplierName?: string;
  summary?: string;
  raw?: Record<string, unknown>;
}

export interface NextraWalletSnapshot {
  balance: number;
  available: number;
  due: number;
  currency: string;
  asOf: string;
}

export interface NextraBookingSummary {
  bookingRef: string;
  pnr?: string;
  status: string;
  productType: NextraProductType;
  title: string;
  totalPrice: number;
  currency: string;
  bookedAt?: string;
  raw?: Record<string, unknown>;
}

export interface NextraBookRequest {
  offerId: string;
  productType: NextraProductType;
  dealId?: string;
  passengers?: Array<{ firstName: string; lastName: string; type: 'adult' | 'child' | 'infant' }>;
}

export interface NextraBookResult {
  bookingRef: string;
  pnr?: string;
  status: string;
}

export interface NextraTenantConfig {
  apiBaseUrl: string;
  apiKey?: string;
  agentUserId?: string;
}
