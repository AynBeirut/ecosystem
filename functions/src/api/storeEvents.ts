import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { canUseModule } from '../lib/entitlements';
import { verifyPosDevice } from '../services/posDeviceAuth';
import {
  disablePosEntryTicketProduct,
  enrichEventForPos,
  eventEntryProductId,
  provisionPosEntryTicketProduct,
} from '../lib/eventPosEntryTicket';
import {
  ACTIVE_EVENT_DOC_ID,
  buildEventWritePayload,
  normalizeEventStatus,
  parseSinceTimestamp,
  serializeActiveEventPointer,
  serializeStoreEvent,
  validateEventBelongsToStore,
} from '../lib/storeEventsCore';

const db = admin.firestore();

const ONLINE_ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'preparing', 'ready'];

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

  const resolved = await resolveStoreIdForOwnerUid(uid);
  return resolved === storeId;
}

async function authenticateOwnerRequest(
  req: Request,
  requestedStoreId?: string,
): Promise<{ ok: true; uid: string; storeId: string } | { ok: false; status: number; error: string }> {
  const authHeader = req.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!bearerToken) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const decoded = await admin.auth().verifyIdToken(bearerToken);
  const storeId = String(requestedStoreId || req.query.storeId || req.body?.storeId || '').trim()
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

function eventsCollection(storeId: string) {
  return db.collection('stores').doc(storeId).collection('storeEvents');
}

function activeEventRef(storeId: string) {
  return db.collection('stores').doc(storeId).collection('posSettings').doc(ACTIVE_EVENT_DOC_ID);
}

async function readActiveEvent(storeId: string) {
  const snap = await activeEventRef(storeId).get();
  return serializeActiveEventPointer(snap.data());
}

async function writeActiveEventPointer(
  storeId: string,
  eventId: string,
  updatedBy: 'grabio' | 'pos',
): Promise<{ ok: true; activeEvent: ReturnType<typeof serializeActiveEventPointer> } | { ok: false; status: number; error: string }> {
  const loaded = await validateEventBelongsToStore(db, storeId, eventId);
  if (!loaded.ok) {
    return { ok: false, status: 404, error: loaded.error };
  }

  const eventRef = eventsCollection(storeId).doc(eventId);
  const batch = db.batch();
  batch.set(activeEventRef(storeId), {
    eventId,
    name: loaded.event.name,
    startAt: loaded.event.startAt,
    endAt: loaded.event.endAt,
    status: 'active',
    saleMode: loaded.event.saleMode,
    settings: loaded.event.settings,
    posEntryTicketProductId: eventEntryProductId(storeId, eventId),
    setAt: admin.firestore.FieldValue.serverTimestamp(),
    setBy: updatedBy,
  }, { merge: true });
  batch.set(eventRef, {
    status: 'active',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy,
  }, { merge: true });
  await batch.commit();

  const activeEvent = await readActiveEvent(storeId);
  return { ok: true, activeEvent };
}

export async function createStoreEvent(req: Request, res: Response): Promise<void> {
  try {
    const auth = await authenticateOwnerRequest(req);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }

    const payload = buildEventWritePayload({
      name: req.body?.name,
      startAt: req.body?.startAt,
      endAt: req.body?.endAt,
      status: req.body?.status || 'draft',
      settings: req.body?.settings,
      updatedBy: 'grabio',
    });

    const docRef = eventsCollection(auth.storeId).doc();
    await docRef.set({
      ...payload,
      storeId: auth.storeId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const snap = await docRef.get();
    const event = serializeStoreEvent(docRef.id, snap.data() || {});
    const provision = await provisionPosEntryTicketProduct(auth.storeId, docRef.id, event);

    res.status(201).json({
      success: true,
      event: enrichEventForPos(event, snap.data()),
      entryTicket: provision.entryTicket,
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Create event failed' });
  }
}

export async function listStoreEvents(req: Request, res: Response): Promise<void> {
  try {
    const auth = await authenticateOwnerRequest(req);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }

    const from = parseSinceTimestamp(req.query.from);
    const to = parseSinceTimestamp(req.query.to);
    const status = normalizeEventStatus(req.query.status);

    let query: FirebaseFirestore.Query = eventsCollection(auth.storeId).orderBy('startAt', 'asc');
    if (status) {
      query = query.where('status', '==', status);
    }

    const snap = await query.get();
    let events = snap.docs.map((doc) => serializeStoreEvent(doc.id, doc.data()));

    if (from) {
      events = events.filter((event) => event.endAt && new Date(event.endAt) >= from);
    }
    if (to) {
      events = events.filter((event) => event.startAt && new Date(event.startAt) <= to);
    }

    const activeEvent = await readActiveEvent(auth.storeId);
    res.json({ success: true, events, activeEvent });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'List events failed' });
  }
}

