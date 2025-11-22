type DebugLog = {
  id: string;
  ts: number;
  level: 'info' | 'warn' | 'error';
  title: string;
  message: string;
  meta?: unknown;
};

const listeners = new Set<(logs: DebugLog[]) => void>();
const logs: DebugLog[] = [];

export function pushDebugLog(title: string, message: string, meta?: unknown, level: DebugLog['level'] = 'error') {
  const entry: DebugLog = { id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`, ts: Date.now(), level, title, message, meta };
  logs.unshift(entry);
  // keep last 200
  if (logs.length > 200) logs.splice(200);
  listeners.forEach(l => l([...logs]));
  return entry.id;
}

export function clearDebugLogs() {
  logs.length = 0;
  listeners.forEach(l => l([...logs]));
}

export function subscribeDebugLogs(listener: (l: DebugLog[]) => void) {
  listeners.add(listener);
  // initial emit
  listener([...logs]);
  return () => listeners.delete(listener);
}

export type { DebugLog };
