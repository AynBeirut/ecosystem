import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useStoreEntitlements } from '@/hooks/useStoreEntitlements';
import { updateFinanceDocumentSettings } from '@/lib/financeDocumentSettings';
import { isNipcoProductionStore, NIPCO_TEMPLATE_LOCK_MESSAGE } from '@/lib/nipcoInvoiceTemplateLock';
import InvoiceDocumentSetupContent from '@/pages/admin/finance/InvoiceDocumentSetupContent';

export default function BusinessFinanceInvoiceTemplateSetup() {
  const { toast } = useToast();
  const { profile, storeId, loading } = useStoreEntitlements();
  const [saving, setSaving] = useState(false);
  const nipcoLocked = isNipcoProductionStore(storeId);

  return (
    <div className="finance-embed-theme w-full">
      <InvoiceDocumentSetupContent
        profile={profile}
        storeId={storeId}
        loading={loading}
        nipcoLocked={nipcoLocked}
        saving={saving}
        backTo="/admin/invoice-manager/invoices"
        backLabel="Invoice Manager"
        storeProfileLink="/admin/profile"
        onSave={async (patch) => {
          if (!storeId) return;
          if (nipcoLocked) {
            toast({
              title: 'Template locked',
              description: NIPCO_TEMPLATE_LOCK_MESSAGE,
              variant: 'destructive',
            });
            return;
          }
          setSaving(true);
          try {
            await updateFinanceDocumentSettings(storeId, patch);
            toast({ title: 'Saved', description: 'Invoice PDF settings updated.' });
          } catch (error) {
            toast({
              title: 'Save failed',
              description: error instanceof Error ? error.message : 'Could not save.',
              variant: 'destructive',
            });
          } finally {
            setSaving(false);
          }
        }}
      />
    </div>
  );
}
