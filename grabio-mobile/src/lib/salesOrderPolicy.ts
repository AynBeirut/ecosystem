/** Field sales — place orders only; manager/owner records payment. */
export function isSalesOrderPlacer(userRole?: string): boolean {
  return userRole === 'sub_seller' || userRole === 'sub_manager';
}

/** @deprecated Use picker default (self) instead of forced auto-assign on submit. */
export function autoAssignOrderSalesAgent(_userRole?: string): boolean {
  return false;
}

/** Everyone creating an order sees agent chips; default selection = connected user. */
export function showOrderSalesAgentPicker(_userRole?: string): boolean {
  return true;
}

/** @deprecated Agent assignment is optional; kept for call-site compatibility. */
export function mustSelectOrderSalesAgent(userRole?: string, _subAccountRole?: string): boolean {
  return showOrderSalesAgentPicker(userRole);
}

/** Store owner only — not sales manager or sales agent. */
export function canRecordOrderPayment(userRole?: string): boolean {
  return userRole === 'owner';
}

export function canChangeOrderStatus(userRole?: string): boolean {
  return userRole === 'owner' || userRole === 'sub_manager';
}

/** Sales rep → pending (manager confirms). Admin/manager → confirmed. Paid → delivered. */
export function resolveMobileOrderStatus(
  userRole?: string,
  opts?: { paid?: boolean; scheduled?: boolean },
): 'pending' | 'confirmed' | 'delivered' {
  if (opts?.paid) return 'delivered';
  if (opts?.scheduled) return 'pending';
  if (userRole === 'sub_seller') return 'pending';
  if (userRole === 'owner' || userRole === 'sub_manager') return 'confirmed';
  return 'pending';
}

export function isSalesRepPendingOrder(userRole?: string): boolean {
  return userRole === 'sub_seller';
}
