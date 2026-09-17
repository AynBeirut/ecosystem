import {
  collection,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { signInAnonymously, type User } from 'firebase/auth';
import { auth, authReady } from '@/lib/firebase';
import {
  RESTAURANT_DEMO_COLLECTION,
  RESTAURANT_DEMO_MAX_ACTIONS,
  RESTAURANT_DEMO_SEED,
  RESTAURANT_DEMO_SESSION_STORAGE_KEY,
  RESTAURANT_DEMO_TTL_MS,
} from '@/lib/restaurantDemoConstants';
import {
  canCreateDemoEntity,
  demoDocumentNumber,
  isDemoSessionExpired,
} from '@/lib/restaurantDemoLogic';
import type {
  RestaurantDemoEntityType,
  RestaurantDemoSession,
} from '@/types/restaurantDemo';

function newSessionId(): string {
  return `rd_${crypto.randomUUID().replace(/-/g, '')}`;
}

function expiresAtFromNow(): Timestamp {
  return Timestamp.fromMillis(Date.now() + RESTAURANT_DEMO_TTL_MS);
}

function isPermissionDeniedError(e: unknown): boolean {
  const code = (e as { code?: string })?.code;
  return code === 'permission-denied' || code === 'PERMISSION_DENIED';
}

export async function ensureRestaurantDemoAuth(): Promise<User> {
  await authReady;
  if (auth.currentUser) return auth.currentUser;
  const cred = await signInAnonymously(auth);
  return cred.user;
}

export async function getOrCreateRestaurantDemoSession(): Promise<{
  sessionId: string;
  session: RestaurantDemoSession;
}> {
  const user = await ensureRestaurantDemoAuth();
  const db = getFirestore();
  const stored = localStorage.getItem(RESTAURANT_DEMO_SESSION_STORAGE_KEY);
  if (stored) {
    const ref = doc(db, RESTAURANT_DEMO_COLLECTION, stored);
    try {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const session = snap.data() as RestaurantDemoSession;
        if (session.ownerUid === user.uid && !isDemoSessionExpired(session.expiresAt)) {
          return { sessionId: stored, session };
        }
      }
    } catch (e) {
      if (!isPermissionDeniedError(e)) throw e;
    }
    localStorage.removeItem(RESTAURANT_DEMO_SESSION_STORAGE_KEY);
  }

  const sessionId = newSessionId();
  const now = new Date().toISOString();
  const expiresAt = expiresAtFromNow();
  const session: RestaurantDemoSession = {
    demo: true,
    ownerUid: user.uid,
    sessionId,
    createdAt: now,
    expiresAt,
    actionCount: 0,
    maxActions: RESTAURANT_DEMO_MAX_ACTIONS,
    demoPackage: 'pkg_live_kitchen',
    businessWorkflow: 'live_kitchen',
    label: RESTAURANT_DEMO_SEED.venueName,
  };

  await setDoc(doc(db, RESTAURANT_DEMO_COLLECTION, sessionId), {
    ...session,
    seeds: RESTAURANT_DEMO_SEED,
    updatedAt: serverTimestamp(),
  });
  localStorage.setItem(RESTAURANT_DEMO_SESSION_STORAGE_KEY, sessionId);
  return { sessionId, session };
}

export type CreateDemoPayload =
  | { type: 'products'; name: string; priceUsd: number; category: string }
  | { type: 'guests'; name: string; phone?: string }
  | { type: 'reservations'; guestName: string; partySize: number; dateTime: string }
  | { type: 'orders'; tableOrChannel: string; totalUsd: number }
  | { type: 'documents'; docType: 'invoice' | 'receipt'; amountUsd: number }
  | { type: 'crmTasks'; title: string; guestName?: string };

function collectionForType(type: RestaurantDemoEntityType): RestaurantDemoEntityType {
  return type;
}

