import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { doc, getFirestore, setDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/context/useAuth';
import { getDemoBranding, getDemoStore } from '@/lib/builderService';
import {
  buildDemoWordPressStagingDomain,
  createWordPressProvisioningRequest,
  getWordPressProvisioningRequest,
} from '@/lib/wordpressProvisioningService';
import WordPressProvisioningWait from '@/components/builder/WordPressProvisioningWait';

type BuilderDemoWordPressProps = {
  builderUid: string;
  demoId: string;
};

const BuilderDemoWordPress: React.FC<BuilderDemoWordPressProps> = ({ builderUid, demoId }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [demoName, setDemoName] = useState('Demo store');
  const [stagingDomain, setStagingDomain] = useState('');
  const contactEmail = user?.email?.trim() || '';

  const persistRequestId = useCallback(
    async (nextRequestId: string, domain: string) => {
      await setDoc(
        doc(getFirestore(), 'builders', builderUid, 'demoStores', demoId),
        {
          wordpressRequestId: nextRequestId,
          wordpressStagingDomain: domain,
          buildMethod: 'wordpress',
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      setRequestId(nextRequestId);
    },
    [builderUid, demoId],
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [branding, demo] = await Promise.all([
          getDemoBranding(builderUid, demoId),
          getDemoStore(builderUid, demoId),
        ]);
        if (cancelled) return;
        const name = branding?.name || demo?.name || 'Demo store';
        const slug = branding?.slug || name;
        const domain = buildDemoWordPressStagingDomain(slug, demoId);
        setDemoName(name);
        setStagingDomain(domain);
        if (demo?.wordpressRequestId) {
          setRequestId(String(demo.wordpressRequestId));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [builderUid, demoId]);

  const stagingPreview = useMemo(
    () => stagingDomain || buildDemoWordPressStagingDomain(demoName, demoId),
    [stagingDomain, demoName, demoId],
  );

  const submitRequest = async () => {
    if (!contactEmail) {
      toast.error('Your account email is required — sign in again');
      return;
    }
    const ownerUid = getAuth().currentUser?.uid || builderUid;
    setSaving(true);
    try {
      const domain = stagingPreview;
      const id = await createWordPressProvisioningRequest(demoId, ownerUid, {
        businessName: demoName.trim(),
        contactEmail,
        requestKind: 'builder_demo',
        stagingDomain: domain,
        notes: 'Builder demo workspace — staging only',
      });
      await persistRequestId(id, domain);
      setStagingDomain(domain);
      toast.success('Staging WordPress install started');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not start WordPress request');
    } finally {
      setSaving(false);
    }
  };

  const handleRetry = async () => {
    if (!requestId) return;
    setSaving(true);
    try {
      const existing = await getWordPressProvisioningRequest(requestId);
      if (!existing) {
        toast.error('Could not load the failed request');
        return;
      }
      const ownerUid = getAuth().currentUser?.uid || builderUid;
      const domain = stagingPreview;
      const id = await createWordPressProvisioningRequest(demoId, ownerUid, {
        businessName: existing.businessName,
        contactEmail: existing.contactEmail,
        requestKind: 'builder_demo',
        stagingDomain: domain,
        notes: existing.notes,
      });
      await persistRequestId(id, domain);
      toast.success('Retry started');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (requestId) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-6">
        <WordPressProvisioningWait
          requestId={requestId}
          contactEmail={contactEmail}
          onRetry={handleRetry}
          retrying={saving}
          demoMode
          stagingDomain={stagingPreview}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>WordPress demo (staging only)</CardTitle>
          <CardDescription>
            No custom domain — WordPress installs on the staging URL below. Client domains and go-live
            happen only after you transfer the demo to a paid store.
          </CardDescription>
        </CardHeader>
      </Card>
      <div className="grid gap-4 rounded-xl border bg-white p-6">
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 space-y-2">
          <p className="text-sm font-medium text-sky-950">Staging URL (auto-assigned)</p>
          <p className="font-mono text-sm text-sky-900 break-all">{stagingPreview}</p>
          <p className="text-xs text-sky-800/90">
            Site title uses demo name <strong>{demoName}</strong>. Credentials appear here — no email is sent.
          </p>
        </div>
        <Button disabled={saving || !contactEmail} onClick={() => void submitRequest()}>
          {saving ? 'Starting install…' : 'Create staging WordPress'}
        </Button>
      </div>
    </div>
  );
};

export default BuilderDemoWordPress;
