import type { StoreEventSettings } from './storeEventsCore';

export function roundEventMoney(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export type EventOrderFinancials = {
  subtotal: number;
  eventDiscountPercent: number | null;
  eventDiscountAmount: number;
  eventEntryFeeAmount: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  pricingEnforced: boolean;
};

export function calculateEventOrderFinancials(
  itemSubtotal: number,
  taxAmountInput: number,
  settings: StoreEventSettings,
  options?: {
    includeEntryFee?: boolean;
    entryFeeAlreadyPaid?: boolean;
  },
): EventOrderFinancials {
  const subtotal = roundEventMoney(itemSubtotal);
  let eventDiscountAmount = 0;
  let eventDiscountPercent: number | null = null;
  let eventEntryFeeAmount = 0;
  let pricingEnforced = false;

  if (settings.discountEnabled) {
    const percent = Number(settings.percent || 0);
    if (Number.isFinite(percent) && percent > 0) {
      eventDiscountPercent = percent;
      eventDiscountAmount = roundEventMoney(subtotal * percent / 100);
      pricingEnforced = true;
    }
  }

  if (
    settings.entryFeeEnabled &&
    options?.includeEntryFee === true &&
    options?.entryFeeAlreadyPaid !== true
  ) {
    const fee = Number(settings.entryFee || 0);
    if (Number.isFinite(fee) && fee > 0) {
      eventEntryFeeAmount = roundEventMoney(fee);
      pricingEnforced = true;
    }
  }

  const taxAmount = roundEventMoney(taxAmountInput);
  const discountAmount = eventDiscountAmount;
  const total = roundEventMoney(subtotal - discountAmount + eventEntryFeeAmount + taxAmount);

  return {
    subtotal,
    eventDiscountPercent,
    eventDiscountAmount,
    eventEntryFeeAmount,
    discountAmount,
    taxAmount,
    total,
    pricingEnforced,
  };
}

export function assertClientTotalMatches(
  clientTotal: number,
  serverTotal: number,
  tolerance = 0.02,
): { ok: true } | { ok: false; message: string } {
  if (!Number.isFinite(clientTotal) || clientTotal <= 0) return { ok: true };
  if (Math.abs(roundEventMoney(clientTotal) - serverTotal) <= tolerance) return { ok: true };
  return {
    ok: false,
    message: `Event pricing total mismatch: expected ${serverTotal.toFixed(2)}, got ${roundEventMoney(clientTotal).toFixed(2)}`,
  };
}

export function entryFeeBlocksTicketLink(
  settings: StoreEventSettings,
  ticket: { entryFeeAmount: number | null; entryFeePaid: boolean },
): boolean {
  if (!settings.linkTicketsToSales || !settings.entryFeeEnabled) return false;
  const fee = Number(ticket.entryFeeAmount ?? settings.entryFee ?? 0);
  return fee > 0 && ticket.entryFeePaid !== true;
}
