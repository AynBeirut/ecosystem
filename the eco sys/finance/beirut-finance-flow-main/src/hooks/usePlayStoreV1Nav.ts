import { useMemo, useSyncExternalStore } from 'react';
import { isPlayStoreV1Shell } from '@/lib/playStoreNavScope';

function subscribe(cb: () => void) {
  const mq = window.matchMedia('(display-mode: standalone)');
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

function getSnapshot() {
  return isPlayStoreV1Shell();
}

function getServerSnapshot() {
  return false;
}

/** True when Play Store v1 compact nav should apply (TWA / installed PWA). */
export function usePlayStoreV1Nav() {
  const active = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(() => ({ active }), [active]);
}
