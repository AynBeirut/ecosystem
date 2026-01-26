/**
 * Get the actual store ID for the current user.
 * For regular admins, this is their user.id.
 * For sub-accounts, this is their user.storeId.
 */
export function getActualStoreId(user: { id: string; storeId?: string } | null): string | null {
  if (!user?.id) return null;
  return user.storeId || user.id;
}
