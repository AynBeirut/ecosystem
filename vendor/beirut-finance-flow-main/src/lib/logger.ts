// Lightweight structured logger. Console in dev; safe JSON serialization.
const isDev = typeof import.meta !== "undefined" && (import.meta as any).env?.DEV;

function safe(data: unknown) {
  try {
    return JSON.parse(JSON.stringify(data, (_k, v) => {
      if (v instanceof Error) return { name: v.name, message: v.message, stack: v.stack };
      return v;
    }));
  } catch { return String(data); }
}

function emit(level: "info" | "warn" | "error", scope: string, message: string, data?: unknown) {
  const entry = { level, scope, message, ts: new Date().toISOString(), data: data !== undefined ? safe(data) : undefined };
  if (isDev || level !== "info") {
    const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    fn(`[${scope}]`, message, entry.data ?? "");
  }
  return entry;
}

export const logger = {
  info: (scope: string, message: string, data?: unknown) => emit("info", scope, message, data),
  warn: (scope: string, message: string, data?: unknown) => emit("warn", scope, message, data),
  error: (scope: string, message: string, data?: unknown) => emit("error", scope, message, data),
};

export const logInfo = logger.info;
export const logWarn = logger.warn;
export const logError = logger.error;
