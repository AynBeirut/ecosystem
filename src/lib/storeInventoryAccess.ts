/** Guests and non-owners must not list recipes/rawMaterials (Firestore rules: store admin only). */
export function canReadStoreInventory(
  userId: string | undefined,
  storeDocId: string,
  storeOwnerId?: string,
): boolean {
  if (!userId || !storeDocId) return false;
  if (userId === storeDocId) return true;
  return Boolean(storeOwnerId && userId === storeOwnerId);
}
