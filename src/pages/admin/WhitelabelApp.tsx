import React, { useEffect, useState } from 'react';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AdminPanel from '@/components/admin/AdminPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ModuleGate from '@/components/ModuleGate';
import AdminPageShell from '@/components/admin/AdminPageShell';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import { useToast } from '@/hooks/use-toast';

type WhitelabelConfig = {
  enabled: boolean;
  appName: string;
  deepLinkHost: string;
  primaryColor: string;
};

const DEFAULT_CONFIG: WhitelabelConfig = {
  enabled: true,
  appName: '',
  deepLinkHost: 'grabio.space',
  primaryColor: '#38B2AC',
};

const BUILD_STEPS = [
  { n: 1, title: 'Set branding below', body: 'App name and colors are saved to your Grabio store profile (Firebase).' },
  { n: 2, title: 'Copy your Store ID', body: 'Each white-label build is tied to one storeId — paste it into the mobile app config.' },
  { n: 3, title: 'Build with EAS', body: 'From white-label-client-app/, set app.json extra.storeId and run eas build --profile preview.' },
  { n: 4, title: 'Publish to stores', body: 'Submit the APK/AAB to Google Play or TestFlight under the client brand.' },
];

const WhitelabelApp: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const storeId = getActualStoreId(user);
  const db = getFirestore();

  const [config, setConfig] = useState<WhitelabelConfig>(DEFAULT_CONFIG);
  const [storeName, setStoreName] = useState('');
  const [storeSlug, setStoreSlug] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    getDoc(doc(db, 'storeProfiles', storeId)).then((snap) => {
      const d = snap.data() || {};
      setStoreName(String(d.storeName || ''));
      setStoreSlug(String(d.storeSlug || ''));
      setLogoUrl(String(d.logoUrl || d.logo || ''));
      const saved = d.whitelabelApp as Partial<WhitelabelConfig> | undefined;
      setConfig({
        enabled: saved?.enabled ?? true,
        appName: saved?.appName || String(d.storeName || ''),
        deepLinkHost: saved?.deepLinkHost || String(d.customDomain || 'grabio.space'),
        primaryColor: saved?.primaryColor || String(d.templateColors?.primary || '#38B2AC'),
      });
      setLoading(false);
    });
  }, [storeId, db]);

  const copyStoreId = () => {
    void navigator.clipboard.writeText(storeId ?? '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Store ID copied' });
  };

  const handleSave = async () => {
    if (!storeId) return;
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'storeProfiles', storeId),
        {
          whitelabelApp: {
            ...config,
            updatedAt: new Date().toISOString(),
          },
        },
        { merge: true },
      );
      toast({ title: 'White-label settings saved' });
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const easSnippet = `// app.json → expo.extra
"storeId": "${storeId || 'YOUR_STORE_ID'}",
"appName": "${config.appName || storeName || 'My Store'}",
"deepLinkHost": "${config.deepLinkHost || 'grabio.space'}"`;

  return (
    <ModuleGate moduleId="whitelabel">
      <AdminPageShell
        title="White-Label Store App"
        description="Branded customer app for your store — same Firebase project as Grabio, no separate backend."
        eyebrow="Mobile"
        backTo="/admin/dashboard"
        actions={<Badge variant="secondary">Firebase only</Badge>}
      >
        <div className="max-w-3xl space-y-6">
        {!loading && (
          <AdminPanel className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-primary/30" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl">🏪</div>
              )}
              <div className="flex-1">
                <p className="font-semibold">{storeName || 'Your store'}</p>
                {storeSlug && (
                  <p className="text-sm text-muted-foreground">
                    Web: <a className="underline text-primary" href={`/store/${storeSlug}`} target="_blank" rel="noreferrer">/store/{storeSlug}</a>
                  </p>
                )}
              </div>
            </CardContent>
          </AdminPanel>
        )}

        <AdminPanel>
          <CardHeader>
            <CardTitle className="text-base">Store ID (for mobile build)</CardTitle>
            <CardDescription>Paste into white-label-client-app/app.json → expo.extra.storeId</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <code className="flex-1 bg-muted rounded-md px-3 py-2 text-sm font-mono break-all">{storeId}</code>
            <Button size="sm" variant="outline" onClick={copyStoreId}>{copied ? '✓ Copied' : 'Copy'}</Button>
          </CardContent>
        </AdminPanel>

        <AdminPanel>
          <CardHeader>
            <CardTitle className="text-base">App branding</CardTitle>
            <CardDescription>Saved to Firestore on your store profile — the mobile app reads live data from Firebase.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>App display name</Label>
              <Input
                value={config.appName}
                onChange={(e) => setConfig((c) => ({ ...c, appName: e.target.value }))}
                placeholder={storeName || 'Bakery X App'}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Deep link domain</Label>
                <Input
                  value={config.deepLinkHost}
                  onChange={(e) => setConfig((c) => ({ ...c, deepLinkHost: e.target.value }))}
                  placeholder="orders.yourstore.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Primary color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    className="w-14 p-1"
                    value={config.primaryColor}
                    onChange={(e) => setConfig((c) => ({ ...c, primaryColor: e.target.value }))}
                  />
                  <Input
                    value={config.primaryColor}
                    onChange={(e) => setConfig((c) => ({ ...c, primaryColor: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Saving…' : 'Save branding'}
            </Button>
          </CardContent>
        </AdminPanel>

        <AdminPanel>
          <CardHeader>
            <CardTitle className="text-base">Build config snippet</CardTitle>
            <CardDescription>For each client build in white-label-client-app/</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto">{easSnippet}</pre>
          </CardContent>
        </AdminPanel>

        <AdminPanel>
          <CardHeader>
            <CardTitle className="text-base">Setup steps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {BUILD_STEPS.map((step) => (
              <div key={step.n} className="flex gap-4">
                <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
                  {step.n}
                </div>
                <div>
                  <p className="font-medium text-sm">{step.title}</p>
                  <p className="text-sm text-muted-foreground">{step.body}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </AdminPanel>

        <AdminPanel>
          <CardHeader>
            <CardTitle className="text-base">What customers get</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
              {['Browse your products only', 'Cart & checkout', 'Order tracking', 'WhatsApp ordering', 'Guest mode — no Grabio login', 'Push notifications (Firebase FCM)'].map((f) => (
                <div key={f}>✓ {f}</div>
              ))}
            </div>
          </CardContent>
        </AdminPanel>
        </div>
      </AdminPageShell>
    </ModuleGate>
  );
};

export default WhitelabelApp;
