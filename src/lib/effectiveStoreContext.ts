import type { StoreEntitlements } from '@/lib/entitlements';
import type { BusinessWorkflow, StartingPackageKey } from '@/lib/moduleManifest';
import {
  isAdminFeatureAllowed,
  isBuilderEntitled,
  isCrmEntitled,
  isFinanceEntitled,
  isInventoryEntitled,
  isPosEntitled,
  isSeoEntitled,
} from '@/lib/featureAccessGate';
import {
  getVenueRoleCapabilities,
  resolveVenueRoleTemplate,
  type VenueRoleCapabilities,
  type VenueRoleTemplateId,
} from '@/lib/restaurantRolePolicy';
import {
  getEffectiveVenueOpsSettings,
  resolveVenueOpsNavFlags,
  type VenueOpsNavFlags,
} from '@/lib/venueOpsNav';
import type { StoreProfile, VenueOpsSettings } from '@/types/storeProfile';
import type { User } from '@/types/product';

/** Surfaces that consume effective store context (expand per Resolver-Contracts). */
export type EffectiveStoreEnvironment =
  | 'web_admin'
  | 'mobile'
  | 'pos'
  | 'functions'
  | 'marketplace'
  | 'invoice_app'
  | 'seo_content'
  | 'accounting';

export type EffectiveStoreActor = Pick<User, 'role' | 'subAccountRole' | 'permissions'> | null | undefined;

export type EffectiveModuleSurfaceFlags = {
  pos: boolean;
  crm: boolean;
  stock: boolean;
  finance: boolean;
  reservations: boolean;
  storefrontBuilder: boolean;
  seoOps: boolean;
};

export type EffectiveStoreContextInput = {
  storeId?: string;
  profile: StoreProfile | null | undefined;
  entitlements: StoreEntitlements | null;
  user?: EffectiveStoreActor;
  environment: EffectiveStoreEnvironment;
};

export type EffectiveRolePolicy = {
  templateId: VenueRoleTemplateId;
  capabilities: VenueRoleCapabilities;
  canAccessVenueOperations: boolean;
  canAccessVenueCrm: boolean;
  canAccessVenueFinance: boolean;
  canAccessVenueInventory: boolean;
  canAccessStorefrontGrow: boolean;
  canAccessSeoOps: boolean;
};

export type EffectiveStoreContext = {
  storeId?: string;
  environment: EffectiveStoreEnvironment;
  businessWorkflow: BusinessWorkflow | undefined;
  startingPackage: StartingPackageKey | null | undefined;
  restaurantFirstNavEnabled: boolean;
  nav: VenueOpsNavFlags;
  venueOpsSettings: VenueOpsSettings | null;
  modulesEntitled: Record<string, boolean>;
  modulesVisible: EffectiveModuleSurfaceFlags;
  role: EffectiveRolePolicy | null;
};

/**
 * Module/nav visibility: entitlement ∧ venue toggle (∧ user permission when user present).
 */
export function resolveEffectiveModuleCapabilities(
  input: Pick<EffectiveStoreContextInput, 'profile' | 'entitlements' | 'user'>,
): { entitled: Record<string, boolean>; visible: EffectiveModuleSurfaceFlags } {
  const { profile, entitlements, user } = input;
  const modulesEntitled = { ...(entitlements?.modules ?? {}) };

  const visible: EffectiveModuleSurfaceFlags = {
    pos: isAdminFeatureAllowed('pos', profile, entitlements, user),
    crm: isAdminFeatureAllowed('crm', profile, entitlements, user),
    stock: isAdminFeatureAllowed('inventory', profile, entitlements, user),
    finance: isAdminFeatureAllowed('finance', profile, entitlements, user),
    reservations: isAdminFeatureAllowed('reservations', profile, entitlements, user),
    storefrontBuilder: isAdminFeatureAllowed('builder', profile, entitlements, user),
    seoOps: isAdminFeatureAllowed('seo', profile, entitlements, user),
  };

  return { entitled: modulesEntitled, visible };
}

