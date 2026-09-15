import type { StoreEntitlements } from '@/lib/entitlements';
import { isBuilderEntitled, isSeoEntitled } from '@/lib/featureAccessGate';
import { isStoreFeatureConfigured, resolveEffectiveStoreContext } from '@/lib/effectiveStoreContext';
import { getAdminFeatureDenial, isFinanceEntitled, isInventoryEntitled } from '@/lib/featureAccessGate';
import type { StoreProfile } from '@/types/storeProfile';
import type { VenueSetupTrack, VenueSetupTrackStatus } from '@/types/venueSetup';

function isVenueFocusedStore(
  profile: Pick<StoreProfile, 'businessWorkflow' | 'startingPackage'> | null | undefined,
  entitlements: StoreEntitlements | null,
): boolean {
  const workflow = profile?.businessWorkflow || entitlements?.businessWorkflow;
  const pkg = profile?.startingPackage || entitlements?.startingPackage;
  return workflow === 'live_kitchen' || pkg === 'pkg_live_kitchen';
}

function track(
  partial: Omit<VenueSetupTrack, 'status'> & { status?: VenueSetupTrackStatus },
  status: VenueSetupTrackStatus,
): VenueSetupTrack {
  return { ...partial, status };
}

const CONTINUE: Partial<
  Record<VenueSetupTrack['id'], Pick<VenueSetupTrack, 'continuePath' | 'continueLabel'>>
> = {
  store_identity: { continuePath: '/admin/profile', continueLabel: 'Store Profile' },
  daily_operations: { continuePath: '/admin/pos', continueLabel: 'Grabio POS' },
  reservations: { continuePath: '/admin/delivery', continueLabel: 'Delivery & dine-in' },
  crm_guests: { continuePath: '/admin/crm/dashboard', continueLabel: 'Sales CRM' },
  roles_access: { continuePath: '/admin/sub-accounts', continueLabel: 'Sub-accounts' },
  optional_inventory: { continuePath: '/admin/profile', continueLabel: 'Venue layout toggles' },
  optional_finance: { continuePath: '/admin/profile', continueLabel: 'Venue layout toggles' },
  storefront_grow: { continuePath: '/admin/theme-editor', continueLabel: 'Theme editor' },
};

/**
 * Read-only setup readiness — derived from storeProfile + entitlements + effective resolver.
 */