export async function getStoreEvent(req: Request, res: Response): Promise<void> {
  try {
    const auth = await authenticateOwnerRequest(req);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }

    const eventId = String(req.params.eventId || '').trim();
    if (!eventId) {
      res.status(400).json({ error: 'eventId required' });
      return;
    }

    const loaded = await validateEventBelongsToStore(db, auth.storeId, eventId);
    if (!loaded.ok) {
      res.status(404).json({ error: loaded.error });
      return;
    }

    res.json({ success: true, event: loaded.event });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Get event failed' });
  }
}

export async function updateStoreEvent(req: Request, res: Response): Promise<void> {
  try {
    const auth = await authenticateOwnerRequest(req);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }

    const eventId = String(req.params.eventId || '').trim();
    if (!eventId) {
      res.status(400).json({ error: 'eventId required' });
      return;
    }

    const existingSnap = await eventsCollection(auth.storeId).doc(eventId).get();
    if (!existingSnap.exists) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    const payload = buildEventWritePayload({
      name: req.body?.name,
      startAt: req.body?.startAt,
      endAt: req.body?.endAt,
      status: req.body?.status,
      settings: req.body?.settings,
      updatedBy: 'grabio',
      existing: existingSnap.data(),
    });

    await eventsCollection(auth.storeId).doc(eventId).set(payload, { merge: true });
    const updatedSnap = await eventsCollection(auth.storeId).doc(eventId).get();
    const event = serializeStoreEvent(eventId, updatedSnap.data() || {});
    const provision = await provisionPosEntryTicketProduct(auth.storeId, eventId, event);
    res.json({
      success: true,
      event: enrichEventForPos(event, updatedSnap.data()),
      entryTicket: provision.entryTicket,
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Update event failed' });
  }
}

export async function cancelStoreEvent(req: Request, res: Response): Promise<void> {
  try {
    const auth = await authenticateOwnerRequest(req);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }

    const eventId = String(req.params.eventId || '').trim();
    if (!eventId) {
      res.status(400).json({ error: 'eventId required' });
      return;
    }

    const eventRef = eventsCollection(auth.storeId).doc(eventId);
    const eventSnap = await eventRef.get();
    if (!eventSnap.exists) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    const batch = db.batch();
    batch.set(eventRef, {
      status: 'cancelled',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: 'grabio',
    }, { merge: true });

    const activeSnap = await activeEventRef(auth.storeId).get();
    if (activeSnap.exists && String(activeSnap.data()?.eventId || '').trim() === eventId) {
      batch.delete(activeEventRef(auth.storeId));
    }

    await batch.commit();
    await disablePosEntryTicketProduct(auth.storeId, eventId);
    const updatedSnap = await eventRef.get();
    res.json({
      success: true,
      event: serializeStoreEvent(eventId, updatedSnap.data() || {}),
      activeEvent: await readActiveEvent(auth.storeId),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Cancel event failed' });
  }
}

export async function setActiveStoreEvent(req: Request, res: Response): Promise<void> {
  try {
    const auth = await authenticateOwnerRequest(req);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }

    const eventId = String(req.body?.eventId || '').trim();
    if (!eventId) {
      res.status(400).json({ error: 'eventId required' });
      return;
    }

    const result = await writeActiveEventPointer(auth.storeId, eventId, 'grabio');
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.json({ success: true, activeEvent: result.activeEvent });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Set active event failed' });
  }
}

export async function clearActiveStoreEvent(req: Request, res: Response): Promise<void> {
  try {
    const auth = await authenticateOwnerRequest(req);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }

    const activeSnap = await activeEventRef(auth.storeId).get();
    if (activeSnap.exists) {
      const activeEventId = String(activeSnap.data()?.eventId || '').trim();
      const batch = db.batch();
      batch.delete(activeEventRef(auth.storeId));
      if (activeEventId) {
        batch.set(eventsCollection(auth.storeId).doc(activeEventId), {
          status: 'ended',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: 'grabio',
        }, { merge: true });
      }
      await batch.commit();
    }

    res.json({ success: true, activeEvent: null });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Clear active event failed' });
  }
}

