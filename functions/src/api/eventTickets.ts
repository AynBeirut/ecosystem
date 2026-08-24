import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { canUseModule } from '../lib/entitlements';
import { verifyPosDevice } from '../services/posDeviceAuth';
import {
  linkEventTicketToOrder,
  loadStoreEvent,
  serializeEventTicket,
  ticketsCollection,
  validateEventBelongsToStore,
  createEventEntryTicketRecord,
} from '../lib/storeEventsCore';
import { entryFeeBlocksTicketLink } from '../lib/eventPricing';

const db = admin.firestore();

async function resolveStoreIdForOwnerUid(uid: string): Promise<string> {
  const sellerSnap = await db.collection('sellers').doc(uid).get();
  if (sellerSnap.exists) {
    const sellerStoreId = String(sellerSnap.data()?.storeId || '').trim();
    if (sellerStoreId) return sellerStoreId;
  }
  const userSnap = await db.collection('users').doc(uid).get();
  if (userSnap.exists) {
    const data = userSnap.data() || {};
    const active = String(data.activeStoreId || data.primaryStoreId || data.storeId || '').trim();
    if (active) return active;
  }
  return uid;
}

async function assertOwnerOfStore(uid: string, storeId: string): Promise<boolean> {
  if (!uid || !storeId) return false;
  if (uid === storeId) return true;
  const profile = (await db.collection('storeProfiles').doc(storeId).get()).data();
  if (profile?.ownerId === uid) return true;
  return (await resolveStoreIdForOwnerUid(uid)) === storeId;
}

async function authenticateOwnerRequest(
  req: Request,
): Promise<{ ok: true; uid: string; storeId: string } | { ok: false; status: number; error: string }> {
  const authHeader = req.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!bearerToken) return { ok: false, status: 401, error: 'Unauthorized' };

  const decoded = await admin.auth().verifyIdToken(bearerToken);
  const storeId = String(req.query.storeId || req.body?.storeId || '').trim()
    || (await resolveStoreIdForOwnerUid(decoded.uid));

  if (!(await assertOwnerOfStore(decoded.uid, storeId))) {
    return { ok: false, status: 403, error: 'Unauthorized' };
  }

  const profile = (await db.collection('storeProfiles').doc(storeId).get()).data();
  if (!canUseModule(profile, 'pos')) {
    return { ok: false, status: 403, error: 'POS module not enabled' };
  }

  return { ok: true, uid: decoded.uid, storeId };
}

function readPosAuthFromQuery(req: Request) {
  return {
    storeId: String(req.query.storeId || '').trim(),
    deviceId: String(req.query.deviceId || '').trim(),
    deviceToken: String(req.query.deviceToken || '').trim(),
  };
}

function readPosAuthFromBody(req: Request) {
  return {
    storeId: String(req.body?.storeId || '').trim(),
    deviceId: String(req.body?.deviceId || '').trim(),
    deviceToken: String(req.body?.deviceToken || '').trim(),
  };
}

async function authenticatePosDevice(
  storeId: string,
  deviceId: string,
  deviceToken: string,
): Promise<{ ok: true; storeId: string; deviceId: string } | { ok: false; status: number; error: string }> {
  const auth = await verifyPosDevice(db, storeId, deviceId, deviceToken);
  if (!auth.ok) return { ok: false, status: auth.status, error: auth.error };

  const profile = (await db.collection('storeProfiles').doc(storeId).get()).data();
  if (!canUseModule(profile, 'pos')) {
    return { ok: false, status: 403, error: 'POS module not enabled' };
  }

  return { ok: true, storeId, deviceId };
}

function storeEventRef(storeId: string, eventId: string) {
  return db.collection('stores').doc(storeId).collection('storeEvents').doc(eventId);
}

