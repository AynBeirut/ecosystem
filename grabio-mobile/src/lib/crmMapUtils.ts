import type { CrmActivityRow } from './crmVisitMetrics';
import type { CrmClient } from './crmMobileService';
import { Linking, Alert } from 'react-native';
import { toDateYmd } from './crmVisitRouteService';
import { phoneDigitsForLink, stripPhoneDigits } from './crmCustomerPhone';

export type MapPeriod = 'day' | 'week' | 'month';
export type RepeatFilter = 'all' | 'due' | 'overdue';
export type CustomerDateMode = 'today' | 'yesterday' | 'pick';

export const CRM_VISIT_STATUS_COLORS = {
  visited: '#22c55e',
  due: '#f59e0b',
  overdue: '#ef4444',
  no_gps: '#9ca3af',
} as const;

export const CRM_PIPELINE_COLORS: Record<string, string> = {
  new_lead: '#6366f1',
  contacted: '#3b82f6',
  interested: '#8b5cf6',
  proposal_sent: '#a855f7',
  negotiation: '#d946ef',
  closed: '#22c55e',
  lost: '#ef4444',
};

export const PIPELINE_LABELS: Record<string, string> = {
  new_lead: 'New lead',
  contacted: 'Contacted',
  interested: 'Interested',
  proposal_sent: 'Proposal',
  negotiation: 'Negotiation',
  closed: 'Closed',
  lost: 'Lost',
};

function startOfDayMs(d = new Date()): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function endOfDayMs(d = new Date()): number {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.getTime();
}

