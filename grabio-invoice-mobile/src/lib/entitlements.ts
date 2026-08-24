const CORE_MODULE_IDS = ['invoicing', 'marketplace', 'analytics', 'payments', 'delivery'];

export type MobileStoreProfile = {
  subscriptionTier?: string;
  pricingVersion?: string;
  enabledModules?: Record<string, boolean>;
  addOns?: string[] | Record<string, unknown>;
  addOnsMeta?: Record<string, unknown>;
  allowsManufacturing?: boolean;
};

function hasCrmAddon(profile: MobileStoreProfile | null): boolean {
  if (!profile) return false;
  const meta = profile.addOnsMeta;
  if (meta?.salesCrm === true) return true;
  if (Array.isArray(profile.addOns) && profile.addOns.includes('salesCrm')) return true;
  return false;
}

function legacyModules(profile: MobileStoreProfile | null): Record<string, boolean> {
  const tier = profile?.subscriptionTier ?? 'starter';
  const modules: Record<string, boolean> = {};
  CORE_MODULE_IDS.forEach((id) => {
    modules[id] = true;
  });
  modules.stock = true;
  modules.dropship = true;
  modules.services = true;
  if (tier === 'pro' || tier === 'business') {
    modules.factory = true;
    modules.restaurant = true;
  }
  if (hasCrmAddon(profile)) modules.crm = true;
  if (tier === 'business') modules.team = true;
  return modules;
}

function modularModules(profile: MobileStoreProfile): Record<string, boolean> {
  const enabled = profile.enabledModules ?? {};
  const modules: Record<string, boolean> = {};

  CORE_MODULE_IDS.forEach((id) => {
    modules[id] = enabled[id] !== false;
  });

  Object.entries(enabled).forEach(([id, on]) => {
    modules[id] = Boolean(on);
  });

  return modules;
}

function resolveMobileModules(profile: MobileStoreProfile | null): Record<string, boolean> {
  if (
    profile?.pricingVersion === 'modular-v2' &&
    profile.enabledModules &&
    Object.keys(profile.enabledModules).length > 0
  ) {
    return modularModules(profile);
  }
  return legacyModules(profile);
}

export function canUseMobileModule(profile: MobileStoreProfile | null, moduleId: string): boolean {
  if (moduleId === 'crm') return hasCrmAddon(profile);
  return Boolean(resolveMobileModules(profile)[moduleId]);
}

/** Standalone Invoice Manager — Invoicing & Billing (core) or Invoice Manager add-on. */
export function canUseInvoiceManagerApp(profile: MobileStoreProfile | null): boolean {
  return canUseMobileModule(profile, 'invoicing') || canUseMobileModule(profile, 'invoice_manager');
}

export const MOBILE_OWNER_SCREENS: Array<{ name: string; moduleId: string }> = [
  { name: 'InvoiceManager', moduleId: 'invoice_manager' },
  { name: 'Purchases', moduleId: 'stock' },
  { name: 'Suppliers', moduleId: 'stock' },
  { name: 'Inventory', moduleId: 'stock' },
  { name: 'CrmMyClients', moduleId: 'crm' },
];
