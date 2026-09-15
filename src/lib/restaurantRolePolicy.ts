import type { User } from '@/types/product';
import type { SubAccountPermission, SubAccountRole } from '@/types/subaccount';
import { ROLE_PERMISSIONS } from '@/types/subaccount';
import {
  isAccountingFreelancerSubAccount,
  isFreelancerClientSubAccount,
  isWebBuilderSubAccount,
} from '@/lib/webBuilderAccess';

type SubAccountUser = Pick<User, 'role' | 'subAccountRole' | 'permissions'> | null | undefined;

function isManagerSubAccount(user: SubAccountUser): boolean {
  return user?.role === 'sub_account' && user?.subAccountRole === 'manager';
}

function hasStoreAdminAccess(user: SubAccountUser): boolean {
  return user?.role === 'admin' || isManagerSubAccount(user);
}

function canViewStoreInventory(user: SubAccountUser): boolean {
  return hasStoreAdminAccess(user) || Boolean(user?.permissions?.includes('view_inventory'));
}

/**
 * Venue-facing role templates for fine-dining roadmap.
 * Firestore still stores `SubAccountRole` — templates map 1:1 until new roles are migrated.
 */
export type VenueRoleTemplateId =
  | 'owner'
  | 'venue_manager'
  | 'floor_manager'
  | 'host_reservations'
  | 'waiter'
  | 'kitchen_lead'
  | 'cashier'
  | 'crm_guest_relations'
  | 'accounting'
  | 'inventory_purchasing'
  | 'web_maintenance'
  | 'seo_content'
  | 'implementation_support';

export type VenueRoleCapabilities = {
  venueOps: boolean;
  reservations: boolean;
  crm: boolean;
  finance: boolean;
  inventory: boolean;
  storefrontBuilder: boolean;
  seoOps: boolean;
};

export type VenueRoleTemplate = {
  id: VenueRoleTemplateId;
  label: string;
  mapsToSubAccountRole: SubAccountRole | 'admin';
  capabilities: VenueRoleCapabilities;
};

/** Permissions reserved for future reservation hub — not enforced in Firestore yet. */
export const PLANNED_VENUE_PERMISSIONS = ['manage_reservations'] as const;
export type PlannedVenuePermission = (typeof PLANNED_VENUE_PERMISSIONS)[number];

export const VENUE_ROLE_TEMPLATES: Record<VenueRoleTemplateId, VenueRoleTemplate> = {
  owner: {
    id: 'owner',
    label: 'Owner',
    mapsToSubAccountRole: 'admin',
    capabilities: {
      venueOps: true,
      reservations: true,
      crm: true,
      finance: true,
      inventory: true,
      storefrontBuilder: true,
      seoOps: true,
    },
  },
  venue_manager: {
    id: 'venue_manager',
    label: 'Venue manager',
    mapsToSubAccountRole: 'manager',
    capabilities: {
      venueOps: true,
      reservations: true,
      crm: true,
      finance: true,
      inventory: true,
      storefrontBuilder: true,
      seoOps: true,
    },
  },
  floor_manager: {
    id: 'floor_manager',
    label: 'Floor manager',
    mapsToSubAccountRole: 'manager',
    capabilities: {
      venueOps: true,
      reservations: true,
      crm: true,
      finance: false,
      inventory: false,
      storefrontBuilder: false,
      seoOps: false,
    },
  },
  host_reservations: {
    id: 'host_reservations',
    label: 'Host / reservations',
    mapsToSubAccountRole: 'cashier',
    capabilities: {
      venueOps: true,
      reservations: true,
      crm: true,
      finance: false,
      inventory: false,
      storefrontBuilder: false,
      seoOps: false,
    },
  },
  waiter: {
    id: 'waiter',
    label: 'Waiter / service',
    mapsToSubAccountRole: 'cashier',
    capabilities: {
      venueOps: true,
      reservations: false,
      crm: true,
      finance: false,
      inventory: false,
      storefrontBuilder: false,
      seoOps: false,
    },
  },
  kitchen_lead: {
    id: 'kitchen_lead',
    label: 'Kitchen lead',
    mapsToSubAccountRole: 'manager',
    capabilities: {
      venueOps: true,
      reservations: false,
      crm: false,
      finance: false,
      inventory: true,
      storefrontBuilder: false,
      seoOps: false,
    },
  },
  cashier: {
    id: 'cashier',
    label: 'Cashier',
    mapsToSubAccountRole: 'cashier',
    capabilities: {
      venueOps: true,
      reservations: false,
      crm: true,
      finance: false,
      inventory: false,
      storefrontBuilder: false,
      seoOps: false,
    },
  },
  crm_guest_relations: {
    id: 'crm_guest_relations',
    label: 'CRM / guest relations',
    mapsToSubAccountRole: 'sales',
    capabilities: {
      venueOps: false,
      reservations: false,
      crm: true,
      finance: false,
      inventory: false,
      storefrontBuilder: false,
      seoOps: false,
    },
  },
  accounting: {
    id: 'accounting',
    label: 'Accounting',
    mapsToSubAccountRole: 'accounting',
    capabilities: {
      venueOps: false,
      reservations: false,
      crm: false,
      finance: true,
      inventory: false,
      storefrontBuilder: false,
      seoOps: false,
    },
  },
  inventory_purchasing: {
    id: 'inventory_purchasing',
    label: 'Inventory / purchasing',
    mapsToSubAccountRole: 'manager',
    capabilities: {
      venueOps: false,
      reservations: false,
      crm: false,
      finance: false,
      inventory: true,
      storefrontBuilder: false,
      seoOps: false,
    },
  },
  web_maintenance: {
    id: 'web_maintenance',
    label: 'Web / builder',
    mapsToSubAccountRole: 'web_maintenance',
    capabilities: {
      venueOps: false,
      reservations: false,
      crm: false,
      finance: false,
      inventory: true,
      storefrontBuilder: true,
      seoOps: false,
    },
  },
  seo_content: {
    id: 'seo_content',
    label: 'SEO / content',
    mapsToSubAccountRole: 'web_maintenance',
    capabilities: {
      venueOps: false,
      reservations: false,
      crm: false,
      finance: false,
      inventory: false,
      storefrontBuilder: true,
      seoOps: true,
    },
  },
  implementation_support: {
    id: 'implementation_support',
    label: 'Implementation support',
    mapsToSubAccountRole: 'manager',
    capabilities: {
      venueOps: true,
      reservations: true,
      crm: true,
      finance: false,
      inventory: false,
      storefrontBuilder: true,
      seoOps: false,
    },
  },
};

