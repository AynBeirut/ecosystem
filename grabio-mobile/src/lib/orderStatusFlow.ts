/** NIPCO — B2B distribution; no kitchen/pickup prep steps. */
export const NIPCO_STORE_ID = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';

export const FULL_ORDER_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'ready',
  'delivered',
  'returned',
  'cancelled',
] as const;

export const DIRECT_ORDER_STATUSES = [
  'pending',
  'confirmed',
  'delivered',
  'returned',
  'cancelled',
] as const;

export const DIRECT_TRACKING_STEPS = ['pending', 'confirmed', 'delivered'] as const;

export const FULL_TRACKING_STEPS = ['pending', 'confirmed', 'processing', 'ready', 'delivered'] as const;

export type OrderFlowSettings = {
  skipKitchenStatuses?: boolean;
};

export function usesDirectOrderFlow(
  storeId?: string | null,
  deliverySettings?: OrderFlowSettings,
): boolean {
  if (deliverySettings?.skipKitchenStatuses === true) return true;
  return storeId === NIPCO_STORE_ID;
}

export function getOrderStatusesForStore(
  storeId?: string | null,
  deliverySettings?: OrderFlowSettings,
): readonly string[] {
  return usesDirectOrderFlow(storeId, deliverySettings) ? DIRECT_ORDER_STATUSES : FULL_ORDER_STATUSES;
}

export function getTrackingSteps(
  storeId?: string | null,
  deliverySettings?: OrderFlowSettings,
): readonly string[] {
  return usesDirectOrderFlow(storeId, deliverySettings) ? DIRECT_TRACKING_STEPS : FULL_TRACKING_STEPS;
}

export function getNextOrderStatus(
  current: string,
  storeId?: string | null,
  deliverySettings?: OrderFlowSettings,
): string | undefined {
  if (usesDirectOrderFlow(storeId, deliverySettings)) {
    const directNext: Record<string, string> = {
      pending: 'confirmed',
      confirmed: 'delivered',
      processing: 'delivered',
      ready: 'delivered',
    };
    return directNext[current];
  }

  const fullNext: Record<string, string> = {
    pending: 'confirmed',
    confirmed: 'processing',
    processing: 'ready',
    ready: 'delivered',
  };
  return fullNext[current];
}

export function getSuggestedOrderStatuses(
  current: string,
  storeId?: string | null,
  deliverySettings?: OrderFlowSettings,
): string[] {
  const next = getNextOrderStatus(current, storeId, deliverySettings);
  if (next) return [next];

  if (current === 'delivered') return ['returned', 'cancelled'];
  if (current === 'returned') return ['delivered', 'cancelled'];
  if (current === 'cancelled') return ['pending'];

  return getOrderStatusesForStore(storeId, deliverySettings).filter((s) => s !== current);
}

/** Map legacy kitchen statuses onto direct-flow tracking steps. */
export function resolveTrackingStepIndex(
  status: string,
  storeId?: string | null,
  deliverySettings?: OrderFlowSettings,
): number {
  const steps = getTrackingSteps(storeId, deliverySettings);
  if (status === 'cancelled' || status === 'returned') return -1;
  if (usesDirectOrderFlow(storeId, deliverySettings)) {
    if (status === 'processing' || status === 'ready') return steps.indexOf('confirmed');
    return steps.indexOf(status);
  }
  return steps.indexOf(status);
}