export function resolveEffectiveRolePolicy(
  user: EffectiveStoreActor,
  modulesVisible: EffectiveModuleSurfaceFlags,
): EffectiveRolePolicy | null {
  if (!user) return null;

  const templateId = resolveVenueRoleTemplate(user);
  const capabilities = getVenueRoleCapabilities(user);

  return {
    templateId,
    capabilities: {
      venueOps: capabilities.venueOps && modulesVisible.pos,
      reservations: capabilities.reservations && modulesVisible.reservations,
      crm: capabilities.crm && modulesVisible.crm,
      finance: capabilities.finance && modulesVisible.finance,
      inventory: capabilities.inventory && modulesVisible.stock,
      storefrontBuilder: capabilities.storefrontBuilder && modulesVisible.storefrontBuilder,
      seoOps: capabilities.seoOps && modulesVisible.seoOps,
    },
    canAccessVenueOperations: modulesVisible.pos,
    canAccessVenueCrm: modulesVisible.crm,
    canAccessVenueFinance: modulesVisible.finance,
    canAccessVenueInventory: modulesVisible.stock,
    canAccessStorefrontGrow: modulesVisible.storefrontBuilder,
    canAccessSeoOps: modulesVisible.seoOps,
  };
}

/** Facade: store profile + entitlements + optional user + environment. */
export function resolveEffectiveStoreContext(input: EffectiveStoreContextInput): EffectiveStoreContext {
  const { storeId, profile, entitlements, user, environment } = input;
  const nav = resolveVenueOpsNavFlags(profile);
  const { entitled: modulesEntitled, visible: modulesVisible } = resolveEffectiveModuleCapabilities({
    profile,
    entitlements,
    user: environment === 'web_admin' ? user : undefined,
  });

  const role = user ? resolveEffectiveRolePolicy(user, modulesVisible) : null;

  return {
    storeId,
    environment,
    businessWorkflow: profile?.businessWorkflow ?? entitlements?.businessWorkflow,
    startingPackage: profile?.startingPackage ?? entitlements?.startingPackage ?? null,
    restaurantFirstNavEnabled: Boolean(profile?.venueOpsSettings?.restaurantFirstNavEnabled),
    nav,
    venueOpsSettings: getEffectiveVenueOpsSettings(profile),
    modulesEntitled,
    modulesVisible,
    role,
  };
}

export function canShowAdminCrmNav(ctx: EffectiveStoreContext, storeAdminAccess: boolean): boolean {
  return storeAdminAccess && ctx.modulesVisible.crm;
}

export function canShowAdminSeoNav(ctx: EffectiveStoreContext, storeAdminAccess: boolean): boolean {
  return storeAdminAccess && ctx.modulesVisible.seoOps;
}

export function canShowAdminFinanceNav(ctx: EffectiveStoreContext): boolean {
  return ctx.modulesVisible.finance;
}

export function canShowAdminInventoryNav(ctx: EffectiveStoreContext): boolean {
  return ctx.modulesVisible.stock;
}

export function canShowAdminBuilderNav(ctx: EffectiveStoreContext): boolean {
  return ctx.modulesVisible.storefrontBuilder;
}

/** Readiness / ops panels (no user): entitlement ∧ toggle only. */
export function isStoreFeatureConfigured(
  feature: 'finance' | 'inventory' | 'crm' | 'seo' | 'builder' | 'reservations' | 'pos',
  profile: StoreProfile | null | undefined,
  entitlements: StoreEntitlements | null,
): boolean {
  return isAdminFeatureAllowed(feature, profile, entitlements, undefined);
}

export {
  isFinanceEntitled,
  isInventoryEntitled,
  isCrmEntitled,
  isPosEntitled,
  isBuilderEntitled,
  isSeoEntitled,
};