export async function getActiveStoreEvent(req: Request, res: Response): Promise<void> {
  try {
    const auth = await authenticateOwnerRequest(req);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }

    res.json({ success: true, activeEvent: await readActiveEvent(auth.storeId) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Get active event failed' });
  }
}

function readPosAuthFromQuery(req: Request): { storeId: string; deviceId: string; deviceToken: string } {
  return {
    storeId: String(req.query.storeId || '').trim(),
    deviceId: String(req.query.deviceId || '').trim(),
    deviceToken: String(req.query.deviceToken || '').trim(),
  };
}

async function authenticatePosDeviceForEvents(
  storeId: string,
  deviceId: string,
  deviceToken: string,
): Promise<{ ok: true; storeId: string; deviceId: string } | { ok: false; status: number; error: string }> {
  const auth = await verifyPosDevice(db, storeId, deviceId, deviceToken);
  if (!auth.ok) {
    return { ok: false, status: auth.status, error: auth.error };
  }

  const profile = (await db.collection('storeProfiles').doc(storeId).get()).data();
  if (!canUseModule(profile, 'pos')) {
    return { ok: false, status: 403, error: 'POS module not enabled' };
  }

  return { ok: true, storeId, deviceId };
}

export async function getPosEvents(req: Request, res: Response): Promise<void> {
  try {
    const { storeId, deviceId, deviceToken } = readPosAuthFromQuery(req);
    const auth = await authenticatePosDeviceForEvents(storeId, deviceId, deviceToken);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }

    const since = parseSinceTimestamp(req.query.since);
    const snap = await eventsCollection(auth.storeId).orderBy('updatedAt', 'desc').limit(200).get();

    let events = snap.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) =>
      enrichEventForPos(serializeStoreEvent(doc.id, doc.data()), doc.data()),
    );
    if (since) {
      events = events.filter((event: ReturnType<typeof serializeStoreEvent>) => {
        const updatedAt = event.updatedAt ? new Date(event.updatedAt) : null;
        return !updatedAt || updatedAt >= since;
      });
    }

    const activeEvent = await readActiveEvent(auth.storeId);
    const activeEventDoc = await activeEventRef(auth.storeId).get();
    const activeEventPayload = activeEvent && activeEventDoc.exists
      ? {
          ...activeEvent,
          posEntryTicketProductId: String(activeEventDoc.data()?.posEntryTicketProductId || eventEntryProductId(auth.storeId, activeEvent.eventId)).trim(),
        }
      : activeEvent;

    res.json({
      success: true,
      events,
      activeEvent: activeEventPayload,
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'POS events sync failed' });
  }
}

export async function getPosActiveEvent(req: Request, res: Response): Promise<void> {
  try {
    const { storeId, deviceId, deviceToken } = readPosAuthFromQuery(req);
    const auth = await authenticatePosDeviceForEvents(storeId, deviceId, deviceToken);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }

    res.json({
      success: true,
      activeEvent: await readActiveEvent(auth.storeId),
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'POS active event fetch failed' });
  }
}

function isOnlineOrder(data: FirebaseFirestore.DocumentData): boolean {
  const source = String(data.source || '').trim().toLowerCase();
  if (source === 'pos') return false;
  const channel = String(data.orderChannel || '').trim().toLowerCase();
  return channel === 'web' || channel === 'whatsapp' || !source;
}

export async function getPosOnlineOrders(req: Request, res: Response): Promise<void> {
  try {
    const { storeId, deviceId, deviceToken } = readPosAuthFromQuery(req);
    const auth = await authenticatePosDeviceForEvents(storeId, deviceId, deviceToken);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }

    const since = parseSinceTimestamp(req.query.since);
    const snap = await db.collection('orders')
      .where('storeId', '==', auth.storeId)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    const orders = snap.docs
      .map((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
        const data = doc.data();
        return {
          orderId: doc.id,
          invoiceNumber: String(data.invoiceNumber || '').trim(),
          status: String(data.status || 'pending').trim(),
          customerName: String(data.customerName || '').trim(),
          customerPhone: String(data.customerPhone || '').trim(),
          total: Number(data.total || 0),
          deliveryMethod: String(data.deliveryMethod || '').trim(),
          scheduledFor: data.scheduledFor || null,
          paymentStatus: String(data.paymentStatus || '').trim(),
          orderChannel: String(data.orderChannel || 'web').trim(),
          createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.createdAt?.toDate?.()?.toISOString?.() || null,
          itemCount: Array.isArray(data.items) ? data.items.length : 0,
          _raw: data as FirebaseFirestore.DocumentData,
        };
      })
      .filter((order: { _raw: FirebaseFirestore.DocumentData; status: string }) => isOnlineOrder(order._raw))
      .filter((order: { status: string }) => ONLINE_ORDER_STATUSES.includes(order.status))
      .filter((order: { createdAt: string | null; updatedAt: string | null }) => {
        if (!since) return true;
        const createdAt = order.createdAt ? new Date(order.createdAt) : null;
        const updatedAt = order.updatedAt ? new Date(order.updatedAt) : null;
        const marker = updatedAt || createdAt;
        return !marker || marker >= since;
      })
      .map(({ _raw: _ignored, ...order }: { _raw: FirebaseFirestore.DocumentData; [key: string]: unknown }) => order);

    const cursor = new Date().toISOString();
    await db.collection('stores').doc(auth.storeId).collection('posDevices').doc(auth.deviceId).set({
      onlineOrdersCursor: cursor,
      lastOnlineOrdersPollAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.json({
      success: true,
      orders,
      cursor,
      syncedAt: cursor,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'POS online orders fetch failed' });
  }
}
