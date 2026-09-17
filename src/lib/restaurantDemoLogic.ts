import { RESTAURANT_DEMO_MAX_ACTIONS } from '@/lib/restaurantDemoConstants';

export function canCreateDemoEntity(actionCount: number, maxActions = RESTAURANT_DEMO_MAX_ACTIONS): boolean {
  return actionCount < maxActions;
}

export function isDemoSessionExpired(
  expiresAt: string | { toMillis?: () => number; seconds?: number },
  nowMs = Date.now(),
): boolean {
  if (expiresAt && typeof expiresAt === 'object' && typeof expiresAt.toMillis === 'function') {
    return expiresAt.toMillis() <= nowMs;
  }
  if (expiresAt && typeof expiresAt === 'object' && typeof expiresAt.seconds === 'number') {
    return expiresAt.seconds * 1000 <= nowMs;
  }
  const t = Date.parse(String(expiresAt));
  return Number.isNaN(t) || t <= nowMs;
}

export function demoDocumentNumber(prefix: string, actionIndex: number): string {
  return `DEMO-${prefix}-${String(actionIndex + 1).padStart(3, '0')}`;
}

export function remainingDemoActions(actionCount: number, maxActions = RESTAURANT_DEMO_MAX_ACTIONS): number {
  return Math.max(0, maxActions - actionCount);
}
