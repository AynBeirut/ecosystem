// Network-only retry wrapper. NEVER retries permission/auth/validation failures.
import { retry, type RetryOptions } from "./retry";

const isPermanentFailure = (err: any): boolean => {
  if (!err) return false;
  const code = err.code || err.status;
  if (code === "42501" || code === 401 || code === 403) return true;
  if (typeof code === "string" && (code === "PGRST301" || code.startsWith("23"))) return true;
  const msg = String(err.message || err).toLowerCase();
  return msg.includes("permission") || msg.includes("row-level security") ||
         msg.includes("jwt") || msg.includes("duplicate key") || msg.includes("violates");
};

export const retryRequest = <T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> =>
  retry(fn, {
    retries: 3,
    baseDelayMs: 400,
    maxDelayMs: 4000,
    ...opts,
    shouldRetry: (err, attempt) => {
      if (isPermanentFailure(err)) return false;
      const msg = String((err as any)?.message || err).toLowerCase();
      const transient = msg.includes("network") || msg.includes("fetch") ||
                        msg.includes("timeout") || (err as any)?.status >= 500;
      return transient && attempt <= 3;
    },
  });

export default retryRequest;
