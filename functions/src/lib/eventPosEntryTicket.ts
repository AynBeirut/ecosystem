import * as admin from 'firebase-admin';
import type { StoreEventSnapshot } from './storeEventsCore';
import { createEventEntryTicketRecord, linkEventTicketToOrder } from './storeEventsCore';

const db = admin.firestore();

export function eventEntryProductId(storeId: string, eventId: string): string {
  return `event-entry-${storeId}-${eventId}`;
}

export type PosEntryTicketPayload = {
  productId: string;
  eventId: string;
  label: string;
  amount: number;
  enabled: boolean;
  requiresGuestName: boolean;
  linkTicketsToSales: boolean;
};

export function buildPosEntryTicketPayload(event: StoreEventSnapshot): PosEntryTicketPayload {
  const settings = event.settings;
  const amount = settings.entryFeeEnabled && settings.entryFee != null
    ? Number(settings.entryFee)
    : 0;

  return {
    productId: eventEntryProductId('', event.id),
    eventId: event.id,
    label: `Entry · ${event.name}`,
    amount: Number.isFinite(amount) ? amount : 0,
    enabled: event.status !== 'cancelled' && event.status !== 'ended',
    requiresGuestName: settings.requireGuestName !== false,
    linkTicketsToSales: settings.linkTicketsToSales === true,
  };
}

export async function provisionPosEntryTicketProduct(
  storeId: string,
  eventId: string,
  event: StoreEventSnapshot,
): Promise<{ productId: string; entryTicket: PosEntryTicketPayload }> {
  const productId = eventEntryProductId(storeId, eventId);
  const settings = event.settings;
  const price = settings.entryFeeEnabled && settings.entryFee != null
    ? Number(settings.entryFee)
    : 0;
  const active = event.status !== 'cancelled' && event.status !== 'ended';

  await db.collection('products').doc(productId).set({
    storeId,
    eventId,
    name: `Entry · ${event.name}`,
    price: Number.isFinite(price) ? price : 0,
    category: 'Event Entry',
    productType: 'simple',
    type: 'simple',
    source: 'grabio-event',
    isEventEntryTicket: true,
    inStock: active,
    stock: active ? 999999 : 0,
    description: `Event entry ticket for ${event.name}`,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  await db.collection('stores').doc(storeId).collection('storeEvents').doc(eventId).set({
    posEntryTicketProductId: productId,
    posEntryTicketProvisionedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  const entryTicket = buildPosEntryTicketPayload({ ...event, id: eventId });
  return {
    productId,
    entryTicket: {
      ...entryTicket,
      productId,
      eventId,
    },
  };
}

export async function disablePosEntryTicketProduct(storeId: string, eventId: string): Promise<void> {
  const productId = eventEntryProductId(storeId, eventId);
  await db.collection('products').doc(productId).set({
    inStock: false,
    stock: 0,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

export async function loadProductEntryTicketMeta(
  productId: string,
): Promise<{ isEventEntryTicket: true; eventId: string; storeId: string } | null> {
  const snap = await db.collection('products').doc(productId).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  if (data.isEventEntryTicket !== true) return null;
  const eventId = String(data.eventId || '').trim();
  const storeId = String(data.storeId || '').trim();
  if (!eventId || !storeId) return null;
  return { isEventEntryTicket: true, eventId, storeId };
}

export function enrichEventForPos(
  event: StoreEventSnapshot,
  rawData?: FirebaseFirestore.DocumentData,
): StoreEventSnapshot & { posEntryTicketProductId: string | null; entryTicket: PosEntryTicketPayload } {
  const storeId = String(rawData?.storeId || '').trim();
  const productId = String(rawData?.posEntryTicketProductId || '').trim()
    || (storeId && event.id ? eventEntryProductId(storeId, event.id) : '');
  const entryTicket = buildPosEntryTicketPayload(event);

  return {
    ...event,
    posEntryTicketProductId: productId || null,
    entryTicket: {
      ...entryTicket,
      productId: productId || entryTicket.productId,
      eventId: event.id,
    },
  };
}

export async function autoIssueEntryTicketsFromPosOrder(
  db: FirebaseFirestore.Firestore,
  storeId: string,
  orderId: string,
  items: Array<{ productId: string; quantity: number }>,
  guest: { customerName: string; customerPhone?: string },
  localSaleId: string,
): Promise<Array<{ eventId: string; ticketId: string; ticketNumber: string }>> {
  const issued: Array<{ eventId: string; ticketId: string; ticketNumber: string }> = [];
  const seenEvents = new Set<string>();

  for (const item of items) {
    const meta = await loadProductEntryTicketMeta(String(item.productId || '').trim());
    if (!meta || meta.storeId !== storeId || seenEvents.has(meta.eventId)) continue;
    seenEvents.add(meta.eventId);

    const guestName = String(guest.customerName || '').trim() || 'Event Guest';
    const created = await createEventEntryTicketRecord(db, storeId, meta.eventId, {
      guestName,
      guestPhone: String(guest.customerPhone || '').trim(),
      entryFeePaid: true,
      notes: `Auto-issued from POS sale ${localSaleId}`,
      source: 'pos',
    });

    await linkEventTicketToOrder(db, storeId, meta.eventId, created.ticketId, orderId, localSaleId);
    await db.collection('orders').doc(orderId).set({
      isEventSale: true,
      eventId: meta.eventId,
      eventTicketId: created.ticketId,
      eventTicketNumber: created.ticket.ticketNumber,
      eventGuestName: guestName,
      eventEntryAutoIssued: true,
    }, { merge: true });

    issued.push({
      eventId: meta.eventId,
      ticketId: created.ticketId,
      ticketNumber: created.ticket.ticketNumber,
    });
  }

  return issued;
}
