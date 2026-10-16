import { FirebaseError } from 'firebase/app';

/** Avoid console spam from duplicate Firestore/API failures in demo staging. */
const logged = new Set<string>();

export function logTravelErrorOnce(key: string, err: unknown) {
  if (logged.has(key)) return;
  logged.add(key);
  const msg = err instanceof FirebaseError ? `${err.code}: ${err.message}` : String(err);
  console.warn(`[travel] ${key}:`, msg);
}

export async function safeTravelRead<T>(key: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    logTravelErrorOnce(key, err);
    return fallback;
  }
}
