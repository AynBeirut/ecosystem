export const WORK_TIMEZONE = 'Asia/Beirut';
export const WORK_HOUR_START = 8;
export const WORK_HOUR_END = 19;
const WORK_DAYS = new Set(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);

export type AssistantRole = 'owner' | 'manager' | 'sales' | 'delivery' | 'crm_rep' | 'buyer';

export function firstName(fullName?: string | null): string {
  const raw = String(fullName || '').trim();
  if (!raw) return 'there';
  if (raw.includes('@')) return raw.split('@')[0] || 'there';
  return raw.split(/\s+/)[0] || 'there';
}

function beirutParts(date = new Date()): { hour: number; weekday: string } {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: WORK_TIMEZONE,
    hour: '2-digit',
    weekday: 'short',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  return { hour, weekday };
}

export function isWithinWorkHours(date = new Date()): boolean {
  const { hour, weekday } = beirutParts(date);
  if (!WORK_DAYS.has(weekday)) return false;
  return hour >= WORK_HOUR_START && hour < WORK_HOUR_END;
}

export function todayYmdBeirut(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: WORK_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function formatVisitTimeLabel(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-LB', {
      timeZone: WORK_TIMEZONE,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export type MorningBriefingStats = {
  routeStops: number;
  followUpsToday: number;
  tasksToday: number;
  pendingApprovals: number;
  teamVisitsToday: number;
};

export function mapSubRoleToAssistant(
  role: string,
  subRole: string,
): AssistantRole {
  if (role === 'admin' || role === 'owner') return 'owner';
  if (subRole === 'manager') return 'manager';
  if (subRole === 'sales') return 'sales';
  if (subRole === 'delivery') return 'delivery';
  if (role === 'crm_rep') return 'crm_rep';
  return 'buyer';
}

export function buildMorningBriefing(
  role: AssistantRole,
  displayName: string,
  stats: MorningBriefingStats,
): { title: string; body: string } {
  const name = firstName(displayName);

  if (role === 'sales' || role === 'crm_rep') {
    const parts: string[] = [];
    if (stats.routeStops > 0) parts.push(`${stats.routeStops} client${stats.routeStops === 1 ? '' : 's'} on your route`);
    if (stats.followUpsToday > 0) parts.push(`${stats.followUpsToday} follow-up${stats.followUpsToday === 1 ? '' : 's'}`);
    if (stats.tasksToday > 0) parts.push(`${stats.tasksToday} task${stats.tasksToday === 1 ? '' : 's'}`);
    const list = parts.length > 0 ? parts.join(' · ') : 'your day is clear — check CRM for new leads';
    return {
      title: `Good morning, ${name} ☀️`,
      body: `Here's your list: ${list}. Open Tasks or Visit Routes when you're ready.`,
    };
  }

  if (role === 'manager' || role === 'owner') {
    const parts: string[] = [];
    if (stats.teamVisitsToday > 0) parts.push(`${stats.teamVisitsToday} team visit${stats.teamVisitsToday === 1 ? '' : 's'} today`);
    if (stats.pendingApprovals > 0) parts.push(`${stats.pendingApprovals} order${stats.pendingApprovals === 1 ? '' : 's'} to approve`);
    if (stats.followUpsToday > 0) parts.push(`${stats.followUpsToday} client follow-up${stats.followUpsToday === 1 ? '' : 's'}`);
    const list = parts.length > 0 ? parts.join(' · ') : 'team schedule is light today';
    const lead = role === 'manager' ? `Your team needs you, ${name}.` : `Quick team check-in, ${name}.`;
    return {
      title: `Good morning, ${name} ☀️`,
      body: `${lead} ${list}. Review routes and follow-ups in CRM.`,
    };
  }

  return { title: `Good morning, ${name}`, body: 'Have a productive day with Grabio.' };
}

export function buildVisitReminder(
  displayName: string,
  clientName: string,
  whenLabel: string,
): { title: string; body: string } {
  const name = firstName(displayName);
  return {
    title: `${name}, visit time 📍`,
    body: `${clientName} is scheduled around ${whenLabel}. Tap to open the client and mark your visit.`,
  };
}
