export type StoreEventStatus = 'draft' | 'scheduled' | 'active' | 'ended' | 'cancelled';

export type StoreEventSettings = {
  percent: number | null;
  entryFee: number | null;
  freeDrinkProductId: string | null;
  entryFeeEnabled: boolean;
  discountEnabled: boolean;
  requireGuestName: boolean;
  linkTicketsToSales: boolean;
  reservationsEnabled: boolean;
};

export type StoreEvent = {
  id: string;
  name: string;
  startAt: string;
  endAt: string;
  status: StoreEventStatus;
  saleMode: 'mark_only';
  settings: StoreEventSettings;
  createdAt: string | null;
  updatedAt: string | null;
  updatedBy: 'grabio' | 'pos';
};

export type ActiveEventPointer = {
  eventId: string;
  name: string;
  startAt: string;
  endAt: string;
  status: StoreEventStatus;
  saleMode: 'mark_only';
  settings: StoreEventSettings;
  setAt: string | null;
  setBy: 'grabio' | 'pos';
};

export type EventReservationStatus = 'pending' | 'confirmed' | 'seated' | 'cancelled' | 'no_show';

export type EventReservation = {
  id: string;
  eventId: string;
  eventName: string;
  guestName: string;
  guestPhone: string;
  partySize: number;
  reservedFor: string;
  notes: string;
  status: EventReservationStatus;
  createdAt: string | null;
  updatedAt: string | null;
};

export type EventTicketStatus = 'issued' | 'checked_in' | 'linked' | 'cancelled';

export type EventTicket = {
  id: string;
  eventId: string;
  ticketNumber: string;
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  entryFeeAmount: number | null;
  entryFeePaid: boolean;
  status: EventTicketStatus;
  linkedOrderId: string | null;
  linkedLocalSaleId: string | null;
  linkedAt: string | null;
  notes: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export const DEFAULT_EVENT_SETTINGS: StoreEventSettings = {
  percent: null,
  entryFee: null,
  freeDrinkProductId: null,
  entryFeeEnabled: false,
  discountEnabled: false,
  requireGuestName: true,
  linkTicketsToSales: true,
  reservationsEnabled: false,
};