export async function createRestaurantDemoEntity(
  sessionId: string,
  payload: CreateDemoPayload,
): Promise<string> {
  const user = await ensureRestaurantDemoAuth();
  const db = getFirestore();
  const sessionRef = doc(db, RESTAURANT_DEMO_COLLECTION, sessionId);
  const entityId = `demo_${crypto.randomUUID().slice(0, 12)}`;
  const subCol = collectionForType(payload.type);
  const entityRef = doc(db, RESTAURANT_DEMO_COLLECTION, sessionId, subCol, entityId);

  await runTransaction(db, async (tx) => {
    const sessionSnap = await tx.get(sessionRef);
    if (!sessionSnap.exists()) throw new Error('Demo session not found');
    const session = sessionSnap.data() as RestaurantDemoSession;
    if (session.ownerUid !== user.uid) throw new Error('Not your demo session');
    if (isDemoSessionExpired(session.expiresAt)) throw new Error('Demo session expired');
    if (!canCreateDemoEntity(session.actionCount, session.maxActions)) {
      throw new Error('Demo action limit reached (5 per session)');
    }

    const expiresAt =
      session.expiresAt instanceof Timestamp
        ? session.expiresAt
        : Timestamp.fromDate(new Date(String(session.expiresAt)));
    const createdAt = new Date().toISOString();
    const base = {
      demo: true,
      sessionId,
      expiresAt,
      createdByDemoVisitor: true,
      createdAt,
      demoBadge: 'DEMO' as const,
    };

    let displayLabel = 'DEMO item';
    let body: Record<string, unknown> = {};

    switch (payload.type) {
      case 'products':
        displayLabel = `DEMO · ${payload.name}`;
        body = { name: payload.name, priceUsd: payload.priceUsd, category: payload.category };
        break;
      case 'guests':
        displayLabel = `DEMO · Guest ${payload.name}`;
        body = { name: payload.name, phone: payload.phone || '' };
        break;
      case 'reservations':
        displayLabel = `DEMO · ${payload.guestName}`;
        body = {
          guestName: payload.guestName,
          partySize: payload.partySize,
          dateTime: payload.dateTime,
        };
        break;
      case 'orders':
        displayLabel = `DEMO · Order ${payload.tableOrChannel}`;
        body = {
          tableOrChannel: payload.tableOrChannel,
          totalUsd: payload.totalUsd,
          status: 'open',
        };
        break;
      case 'documents':
        displayLabel = `DEMO · ${payload.docType}`;
        body = {
          docType: payload.docType,
          number: demoDocumentNumber(payload.docType === 'invoice' ? 'INV' : 'RCP', session.actionCount),
          amountUsd: payload.amountUsd,
        };
        break;
      case 'crmTasks':
        displayLabel = `DEMO · ${payload.title}`;
        body = { title: payload.title, guestName: payload.guestName || '' };
        break;
      default:
        break;
    }

    tx.set(entityRef, { ...base, displayLabel, ...body });
    tx.update(sessionRef, {
      actionCount: session.actionCount + 1,
      updatedAt: serverTimestamp(),
    });
  });

  return entityId;
}

export function subscribeRestaurantDemoEntities(
  sessionId: string,
  type: RestaurantDemoEntityType,
  onChange: (rows: Record<string, unknown>[]) => void,
): Unsubscribe {
  const db = getFirestore();
  const col = collection(db, RESTAURANT_DEMO_COLLECTION, sessionId, type);
  return onSnapshot(col, (snap) => {
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    onChange(rows);
  });
}

export function subscribeRestaurantDemoSession(
  sessionId: string,
  onChange: (session: RestaurantDemoSession | null) => void,
): Unsubscribe {
  const db = getFirestore();
  const ref = doc(db, RESTAURANT_DEMO_COLLECTION, sessionId);
  return onSnapshot(ref, (snap) => {
    onChange(snap.exists() ? (snap.data() as RestaurantDemoSession) : null);
  });
}
