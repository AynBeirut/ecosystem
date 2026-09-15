import React, { useMemo, useState } from 'react';
import { getFirestore, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { UtensilsCrossed, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useStoreEntitlements } from '@/hooks/useStoreEntitlements';
import AdminPanel from '@/components/admin/AdminPanel';
import type { VenueOpsSettings } from '@/types/storeProfile';
import { canConfigureVenueOpsSettings, mergeVenueOpsSettingsPatch } from '@/lib/venueOpsSettingsUi';
import { getEffectiveVenueOpsSettings, resolveVenueOpsNavFlags } from '@/lib/venueOpsNav';

type ToggleKey = keyof Omit<VenueOpsSettings, never>;

const MODULE_TOGGLES: { key: ToggleKey; label: string; hint: string }[] = [
  {
    key: 'enableCrmPipeline',
    label: 'Guest CRM',
    hint: 'Guests, hosts, and follow-ups in the sidebar.',
  },
  {
    key: 'enableReservationsHub',
    label: 'Reservations & events',
    hint: 'Tables and occasions (when your package includes it).',
  },
  {
    key: 'enableFullInventory',
    label: 'Inventory & purchasing',
    hint: 'Stock, suppliers, and food cost — off until you are ready.',
  },
  {
    key: 'enableBusinessFinance',
    label: 'Business finance',
    hint: 'Accounting, expenses, and full ledger tools.',
  },
  {
    key: 'enableStorefrontBuilder',
    label: 'Website & storefront builder',
    hint: 'Theme editor and public store tools.',
  },
  {
    key: 'enableSeoOps',
    label: 'SEO & content tools',
    hint: 'Search and content modules in admin.',
  },
];

const VenueOpsSettingsPanel: React.FC = () => {
  const { profile, storeId, reload } = useStoreEntitlements();
  const { toast } = useToast();
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const visible = canConfigureVenueOpsSettings(profile);
  const settings = profile?.venueOpsSettings ?? {};
  const navFlags = useMemo(() => resolveVenueOpsNavFlags(profile), [profile]);
  const effective = useMemo(() => getEffectiveVenueOpsSettings(profile), [profile]);

  const save = async (patch: Partial<VenueOpsSettings>, savingId: string) => {
    if (!storeId) return;
    setSavingKey(savingId);
    try {
      const venueOpsSettings = mergeVenueOpsSettingsPatch(settings, patch);
      await updateDoc(doc(getFirestore(), 'storeProfiles', storeId), {
        venueOpsSettings,
        updatedAt: serverTimestamp(),
      });
      window.dispatchEvent(new Event('grabio:store-profile-updated'));
      await reload({ silent: true, fromServer: true });
      toast({
        title: 'Venue layout saved',
        description:
          patch.restaurantFirstNavEnabled !== undefined
            ? 'Refresh the page or sign out and back in if the sidebar does not update immediately.'
            : 'Sidebar modules updated for this venue.',
      });
    } catch (err) {
      console.error(err);
      toast({
        title: 'Could not save',
        description: 'Venue settings failed to update. Try again.',
        variant: 'destructive',
      });
    } finally {
      setSavingKey(null);
    }
  };

  if (!visible) return null;

  const layoutOn = Boolean(settings.restaurantFirstNavEnabled);

  return (
    <AdminPanel className="mb-6 border border-teal-200/60 bg-teal-50/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UtensilsCrossed className="h-5 w-5 text-teal-700" />
          Venue operations layout
        </CardTitle>
        <CardDescription>
          How your admin menu is organized — floor, guests, and kitchen first. Other stores keep the classic menu until
          you turn this on.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 rounded-lg border bg-white/80 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1 pr-2">
            <Label htmlFor="restaurant-first-nav" className="text-base font-medium">
              Restaurant-focused admin menu
            </Label>
            <p className="text-sm text-muted-foreground">
              Groups daily service, guests, and kitchen ahead of stock and finance.{' '}
              {navFlags.mode === 'restaurant_first' ? (
                <span className="font-medium text-teal-800">Active on this account.</span>
              ) : (
                <span>Currently using the classic full menu.</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {savingKey === 'restaurantFirstNavEnabled' && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            <Switch
              id="restaurant-first-nav"
              checked={layoutOn}
              disabled={!storeId || savingKey !== null}
              onCheckedChange={(checked) =>
                void save({ restaurantFirstNavEnabled: checked }, 'restaurantFirstNavEnabled')
              }
            />
          </div>
        </div>

        {layoutOn && (
          <div className="space-y-2 rounded-lg border bg-white/60 p-4">
            <p className="text-sm font-medium text-slate-900">Show in sidebar</p>
            <p className="text-xs text-muted-foreground mb-3">
              Turn modules on as the venue grows. Off = hidden from the restaurant menu (data is not deleted).
            </p>
            {MODULE_TOGGLES.map(({ key, label, hint }) => (
              <div
                key={key}
                className="flex flex-col gap-2 border-t border-slate-100 pt-3 first:border-t-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <Label htmlFor={`venue-ops-${key}`} className="text-sm font-medium">{label}</Label>
                  <p className="text-xs text-muted-foreground">{hint}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {savingKey === key && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  <Switch
                    id={`venue-ops-${key}`}
                    checked={Boolean(effective?.[key])}
                    disabled={!storeId || savingKey !== null}
                    onCheckedChange={(checked) => void save({ [key]: checked }, key)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </AdminPanel>
  );
};

export default VenueOpsSettingsPanel;
