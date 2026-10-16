import type { StoreEntitlements } from '@/lib/entitlements';
import {
  canAccessHrPayroll,
  canAccessOfficialHr,
  canAccessRestaurantFinance,
  canAccessRestaurantInventory,
  canAccessSeoOps,
  canAccessStorefrontGrowTools,
  canAccessVenueCrm,
  canAccessVenueOperations,
} from '@/lib/restaurantRolePolicy';
import { resolveVenueOpsNavFlags, type VenueOpsNavFlags } from '@/lib/venueOpsNav';
import type { StoreProfile, VenueOpsSettings } from '@/types/storeProfile';
import type { User } from '@/types/product';

export type GatedAdminFeature =
  | 'finance'
  | 'inventory'
  | 'crm'
  | 'seo'
  | 'builder'
  | 'reservations'
  | 'pos'
  | 'hr'
  | 'venue_ops'
  | 'payroll';

export type FeatureAccessDenialReason = 'not_entitled' | 'store_toggle' | 'permission';

export type FeatureAccessDenial = {
  feature: GatedAdminFeature;
  reason: FeatureAccessDenialReason;
};

export type FeatureAccessActor = Pick<User, 'role' | 'subAccountRole' | 'permissions'> | null | undefined;

export function isFinanceEntitled(entitlements: StoreEntitlements | null): boolean {
  const m = entitlements?.modules ?? {};
  return Boolean(m.payments || m.invoicing || m.invoice_manager);
}

export function isInventoryEntitled(entitlements: StoreEntitlements | null): boolean {
  return Boolean(entitlements?.modules?.stock);
}

export function isCrmEntitled(entitlements: StoreEntitlements | null): boolean {
  return Boolean(entitlements?.modules?.crm);
}

export function isPosEntitled(entitlements: StoreEntitlements | null): boolean {
  return Boolean(entitlements?.modules?.pos);
}

export function isBuilderEntitled(entitlements: StoreEntitlements | null): boolean {
  const m = entitlements?.modules ?? {};
  return Boolean(m.builder || m.ai_builder || m.blog_publisher);
}

export function isSeoEntitled(entitlements: StoreEntitlements | null): boolean {
  const m = entitlements?.modules ?? {};
  return Boolean(m.blog_publisher || m.seo_assistant || m.content_creator);
}

/** Existing team module. No new package id. */
export function isHrEntitled(entitlements: StoreEntitlements | null): boolean {
  return Boolean(entitlements?.modules?.team);
}

/** Existing restaurant module, or a live-kitchen package/workflow. */
export function isVenueOpsHubEntitled(entitlements: StoreEntitlements | null): boolean {
  if (entitlements?.modules?.restaurant) return true;
  return (
    entitlements?.businessWorkflow === 'live_kitchen' ||
    entitlements?.startingPackage === 'pkg_live_kitchen'
  );
}

function storeToggleForFeature(nav: VenueOpsNavFlags, feature: GatedAdminFeature): boolean {
  switch (feature) {
    case 'finance':
      return nav.showBusinessFinanceNav;
    case 'inventory':
      return nav.showInventoryNav;
    case 'crm':
      return nav.showCrmNav;
    case 'seo':
      return nav.showSeoNav;
    case 'builder':
      return nav.showStorefrontGrowNav;
    case 'reservations':
      return nav.showReservationsNav;
    case 'pos':
      return true;
    case 'hr':
      return nav.showOfficialHrNav;
    case 'venue_ops':
      return nav.showVenueOpsHubNav;
    case 'payroll':
      return nav.showBusinessFinanceNav;
    default:
      return false;
  }
}

function userPermissionForFeature(user: FeatureAccessActor, feature: GatedAdminFeature): boolean {
  if (!user) return true;
  switch (feature) {
    case 'finance':
      return canAccessRestaurantFinance(user);
    case 'inventory':
      return canAccessRestaurantInventory(user);
    case 'crm':
      return canAccessVenueCrm(user);
    case 'seo':
      return canAccessSeoOps(user);
    case 'builder':
      return canAccessStorefrontGrowTools(user);
    case 'reservations':
    case 'pos':
      return canAccessVenueOperations(user);
    case 'hr':
      return canAccessOfficialHr(user);
    case 'venue_ops':
      return canAccessVenueOperations(user);
    case 'payroll':
      return canAccessHrPayroll(user);
    default:
      return false;
  }
}

function isEntitledForFeature(entitlements: StoreEntitlements | null, feature: GatedAdminFeature): boolean {
  switch (feature) {
    case 'finance':
      return isFinanceEntitled(entitlements);
    case 'inventory':
      return isInventoryEntitled(entitlements);
    case 'crm':
      return isCrmEntitled(entitlements);
    case 'seo':
      return isSeoEntitled(entitlements);
    case 'builder':
      return isBuilderEntitled(entitlements);
    case 'reservations':
    case 'pos':
      return isPosEntitled(entitlements);
    case 'hr':
      return isHrEntitled(entitlements);
    case 'venue_ops':
      return isVenueOpsHubEntitled(entitlements);
    case 'payroll':
      return isFinanceEntitled(entitlements);
    default:
      return false;
  }
}

/**
 * allowed = subscription entitlement AND store venue toggle AND user permission
 */
