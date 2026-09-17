export type RestaurantDemoEntityType =
  | 'products'
  | 'guests'
  | 'reservations'
  | 'orders'
  | 'documents'
  | 'crmTasks';

export type RestaurantDemoSession = {
  demo: true;
  ownerUid: string;
  sessionId: string;
  createdAt: string;
  expiresAt: string | { toMillis?: () => number; seconds?: number };
  actionCount: number;
  maxActions: number;
  demoPackage: 'pkg_live_kitchen';
  businessWorkflow: 'live_kitchen';
  label: string;
};

export type RestaurantDemoEntityBase = {
  demo: true;
  sessionId: string;
  expiresAt: string | { toMillis?: () => number; seconds?: number };
  createdByDemoVisitor: true;
  createdAt: string;
  displayLabel: string;
  demoBadge: 'DEMO';
};

export type RestaurantDemoProduct = RestaurantDemoEntityBase & {
  name: string;
  priceUsd: number;
  category: string;
};

export type RestaurantDemoGuest = RestaurantDemoEntityBase & {
  name: string;
  phone?: string;
  notes?: string;
};

export type RestaurantDemoReservation = RestaurantDemoEntityBase & {
  guestName: string;
  partySize: number;
  dateTime: string;
};

export type RestaurantDemoOrder = RestaurantDemoEntityBase & {
  tableOrChannel: string;
  totalUsd: number;
  status: 'open' | 'served' | 'paid';
};

export type RestaurantDemoDocument = RestaurantDemoEntityBase & {
  docType: 'invoice' | 'receipt';
  number: string;
  amountUsd: number;
};

export type RestaurantDemoCrmTask = RestaurantDemoEntityBase & {
  title: string;
  guestName?: string;
};
