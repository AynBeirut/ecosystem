import type { User } from '@/types/product';

export const FREELANCER_PORTAL_PATH = '/freelancer';

/** Platform builder on a client store (storefront / catalog). */
export function isWebBuilderSubAccount(
  user: Pick<User, 'role' | 'subAccountRole'> | null | undefined,
): boolean {
  return user?.role === 'sub_account' && user?.subAccountRole === 'web_maintenance';
}

/** Accounting freelancer on a client store (finance / invoicing). */
export function isAccountingFreelancerSubAccount(
  user: Pick<User, 'role' | 'subAccountRole'> | null | undefined,
): boolean {
  return user?.role === 'sub_account' && user?.subAccountRole === 'accounting';
}

/** Any platform freelancer acting on a client store via sub-account. */
export function isFreelancerClientSubAccount(
  user: Pick<User, 'role' | 'subAccountRole'> | null | undefined,
): boolean {
  return isWebBuilderSubAccount(user) || isAccountingFreelancerSubAccount(user);
}

export function isPlatformBuilderFreelancer(
  user: Pick<User, 'role' | 'freelancerTrack'> | null | undefined,
): boolean {
  return user?.role === 'freelancer' && user?.freelancerTrack === 'designer_builder';
}

export function isPlatformAccountingFreelancer(
  user: Pick<User, 'role' | 'freelancerTrack'> | null | undefined,
): boolean {
  return user?.role === 'freelancer' && user?.freelancerTrack === 'accounting';
}

/** Builder's own home — client list + demo slots. */
export function getFreelancerPortalPath(): string {
  return FREELANCER_PORTAL_PATH;
}

/** Web builder client store workspace entry. */
export function getWebBuilderClientDashboardPath(storeId?: string | null): string {
  if (storeId) {
    return `/admin/dashboard?storeId=${encodeURIComponent(storeId)}`;
  }
  return '/admin/dashboard';
}

/** Accounting freelancer client store workspace entry. */
export function getAccountingFreelancerClientDashboardPath(storeId?: string | null): string {
  if (storeId) {
    return `/admin/finance/accounting?storeId=${encodeURIComponent(storeId)}`;
  }
  return '/admin/finance/accounting';
}

export function getFreelancerClientDashboardPath(
  user: Pick<User, 'role' | 'subAccountRole'> | null | undefined,
  storeId?: string | null,
): string {
  if (isAccountingFreelancerSubAccount(user)) {
    return getAccountingFreelancerClientDashboardPath(storeId);
  }
  return getWebBuilderClientDashboardPath(storeId);
}

export function canAccessFreelancerPortal(
  user: Pick<User, 'role' | 'subAccountRole' | 'freelancerTrack'> | null | undefined,
): boolean {
  if (user?.role === 'freelancer') return true;
  return isFreelancerClientSubAccount(user);
}

/** Top-level dashboard link in nav bars. */
export function resolveBuilderUserDashboardPath(
  user: Pick<User, 'role' | 'subAccountRole' | 'freelancerTrack' | 'storeId'> | null | undefined,
): string {
  if (canAccessFreelancerPortal(user)) {
    return getFreelancerPortalPath();
  }
  if (user?.role === 'crm_rep') return '/team/crm';
  if (user?.role === 'sub_account') return '/team/dashboard';
  return '/admin/dashboard';
}

export function canViewProductCost(
  user: Pick<User, 'role' | 'subAccountRole'> | null | undefined,
): boolean {
  if (user?.role === 'admin') return true;
  return !isWebBuilderSubAccount(user);
}

export function canViewFinancialData(
  user: Pick<User, 'role' | 'subAccountRole'> | null | undefined,
): boolean {
  if (user?.role === 'admin') return true;
  return !isWebBuilderSubAccount(user);
}

/** Admin paths a web builder may use on client stores — no finance, cost, or ops data. */
export const WEB_BUILDER_ADMIN_ROUTES = [
  '/admin/dashboard',
  '/admin/theme-editor',
  '/admin/templates',
  '/admin/builder',
  '/admin/products',
  '/admin/announcements',
  '/admin/blog',
] as const;

/** Admin paths an accounting freelancer may use on client stores. */
export const ACCOUNTING_FREELANCER_ADMIN_ROUTES = [
  '/admin/finance',
  '/admin/invoice-manager',
  '/admin/reports',
] as const;

export function isWebBuilderAllowedPath(pathname: string): boolean {
  const path = pathname.split('?')[0];
  return WEB_BUILDER_ADMIN_ROUTES.some(
    (route) => path === route || path.startsWith(`${route}/`),
  );
}

export function isAccountingFreelancerAllowedPath(pathname: string): boolean {
  const path = pathname.split('?')[0];
  return ACCOUNTING_FREELANCER_ADMIN_ROUTES.some(
    (route) => path === route || path.startsWith(`${route}/`),
  );
}

/** @deprecated use getWebBuilderClientDashboardPath */
export function getWebBuilderHomePath(): string {
  return getWebBuilderClientDashboardPath();
}
