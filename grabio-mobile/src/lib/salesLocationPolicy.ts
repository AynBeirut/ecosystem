type SalesLocationUser = {
  userRole?: 'owner' | 'sub_seller' | 'sub_manager' | 'sub_delivery' | 'crm_rep' | 'buyer';
};

/** Sales agent + sales manager — company devices; location always on while app is open. */
export function requiresMandatorySalesLocation(user: SalesLocationUser | null | undefined): boolean {
  if (!user) return false;
  return user.userRole === 'crm_rep' || user.userRole === 'sub_seller' || user.userRole === 'sub_manager';
}
