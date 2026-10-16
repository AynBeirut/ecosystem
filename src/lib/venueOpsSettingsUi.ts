import type { StoreProfile, VenueOpsSettings } from '@/types/storeProfile';

export function canConfigureVenueOpsSettings(
  profile: Pick<StoreProfile, 'businessWorkflow' | 'startingPackage'> | null | undefined,
): boolean {
  return (
    profile?.businessWorkflow === 'live_kitchen' || profile?.startingPackage === 'pkg_live_kitchen'
  );
}

export const HR_VENUE_HUB_TOGGLE_KEYS = ['enableOfficialHr', 'enableVenueOpsHub'] as const;

export type HrVenueHubToggleKey = (typeof HR_VENUE_HUB_TOGGLE_KEYS)[number];

/** Classic stores use the saved switch. Restaurant-first stores use the live-kitchen default until overridden. */
export function hrVenueHubToggleChecked(
  key: HrVenueHubToggleKey,
  settings: VenueOpsSettings,
  restaurantFirstEffective: VenueOpsSettings | null,
  entitled: boolean,
): boolean {
  if (!entitled) return false;
  if (settings.restaurantFirstNavEnabled && restaurantFirstEffective) {
    return Boolean(restaurantFirstEffective[key]);
  }
  return Boolean(settings[key]);
}

export function mergeVenueOpsSettingsPatch(
  current: VenueOpsSettings | undefined,
  patch: Partial<VenueOpsSettings>,
): VenueOpsSettings {
  return { ...current, ...patch };
}
