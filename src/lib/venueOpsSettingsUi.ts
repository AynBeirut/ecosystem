import type { StoreProfile, VenueOpsSettings } from '@/types/storeProfile';

export function canConfigureVenueOpsSettings(
  profile: Pick<StoreProfile, 'businessWorkflow' | 'startingPackage'> | null | undefined,
): boolean {
  return (
    profile?.businessWorkflow === 'live_kitchen' || profile?.startingPackage === 'pkg_live_kitchen'
  );
}

export function mergeVenueOpsSettingsPatch(
  current: VenueOpsSettings | undefined,
  patch: Partial<VenueOpsSettings>,
): VenueOpsSettings {
  return { ...current, ...patch };
}
