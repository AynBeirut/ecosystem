import React, { useState } from 'react';
import { getFirestore, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useStoreEntitlements } from '@/hooks/useStoreEntitlements';
import {
  isProjectBasedInventory,
  isSalesAllowedWhenOutOfStock,
} from '@/lib/inventorySettings';
import InventorySettingRow from '@/components/admin/InventorySettingRow';
import AdminPanel from '@/components/admin/AdminPanel';

const InventorySettingsPanel: React.FC = () => {
  const { profile, storeId, reload } = useStoreEntitlements();
  const { toast } = useToast();
  const [savingProject, setSavingProject] = useState(false);
  const [savingOos, setSavingOos] = useState(false);

  const projectBased = isProjectBasedInventory(profile);
  const allowSales = isSalesAllowedWhenOutOfStock(profile);
  const rawSettings = profile?.inventorySettings ?? {};

  const saveProjectBased = async (nextProjectBased: boolean) => {
    if (!storeId) return;
    setSavingProject(true);
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
      setSavingProject(false);
    }
  };

  const saveAllowSales = async (enabled: boolean) => {
    if (!storeId || projectBased) return;
    setSavingOos(true);
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
      setSavingOos(false);
    }
  };

  return (
    <AdminPanel className="mb-4">
      <CardHeader className="space-y-0 px-4 py-3">
        <CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
          <Package className="h-4 w-4 text-market-primary" />
          Inventory mode
        </CardTitle>
        <CardDescription className="text-xs">Store setup — expand Details on each row for help.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 px-4 pb-4 pt-0">
        <InventorySettingRow
          id="project-based-inventory"
          title="Project-based inventory (no held stock)"
          description="Turns off low-stock alerts. Allows estimates, recipes, production, and sales at zero stock. Record stock when materials arrive — inventory reconciles automatically."
          checked={projectBased}
          saving={savingProject}
          disabled={!storeId}
          onCheckedChange={(checked) => void saveProjectBased(checked)}
        />
        <InventorySettingRow
          id="allow-oos-sales"
          title="Allow sales when out of stock"
          description="POS and admin orders can sell at zero stock. Low-stock alerts stay on. Online storefront still hides out-of-stock add-to-cart."
          footerNote={projectBased ? 'Already enabled via project-based inventory mode.' : undefined}
          checked={allowSales}
          saving={savingOos}
          disabled={!storeId || projectBased}
          onCheckedChange={(checked) => void saveAllowSales(checked)}
        />
      </CardContent>
    </AdminPanel>
  );
};

export default InventorySettingsPanel;
