import * as admin from 'firebase-admin';

export type StoreEventStatus = 'draft' | 'scheduled' | 'active' | 'ended' | 'cancelled';
export type StoreEventSaleMode = 'mark_only';

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

export type StoreEventTicketStatus = 'issued' | 'checked_in' | 'linked' | 'cancelled';

export type StoreEventRecord = {
  name: string;
  startAt: FirebaseFirestore.Timestamp;
  endAt: FirebaseFirestore.Timestamp;
  status: StoreEventStatus;
  saleMode: StoreEventSaleMode;
  settings: StoreEventSettings;
  createdAt: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  updatedAt: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue | string;
  updatedBy: 'grabio' | 'pos';
};

export type StoreEventSnapshot = {
  id: string;
  name: string;
  startAt: string;
  endAt: string;
  status: StoreEventStatus;
  saleMode: StoreEventSaleMode;
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
  saleMode: StoreEventSaleMode;
  settings: StoreEventSettings;
  setAt: string | null;
  setBy: 'grabio' | 'pos';
};

export const ACTIVE_EVENT_DOC_ID = 'activeEvent';
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

export type StoreEventTicketSnapshot = {
  id: string;
  eventId: string;
  ticketNumber: string;
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  entryFeeAmount: number | null;
  entryFeePaid: boolean;
  status: StoreEventTicketStatus;
  linkedOrderId: string | null;
  linkedLocalSaleId: string | null;
  linkedAt: string | null;
  notes: string;
  createdAt: string | null;
  updatedAt: string | null;
};

const TICKET_STATUSES = new Set<StoreEventTicketStatus>(['issued', 'checked_in', 'linked', 'cancelled']);

const EVENT_STATUSES = new Set<StoreEventStatus>([
  'draft',
  'scheduled',
  'active',
  'ended',
  'cancelled',
]);

function timestampToIso(value: unknown): string | null {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as FirebaseFirestore.Timestamp).toDate().toISOString();
  }
  if (typeof value === 'string' && value.trim()) return value.trim();
  return null;
}

export function normalizeEventSettings(raw: unknown): StoreEventSettings {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const percentRaw = input.percent;
  const entryFeeRaw = input.entryFee;
  const freeDrinkProductId = String(input.freeDrinkProductId || '').trim() || null;

  return {
    percent: percentRaw == null || percentRaw === '' ? null : Number(percentRaw),
    entryFee: entryFeeRaw == null || entryFeeRaw === '' ? null : Number(entryFeeRaw),
    freeDrinkProductId,
    entryFeeEnabled: input.entryFeeEnabled === true,
    discountEnabled: input.discountEnabled === true,
    requireGuestName: input.requireGuestName !== false,
    linkTicketsToSales: input.linkTicketsToSales === true,
    reservationsEnabled: input.reservationsEnabled === true,
  };
}

export function parseEventTimestamp(value: unknown, fieldName: string): FirebaseFirestore.Timestamp {
  if (value && typeof value === 'object' && 'toDate' in value) {
    return value as FirebaseFirestore.Timestamp;
  }
  if (typeof value === 'string' && value.trim()) {
    const date = new Date(value.trim());
    if (Number.isNaN(date.getTime())) {
      throw new Error(`Invalid ${fieldName}`);
    }
    return admin.firestore.Timestamp.fromDate(date);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return admin.firestore.Timestamp.fromMillis(value);
  }
  throw new Error(`${fieldName} required`);
}

export function serializeStoreEvent(
  eventId: string,
  data: FirebaseFirestore.DocumentData,
): StoreEventSnapshot {
  return {
    id: eventId,
    name: String(data.name || '').trim(),
    startAt: timestampToIso(data.startAt) || '',
    endAt: timestampToIso(data.endAt) || '',
    status: (EVENT_STATUSES.has(data.status) ? data.status : 'draft') as StoreEventStatus,
    saleMode: data.saleMode === 'mark_only' ? 'mark_only' : 'mark_only',
    settings: normalizeEventSettings(data.settings),
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
    updatedBy: data.updatedBy === 'pos' ? 'pos' : 'grabio',
  };
}