function weekStartMs(d = new Date()): number {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function monthStartMs(d = new Date()): number {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function periodRange(period: MapPeriod, day = new Date()): { from: number; to: number } {
  const to = endOfDayMs(day);
  if (period === 'day') return { from: startOfDayMs(day), to };
  if (period === 'week') return { from: weekStartMs(day), to };
  return { from: monthStartMs(day), to };
}

function isCompletedVisit(a: CrmActivityRow): boolean {
  if (a.type !== 'visit') return false;
  return a.visitCompleted === true || (a.visitCompleted == null && a.result !== 'no_answer');
}

function dateFromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setHours(12, 0, 0, 0);
  return dt;
}

/** Calendar day of client's scheduled next visit (nextFollowUpAt). */
export function customerVisitDateYmd(client: CrmClient): string | null {
  if (!client.nextFollowUpAt) return null;
  const t = new Date(client.nextFollowUpAt).getTime();
  if (!Number.isFinite(t)) return client.nextFollowUpAt.slice(0, 10);
  return toDateYmd(new Date(t));
}

/** Client is relevant on the selected customer date: scheduled, on a route, or visited that day. */
export function clientMatchesCustomerDate(
  client: CrmClient,
  activities: CrmActivityRow[],
  dateYmd: string,
  routeStopClientIds: Set<string>,
): boolean {
  if (customerVisitDateYmd(client) === dateYmd) return true;
  if (routeStopClientIds.has(client.id)) return true;
  const day = dateFromYmd(dateYmd);
  const from = startOfDayMs(day);
  const to = endOfDayMs(day);
  return activities.some(
    (a) =>
      a.customerId === client.id
      && a.type === 'visit'
      && isCompletedVisit(a)
      && new Date(a.loggedAt).getTime() >= from
      && new Date(a.loggedAt).getTime() <= to,
  );
}

export type ClientMapStatus = 'visited' | 'due' | 'overdue' | 'pending';

export function clientMapStatus(
  client: CrmClient,
  activities: CrmActivityRow[],
  period: MapPeriod,
  day = new Date(),
): ClientMapStatus {
  const { from, to } = periodRange(period, day);
  const visited = activities.some(
    (a) =>
      a.customerId === client.id
      && a.type === 'visit'
      && isCompletedVisit(a)
      && new Date(a.loggedAt).getTime() >= from
      && new Date(a.loggedAt).getTime() <= to,
  );
  if (visited) return 'visited';

  const followUp = client.nextFollowUpAt ? new Date(client.nextFollowUpAt).getTime() : null;
  if (followUp != null) {
    const now = Date.now();
    const endToday = endOfDayMs(day);
    if (followUp < startOfDayMs(day)) return 'overdue';
    if (followUp <= endToday) return 'due';
  }
  return 'pending';
}

export function statusColor(status: ClientMapStatus): string {
  if (status === 'visited') return CRM_VISIT_STATUS_COLORS.visited;
  if (status === 'due') return CRM_VISIT_STATUS_COLORS.due;
  if (status === 'overdue') return CRM_VISIT_STATUS_COLORS.overdue;
  return '#94a3b8';
}

export function matchesRepeatFilter(client: CrmClient, repeat: RepeatFilter, day = new Date()): boolean {
  if (repeat === 'all') return true;
  const followUp = client.nextFollowUpAt ? new Date(client.nextFollowUpAt).getTime() : null;
  if (followUp == null) return repeat === 'overdue' ? false : false;
  const start = startOfDayMs(day);
  const end = endOfDayMs(day);
  if (repeat === 'overdue') return followUp < start;
  if (repeat === 'due') return followUp >= start && followUp <= end;
  return true;
}

export function normalizePhone(phone?: string | null): string {
  return phoneDigitsForLink(phone);
}

export async function callClient(phone?: string | null): Promise<void> {
  const digits = phoneDigitsForLink(phone) || stripPhoneDigits(phone);
  if (!digits) {
    Alert.alert('No phone', 'This client has no phone number on file.');
    return;
  }
  const url = `tel:${digits}`;
  const ok = await Linking.canOpenURL(url);
  if (!ok) {
    Alert.alert('Cannot call', 'Phone dialer is not available on this device.');
    return;
  }
  await Linking.openURL(url);
}

export async function whatsappClient(phone?: string | null, message?: string): Promise<void> {
  const digits = phoneDigitsForLink(phone) || stripPhoneDigits(phone);
  if (!digits) {
    Alert.alert('No phone', 'This client has no WhatsApp number on file.');
    return;
  }
  const url = `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
  await Linking.openURL(url);
}

export function clientCanShareLocationForDriver(client: CrmClient): boolean {
  const hasGps = client.location?.lat != null && client.location?.lng != null;
  const hasAddress = Boolean(
    client.address?.trim() || client.area?.trim() || client.district?.trim(),
  );
  return hasGps || hasAddress;
}

export function buildClientLocationShareMessage(client: CrmClient): string | null {
  const name = client.name || 'Client';
  const lines = [`🚚 Client location for driver`, '', name];
  if (client.phone?.trim()) lines.push(`Phone: ${client.phone.trim()}`);
  const addressParts = [client.address, client.area, client.district, client.city].filter(Boolean);
  if (addressParts.length) lines.push(`Address: ${addressParts.join(', ')}`);
  const loc = client.location;
  if (loc?.lat != null && loc?.lng != null) {
    lines.push('', `📍 Google Maps:`, googleMapsUrl(loc.lat, loc.lng));
    return lines.join('\n');
  }
  if (addressParts.length) return lines.join('\n');
  return null;
}

/** Opens WhatsApp with client GPS + address — pick driver chat or use driverPhone if set. */
export async function whatsappShareClientLocationForDriver(
  client: CrmClient,
  driverPhone?: string | null,
): Promise<void> {
  const message = buildClientLocationShareMessage(client);
  if (!message) {
    Alert.alert(
      'No location',
      'Add GPS or a street address on this client first, then share with the driver.',
    );
    return;
  }
  const digits = normalizePhone(driverPhone);
  const url = digits
    ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('WhatsApp', 'Could not open WhatsApp. Install it or try again.');
  }
}

export function googleMapsEmbedHtml(lat: number, lng: number): string {
  const src = `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;"><iframe width="100%" height="100%" frameborder="0" style="border:0" src="${src}" allowfullscreen></iframe></body></html>`;
}

export function googleMapsUrl(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${lat},${lng}`;
}
