import type { StoreProfile } from '@/types/storeProfile';

export type StoreInventorySettings = {
  /** Buy materials per open project — no held stock. Disables low-stock alerts and stock blocks on sales/production. */
  projectBasedInventory?: boolean;
  /** Explicit override; ignored when projectBasedInventory is true. */
  lowStockAlertsEnabled?: boolean;
  /** Allow POS and admin sales when stock is zero. Low-stock alerts stay on unless project-based. */
  allowSalesWhenOutOfStock?: boolean;
};

export function readInventorySettings(
  profile?: Pick<StoreProfile, 'inventorySettings'> | null,
): {
  projectBasedInventory: boolean;
  lowStockAlertsEnabled: boolean;
  allowSalesWhenOutOfStock: boolean;
} {
  const settings = profile?.inventorySettings ?? {};
  const projectBased = settings.projectBasedInventory === true;
  return {
    projectBasedInventory: projectBased,
    lowStockAlertsEnabled: projectBased ? false : settings.lowStockAlertsEnabled !== false,
    allowSalesWhenOutOfStock: settings.allowSalesWhenOutOfStock === true,
  };
}

/** POS, admin orders, and checkout may sell at zero stock. */
export function isSalesAllowedWhenOutOfStock(
  profile?: Pick<StoreProfile, 'inventorySettings'> | null,
): boolean {
  const settings = readInventorySettings(profile);
  return settings.projectBasedInventory || settings.allowSalesWhenOutOfStock;
}

export function isProjectBasedInventory(
  profile?: Pick<StoreProfile, 'inventorySettings'> | null,
): boolean {
  return readInventorySettings(profile).projectBasedInventory;
}

export function isLowStockAlertsEnabled(
  profile?: Pick<StoreProfile, 'inventorySettings'> | null,
): boolean {
  return readInventorySettings(profile).lowStockAlertsEnabled;
}