export async function createEventTicket(req: Request, res: Response): Promise<void> {
  try {
    const auth = await authenticateOwnerRequest(req);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }

    const eventId = String(req.params.eventId || '').trim();
    const eventCheck = await validateEventBelongsToStore(db, auth.storeId, eventId);
    if (!eventCheck.ok) {
      res.status(404).json({ error: eventCheck.error });
      return;
    }

    const settings = eventCheck.event.settings;
    const guestName = String(req.body?.guestName || '').trim();
    if (!guestName && settings.requireGuestName) {
      res.status(400).json({ error: 'guestName required' });
      return;
    }

    const created = await createEventEntryTicketRecord(db, auth.storeId, eventId, {
      guestName,
      guestPhone: String(req.body?.guestPhone || '').trim(),
      guestEmail: String(req.body?.guestEmail || '').trim(),
      entryFeePaid: req.body?.entryFeePaid === true,
      notes: String(req.body?.notes || '').trim(),
      createdBy: auth.uid,
      source: 'grabio',
    });

    res.status(201).json({
      success: true,
      ticket: created.ticket,
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Create ticket failed' });
  }
}

export async function issuePosEventEntryTicket(req: Request, res: Response): Promise<void> {
  try {
    const { storeId, deviceId, deviceToken } = readPosAuthFromBody(req);
    const auth = await authenticatePosDevice(storeId, deviceId, deviceToken);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }

    const eventId = String(req.body?.eventId || '').trim();
    const guestName = String(req.body?.guestName || '').trim();
    if (!eventId) {
      res.status(400).json({ error: 'eventId required' });
      return;
    }
    if (!guestName) {
      res.status(400).json({ error: 'guestName required' });
      return;
    }

    const created = await createEventEntryTicketRecord(db, auth.storeId, eventId, {
      guestName,
      guestPhone: String(req.body?.guestPhone || '').trim(),
      entryFeePaid: req.body?.entryFeePaid !== false,
      notes: String(req.body?.notes || 'Issued from POS').trim(),
      createdBy: auth.deviceId,
      source: 'pos',
    });

    res.status(201).json({
      success: true,
      ticket: created.ticket,
      entryTicketProductId: `event-entry-${auth.storeId}-${eventId}`,
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Issue entry ticket failed' });
  }
}

export async function listEventTickets(req: Request, res: Response): Promise<void> {
  try {
    const auth = await authenticateOwnerRequest(req);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }

    const eventId = String(req.params.eventId || '').trim();
    const loaded = await loadStoreEvent(db, auth.storeId, eventId);
    if (!loaded) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    const snap = await ticketsCollection(db, auth.storeId, eventId)
      .orderBy('createdAt', 'desc')
      .limit(500)
      .get();

    const tickets = snap.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) =>
      serializeEventTicket(eventId, doc.id, doc.data()),
    );
    res.json({
      success: true,
      tickets,
      summary: {
        total: tickets.length,
        linked: tickets.filter((t) => t.status === 'linked').length,
        issued: tickets.filter((t) => t.status === 'issued' || t.status === 'checked_in').length,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'List tickets failed' });
  }
}

