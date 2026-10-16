import { useCallback, useEffect, useState } from "react";
import FinancePageShell from "@/components/FinancePageShell";
import { useAppContext } from "@/context/AppContext";
import { useToast } from "@/hooks/use-toast";
import { resolveGrabioStore, updateFinanceDocumentSettings } from "@/lib/grabio/storeService";
import { BRAND } from "@/lib/branding";
import InvoiceDocumentSetupContent from "@grabio/pages/admin/finance/InvoiceDocumentSetupContent";
import type { StoreProfile } from "@grabio/types/storeProfile";

const NIPCO_STORE_ID = "DfIhBAEZ5NR7yNX0HboZvv58Nf82";

export default function InvoiceDocumentSetup() {
  const { logout, refreshDocumentCompany } = useAppContext();
  const { toast } = useToast();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [profile, setProfile] = useState<StoreProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    await refreshDocumentCompany();
    try {
      const auth = await import("@/integrations/firebase/client").then((m) => m.getFinanceAuth());
      const user = auth.currentUser;
      if (!user) return;
      const resolved = await resolveGrabioStore(user.uid, user.email || "");
      setStoreId(resolved.storeId);
      setProfile(resolved.profile as StoreProfile);
    } catch (e) {
      console.error("[InvoiceDocumentSetup] load failed", e);
    } finally {
      setLoading(false);
    }
  }, [refreshDocumentCompany]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <FinancePageShell onLogout={logout}>
      <div className="finance-embed-theme w-full">
        <InvoiceDocumentSetupContent
          profile={profile}
          storeId={storeId}
          loading={loading}
          nipcoLocked={storeId === NIPCO_STORE_ID}
          saving={saving}
          backTo="/invoices"
          backLabel="Invoices"
          storeProfileLink={`${BRAND.ecosystemUrl}/admin/profile`}
          onSave={async (patch) => {
            if (!storeId || storeId === NIPCO_STORE_ID) return;
            setSaving(true);
            try {
              await updateFinanceDocumentSettings(storeId, patch);
              await refreshDocumentCompany();
              toast({ title: "Saved", description: "Invoice PDF settings updated." });
            } catch (e) {
              console.error(e);
              toast({ title: "Save failed", variant: "destructive" });
            } finally {
              setSaving(false);
            }
          }}
        />
      </div>
    </FinancePageShell>
  );
}
