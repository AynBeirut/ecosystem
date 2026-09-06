import firestore from '@react-native-firebase/firestore';
import { invalidateCrmStoreCache } from './crmMobileService';
import { parseDateYmd } from './crmVisitRouteService';

export type NextVisitScheduledBy = 'auto_address' | 'visit_route';

export type AddressScheduleClient = {
  id: string;
  district?: string | null;
  area?: string | null;
  address?: string | null;
};

/** Group key from registered CRM address (district + area, else street address). */
export function registeredAddressBucket(client: AddressScheduleClient): string {
  const district = (client.district || '').trim();
  const area = (client.area || '').trim();
  if (district || area) {
    return `${district || '—'} · ${area || '—'}`;
  }
  const addr = (client.address || '').trim();
  return addr ? `addr:${addr.toLowerCase()}` : 'Unknown location';
}

export function visitDateToFollowUpIso(visitDateYmd: string, slotIndex = 0): string {
  const d = parseDateYmd(visitDateYmd);
  d.setHours(9, 0, 0, 0);
  d.setMinutes(d.getMinutes() + slotIndex * 5);
  return d.toISOString();
}

/** Spread address buckets evenly across the next N calendar days (one visit day per bucket). */
export function computeAddressVisitSchedule(
  clients: AddressScheduleClient[],
  opts?: { startDate?: Date; horizonDays?: number },
): Map<string, string> {
  const start = opts?.startDate ? new Date(opts.startDate) : new Date();
  start.setHours(0, 0, 0, 0);
  const horizon = Math.max(1, opts?.horizonDays ?? 30);

  const byBucket = new Map<string, AddressScheduleClient[]>();
  for (const c of clients) {
    const key = registeredAddressBucket(c);
    if (!byBucket.has(key)) byBucket.set(key, []);
    byBucket.get(key)!.push(c);
  }

  const buckets = [...byBucket.keys()].sort((a, b) => a.localeCompare(b));
  const result = new Map<string, string>();

  buckets.forEach((bucket, idx) => {
    const dayOffset = idx % horizon;
    const list = byBucket.get(bucket)!;
    list.forEach((c, slotIndex) => {
      const d = new Date(start);
      d.setDate(d.getDate() + dayOffset);
      d.setHours(9, 0, 0, 0);
      d.setMinutes(d.getMinutes() + slotIndex * 5);
      result.set(c.id, d.toISOString());
    });
  });

  return result;
}

/** Admin visit route — overwrites auto schedule for stops on that route date. */
export async function applyRouteVisitScheduleToCustomers(input: {
  storeId: string;
  visitDate: string;
  stops: Array<{ clientId: string }>;
  routeId: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const chunks: Array<typeof input.stops> = [];
  for (let i = 0; i < input.stops.length; i += 400) {
    chunks.push(input.stops.slice(i, i + 400));
  }

  for (const chunk of chunks) {
    const batch = firestore().batch();
    chunk.forEach((stop, idx) => {
      const ref = firestore().collection('customers').doc(stop.clientId);
      batch.update(ref, {
        nextFollowUpAt: visitDateToFollowUpIso(input.visitDate, idx),
        nextVisitScheduledBy: 'visit_route' satisfies NextVisitScheduledBy,
        nextVisitRouteId: input.routeId,
        updatedAt: now,
      });
    });
    await batch.commit();
  }

  invalidateCrmStoreCache(input.storeId);
}