export async function updateEventTicket(req: Request, res: Response): Promise<void> {
  try {
    const auth = await authenticateOwnerRequest(req);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }

    const eventId = String(req.params.eventId || '').trim();
    const ticketId = String(req.params.ticketId || '').trim();
    const ticketRef = ticketsCollection(db, auth.storeId, eventId).doc(ticketId);
    const ticketSnap = await ticketRef.get();
    if (!ticketSnap.exists) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    const existing = ticketSnap.data() || {};
    if (existing.status === 'linked') {
      res.status(400).json({ error: 'Linked tickets cannot be edited' });
      return;
    }

    const guestName = req.body?.guestName != null
      ? String(req.body.guestName).trim()
      : String(existing.guestName || '').trim();
    if (!guestName) {
      res.status(400).json({ error: 'guestName required' });
      return;
    }

    await ticketRef.set({
      guestName,
      guestPhone: req.body?.guestPhone != null ? String(req.body.guestPhone).trim() : existing.guestPhone,
      guestEmail: req.body?.guestEmail != null ? String(req.body.guestEmail).trim() : existing.guestEmail,
      entryFeePaid: req.body?.entryFeePaid != null ? req.body.entryFeePaid === true : existing.entryFeePaid === true,
      status: req.body?.status === 'checked_in' ? 'checked_in' : existing.status,
      notes: req.body?.notes != null ? String(req.body.notes).trim() : existing.notes,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    const updated = await ticketRef.get();
    res.json({
      success: true,
      ticket: serializeEventTicket(eventId, ticketId, updated.data() || {}),
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Update ticket failed' });
  }
}

export async function cancelEventTicket(req: Request, res: Response): Promise<void> {
  try {
    const auth = await authenticateOwnerRequest(req);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }

    const eventId = String(req.params.eventId || '').trim();
    const ticketId = String(req.params.ticketId || '').trim();
    const ticketRef = ticketsCollection(db, auth.storeId, eventId).doc(ticketId);
    const ticketSnap = await ticketRef.get();
    if (!ticketSnap.exists) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    if (ticketSnap.data()?.status === 'linked') {
      res.status(400).json({ error: 'Linked tickets cannot be cancelled' });
      return;
    }

    await ticketRef.set({
      status: 'cancelled',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    const updated = await ticketRef.get();
    res.json({
      success: true,
      ticket: serializeEventTicket(eventId, ticketId, updated.data() || {}),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Cancel ticket failed' });
  }
}

async function lookupTickets(
  storeId: string,
  eventId: string,
  ticketNumber: string,
  guestName: string,
) {
  const col = ticketsCollection(db, storeId, eventId);
  if (ticketNumber) {
    const snap = await col.where('ticketNumber', '==', ticketNumber).limit(5).get();
    return snap.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) =>
      serializeEventTicket(eventId, doc.id, doc.data()),
    );
  }

  if (guestName) {
    const normalized = guestName.toLowerCase();
    const snap = await col.orderBy('createdAt', 'desc').limit(200).get();
    return snap.docs
      .map((doc: FirebaseFirestore.QueryDocumentSnapshot) => serializeEventTicket(eventId, doc.id, doc.data()))
      .filter((ticket) => ticket.guestName.toLowerCase().includes(normalized));
  }

  return [];
}

export async function lookupEventTicketsAdmin(req: Request, res: Response): Promise<void> {
  try {
    const auth = await authenticateOwnerRequest(req);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }

    const eventId = String(req.params.eventId || '').trim();
    const ticketNumber = String(req.query.ticketNumber || '').trim();
    const guestName = String(req.query.guestName || '').trim();
    if (!ticketNumber && !guestName) {
      res.status(400).json({ error: 'ticketNumber or guestName required' });
      return;
    }

    res.json({
      success: true,
      tickets: await lookupTickets(auth.storeId, eventId, ticketNumber, guestName),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Ticket lookup failed' });
  }
}

export async function lookupPosEventTickets(req: Request, res: Response): Promise<void> {
  try {
    const { storeId, deviceId, deviceToken } = readPosAuthFromQuery(req);
    const auth = await authenticatePosDevice(storeId, deviceId, deviceToken);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }

    const eventId = String(req.query.eventId || '').trim();
    const ticketNumber = String(req.query.ticketNumber || '').trim();
    const guestName = String(req.query.guestName || '').trim();
    if (!eventId) {
      res.status(400).json({ error: 'eventId required' });
      return;
    }
    if (!ticketNumber && !guestName) {
      res.status(400).json({ error: 'ticketNumber or guestName required' });
      return;
    }

    const eventCheck = await validateEventBelongsToStore(db, auth.storeId, eventId);
    if (!eventCheck.ok) {
      res.status(404).json({ error: eventCheck.error });
      return;
    }

    const tickets = (await lookupTickets(auth.storeId, eventId, ticketNumber, guestName))
      .filter((ticket) => ticket.status !== 'cancelled');

    res.json({
      success: true,
      event: eventCheck.event,
      tickets,
      linkTicketsToSales: eventCheck.event.settings.linkTicketsToSales,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'POS ticket lookup failed' });
  }
}

export async function linkPosEventTicket(req: Request, res: Response): Promise<void> {
  try {
    const { storeId, deviceId, deviceToken } = readPosAuthFromBody(req);
    const auth = await authenticatePosDevice(storeId, deviceId, deviceToken);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }

    const eventId = String(req.body?.eventId || '').trim();
    const ticketId = String(req.body?.ticketId || '').trim();
    const orderId = String(req.body?.orderId || '').trim();
    const localSaleId = String(req.body?.localSaleId || '').trim();

    if (!eventId || !ticketId || !orderId) {
      res.status(400).json({ error: 'eventId, ticketId, and orderId required' });
      return;
    }

    const eventCheck = await validateEventBelongsToStore(db, auth.storeId, eventId);
    if (!eventCheck.ok) {
      res.status(404).json({ error: eventCheck.error });
      return;
    }

    const orderSnap = await db.collection('orders').doc(orderId).get();
    if (!orderSnap.exists || orderSnap.data()?.storeId !== auth.storeId) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const ticketSnap = await ticketsCollection(db, auth.storeId, eventId).doc(ticketId).get();
    if (!ticketSnap.exists) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }
    const ticketPreview = serializeEventTicket(eventId, ticketId, ticketSnap.data() || {});
    if (entryFeeBlocksTicketLink(eventCheck.event.settings, ticketPreview)) {
      res.status(400).json({ error: 'Entry fee must be paid before linking this ticket to a sale' });
      return;
    }

    const linkResult = await linkEventTicketToOrder(
      db,
      auth.storeId,
      eventId,
      ticketId,
      orderId,
      localSaleId,
    );
    if (!linkResult.ok) {
      res.status(400).json({ error: linkResult.error });
      return;
    }

    await db.collection('orders').doc(orderId).set({
      eventTicketId: ticketId,
      eventTicketNumber: linkResult.ticket.ticketNumber,
      eventGuestName: linkResult.ticket.guestName,
      isEventSale: true,
      eventId,
      eventName: eventCheck.event.name,
    }, { merge: true });

    res.json({ success: true, ticket: linkResult.ticket });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Link ticket failed' });
  }
}

export async function getPosEventTicketsSync(req: Request, res: Response): Promise<void> {
  try {
    const { storeId, deviceId, deviceToken } = readPosAuthFromQuery(req);
    const auth = await authenticatePosDevice(storeId, deviceId, deviceToken);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }

    const eventId = String(req.query.eventId || '').trim();
    if (!eventId) {
      res.status(400).json({ error: 'eventId required' });
      return;
    }

    const snap = await ticketsCollection(db, auth.storeId, eventId)
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get();

    const tickets = snap.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) =>
      serializeEventTicket(eventId, doc.id, doc.data()),
    );
    res.json({ success: true, tickets, syncedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'POS ticket sync failed' });
  }
}
