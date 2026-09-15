import type { User } from '@/types/product';
import { canAccessRestaurantBusinessTools } from '@/lib/restaurantRolePolicy';
import { getAccountingFreelancerClientDashboardPath, getFreelancerPortalPath, getWebBuilderClientDashboardPath, isAccountingFreelancerSubAccount, isFreelancerClientSubAccount, isWebBuilderSubAccount } from '@/lib/webBuilderAccess';

type SubAccountUser = Pick<User, 'role' | 'subAccountRole' | 'permissions'> | null | undefined;

/** Store owner account or Manager sub-account — full back-office access (not field Sales). */
export function hasStoreAdminAccess(
  user: Pick<User, 'role' | 'subAccountRole'> | null | undefined,
): boolean {
  return user?.role === 'admin' || isManagerSubAccount(user);
}

/** Field sales rep — own clients/orders/CRM routes only. */
export function isSalesSubAccount(
  user: Pick<User, 'role' | 'subAccountRole'> | null | undefined,
): boolean {
  return user?.role === 'sub_account' && user?.subAccountRole === 'sales';
}

export function canViewStoreInventory(user: SubAccountUser): boolean {
  return hasStoreAdminAccess(user) || Boolean(user?.permissions?.includes('view_inventory'));
}

export function canManageStoreInventory(user: SubAccountUser): boolean {
  return hasStoreAdminAccess(user) || Boolean(user?.permissions?.includes('manage_inventory'));
}

/** Grabio POS pairing + store events — sales staff with checkout access. */
export function canAccessGrabioPos(user: SubAccountUser): boolean {
  if (hasStoreAdminAccess(user)) return true;
  if (user?.role !== 'sub_account') return false;
  return (
    user.permissions?.includes('create_orders') === true ||
    user.permissions?.includes('process_payments') === true
  );
}

export function isManagerSubAccount(
  user: Pick<User, 'role' | 'subAccountRole'> | null | undefined,
): boolean {
  return user?.role === 'sub_account' && user?.subAccountRole === 'manager';
}

/** Finance, payroll, account statement, invoice manager, etc. */
export function canAccessBusinessTools(
  user: Pick<User, 'role' | 'subAccountRole'> | null | undefined,
): boolean {
  return canAccessRestaurantBusinessTools(user);
}

export function getSubAccountHomePath(
  user: Pick<User, 'role' | 'subAccountRole'> | null | undefined,
): '/admin/dashboard' | '/team/dashboard' | '/freelancer' {
  if (isWebBuilderSubAccount(user)) return getWebBuilderClientDashboardPath() as '/admin/dashboard';
  if (isAccountingFreelancerSubAccount(user)) {
    return getAccountingFreelancerClientDashboardPath() as '/admin/finance/accounting';
  }
  return isManagerSubAccount(user) ? '/admin/dashboard' : '/team/dashboard';
}

export function getPlatformBuilderHomePath(
  user: Pick<User, 'role' | 'subAccountRole' | 'freelancerTrack'> | null | undefined,
): '/freelancer' | '/admin/dashboard' | '/team/dashboard' {
  if (isFreelancerClientSubAccount(user) || user?.role === 'freelancer') {
    return getFreelancerPortalPath() as '/freelancer';
  }
  return getSubAccountHomePath(user);
}
