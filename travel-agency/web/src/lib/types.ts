import type { TravelActivityType, TravelPipelineStage } from './travelConstants';

export interface TravelContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  createdAt: string;
}

export interface TravelDeal {
  id: string;
  title: string;
  contactId?: string;
  contactName?: string;
  stage: TravelPipelineStage;
  destination?: string;
  pax?: number;
  marginTotal?: number;
  bookingRef?: string;
  pnr?: string;
  assignedAgentId?: string;
  updatedAt: string;
  createdAt: string;
}

export interface TravelQuoteLine {
  label: string;
  cost: number;
  sell: number;
}

export interface TravelItineraryItem {
  id: string;
  type: 'flight' | 'hotel' | 'activity' | 'transfer' | 'note';
  title: string;
  time?: string;
  description?: string;
  imageUrl?: string;
  cost: number;
  sell: number;
}

export interface TravelItineraryDay {
  id: string;
  dayNumber: number;
  title: string;
  date?: string;
  items: TravelItineraryItem[];
}

export type SaveQuoteInput = Partial<TravelQuote> & {
  title: string;
  currency: string;
  /** On update: remove structured `days` when saving text-only. */
  clearStructuredDays?: boolean;
};

export interface TravelQuote {
  id: string;
  dealId: string;
  quoteNumber: string;
  title: string;
  customerName?: string;
  currency: string;
  total: number;
  costTotal: number;
  margin: number;
  itinerary: string;
  days?: TravelItineraryDay[];
  inclusions?: string;
  exclusions?: string;
  status: 'draft' | 'sent' | 'accepted' | 'expired';
  publicToken?: string;
  createdAt: string;
  updatedAt: string;
  lines?: TravelQuoteLine[];
}

export interface TravelActivity {
  id: string;
  dealId: string;
  dealTitle?: string;
  contactName?: string;
  type: TravelActivityType;
  note: string;
  createdAt: string;
}

export interface TravelTask {
  id: string;
  dealId?: string;
  dealTitle?: string;
  contactName?: string;
  title: string;
  dueDate?: string;
  status: 'open' | 'done';
  createdAt: string;
}
