/** NIPCO — B2B distribution; no kitchen/pickup prep steps. */
export const NIPCO_STORE_ID = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';

export const FULL_ORDER_STATUS_VALUES = [
  'pending',
  'confirmed',
  'processing',
  'ready',
  'delivered',
  'returned',
  'cancelled',
] as const;

export const DIRECT_ORDER_STATUS_VALUES = [
  'pending',
  'confirmed',
  'delivered',
  'returned',
  'cancelled',
] as const;

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

export function getOrderStatusValuesForStore(
  storeId?: string | null,
  deliverySettings?: OrderFlowSettings,
): readonly string[] {
  return usesDirectOrderFlow(storeId, deliverySettings)
    ? DIRECT_ORDER_STATUS_VALUES
    : FULL_ORDER_STATUS_VALUES;
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

export function isActivePreDeliveryStatus(
  status: string,
  storeId?: string | null,
  deliverySettings?: OrderFlowSettings,
): boolean {
  const normalized = String(status || '').toLowerCase();
  if (usesDirectOrderFlow(storeId, deliverySettings)) {
    return ['pending', 'confirmed', 'processing', 'ready'].includes(normalized);
  }
  return ['pending', 'confirmed', 'processing', 'ready'].includes(normalized);
}
