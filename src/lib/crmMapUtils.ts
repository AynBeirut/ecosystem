import type { CrmActivity } from '@/types/crm';
import type { CrmClient } from '@/lib/crmService';
import { isCompletedVisit } from '@/lib/crmVisitMetrics';
import { toDateYmd } from '@/lib/crmVisitRouteService';

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

function dateFromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setHours(12, 0, 0, 0);
  return dt;
}

export function customerVisitDateYmd(client: CrmClient): string | null {
  if (!client.nextFollowUpAt) return null;
  const t = new Date(client.nextFollowUpAt).getTime();
  if (!Number.isFinite(t)) return client.nextFollowUpAt.slice(0, 10);
  return toDateYmd(new Date(t));
}

export function clientMatchesCustomerDate(
  client: CrmClient,
  activities: CrmActivity[],
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
  activities: CrmActivity[],
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
  if (followUp == null) return false;
  const start = startOfDayMs(day);
  const end = endOfDayMs(day);
  if (repeat === 'overdue') return followUp < start;
  if (repeat === 'due') return followUp >= start && followUp <= end;
  return true;
}

function stripPhoneDigits(phone?: string | null): string {
  return (phone || '').replace(/\D/g, '');
}

export function normalizePhone(phone?: string | null): string {
  const digits = stripPhoneDigits(phone);
  if (!digits) return '';
  if (digits.startsWith('961') && digits.length >= 10) return digits;
  if (digits.startsWith('0') && digits.length >= 8) return `961${digits.slice(1)}`;
  if (digits.length === 8) return `961${digits}`;
  return digits;
}

export function callClient(phone?: string | null): void {
  const digits = normalizePhone(phone);
  if (!digits) return;
  window.open(`tel:${digits}`, '_self');
}

export function whatsappClient(phone?: string | null, message?: string): void {
  const digits = normalizePhone(phone);
  if (!digits) return;
  const url = `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
  window.open(url, '_blank', 'noopener,noreferrer');
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

export function whatsappShareClientLocationForDriver(
  client: CrmClient,
  driverPhone?: string | null,
): void {
  const message = buildClientLocationShareMessage(client);
  if (!message) return;
  const digits = normalizePhone(driverPhone);
  const url = digits
    ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function googleMapsUrl(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${lat},${lng}`;
}
