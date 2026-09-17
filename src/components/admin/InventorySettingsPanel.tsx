import React, { useState } from 'react';
import { getFirestore, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Package, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useStoreEntitlements } from '@/hooks/useStoreEntitlements';
import {
  isProjectBasedInventory,
  isSalesAllowedWhenOutOfStock,
  readInventorySettings,
} from '@/lib/inventorySettings';
import AllowOutOfStockSalesToggle from '@/components/admin/AllowOutOfStockSalesToggle';
import AdminPanel from '@/components/admin/AdminPanel';

const InventorySettingsPanel: React.FC = () => {
  const { profile, storeId, reload } = useStoreEntitlements();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const projectBased = isProjectBasedInventory(profile);
  const { lowStockAlertsEnabled } = readInventorySettings(profile);

  const saveProjectBased = async (nextProjectBased: boolean) => {
    if (!storeId) return;
    setSaving(true);
    try {
      const current = profile?.inventorySettings ?? {};
      await updateDoc(doc(getFirestore(), 'storeProfiles', storeId), {
        inventorySettings: {
          ...current,
          projectBasedInventory: nextProjectBased,
          lowStockAlertsEnabled: nextProjectBased ? false : current.lowStockAlertsEnabled !== false,
        },
        updatedAt: serverTimestamp(),
      });
      window.dispatchEvent(new Event('grabio:store-profile-updated'));
      await reload({ silent: true, fromServer: true });
      toast({
        title: nextProjectBased ? 'Project-based inventory on' : 'Stock alerts restored',
        description: nextProjectBased
          ? 'Low-stock alerts off. Sales and production can run at zero stock; enter stock later to reconcile.'
          : 'Standard stock tracking and low-stock alerts are active again.',
      });
    } catch (err) {
      console.error(err);
      toast({
        title: 'Could not save',
        description: 'Inventory settings failed to update. Try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPanel className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5 text-market-primary" />
          Inventory mode
        </CardTitle>
        <CardDescription>
          For businesses that buy materials per project — not warehouse stock.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1 pr-2">
            <Label htmlFor="project-based-inventory" className="text-base font-medium">
              Project-based inventory (no held stock)
            </Label>
            <p className="text-sm text-muted-foreground">
              Turns off low-stock alerts. Allows estimates, recipes, production, and sales at zero stock.
              Record stock when materials arrive — inventory reconciles automatically.
            </p>
            {projectBased && (
              <Badge variant="secondary" className="mt-2">
                Low-stock alerts off · sell at zero stock
              </Badge>
            )}
            {!projectBased && lowStockAlertsEnabled && (
              <Badge variant="outline" className="mt-2">
                Standard stock tracking
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Switch
              id="project-based-inventory"
              checked={projectBased}
              disabled={saving || !storeId}
              onCheckedChange={(checked) => void saveProjectBased(checked)}
            />
          </div>
        </div>
        <AllowOutOfStockSalesToggle />
      </CardContent>
    </AdminPanel>
  );
};

export default InventorySettingsPanel;
