export type SubAccountRole = 'sales' | 'delivery' | 'manager';

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
  | 'process_payments';

export interface SubAccount {
  id: string;
  storeId: string;
  email: string;
  name: string;
  phone?: string;
  role: SubAccountRole;
  permissions: SubAccountPermission[];
  status: 'active' | 'suspended' | 'inactive';
  commissionRate?: number; // For sales role - percentage
  kmRate?: number; // For delivery role - payment per km
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
};
