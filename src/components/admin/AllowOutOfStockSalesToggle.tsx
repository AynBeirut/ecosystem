import React, { useState } from 'react';
import { doc, getFirestore, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Loader2, ShoppingCart } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useStoreEntitlements } from '@/hooks/useStoreEntitlements';
import {
  isProjectBasedInventory,
  isSalesAllowedWhenOutOfStock,
  readInventorySettings,
} from '@/lib/inventorySettings';

type AllowOutOfStockSalesToggleProps = {
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

  if (compact) {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
        <ShoppingCart className="h-4 w-4 text-muted-foreground shrink-0" />
        <Label htmlFor="allow-oos-sales-compact" className="text-sm font-medium cursor-pointer">
          Sell when out of stock
        </Label>
        <Switch
          id="allow-oos-sales-compact"
          checked={allowSales}
          disabled={saving || !storeId || projectBased}
          onCheckedChange={(checked) => void saveAllowSales(checked)}
        />
      </div>
    );
  }

  const { allowSalesWhenOutOfStock } = readInventorySettings(profile);

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1 pr-2">
        <Label htmlFor="allow-oos-sales" className="text-base font-medium">
          Allow sales when out of stock
        </Label>
        <p className="text-sm text-muted-foreground">
          POS and admin orders can sell at zero stock. Low-stock alerts stay on. Online storefront still
          hides out-of-stock add-to-cart.
        </p>
        {projectBased && (
          <p className="text-xs text-muted-foreground">
            Already enabled via project-based inventory mode.
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        <Switch
          id="allow-oos-sales"
          checked={allowSales}
          disabled={saving || !storeId || projectBased}
          onCheckedChange={(checked) => void saveAllowSales(checked)}
        />
        {!projectBased && allowSalesWhenOutOfStock ? (
          <span className="text-xs text-muted-foreground sr-only">Enabled</span>
        ) : null}
      </div>
    </div>
  );
};

export default AllowOutOfStockSalesToggle;
