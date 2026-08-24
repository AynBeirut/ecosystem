import { auth } from '@/lib/firebase';
import type { ActiveEventPointer, EventTicket, StoreEvent, StoreEventSettings } from '@/types/storeEvents';

const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ||
  'https://us-central1-market-flow-7b074.cloudfunctions.net/api';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Sign in required');
  const token = await currentUser.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data as T;
}

export async function listStoreEvents(params?: {
  from?: string;
  to?: string;
  status?: string;
}): Promise<{ events: StoreEvent[]; activeEvent: ActiveEventPointer | null }> {
  const headers = await getAuthHeaders();
  const query = new URLSearchParams();
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  if (params?.status) query.set('status', params.status);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const response = await fetch(`${API_BASE}/store/events${suffix}`, { headers });
  return parseResponse(response);
}

export async function createStoreEvent(payload: {
  name: string;
  startAt: string;
  endAt: string;
  status?: string;
  settings?: Partial<StoreEventSettings>;
}): Promise<StoreEvent> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/store/events`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await parseResponse<{ event: StoreEvent }>(response);
  return data.event;
}

export async function updateStoreEvent(
  eventId: string,
  payload: {
    name?: string;
    startAt?: string;
    endAt?: string;
    status?: string;
    settings?: Partial<StoreEventSettings>;
  },
): Promise<StoreEvent> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/store/events/${eventId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await parseResponse<{ event: StoreEvent }>(response);
  return data.event;
}

export async function cancelStoreEvent(eventId: string): Promise<StoreEvent> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/store/events/${eventId}/cancel`, {
    method: 'POST',
    headers,
  });
  const data = await parseResponse<{ event: StoreEvent }>(response);
  return data.event;
}

export async function setActiveStoreEvent(eventId: string): Promise<ActiveEventPointer | null> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/store/events/active`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ eventId }),
  });
  const data = await parseResponse<{ activeEvent: ActiveEventPointer | null }>(response);
  return data.activeEvent;
}

export async function clearActiveStoreEvent(): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/store/events/active`, {
    method: 'DELETE',
    headers,
  });
  await parseResponse(response);
}

export async function listEventTickets(eventId: string): Promise<{
  tickets: EventTicket[];
  summary: { total: number; linked: number; issued: number };
}> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/store/events/${eventId}/tickets`, { headers });
  return parseResponse(response);
}

export async function createEventTicket(
  eventId: string,
  payload: {
    guestName: string;
    guestPhone?: string;
    guestEmail?: string;
    entryFeePaid?: boolean;
    notes?: string;
  },
): Promise<EventTicket> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/store/events/${eventId}/tickets`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await parseResponse<{ ticket: EventTicket }>(response);
  return data.ticket;
}

export async function cancelEventTicket(eventId: string, ticketId: string): Promise<EventTicket> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/store/events/${eventId}/tickets/${ticketId}/cancel`, {
    method: 'POST',
    headers,
  });
  const data = await parseResponse<{ ticket: EventTicket }>(response);
  return data.ticket;
}

export async function listStoreReservations(params?: {
  from?: string;
  to?: string;
}): Promise<{ reservations: import('@/types/storeEvents').EventReservation[] }> {
  const headers = await getAuthHeaders();
  const query = new URLSearchParams();
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const response = await fetch(`${API_BASE}/store/events/reservations${suffix}`, { headers });
  return parseResponse(response);
}

export async function listEventReservations(eventId: string) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/store/events/${eventId}/reservations`, { headers });
  return parseResponse<{ reservations: import('@/types/storeEvents').EventReservation[] }>(response);
}

export async function createEventReservation(
  eventId: string,
  payload: {
    guestName: string;
    guestPhone?: string;
    partySize?: number;
    reservedFor: string;
    notes?: string;
  },
) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/store/events/${eventId}/reservations`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await parseResponse<{ reservation: import('@/types/storeEvents').EventReservation }>(response);
  return data.reservation;
}

export async function updateEventReservation(
  eventId: string,
  reservationId: string,
  payload: Partial<{
    guestName: string;
    guestPhone: string;
    partySize: number;
    reservedFor: string;
    notes: string;
    status: string;
  }>,
) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/store/events/${eventId}/reservations/${reservationId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await parseResponse<{ reservation: import('@/types/storeEvents').EventReservation }>(response);
  return data.reservation;
}
