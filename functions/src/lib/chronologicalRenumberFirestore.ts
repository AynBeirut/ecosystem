import type { Firestore } from 'firebase-admin/firestore';
import {
  documentDateKeyFromFields,
  parseCreatedAtMs,
  rebuildChronologicalNumbers,
} from './chronologicalDocumentNumbers';

const nowIso = () => new Date().toISOString();

type Row = { id: string; documentDateKey: string; createdAtMs: number };

function toRow(id: string, data: Record<string, unknown>, dateFields: string[]): Row {
  const pick = (fields: string[]) => {
    for (const f of fields) {
      if (data[f] != null && data[f] !== '') return data[f];
    }
    return null;
  };
  const createdRaw = pick(['createdAt', 'updatedAt', 'date']) || data.createdAt;
  const docDate = pick(dateFields);
  return {
    id,
    documentDateKey: documentDateKeyFromFields(
      docDate as string | Date | null | undefined,
      createdRaw,
    ),
    createdAtMs: parseCreatedAtMs(createdRaw),
  };
}

async function commitPatches(
  db: Firestore,
  patches: Array<{ ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }>,
): Promise<void> {
  for (let i = 0; i < patches.length; i += 400) {
    const chunk = patches.slice(i, i + 400);
    const batch = db.batch();
    for (const p of chunk) {
      batch.update(p.ref, { ...p.data, updatedAt: nowIso() });
    }
    await batch.commit();
  }
}

/** Shop / POS / online orders → ORD-YYYY-MM-DD-000001 on `invoiceNumber`. */
export async function renumberStoreOrders(db: Firestore, storeId: string): Promise<Map<string, string>> {
  const snap = await db.collection('orders').where('storeId', '==', storeId).get();
  const rows = snap.docs.map((d) =>
    toRow(d.id, d.data() as Record<string, unknown>, ['posSaleTimestamp', 'date', 'orderDate', 'createdAt']),
  );
  const map = rebuildChronologicalNumbers(rows, 'ORD');
  const patches = snap.docs
    .map((d) => {
      const next = map.get(d.id);
      const prev = String((d.data() as Record<string, unknown>).invoiceNumber || '');
      if (!next || next === prev) return null;
      return { ref: d.ref, data: { invoiceNumber: next } };
    })
    .filter(Boolean) as Array<{ ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }>;
  await commitPatches(db, patches);
  return map;
}

export async function resolveOrderInvoiceNumber(
  db: Firestore,
  storeId: string,
  orderId: string,
): Promise<string> {
  const map = await renumberStoreOrders(db, storeId);
  const fromMap = map.get(orderId);
  if (fromMap) return fromMap;
  const snap = await db.collection('orders').doc(orderId).get();
  return String(snap.data()?.invoiceNumber || 'ORD-PENDING');
}
