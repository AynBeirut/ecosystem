export const TABLE_RESERVATION_STATUSES = ['requested', 'confirmed', 'seated', 'cancelled', 'no_show'] as const;
export type TableReservationStatus = (typeof TABLE_RESERVATION_STATUSES)[number];

export interface TableReservationInput {
  guestName: string;
  guestPhone: string;
  guestEmail?: string;
  visitDate: string;
  visitTime: string;
  partySize: number;
  notes?: string;
}

export interface TableReservationRecord extends TableReservationInput {
  storeId: string;
  status: TableReservationStatus;
  tableLabel: string;
  reference: string;
}

export function buildTableReservationWrite(
  storeId: string,
  input: TableReservationInput,
): TableReservationRecord {
  const id = storeId.trim();
  if (!id) throw new Error('Store is required.');
  const guestName = input.guestName.trim();
  const guestPhone = input.guestPhone.trim();
  const visitDate = input.visitDate.trim();
  const visitTime = input.visitTime.trim();
  const partySize = Math.floor(Number(input.partySize));
  if (!guestName) throw new Error('Name is required.');
  if (!guestPhone) throw new Error('Phone is required.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(visitDate)) throw new Error('Date is required.');
  if (!/^\d{2}:\d{2}$/.test(visitTime)) throw new Error('Time is required.');
  if (!Number.isFinite(partySize) || partySize < 1 || partySize > 50) {
    throw new Error('Party size must be between 1 and 50.');
  }
  return {
    storeId: id,
    guestName,
    guestPhone,
    guestEmail: (input.guestEmail || '').trim(),
    visitDate,
    visitTime,
    partySize,
    notes: (input.notes || '').trim(),
    status: 'requested',
    tableLabel: '',
    reference: `TBL-${visitDate}-${visitTime.replace(':', '')}`,
  };
}

export function tableReservationLabel(row: Pick<TableReservationRecord, 'guestName' | 'visitDate' | 'visitTime' | 'partySize' | 'tableLabel'>): string {
  const table = row.tableLabel.trim();
  const where = table ? ` · ${table}` : '';
  return `${row.guestName} · ${row.visitDate} · ${row.visitTime} · ${row.partySize}${where}`;
}
