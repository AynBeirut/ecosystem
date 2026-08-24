import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { canUseModule } from '../lib/entitlements';
import { loadStoreEvent, parseEventTimestamp, validateEventBelongsToStore } from '../lib/storeEventsCore';

const db = admin.firestore();

export type EventReservationStatus = 'pending' | 'confirmed' | 'seated' | 'cancelled' | 'no_show';

function reservationsCollection(storeId: string, eventId: string) {
  return db.collection('stores').doc(storeId).collection('storeEvents').doc(eventId).collection('eventReservations');
}

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

function timestampToIso(value: unknown): string | null {
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as FirebaseFirestore.Timestamp).toDate().toISOString();
  }
  if (typeof value === 'string' && value.trim()) return value.trim();
  return null;
}

function serializeReservation(eventId: string, reservationId: string, data: FirebaseFirestore.DocumentData) {
  const statusRaw = String(data.status || 'pending');
  const allowed = new Set(['pending', 'confirmed', 'seated', 'cancelled', 'no_show']);
  return {
    id: reservationId,
    eventId,
    eventName: String(data.eventName || '').trim(),
    guestName: String(data.guestName || '').trim(),
    guestPhone: String(data.guestPhone || '').trim(),
    partySize: Number(data.partySize || 1),
    reservedFor: timestampToIso(data.reservedFor) || '',
    notes: String(data.notes || '').trim(),
    status: (allowed.has(statusRaw) ? statusRaw : 'pending') as EventReservationStatus,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

export async function createEventReservation(req: Request, res: Response): Promise<void> {
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
    if (!eventCheck.event.settings.reservationsEnabled) {
      res.status(400).json({ error: 'Reservations are not enabled for this event' });
      return;
    }

    const guestName = String(req.body?.guestName || '').trim();
    if (!guestName) {
      res.status(400).json({ error: 'guestName required' });
      return;
    }

    const reservedFor = parseEventTimestamp(req.body?.reservedFor, 'reservedFor');
    const partySizeRaw = Number(req.body?.partySize || 1);
    const partySize = Number.isFinite(partySizeRaw) && partySizeRaw > 0 ? Math.round(partySizeRaw) : 1;

    const ref = reservationsCollection(auth.storeId, eventId).doc();
    await ref.set({
      storeId: auth.storeId,
      eventId,
      eventName: eventCheck.event.name,
      guestName,
      guestPhone: String(req.body?.guestPhone || '').trim(),
      partySize,
      reservedFor,
      notes: String(req.body?.notes || '').trim(),
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: auth.uid,
    });

    const snap = await ref.get();
    res.status(201).json({
      success: true,
      reservation: serializeReservation(eventId, ref.id, snap.data() || {}),
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Create reservation failed' });
  }
}

export async function listEventReservations(req: Request, res: Response): Promise<void> {
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

    const snap = await reservationsCollection(auth.storeId, eventId)
      .orderBy('reservedFor', 'asc')
      .limit(500)
      .get();

    res.json({
      success: true,
      reservations: snap.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) =>
        serializeReservation(eventId, doc.id, doc.data()),
      ),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'List reservations failed' });
  }
}

export async function updateEventReservation(req: Request, res: Response): Promise<void> {
  try {
    const auth = await authenticateOwnerRequest(req);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }

    const eventId = String(req.params.eventId || '').trim();
    const reservationId = String(req.params.reservationId || '').trim();
    const ref = reservationsCollection(auth.storeId, eventId).doc(reservationId);
    const snap = await ref.get();
    if (!snap.exists) {
      res.status(404).json({ error: 'Reservation not found' });
      return;
    }

    const existing = snap.data() || {};
    const statusRaw = String(req.body?.status || existing.status || 'pending');
    const allowed = new Set(['pending', 'confirmed', 'seated', 'cancelled', 'no_show']);

    await ref.set({
      guestName: req.body?.guestName != null ? String(req.body.guestName).trim() : existing.guestName,
      guestPhone: req.body?.guestPhone != null ? String(req.body.guestPhone).trim() : existing.guestPhone,
      partySize: req.body?.partySize != null ? Number(req.body.partySize) : existing.partySize,
      reservedFor: req.body?.reservedFor != null
        ? parseEventTimestamp(req.body.reservedFor, 'reservedFor')
        : existing.reservedFor,
      notes: req.body?.notes != null ? String(req.body.notes).trim() : existing.notes,
      status: allowed.has(statusRaw) ? statusRaw : existing.status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    const updated = await ref.get();
    res.json({
      success: true,
      reservation: serializeReservation(eventId, reservationId, updated.data() || {}),
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Update reservation failed' });
  }
}

export async function listStoreEventReservations(req: Request, res: Response): Promise<void> {
  try {
    const auth = await authenticateOwnerRequest(req);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }

    const from = String(req.query.from || '').trim();
    const to = String(req.query.to || '').trim();
    const snap = await db.collectionGroup('eventReservations')
      .where('storeId', '==', auth.storeId)
      .orderBy('reservedFor', 'asc')
      .limit(500)
      .get();

    let reservations = snap.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = doc.data();
      const eventId = String(data.eventId || '').trim();
      return serializeReservation(eventId, doc.id, data);
    });

    if (from) {
      const fromDate = new Date(from);
      reservations = reservations.filter((r: ReturnType<typeof serializeReservation>) =>
        !r.reservedFor || new Date(r.reservedFor) >= fromDate,
      );
    }
    if (to) {
      const toDate = new Date(to);
      reservations = reservations.filter((r: ReturnType<typeof serializeReservation>) =>
        !r.reservedFor || new Date(r.reservedFor) <= toDate,
      );
    }

    res.json({ success: true, reservations });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'List store reservations failed' });
  }
}