export function resolveVenueSetupTracks(
  profile: StoreProfile | null | undefined,
  entitlements: StoreEntitlements | null,
): VenueSetupTrack[] {
  if (!isVenueFocusedStore(profile, entitlements)) {
    return [];
  }

  const ctx = resolveEffectiveStoreContext({
    profile,
    entitlements,
    environment: 'web_admin',
  });
  const { nav, modulesVisible } = ctx;
  const settings = profile?.venueOpsSettings;
  const delivery = profile?.deliverySettings;
  const hasName = Boolean(String(profile?.name || '').trim());
  const hasSlug = Boolean(String(profile?.slug || profile?.storeSlug || '').trim());

  const storeIdentityStatus: VenueSetupTrackStatus =
    hasName && hasSlug ? 'ready' : hasName || hasSlug ? 'in_progress' : 'not_started';

  const posReady = modulesVisible.pos;
  const dailyStatus: VenueSetupTrackStatus = posReady ? 'ready' : 'in_progress';

  const reservationsStatus: VenueSetupTrackStatus =
    delivery?.scheduledOrdersEnabled || delivery?.dineIn
      ? 'in_progress'
      : nav.showReservationsNav
        ? 'not_started'
        : 'deferred';

  const crmEntitled = Boolean(ctx.modulesEntitled.crm);
  const crmStatus: VenueSetupTrackStatus = crmEntitled
    ? modulesVisible.crm
      ? 'ready'
      : 'in_progress'
    : 'not_started';

  const rolesStatus: VenueSetupTrackStatus = settings?.restaurantFirstNavEnabled
    ? 'in_progress'
    : 'not_started';

  const inventoryStatus: VenueSetupTrackStatus = optionalTrackStatus(
    'inventory',
    profile,
    entitlements,
    nav.showInventoryNav,
    isInventoryEntitled(entitlements) && modulesVisible.stock,
  );

  const financeStatus: VenueSetupTrackStatus = optionalTrackStatus(
    'finance',
    profile,
    entitlements,
    nav.showBusinessFinanceNav,
    isFinanceEntitled(entitlements) && modulesVisible.finance,
  );

  const growTogglesOn = nav.showStorefrontGrowNav || nav.showSeoNav;
  const growPurchased = isBuilderEntitled(entitlements) || isSeoEntitled(entitlements);
  const growConfigured =
    isStoreFeatureConfigured('builder', profile, entitlements)
    || isStoreFeatureConfigured('seo', profile, entitlements);
  const growStatus: VenueSetupTrackStatus = !growTogglesOn
    ? 'deferred'
    : !growPurchased
      ? 'blocked'
      : growConfigured
        ? 'in_progress'
        : 'not_started';

  const importQueue = profile?.venueSetupIntake?.pendingItems?.length ?? 0;
  const importStatus: VenueSetupTrackStatus =
    importQueue > 0 ? 'in_progress' : 'not_started';

  const baseTracks: Omit<VenueSetupTrack, 'status'>[] = [
    {
      id: 'store_identity',
      label: 'Store identity',
      intakeCategory: 'setup_import',
      hint: 'Name, slug, and venue profile in Store Profile.',
      ...CONTINUE.store_identity,
    },
    {
      id: 'daily_operations',
      label: 'Kitchen & orders',
      intakeCategory: 'daily_operation',
      hint: 'POS module and floor/order flows.',
      ...CONTINUE.daily_operations,
    },
    {
      id: 'reservations',
      label: 'Reservations & scheduling',
      intakeCategory: 'daily_operation',
      hint: 'Events hub + scheduled orders — unified hub comes with client workflow draft.',
      ...CONTINUE.reservations,
    },
    {
      id: 'crm_guests',
      label: 'Guests & CRM',
      intakeCategory: 'crm',
      hint: 'CRM module and guest list.',
      ...CONTINUE.crm_guests,
    },
    {
      id: 'roles_access',
      label: 'Staff & roles',
      intakeCategory: 'role_security',
      hint: 'Sub-accounts and restaurant-first nav opt-in on Store Profile.',
      ...CONTINUE.roles_access,
    },
    {
      id: 'optional_inventory',
      label: 'Inventory (optional)',
      intakeCategory: 'optional_inventory',
      hint: 'Off by default for new restaurant-first nav until enabled in venue settings.',
      ...CONTINUE.optional_inventory,
    },
    {
      id: 'optional_finance',
      label: 'Finance (optional)',
      intakeCategory: 'optional_accounting_finance',
      hint: 'Accounting and invoice tools when venue enables finance nav.',
      ...CONTINUE.optional_finance,
    },
    {
      id: 'storefront_grow',
      label: 'Website & grow',
      intakeCategory: 'tenant_option',
      hint: 'Builder, template, and SEO when enabled.',
      ...CONTINUE.storefront_grow,
    },
    {
      id: 'client_data_import',
      label: 'Client data intake',
      intakeCategory: 'setup_import',
      hint: 'Awaiting Excel/workflow draft — no guessed features.',
    },
  ];

  const statuses: VenueSetupTrackStatus[] = [
    storeIdentityStatus,
    dailyStatus,
    reservationsStatus,
    crmStatus,
    rolesStatus,
    inventoryStatus,
    financeStatus,
    growStatus,
    importStatus,
  ];

  return baseTracks.map((t, i) => track(t, statuses[i]));
}

function optionalTrackStatus(
  feature: 'finance' | 'inventory',
  profile: StoreProfile | null | undefined,
  entitlements: StoreEntitlements | null,
  toggleOn: boolean,
  configured: boolean,
): VenueSetupTrackStatus {
  const denial = getAdminFeatureDenial(feature, profile, entitlements);
  if (denial?.reason === 'not_entitled') return 'blocked';
  if (!toggleOn) return 'deferred';
  return configured ? 'ready' : 'in_progress';
}

export function shouldShowVenueSetupReadiness(
  profile: StoreProfile | null | undefined,
  entitlements: StoreEntitlements | null,
): boolean {
  return resolveVenueSetupTracks(profile, entitlements).length > 0;
}