/** Resolve template from current auth user (today: subAccountRole only). */
export function resolveVenueRoleTemplate(user: SubAccountUser): VenueRoleTemplateId {
  if (user?.role === 'admin') return 'owner';
  if (isAccountingFreelancerSubAccount(user)) return 'accounting';
  if (isWebBuilderSubAccount(user)) return 'web_maintenance';
  switch (user?.subAccountRole) {
    case 'manager':
      return 'venue_manager';
    case 'cashier':
      return 'cashier';
    case 'sales':
      return 'crm_guest_relations';
    case 'delivery':
      return 'waiter';
    case 'accounting':
      return 'accounting';
    case 'web_maintenance':
      return 'web_maintenance';
    default:
      return 'waiter';
  }
}

export function getVenueRoleCapabilities(user: SubAccountUser): VenueRoleCapabilities {
  const template = VENUE_ROLE_TEMPLATES[resolveVenueRoleTemplate(user)];
  return { ...template.capabilities };
}

function hasPermission(user: SubAccountUser, permission: SubAccountPermission): boolean {
  return Boolean(user?.permissions?.includes(permission));
}

/** Floor, POS, orders — excludes platform freelancer client sessions. */
export function canAccessVenueOperations(user: SubAccountUser): boolean {
  if (user?.role === 'admin') return true;
  if (!user || user.role !== 'sub_account') return false;
  if (isFreelancerClientSubAccount(user)) return false;
  if (hasStoreAdminAccess(user)) return true;
  if (user.subAccountRole === 'cashier' || user.subAccountRole === 'delivery') return true;
  if (user.subAccountRole === 'sales') {
    return hasPermission(user, 'view_orders') || hasPermission(user, 'create_orders');
  }
  return false;
}

/** Admin CRM + guest tools (sales uses /team CRM today). */
export function canAccessVenueCrm(user: SubAccountUser): boolean {
  if (hasStoreAdminAccess(user)) return true;
  if (user?.role === 'sub_account' && user.subAccountRole === 'sales') {
    return hasPermission(user, 'view_customers') || hasPermission(user, 'manage_customers');
  }
  return false;
}

/**
 * Finance, invoice manager, payroll, staff — owner + manager only (unchanged from canAccessBusinessTools).
 * Accounting freelancers use dedicated finance allowlist paths, not full business tools.
 */
export function canAccessRestaurantBusinessTools(user: SubAccountUser): boolean {
  return hasStoreAdminAccess(user);
}

/** GL, statements, invoice manager routes — includes accounting freelancer client sessions. */
export function canAccessRestaurantFinance(user: SubAccountUser): boolean {
  if (user?.role === 'admin' || isManagerSubAccount(user)) return true;
  if (isAccountingFreelancerSubAccount(user)) return true;
  return false;
}

export function canAccessRestaurantInventory(user: SubAccountUser): boolean {
  if (isWebBuilderSubAccount(user)) return canViewStoreInventory(user);
  if (isAccountingFreelancerSubAccount(user)) return false;
  return canViewStoreInventory(user);
}

/** Theme editor, templates, WordPress — builder role or store admin. */
export function canAccessStorefrontGrowTools(user: SubAccountUser): boolean {
  return isWebBuilderSubAccount(user) || hasStoreAdminAccess(user);
}

/** SEO ops screens — store admin only (not web_maintenance-only sessions). */
export function canAccessSeoOps(user: SubAccountUser): boolean {
  if (isWebBuilderSubAccount(user) || isAccountingFreelancerSubAccount(user)) return false;
  return hasStoreAdminAccess(user);
}

export function defaultPermissionsForRole(role: SubAccountRole): SubAccountPermission[] {
  return [...ROLE_PERMISSIONS[role]];
}
