import React, { useState } from 'react';
import { doc, getFirestore, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useStoreEntitlements } from '@/hooks/useStoreEntitlements';
import { isProjectBasedInventory, isSalesAllowedWhenOutOfStock } from '@/lib/inventorySettings';

type AllowOutOfStockSalesToggleProps = {
  /** Single-line row for tight toolbars only */
  compact?: boolean;
};

const AllowOutOfStockSalesToggle: React.FC<AllowOutOfStockSalesToggleProps> = ({ compact = false }) => {
  const { profile, storeId, reload } = useStoreEntitlements();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const projectBased = isProjectBasedInventory(profile);
  const allowSales = isSalesAllowedWhenOutOfStock(profile);
  const rawSettings = profile?.inventorySettings ?? {};

  const saveAllowSales = async (enabled: boolean) => {
    if (!storeId || projectBased) return;
    setSaving(true);
    try {
      await updateDoc(doc(getFirestore(), 'storeProfiles', storeId), {
        inventorySettings: {
          ...rawSettings,
          allowSalesWhenOutOfStock: enabled,
        },
        updatedAt: serverTimestamp(),
      });
      window.dispatchEvent(new Event('grabio:store-profile-updated'));
      await reload({ silent: true, fromServer: true });
      toast({
        title: enabled ? 'Out-of-stock sales allowed' : 'Stock required for sales',
        description: enabled
          ? 'POS and Create Order can sell when quantity is zero. Online checkout still blocks out-of-stock items.'
          : 'Sales are blocked when product stock is zero.',
      });
    } catch (err) {
      console.error(err);
      toast({
        title: 'Could not save',
        description: 'Inventory setting failed to update. Try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const switchControl = (
    <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
      <Switch
        id={compact ? 'allow-oos-sales-compact' : 'allow-oos-sales'}
        className="scale-90 origin-right"
        checked={allowSales}
        disabled={saving || !storeId || projectBased}
        onCheckedChange={(checked) => void saveAllowSales(checked)}
      />
    </div>
  );

  if (compact) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/10 px-2.5 py-1.5">
        <Label htmlFor="allow-oos-sales-compact" className="text-xs font-medium cursor-pointer">
          Sell when out of stock
        </Label>
        {switchControl}
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/10 px-3 py-2.5">
      <div className="min-w-0 space-y-1">
        <Label htmlFor="allow-oos-sales" className="text-sm font-medium leading-snug">
          Allow sales when out of stock
        </Label>
        <p className="text-sm leading-relaxed text-muted-foreground">
          POS and admin orders can sell at zero stock. Low-stock alerts stay on. Online storefront still
          hides out-of-stock add-to-cart.
        </p>
        {projectBased ? (
          <p className="text-xs text-muted-foreground">Already enabled via project-based inventory mode.</p>
        ) : null}
      </div>
      {switchControl}
    </div>
  );
};

export default AllowOutOfStockSalesToggle;
