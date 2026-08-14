import { StoreDeliverySettings } from '@/types/storeProfile';

export type CustomerFulfillmentMethod = 'delivery' | 'pickup' | 'dine_in';
export type OrderDeliveryMethod = 'standard' | 'express' | 'same_day' | 'pickup' | 'dine_in';

export const DEFAULT_STORE_DELIVERY_SETTINGS: StoreDeliverySettings = {
  standardDelivery: true,
  expressDelivery: false,
  sameDay: false,
  pickup: true,
  dineIn: false,
  standardTime: '3-5 days',
  expressTime: '1-2 days',
  sameDayTime: '4-6 hours',
  standardFee: '5.99',
  expressFee: '12.99',
  sameDayFee: '19.99',
  freeShippingThreshold: '50.00',
  deliveryRadius: '25',
  workingDays: 'Monday to Friday',
  workingHours: '9:00 AM - 6:00 PM',
  specialInstructions: '',
  ownDeliveryEnabled: true,
  defaultPickupCarrier: 'in_house',
};

const FULFILLMENT_LABELS: Record<CustomerFulfillmentMethod, string> = {
  delivery: 'Home Delivery',
  pickup: 'Pick Up',
  dine_in: 'Dine In',
};

const ORDER_METHOD_LABELS: Record<OrderDeliveryMethod, string> = {
  standard: 'Home Delivery',
  express: 'Express Delivery',
  same_day: 'Same Day Delivery',
  pickup: 'Pick Up',
  dine_in: 'Dine In',
};

export function mergeDeliverySettings(
  settings?: Partial<StoreDeliverySettings> | null,
): StoreDeliverySettings {
  return { ...DEFAULT_STORE_DELIVERY_SETTINGS, ...(settings || {}) };
}

export function getStoreFulfillmentOptions(
  settings?: Partial<StoreDeliverySettings> | null,
): CustomerFulfillmentMethod[] {
  const merged = mergeDeliverySettings(settings);
  const options: CustomerFulfillmentMethod[] = [];

  if (merged.standardDelivery || merged.expressDelivery || merged.sameDay) {
    options.push('delivery');
  }
  if (merged.pickup) options.push('pickup');
  if (merged.dineIn) options.push('dine_in');

  return options.length > 0 ? options : ['delivery'];
}

export function intersectFulfillmentOptions(
  storeOptionsList: CustomerFulfillmentMethod[][],
): CustomerFulfillmentMethod[] {
  if (storeOptionsList.length === 0) return ['delivery'];
  return storeOptionsList.reduce(
    (acc, current) => acc.filter((method) => current.includes(method)),
    storeOptionsList[0],
  );
}

export function getFulfillmentLabel(method: CustomerFulfillmentMethod | string): string {
  if (method in FULFILLMENT_LABELS) {
    return FULFILLMENT_LABELS[method as CustomerFulfillmentMethod];
  }
  if (method in ORDER_METHOD_LABELS) {
    return ORDER_METHOD_LABELS[method as OrderDeliveryMethod];
  }
  return String(method || 'Delivery').replace(/_/g, ' ');
}

export function fulfillmentRequiresAddress(method: CustomerFulfillmentMethod): boolean {
  return method === 'delivery';
}

export function mapCustomerFulfillmentToOrderMethod(
  method: CustomerFulfillmentMethod | undefined,
): OrderDeliveryMethod {
  if (method === 'pickup') return 'pickup';
  if (method === 'dine_in') return 'dine_in';
  return 'standard';
}

export function resolveCheckoutDeliveryAddress(
  method: CustomerFulfillmentMethod | undefined,
  address?: string,
): string {
  if (method === 'pickup') return address?.trim() || 'Store Pickup';
  if (method === 'dine_in') return address?.trim() || 'Dine In';
  return address?.trim() || '';
}