export function serializeActiveEventPointer(
  data: FirebaseFirestore.DocumentData | undefined,
): ActiveEventPointer | null {
  if (!data) return null;
  const eventId = String(data.eventId || '').trim();
  if (!eventId) return null;

  return {
    eventId,
    name: String(data.name || '').trim(),
    startAt: timestampToIso(data.startAt) || '',
    endAt: timestampToIso(data.endAt) || '',
    status: (EVENT_STATUSES.has(data.status) ? data.status : 'active') as StoreEventStatus,
    saleMode: data.saleMode === 'mark_only' ? 'mark_only' : 'mark_only',
    settings: normalizeEventSettings(data.settings),
    setAt: timestampToIso(data.setAt),
    setBy: data.setBy === 'pos' ? 'pos' : 'grabio',
  };
}

export function normalizeEventStatus(value: unknown): StoreEventStatus | null {
  const status = String(value || '').trim() as StoreEventStatus;
  return EVENT_STATUSES.has(status) ? status : null;
}

export function buildEventWritePayload(input: {
  name?: unknown;
  startAt?: unknown;
  endAt?: unknown;
  status?: unknown;
  settings?: unknown;
  updatedBy?: 'grabio' | 'pos';
  existing?: FirebaseFirestore.DocumentData;
}): Partial<StoreEventRecord> {
  const existing = input.existing || {};
  const name = String(input.name ?? existing.name ?? '').trim();
  if (!name) throw new Error('name required');

  const startAt = input.startAt != null
    ? parseEventTimestamp(input.startAt, 'startAt')
    : parseEventTimestamp(existing.startAt, 'startAt');
  const endAt = input.endAt != null
    ? parseEventTimestamp(input.endAt, 'endAt')
    : parseEventTimestamp(existing.endAt, 'endAt');

  if (startAt.toMillis() > endAt.toMillis()) {
    throw new Error('startAt must be before endAt');
  }

  const status = normalizeEventStatus(input.status ?? existing.status) || 'draft';

  return {
    name,
    startAt,
    endAt,
    status,
    saleMode: 'mark_only',
    settings: normalizeEventSettings(input.settings ?? existing.settings),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: input.updatedBy || 'grabio',
  };
}

export async function loadStoreEvent(
  db: FirebaseFirestore.Firestore,
  storeId: string,
  eventId: string,
): Promise<{ id: string; data: FirebaseFirestore.DocumentData } | null> {
  const snap = await db
    .collection('stores')
    .doc(storeId)
    .collection('storeEvents')
    .doc(eventId)
    .get();
  if (!snap.exists) return null;
  return { id: snap.id, data: snap.data() as FirebaseFirestore.DocumentData };
}

export async function validateEventBelongsToStore(
  db: FirebaseFirestore.Firestore,
  storeId: string,
  eventId: string,
): Promise<{ ok: true; event: StoreEventSnapshot } | { ok: false; error: string }> {
  const loaded = await loadStoreEvent(db, storeId, eventId);
  if (!loaded) return { ok: false, error: 'Event not found' };
  const event = serializeStoreEvent(loaded.id, loaded.data);
  if (event.status === 'cancelled') return { ok: false, error: 'Event is cancelled' };
  return { ok: true, event };
}

export function parseSinceTimestamp(value: unknown): Date | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function ticketsCollection(
  db: FirebaseFirestore.Firestore,
  storeId: string,
  eventId: string,
) {
  return db.collection('stores').doc(storeId).collection('storeEvents').doc(eventId).collection('eventTickets');
}

