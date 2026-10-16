import { addDoc, collection, getDocs, query, updateDoc, doc, where, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  buildTableReservationWrite,
  TABLE_RESERVATION_STATUSES,
  type TableReservationInput,
  type TableReservationRecord,
  type TableReservationStatus,
} from '@/lib/tableReservation';

export interface TableReservationRow extends TableReservationRecord {
  id: string;
}

function asStatus(value: unknown): TableReservationStatus {
  return TABLE_RESERVATION_STATUSES.includes(value as TableReservationStatus)
    ? (value as TableReservationStatus)
    : 'requested';
}

export async function createTableReservation(storeId: string, input: TableReservationInput): Promise<TableReservationRecord> {
  const row = buildTableReservationWrite(storeId, input);
  await addDoc(collection(db, 'tableReservations'), { ...row, createdAt: serverTimestamp() });
  return row;
}

export async function listTableReservations(storeId: string): Promise<TableReservationRow[]> {
  const snap = await getDocs(query(collection(db, 'tableReservations'), where('storeId', '==', storeId)));
  return snap.docs
    .map((item) => {
      const data = item.data();
      return {
        id: item.id,
        storeId: String(data.storeId || ''),
        guestName: String(data.guestName || ''),
        guestPhone: String(data.guestPhone || ''),
        guestEmail: String(data.guestEmail || ''),
        visitDate: String(data.visitDate || ''),
        visitTime: String(data.visitTime || ''),
        partySize: Number(data.partySize) || 0,
        notes: String(data.notes || ''),
        status: asStatus(data.status),
        tableLabel: String(data.tableLabel || ''),
        reference: String(data.reference || ''),
      };
    })
    .filter((row) => row.storeId === storeId)
    .sort((a, b) => `${a.visitDate}${a.visitTime}`.localeCompare(`${b.visitDate}${b.visitTime}`));
}

export async function updateTableReservation(
  id: string,
  patch: { status?: TableReservationStatus; tableLabel?: string },
): Promise<void> {
  const next: Record<string, unknown> = {};
  if (patch.status) next.status = patch.status;
  if (patch.tableLabel !== undefined) next.tableLabel = patch.tableLabel.trim();
  await updateDoc(doc(db, 'tableReservations', id), next);
}
