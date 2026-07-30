import type { User } from '@/types/product';

export function isManagerSubAccount(
  user: Pick<User, 'role' | 'subAccountRole'> | null | undefined,
): boolean {
  return user?.role === 'sub_account' && user?.subAccountRole === 'manager';
}

/** Finance, payroll, account statement, invoice manager, etc. */
export function canAccessBusinessTools(
  user: Pick<User, 'role' | 'subAccountRole'> | null | undefined,
): boolean {
  return user?.role === 'admin' || isManagerSubAccount(user);
}

export function getSubAccountHomePath(
  user: Pick<User, 'role' | 'subAccountRole'> | null | undefined,
): '/admin/dashboard' | '/team/dashboard' {
  return isManagerSubAccount(user) ? '/admin/dashboard' : '/team/dashboard';
}