export function isAdminFeatureAllowed(
  feature: GatedAdminFeature,
  profile: StoreProfile | null | undefined,
  entitlements: StoreEntitlements | null,
  user?: FeatureAccessActor,
): boolean {
  const nav = resolveVenueOpsNavFlags(profile);
  if (!isEntitledForFeature(entitlements, feature)) return false;
  if (!storeToggleForFeature(nav, feature)) return false;
  if (!userPermissionForFeature(user, feature)) return false;
  return true;
}

/** Dashboard / menu label for Staff (Payroll). Business-tools access is not enough when finance is off. */
export function staffPayrollShortcutVisible(
  canUseBusinessTools: boolean,
  profile: StoreProfile | null | undefined,
  entitlements: StoreEntitlements | null,
  user?: FeatureAccessActor,
): boolean {
  return canUseBusinessTools && isAdminFeatureAllowed('payroll', profile, entitlements, user);
}

export function getAdminFeatureDenial(
  feature: GatedAdminFeature,
  profile: StoreProfile | null | undefined,
  entitlements: StoreEntitlements | null,
  user?: FeatureAccessActor,
): FeatureAccessDenial | null {
  const nav = resolveVenueOpsNavFlags(profile);
  if (!isEntitledForFeature(entitlements, feature)) {
    return { feature, reason: 'not_entitled' };
  }
  if (!storeToggleForFeature(nav, feature)) {
    return { feature, reason: 'store_toggle' };
  }
  if (!userPermissionForFeature(user, feature)) {
    return { feature, reason: 'permission' };
  }
  return null;
}

const FINANCE_PATH_PREFIXES = ['/admin/finance', '/admin/invoice-manager', '/admin/v-expense', '/admin/cash-collection', '/admin/delivery-wallet', '/admin/staff', '/admin/salaries'];

/** Payroll tab under the new HR hub. Parent HR gate is applied in getAdminPathFeatureDenial. */
export function isOfficialHrPayrollPath(pathname: string): boolean {
  return pathname === '/admin/hr/payroll' || pathname.startsWith('/admin/hr/payroll/');
}

/**
 * Old HR screens stay on their current gates.
 * Staff and salaries are payroll (finance). Daily presence is not finance-gated.
 */
export function legacyHrRouteKind(pathname: string): 'payroll' | 'attendance' | null {
  if (
    pathname === '/admin/staff' ||
    pathname.startsWith('/admin/staff/') ||
    pathname === '/admin/salaries' ||
    pathname.startsWith('/admin/salaries/')
  ) {
    return 'payroll';
  }
  if (pathname === '/admin/staff-presence' || pathname.startsWith('/admin/staff-presence/')) {
    return 'attendance';
  }
  return null;
}
const INVENTORY_PATH_PREFIXES = ['/admin/inventory', '/admin/purchases', '/admin/v-purchase'];
const SEO_PATH_PREFIXES = ['/admin/seo-'];
const BUILDER_PATH_PREFIXES = ['/admin/theme-editor', '/admin/templates', '/admin/builder'];
const CRM_PATH_PREFIXES = ['/admin/crm'];

export function resolveGatedFeatureForAdminPath(pathname: string): GatedAdminFeature | null {
  if (isOfficialHrPayrollPath(pathname)) return 'payroll';
  if (pathname === '/admin/hr' || pathname.startsWith('/admin/hr/')) return 'hr';
  if (pathname === '/admin/venue-ops' || pathname.startsWith('/admin/venue-ops/')) return 'venue_ops';
  if (FINANCE_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return 'finance';
  }
  if (INVENTORY_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return 'inventory';
  }
  if (SEO_PATH_PREFIXES.some((p) => pathname.startsWith(p))) {
    return 'seo';
  }
  if (BUILDER_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return 'builder';
  }
  if (CRM_PATH_PREFIXES.some((p) => pathname.startsWith(p))) {
    return 'crm';
  }
  if (pathname === '/admin/events' || pathname.startsWith('/admin/events/')) {
    return 'reservations';
  }
  return null;
}

export function getAdminPathFeatureDenial(
  pathname: string,
  profile: StoreProfile | null | undefined,
  entitlements: StoreEntitlements | null,
  user: FeatureAccessActor,
): FeatureAccessDenial | null {
  if (isOfficialHrPayrollPath(pathname)) {
    return (
      getAdminFeatureDenial('hr', profile, entitlements, user) ??
      getAdminFeatureDenial('payroll', profile, entitlements, user)
    );
  }
  const feature = resolveGatedFeatureForAdminPath(pathname);
  if (!feature) return null;
  return getAdminFeatureDenial(feature, profile, entitlements, user);
}

type VenueModuleToggleKey = Exclude<keyof VenueOpsSettings, 'restaurantFirstNavEnabled'>;

export function isVenueToggleEntitled(
  key: VenueModuleToggleKey,
  entitlements: StoreEntitlements | null,
): boolean {
  switch (key) {
    case 'enableCrmPipeline':
      return isCrmEntitled(entitlements);
    case 'enableReservationsHub':
      return isPosEntitled(entitlements);
    case 'enableFullInventory':
      return isInventoryEntitled(entitlements);
    case 'enableBusinessFinance':
      return isFinanceEntitled(entitlements);
    case 'enableStorefrontBuilder':
      return isBuilderEntitled(entitlements);
    case 'enableSeoOps':
      return isSeoEntitled(entitlements);
    case 'enableOfficialHr':
      return isHrEntitled(entitlements);
    case 'enableVenueOpsHub':
      return isVenueOpsHubEntitled(entitlements);
    default:
      return false;
  }
}
