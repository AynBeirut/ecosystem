// Exponential backoff retry with timeout support
export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  timeoutMs?: number;
  shouldRetry?: (err: unknown, attempt: number) => boolean;
  onRetry?: (err: unknown, attempt: number) => void;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function withTimeout<T>(p: Promise<T>, timeoutMs?: number): Promise<T> {
  if (!timeoutMs) return p;
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Request timed out")), timeoutMs);
    p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

const defaultShouldRetry = (err: any) => {
  const msg = String(err?.message || err || "").toLowerCase();
  return msg.includes("network") || msg.includes("fetch") || msg.includes("timeout") ||
         msg.includes("temporarily") || err?.status >= 500;
};

export async function retry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const { retries = 3, baseDelayMs = 500, maxDelayMs = 8000, timeoutMs,
          shouldRetry = defaultShouldRetry, onRetry } = opts;
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await withTimeout(fn(), timeoutMs);
    } catch (err) {
      attempt++;
      if (attempt > retries || !shouldRetry(err, attempt)) throw err;
      onRetry?.(err, attempt);
      const delay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1));
      await sleep(delay + Math.random() * 100);
    }
  }
}
