import React, { useState, useEffect } from 'react';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminStatCard from '@/components/admin/AdminStatCard';
import AdminPanel from '@/components/admin/AdminPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import ModuleGate from '@/components/ModuleGate';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { Monitor, RefreshCw } from 'lucide-react';

type PosStats = {
  pairedDevices: number;
  lastSync: string | null;
};

const DOWNLOAD_URL = 'https://firebasestorage.googleapis.com/v0/b/market-flow-7b074.appspot.com/o/pos%2FGrabio-POS-Setup.exe?alt=media';

const STEPS = [
  { n: 1, title: 'Download & Install', body: 'Download the Grabio POS installer below and run it on your Windows machine. The setup takes under 2 minutes.' },
  { n: 2, title: 'Copy your Store ID', body: 'Your Store ID is shown below. Enter it on the POS login screen to link the terminal to your Grabio store.' },
  { n: 3, title: 'Start selling', body: 'Products, inventory, and orders sync automatically. POS works 100% offline and pushes records when back online.' },
];

const GrabioPOS: React.FC = () => {
  const { user } = useAuth();
  const storeId = getActualStoreId(user);
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<PosStats | null>(null);

  useEffect(() => {
    if (!storeId) return;
    const db = getFirestore();
    getDoc(doc(db, 'storeProfiles', storeId)).then((snap) => {
      const d = snap.data();
      setStats({
        pairedDevices: d?.posDevices?.length ?? 0,
        lastSync: d?.posLastSync ?? null,
      });
    });
  }, [storeId]);

  const copyStoreId = () => {
    void navigator.clipboard.writeText(storeId ?? '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ModuleGate moduleId="pos">
      <AdminPageShell
        title="Grabio POS"
        description="Full offline point-of-sale for Windows. Syncs products and sales with your Grabio store."
        eyebrow="POS"
        backTo="/admin/dashboard"
        className="max-w-3xl"
      >
        {stats && (
          <div className="grid grid-cols-2 gap-3 md:gap-4 mb-2">
            <AdminStatCard title="Paired Terminals" value={stats.pairedDevices} icon={Monitor} gradient="from-teal-500 to-teal-700" />
            <AdminStatCard
              title="Last Sync"
              value={stats.lastSync ? new Date(stats.lastSync).toLocaleDateString() : '—'}
              icon={RefreshCw}
              gradient="from-sky-500 to-blue-700"
            />
          </div>
        )}

        {/* Store ID */}
        <AdminPanel>
          <CardHeader>
            <CardTitle className="text-base">Your Store ID</CardTitle>
            <CardDescription>Enter this on the POS login screen to pair a terminal.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <code className="flex-1 bg-muted rounded-md px-3 py-2 text-sm font-mono break-all">
              {storeId}
            </code>
            <Button size="sm" variant="outline" onClick={copyStoreId}>
              {copied ? '✓ Copied' : 'Copy'}
            </Button>
          </CardContent>
        </AdminPanel>

        {/* Setup steps */}
        <AdminPanel>
          <CardHeader>
            <CardTitle className="text-base">Quick Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {STEPS.map((step) => (
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

        {/* Download */}
        <AdminPanel className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <p className="font-semibold">Grabio POS — Windows Installer</p>
              <p className="text-sm text-muted-foreground">
                ~80 MB · Windows 10/11 x64 · Offline-first · Auto-updates
              </p>
            </div>
            <a href={DOWNLOAD_URL} target="_blank" rel="noopener noreferrer">
              <Button className="gap-2">
                ⬇ Download POS
              </Button>
            </a>
          </CardContent>
        </AdminPanel>

        {/* Features */}
        <AdminPanel>
          <CardHeader>
            <CardTitle className="text-base">What's included</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-2 text-sm">
              {[
                '🛒 Cart & checkout',
                '💳 Cash, card, account payments',
                '🧾 Receipt printing',
                '📦 Inventory & stock alerts',
                '👥 Customer accounts',
                '↩️ Refunds & returns',
                '💰 Cash drawer management',
                '👔 Staff & payroll',
                '📊 Sales reports',
                '🔁 Composed products (recipes)',
                '📋 Purchase orders',
                '🌙 Dark / light theme',
              ].map((f) => (
                <div key={f} className="flex items-center gap-2 text-muted-foreground">
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </AdminPanel>

        <p className="text-xs text-muted-foreground text-center">
          The POS receives independent updates from the Windows build pipeline. Your Grabio subscription keeps it licensed.
        </p>
      </AdminPageShell>
    </ModuleGate>
  );
};

export default GrabioPOS;
