import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

function isStaleChunkError(err: unknown): boolean {
  const message = String((err as { message?: string })?.message ?? err ?? '');
  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed') ||
    message.includes('error loading dynamically imported module')
  );
}

function hardRecoverFromStaleChunk(): void {
  const win = window as Window & { __grabioHardRecover?: (force?: boolean) => void };
  if (typeof win.__grabioHardRecover === 'function') {
    win.__grabioHardRecover(true);
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.set('_v', String(Date.now()));
  window.location.replace(url.toString());
}

/** Lazy import that auto-reloads once after deploy when hashed chunks 404. */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(() =>
    factory().catch((err) => {
      if (isStaleChunkError(err)) {
        hardRecoverFromStaleChunk();
        return new Promise<{ default: T }>(() => {
          /* page reload in progress */
        });
      }
      throw err;
    }),
  );
}
