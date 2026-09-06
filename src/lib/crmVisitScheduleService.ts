import { doc, getFirestore, writeBatch } from 'firebase/firestore';
import { parseDateYmd } from '@/lib/crmVisitRouteService';

export type NextVisitScheduledBy = 'auto_address' | 'visit_route';

export type AddressScheduleClient = {
  id: string;
  district?: string | null;
  area?: string | null;
  address?: string | null;
};

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

export async function applyRouteVisitScheduleToCustomers(input: {
  storeId: string;
  visitDate: string;
  stops: Array<{ clientId: string }>;
  routeId: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const db = getFirestore();
  const chunks: Array<typeof input.stops> = [];
  for (let i = 0; i < input.stops.length; i += 400) {
    chunks.push(input.stops.slice(i, i + 400));
  }

  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach((stop, idx) => {
      const ref = doc(db, 'customers', stop.clientId);
      batch.update(ref, {
        nextFollowUpAt: visitDateToFollowUpIso(input.visitDate, idx),
        nextVisitScheduledBy: 'visit_route' satisfies NextVisitScheduledBy,
        nextVisitRouteId: input.routeId,
        updatedAt: now,
      });
    });
    await batch.commit();
  }
}