export function serializeEventTicket(
  eventId: string,
  ticketId: string,
  data: FirebaseFirestore.DocumentData,
): StoreEventTicketSnapshot {
  const statusRaw = String(data.status || 'issued').trim() as StoreEventTicketStatus;
  return {
    id: ticketId,
    eventId,
    ticketNumber: String(data.ticketNumber || '').trim(),
    guestName: String(data.guestName || '').trim(),
    guestPhone: String(data.guestPhone || '').trim(),
    guestEmail: String(data.guestEmail || '').trim(),
    entryFeeAmount: data.entryFeeAmount == null || data.entryFeeAmount === ''
      ? null
      : Number(data.entryFeeAmount),
    entryFeePaid: data.entryFeePaid === true,
    status: TICKET_STATUSES.has(statusRaw) ? statusRaw : 'issued',
    linkedOrderId: String(data.linkedOrderId || '').trim() || null,
    linkedLocalSaleId: String(data.linkedLocalSaleId || '').trim() || null,
    linkedAt: timestampToIso(data.linkedAt),
    notes: String(data.notes || '').trim(),
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

export function formatTicketNumber(sequence: number): string {
  return `T-${String(sequence).padStart(4, '0')}`;
}

function storeEventRef(db: FirebaseFirestore.Firestore, storeId: string, eventId: string) {
  return db.collection('stores').doc(storeId).collection('storeEvents').doc(eventId);
}

export async function createEventEntryTicketRecord(
  db: FirebaseFirestore.Firestore,
  storeId: string,
  eventId: string,
  input: {
    guestName: string;
    guestPhone?: string;
    guestEmail?: string;
    entryFeePaid?: boolean;
    notes?: string;
    createdBy?: string;
    source?: 'grabio' | 'pos';
  },
): Promise<{ ticketId: string; ticket: StoreEventTicketSnapshot }> {
  const eventCheck = await validateEventBelongsToStore(db, storeId, eventId);
  if (!eventCheck.ok) throw new Error(eventCheck.error);

  const guestName = String(input.guestName || '').trim();
  if (!guestName && eventCheck.event.settings.requireGuestName) {
    throw new Error('guestName required');
  }

  const ticketRef = ticketsCollection(db, storeId, eventId).doc();
  await db.runTransaction(async (tx: FirebaseFirestore.Transaction) => {
    const eventDoc = (await tx.get(storeEventRef(db, storeId, eventId))) as unknown as FirebaseFirestore.DocumentSnapshot;
    if (!eventDoc.exists) throw new Error('Event not found');

    const lastTicketNumber = Number(eventDoc.data()?.lastTicketNumber || 0);
    const nextNumber = Number.isFinite(lastTicketNumber) ? lastTicketNumber + 1 : 1;
    const settings = eventCheck.event.settings;
    const entryFeeAmount = settings.entryFeeEnabled && settings.entryFee != null
      ? Number(settings.entryFee)
      : null;

    tx.set(ticketRef, {
      ticketNumber: formatTicketNumber(nextNumber),
      guestName,
      guestPhone: String(input.guestPhone || '').trim(),
      guestEmail: String(input.guestEmail || '').trim(),
      entryFeeAmount,
      entryFeePaid: input.entryFeePaid === true,
      status: 'issued',
      notes: String(input.notes || '').trim(),
      issuedFrom: input.source || 'grabio',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: String(input.createdBy || '').trim() || null,
    });
    tx.set(storeEventRef(db, storeId, eventId), { lastTicketNumber: nextNumber }, { merge: true });
  });

  const snap = await ticketRef.get();
  return {
    ticketId: ticketRef.id,
    ticket: serializeEventTicket(eventId, ticketRef.id, snap.data() || {}),
  };
}

export async function linkEventTicketToOrder(
  db: FirebaseFirestore.Firestore,
  storeId: string,
  eventId: string,
  ticketId: string,
  orderId: string,
  localSaleId?: string,
): Promise<{ ok: true; ticket: StoreEventTicketSnapshot } | { ok: false; error: string }> {
  const ticketRef = ticketsCollection(db, storeId, eventId).doc(ticketId);
  const ticketSnap = await ticketRef.get();
  if (!ticketSnap.exists) return { ok: false, error: 'Ticket not found' };

  const ticket = serializeEventTicket(eventId, ticketId, ticketSnap.data() as FirebaseFirestore.DocumentData);
  if (ticket.status === 'cancelled') return { ok: false, error: 'Ticket is cancelled' };
  if (ticket.status === 'linked' && ticket.linkedOrderId && ticket.linkedOrderId !== orderId) {
    return { ok: false, error: 'Ticket already linked to another sale' };
  }

  await ticketRef.set({
    status: 'linked',
    linkedOrderId: orderId,
    linkedLocalSaleId: String(localSaleId || '').trim() || null,
    linkedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  const updated = await ticketRef.get();
  return {
    ok: true,
    ticket: serializeEventTicket(eventId, ticketId, updated.data() as FirebaseFirestore.DocumentData),
  };
}

