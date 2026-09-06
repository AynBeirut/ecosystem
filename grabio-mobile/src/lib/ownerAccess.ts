/** Back-office purchasing — store owner only (not sales manager / reps). */
export function canAccessPurchasing(userRole?: string): boolean {
  return userRole === 'owner';
}

/** Product catalog create/edit — store owner only. */
export function canManageProducts(userRole?: string): boolean {
  return userRole === 'owner';
}

/** Account statements / accounting — store owner only. */
export function canAccessAccounting(userRole?: string): boolean {
  return userRole === 'owner';
}

/** Client balance list — owner + sales manager (read-only for manager). */
export function canViewClientBalances(userRole?: string, subAccountRole?: string): boolean {
  return userRole === 'owner' || userRole === 'sub_manager' || subAccountRole === 'manager';
}

/** Sales manager — client balances only, no accounting edits. */
export function isClientBalanceViewerOnly(userRole?: string, subAccountRole?: string): boolean {
  return userRole === 'sub_manager' || subAccountRole === 'manager';
}

/** Customer CRUD — owner only; managers use client balances viewer. */
export function canEditCustomers(userRole?: string): boolean {
  return userRole === 'owner';
}
