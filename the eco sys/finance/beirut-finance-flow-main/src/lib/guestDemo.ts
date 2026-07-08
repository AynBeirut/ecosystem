import type {
  Client,
  Estimate,
  Expense,
  Invoice,
  Payment,
  Product,
  PurchaseOrder,
  Receipt,
  Supplier,
  User,
} from '@/context/AppContext';

export const GUEST_DEMO_SESSION_KEY = 'grabio-guest-demo';
export const GUEST_DEMO_DATA_KEY = 'grabio-guest-demo-data';
export const GUEST_DEMO_STORE_ID = '__guest_demo__';
export const GUEST_DEMO_USER_ID = '__guest_demo_user__';
export const GUEST_DEMO_EMAIL = 'demo@grabio.space';

export const GUEST_DEMO_LIMITS = {
  clients: 1,
  products: 1,
  suppliers: 1,
  invoices: 1,
  estimates: 1,
  receipts: 1,
  purchaseOrders: 1,
} as const;

export type GuestDemoLimitType = keyof typeof GUEST_DEMO_LIMITS;

export interface GuestDemoData {
  clients: Client[];
  suppliers: Supplier[];
  products: Product[];
  invoices: Invoice[];
  estimates: Estimate[];
  receipts: Receipt[];
  purchaseOrders: PurchaseOrder[];
  payments: Payment[];
  expenses: Expense[];
  company?: User['company'];
}

const EMPTY_DATA: GuestDemoData = {
  clients: [],
  suppliers: [],
  products: [],
  invoices: [],
  estimates: [],
  receipts: [],
  purchaseOrders: [],
  payments: [],
  expenses: [],
};

export function isGuestDemoActive(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem(GUEST_DEMO_SESSION_KEY) === '1';
}

export function setGuestDemoActive(active: boolean): void {
  if (typeof sessionStorage === 'undefined') return;
  if (active) sessionStorage.setItem(GUEST_DEMO_SESSION_KEY, '1');
  else sessionStorage.removeItem(GUEST_DEMO_SESSION_KEY);
}

export function loadGuestDemoData(): GuestDemoData {
  if (typeof localStorage === 'undefined') return { ...EMPTY_DATA };
  const raw = localStorage.getItem(GUEST_DEMO_DATA_KEY);
  if (!raw) return { ...EMPTY_DATA };
  try {
    return { ...EMPTY_DATA, ...JSON.parse(raw) };
  } catch {
    return { ...EMPTY_DATA };
  }
}

export function saveGuestDemoData(data: GuestDemoData): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(GUEST_DEMO_DATA_KEY, JSON.stringify(data));
}

export function clearGuestDemoData(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(GUEST_DEMO_DATA_KEY);
}

export function clearGuestDemo(): void {
  setGuestDemoActive(false);
  clearGuestDemoData();
}

export function guestDemoLimitMessage(type: GuestDemoLimitType, current: number, limit: number): string {
  const label = type === 'purchaseOrders' ? 'purchase order' : type.replace(/s$/, '');
  return `Demo limit reached: ${current}/${limit} ${label}. Sign up to create more.`;
}
