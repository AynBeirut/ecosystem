import React, { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useStoreEntitlements } from '@/hooks/useStoreEntitlements';
import {
  mapGrabioInvoiceTemplateToFinance,
  mapFinanceInvoiceTemplateToGrabio,
  type FinanceInvoiceTemplate,
} from '@/lib/invoiceTemplateMap';
import {
  readFinanceDocumentSettings,
  updateFinanceDocumentSettings,
} from '@/lib/financeDocumentSettings';

const TEMPLATE_OPTIONS: { value: FinanceInvoiceTemplate; label: string }[] = [
  { value: 'modern', label: 'Modern (Blue/Teal)' },
  { value: 'basic', label: 'Classic (Black/Gold)' },
  { value: 'professional', label: 'Vibrant (Orange/Purple)' },
];

export default function BusinessFinanceInvoiceTemplateSetup() {
  const { toast } = useToast();
  const { profile, storeId, loading } = useStoreEntitlements();
  const [saving, setSaving] = useState(false);
  const [documentLogo, setDocumentLogo] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [address, setAddress] = useState('');
  const [taxId, setTaxId] = useState('');
  const [invoiceTemplate, setInvoiceTemplate] = useState<FinanceInvoiceTemplate>('modern');

  useEffect(() => {
    if (!profile) return;
    const doc = readFinanceDocumentSettings(profile);
    setDocumentLogo(doc.documentLogo || '');
    setCompanyName(doc.documentCompanyName || '');
    setAddress(doc.documentAddress || '');
    setTaxId(doc.documentTaxId || '');
    setInvoiceTemplate(mapGrabioInvoiceTemplateToFinance(profile.invoiceTemplate, doc.invoiceTemplate));
  }, [profile]);

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setDocumentLogo(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!storeId) return;
    setSaving(true);
    try {
      await updateFinanceDocumentSettings(storeId, {
        documentLogo: documentLogo || undefined,
        documentCompanyName: companyName.trim() || undefined,
        documentAddress: address.trim() || undefined,
        documentTaxId: taxId.trim() || undefined,
        invoiceTemplate,
      });
      toast({
        title: 'Saved',
        description: 'A4 invoice template settings updated.',
      });
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Could not save document settings.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Loading document settings…</p>;
  }

  const previewTemplate = mapFinanceInvoiceTemplateToGrabio(invoiceTemplate);

  return (
    <div className="space-y-6 text-slate-900">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Invoice template (A4 print)</h2>
        <p className="text-sm text-slate-600 mt-1">
          Logo and layout for A4 invoices, estimates, and PDF exports. This is separate from your shop logo in Store Profile.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="documentLogo">Document logo (A4 invoices &amp; PDFs)</Label>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {documentLogo ? (
              <img
                src={documentLogo}
                alt="Document logo preview"
                className="h-16 w-auto max-w-[200px] rounded border border-slate-600 bg-white object-contain p-1"
              />
            ) : (
              <div className="h-16 w-28 rounded border border-dashed border-slate-500 flex items-center justify-center text-xs text-slate-400">
                No logo
              </div>
            )}
            <Input
              id="documentLogo"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleLogoChange}
              className="max-w-sm"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="documentCompanyName">Company name on documents</Label>
          <Input
            id="documentCompanyName"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder={profile?.name || 'Leave blank to use store name'}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="documentTaxId">Tax ID on documents</Label>
          <Input
            id="documentTaxId"
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
            placeholder={profile?.taxNumber || 'Leave blank to use store tax number'}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="documentAddress">Address on documents</Label>
          <Textarea
            id="documentAddress"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={profile?.location || 'Leave blank to use store address'}
            rows={2}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="invoiceTemplate">A4 template style</Label>
          <select
            id="invoiceTemplate"
            value={invoiceTemplate}
            onChange={(e) => setInvoiceTemplate(e.target.value as FinanceInvoiceTemplate)}
            className="flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {TEMPLATE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Active Grabio template key: {previewTemplate}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void handleSave()} disabled={saving || !storeId}>
          {saving ? 'Saving…' : 'Save document settings'}
        </Button>
      </div>
    </div>
  );
}
