export type SubAccountRole =
  | 'sales' // Field sales rep — limited permissions, team dashboard
  | 'delivery'
  | 'manager' // Store manager — full back-office access (same as store owner UI)
  | 'cashier'
  | 'web_maintenance'
  | 'accounting';

export type SubAccountPermission = 
  | 'view_orders'
  | 'create_orders'
  | 'manage_orders'
  | 'view_inventory'
  | 'manage_inventory'
  | 'view_customers'
  | 'manage_customers'
  | 'view_reports'
  | 'manage_deliveries'
  | 'process_payments'
  /** Planned — reservation hub (Slice C+); not stored in Firestore until approved */
  | 'manage_reservations';

export interface SubAccount {
  id: string;
  storeId: string;
  email: string;
  name: string;
  phone?: string;
  role: SubAccountRole;
  permissions: SubAccountPermission[];
  status: 'active' | 'suspended' | 'inactive';
  assignedTerritory?: string | null;
  dailyVisitTarget?: number | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  lastLogin?: string;
}

export const ROLE_PERMISSIONS: Record<SubAccountRole, SubAccountPermission[]> = {
  sales: [
    'view_orders',
    'create_orders',
    'view_customers',
    'manage_customers',
    'process_payments',
  ],
  delivery: [
    'view_orders',
    'manage_deliveries',
    'view_customers',
  ],
  cashier: [
    'view_orders',
    'create_orders',
    'view_customers',
    'process_payments',
  ],
  manager: [
    'view_orders',
    'create_orders',
    'manage_orders',
    'view_inventory',
    'manage_inventory',
    'view_customers',
    'manage_customers',
    'view_reports',
    'manage_deliveries',
    'process_payments',
  ],
  web_maintenance: [
    'view_inventory',
    'manage_inventory',
  ],
  accounting: [
    'view_orders',
    'view_reports',
    'process_payments',
  ],
};

/** Human-readable sub-account role label (internal role values unchanged). */
export function formatSubAccountRoleLabel(role?: string | null): string {
  if (!role) return '—';
  if (role === 'web_maintenance') return 'Web builder';
  if (role === 'accounting') return 'Accounting freelancer';
  if (role === 'manager') return 'Store admin';
  if (role === 'sales') return 'Sales rep';
  return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export type FreelancerClientSession = {
  role: 'sub_account';
  subAccountRole: 'web_maintenance' | 'accounting';
  storeId: string;
  subAccountId: string;
  permissions: string[];
};

export type WebBuilderClientSession = FreelancerClientSession & {
  subAccountRole: 'web_maintenance';
};

const FREELANCER_CLIENT_ROLES = new Set<FreelancerClientSession['subAccountRole']>([
  'web_maintenance',
  'accounting',
]);

/** Active platform freelancer client-store session (builder or accounting). */
export function readFreelancerClientSessionFromStorage(): FreelancerClientSession | null {
  try {
    const raw = localStorage.getItem('subAccountInfo');
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<FreelancerClientSession>;
    if (!data.subAccountRole || !FREELANCER_CLIENT_ROLES.has(data.subAccountRole)) return null;
    if (typeof data.storeId !== 'string' || !data.storeId.trim()) return null;
    if (typeof data.subAccountId !== 'string' || !data.subAccountId.trim()) return null;
    return {
      role: 'sub_account',
      subAccountRole: data.subAccountRole,
      storeId: data.storeId,
      subAccountId: data.subAccountId,
      permissions: Array.isArray(data.permissions) ? data.permissions : [],
    };
  } catch {
    return null;
  }
}

/** @deprecated use readFreelancerClientSessionFromStorage */
export function readWebBuilderClientSessionFromStorage(): WebBuilderClientSession | null {
  const session = readFreelancerClientSessionFromStorage();
  if (session?.subAccountRole !== 'web_maintenance') return null;
  return session;
}
