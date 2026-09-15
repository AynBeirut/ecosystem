import {
  doc,
  getDoc,
  setDoc,
  type Firestore,
} from 'firebase/firestore';

export type StaffPresenceEntry = {
  date: string;
  hours?: number;
};

export type StaffPresenceRecord = {
  id: string;
  storeId: string;
  staffId: string;
  staffName: string;
  month: string;
  dates: string[];
  entries?: StaffPresenceEntry[];
  updatedAt: string;
  updatedBy?: { id: string; name: string };
};

export function buildStaffPresenceDocId(storeId: string, staffId: string, month: string): string {
  return `spres-${storeId}-${staffId}-${month}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 450);
}

export function lastDayOfMonth(month: string): string {
  const [year, mm] = month.split('-').map(Number);
  const last = new Date(year, mm, 0);
  return `${year}-${String(mm).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
}

export function maxPresenceDate(month: string, today = new Date()): string {
  const todayIso = today.toISOString().slice(0, 10);
  const monthEnd = lastDayOfMonth(month);
  return todayIso < monthEnd ? todayIso : monthEnd;
}

export function defaultPresenceDateInput(month: string, today = new Date()): string {
  const min = `${month}-01`;
  const max = maxPresenceDate(month, today);
  const yesterday = new Date(today.getTime() - 86400000).toISOString().slice(0, 10);
  if (yesterday >= min && yesterday <= max) return yesterday;
  if (max >= min) return max;
  return min;
}

export function isValidPresenceDate(date: string, month: string, today = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  if (!date.startsWith(`${month}-`)) return false;
  const min = `${month}-01`;
  const max = maxPresenceDate(month, today);
  return date >= min && date <= max;
}

export function sortPresenceDates(dates: string[]): string[] {
  return [...new Set(dates.filter(Boolean))].sort();
}

export function sortPresenceEntries(entries: StaffPresenceEntry[]): StaffPresenceEntry[] {
  const byDate = new Map<string, StaffPresenceEntry>();
  for (const entry of entries) {
    if (!entry.date) continue;
    byDate.set(entry.date, entry);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function getPresenceEntries(record?: StaffPresenceRecord | null): StaffPresenceEntry[] {
  if (!record) return [];
  if (record.entries?.length) return sortPresenceEntries(record.entries);
  return sortPresenceDates(record.dates || []).map((date) => ({ date }));
}

export function entriesToDates(entries: StaffPresenceEntry[]): string[] {
  return sortPresenceDates(entries.map((entry) => entry.date));
}

export function totalPresenceHours(record?: StaffPresenceRecord | null): number {
  return getPresenceEntries(record).reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
}

export async function getStaffPresenceForMonth(
  db: Firestore,
  storeId: string,
  staffId: string,
  month: string,
): Promise<StaffPresenceRecord | null> {
  const id = buildStaffPresenceDocId(storeId, staffId, month);
  const snap = await getDoc(doc(db, 'staffPresence', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as StaffPresenceRecord;
}

export async function saveStaffPresenceEntries(
  db: Firestore,
  input: {
    storeId: string;
    staffId: string;
    staffName: string;
    month: string;
    entries: StaffPresenceEntry[];
    actor: { id: string; name: string };
  },
): Promise<StaffPresenceRecord> {
  const sortedEntries = sortPresenceEntries(input.entries);
  const id = buildStaffPresenceDocId(input.storeId, input.staffId, input.month);
  const updatedAt = new Date().toISOString();
  const record: StaffPresenceRecord = {
    id,
    storeId: input.storeId,
    staffId: input.staffId,
    staffName: input.staffName,
    month: input.month,
    entries: sortedEntries,
    dates: entriesToDates(sortedEntries),
    updatedAt,
    updatedBy: { id: input.actor.id, name: input.actor.name },
  };
  await setDoc(doc(db, 'staffPresence', id), record);
  return record;
}

export async function addStaffPresenceDate(
  db: Firestore,
  input: {
    storeId: string;
    staffId: string;
    staffName: string;
    month: string;
    date: string;
    hours?: number;
    actor: { id: string; name: string };
    existingDates?: string[];
    existingEntries?: StaffPresenceEntry[];
  },
): Promise<StaffPresenceRecord> {
  if (!isValidPresenceDate(input.date, input.month)) {
    throw new Error('Pick a date in the selected month — today or earlier only.');
  }
  const baseEntries = input.existingEntries?.length
    ? input.existingEntries
    : (input.existingDates || []).map((date) => ({ date }));
  const nextEntry: StaffPresenceEntry = {
    date: input.date,
    ...(input.hours != null && input.hours > 0 ? { hours: input.hours } : {}),
  };
  const entries = sortPresenceEntries([
    ...baseEntries.filter((entry) => entry.date !== input.date),
    nextEntry,
  ]);
  return saveStaffPresenceEntries(db, { ...input, entries });
}

export async function removeStaffPresenceDate(
  db: Firestore,
  input: {
    storeId: string;
    staffId: string;
    staffName: string;
    month: string;
    date: string;
    actor: { id: string; name: string };
    existingDates: string[];
    existingEntries?: StaffPresenceEntry[];
  },
): Promise<StaffPresenceRecord> {
  const baseEntries = input.existingEntries?.length
    ? input.existingEntries
    : input.existingDates.map((date) => ({ date }));
  const entries = baseEntries.filter((entry) => entry.date !== input.date);
  return saveStaffPresenceEntries(db, { ...input, entries });
}

export function countPresenceDays(record?: StaffPresenceRecord | null): number {
  return getPresenceEntries(record).length;
}
