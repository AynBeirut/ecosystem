import React, { useCallback, useEffect, useState } from 'react';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import ModuleGate from '@/components/ModuleGate';
import { useToast } from '@/hooks/use-toast';
import { Download, Monitor, RefreshCw, Smartphone } from 'lucide-react';
import {
  generatePairingCode,
  POS_INSTALLER_URL,
} from '@/lib/posApi';

type PosDevice = {
  id: string;
  deviceName?: string;
  platform?: string;
  pairedAt?: { toDate?: () => Date };
  lastSyncAt?: { toDate?: () => Date };
};

const PosPairing: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const db = getFirestore();
  const storeId = getActualStoreId(user) || '';

  const [devices, setDevices] = useState<PosDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [codeExpiresAt, setCodeExpiresAt] = useState<number | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);

  const loadDevices = useCallback(async () => {
    if (!storeId) return;
    setLoadingDevices(true);
    try {
      const devicesRef = collection(db, 'stores', storeId, 'posDevices');
      const snap = await getDocs(devicesRef);
      setDevices(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PosDevice)));
    } catch (e) {
      console.error('Failed to load POS devices', e);
      toast({
        title: 'Could not load devices',
        description: e instanceof Error ? e.message : 'Permission or network error',
        variant: 'destructive',
      });
    } finally {
      setLoadingDevices(false);
    }
  }, [db, storeId, toast]);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  useEffect(() => {
    if (!codeExpiresAt) return;
    const timer = setInterval(() => {
      if (Date.now() >= codeExpiresAt) {
        setPairingCode(null);
        setCodeExpiresAt(null);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [codeExpiresAt]);

  const handleGenerateCode = async () => {
    if (!storeId) return;
    setGeneratingCode(true);
    try {
      const result = await generatePairingCode(storeId);
      setPairingCode(result.code);
      setCodeExpiresAt(Date.now() + result.expiresInSeconds * 1000);
      toast({ title: 'Pairing code ready', description: 'Enter this code in Grabio POS within 15 minutes.' });
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to generate code',
        variant: 'destructive',
      });
    } finally {
      setGeneratingCode(false);
    }
  };

  const codeMinutesLeft = codeExpiresAt
    ? Math.max(0, Math.ceil((codeExpiresAt - Date.now()) / 60000))
    : 0;
  const hasPairingCode = Boolean(pairingCode && codeExpiresAt && Date.now() < codeExpiresAt);
  const connectedDevicesCount = devices.length;

  return (
    <ModuleGate moduleId="pos">
      <AdminPageShell
        title="Grabio POS"
        description="Install the Windows app, then pair your terminal to this store."
        eyebrow="POS"
        backTo="/admin/dashboard"
        className="max-w-4xl"
      >
        <div className="grid gap-4 md:grid-cols-3">
          <AdminPanel className="border-teal-200/80 bg-gradient-to-br from-teal-50 via-white to-cyan-50 shadow-[0_18px_50px_-28px_rgba(13,148,136,0.45)]">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_10px_24px_-12px_rgba(8,145,178,0.75)]">
                <Download className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700/80">Installer</p>
                <p className="text-lg font-semibold text-slate-900">Windows v1.1.0</p>
                <p className="text-sm text-slate-600">Offline-first desktop POS</p>
              </div>
            </CardContent>
          </AdminPanel>

          <AdminPanel className="border-cyan-200/80 bg-gradient-to-br from-slate-900 via-teal-950 to-cyan-950 text-white shadow-[0_20px_60px_-30px_rgba(15,23,42,0.8)]">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-cyan-100 ring-1 ring-white/15">
                <Smartphone className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/75">Pairing</p>
                <p className="text-lg font-semibold">{hasPairingCode ? pairingCode : 'Step 2 ready'}</p>
                <p className="text-sm text-cyan-50/75">
                  {hasPairingCode ? `Expires in ~${codeMinutesLeft} min` : 'Generate a 6-digit pairing code'}
                </p>
              </div>
            </CardContent>
          </AdminPanel>

          <AdminPanel className="border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-teal-50 shadow-[0_18px_50px_-28px_rgba(16,185,129,0.38)]">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_10px_24px_-12px_rgba(5,150,105,0.75)]">
                <Monitor className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700/80">Connected</p>
                <p className="text-lg font-semibold text-slate-900">{loadingDevices ? 'Loading…' : connectedDevicesCount}</p>
                <p className="text-sm text-slate-600">Paired terminal{connectedDevicesCount === 1 ? '' : 's'}</p>
              </div>
            </CardContent>
          </AdminPanel>
        </div>

        <AdminPanel className="overflow-hidden border-teal-200/80 bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-white shadow-[0_24px_70px_-34px_rgba(15,23,42,0.85)]">
          <CardHeader className="relative overflow-hidden border-b border-white/10 bg-white/5">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.18),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(45,212,191,0.18),transparent_35%)]" />
            <div className="relative flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div className="space-y-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-cyan-500 text-slate-950 shadow-[0_12px_30px_-16px_rgba(34,211,238,0.8)]">
                  <Download className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-xl text-white">Step 1: Install Grabio POS</CardTitle>
                  <CardDescription className="mt-1 max-w-2xl text-slate-200/80">
                    Download the Windows installer, install it on the terminal, then open the POS app.
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <div className="grid gap-4 md:grid-cols-3">
              {[
                'Download and install Grabio POS on your Windows machine',
                'Open the POS app after installation',
                'Return here for Step 2 and generate a pairing code',
              ].map((step, index) => (
                <div
                  key={step}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                >
                  <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 text-sm font-bold text-slate-950">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-6 text-slate-100/90">{step}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                asChild
                size="lg"
                className="admin-touch-target bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-[0_14px_28px_-16px_rgba(8,145,178,0.9)] hover:from-teal-600 hover:to-cyan-700"
              >
                <a href={POS_INSTALLER_URL} target="_blank" rel="noopener noreferrer">
                  <Download className="mr-2 h-4 w-4" />
                  Download Grabio POS for Windows
                </a>
              </Button>
            </div>
            {storeId ? (
              <details className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <summary className="cursor-pointer list-none font-medium text-white">
                  Advanced details
                </summary>
                <div className="mt-3 border-t border-white/10 pt-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-cyan-100/70">Store ID</p>
                  <p className="mt-1 break-all font-mono text-xs text-cyan-100/85">{storeId}</p>
                </div>
              </details>
            ) : null}
          </CardContent>
        </AdminPanel>

        <AdminPanel className="overflow-hidden border-cyan-200/80 bg-gradient-to-br from-cyan-50 via-white to-teal-50 shadow-[0_22px_55px_-32px_rgba(13,148,136,0.35)]">
          <CardHeader className="border-b border-teal-100 bg-gradient-to-r from-teal-50 to-cyan-50">
            <CardTitle className="flex items-center gap-3 text-lg text-slate-900">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-[0_10px_24px_-14px_rgba(8,145,178,0.75)]">
                <Smartphone className="h-5 w-5" />
              </span>
              Step 2: Pair your terminal
            </CardTitle>
            <CardDescription className="text-slate-600">
              Generate a one-time 6-digit code here, then enter it inside the POS app.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-900">Open the POS app first, then generate the code here.</p>
                <p className="text-sm text-slate-600">Each code works once and stays valid for 15 minutes.</p>
              </div>
              <Button
                type="button"
                onClick={handleGenerateCode}
                disabled={generatingCode || !storeId}
                size="lg"
                className="admin-touch-target bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-[0_14px_28px_-16px_rgba(8,145,178,0.85)] hover:from-teal-600 hover:to-cyan-700"
              >
                {generatingCode ? 'Generating…' : 'Generate 6-digit code'}
              </Button>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
              <div className="rounded-3xl border border-teal-200 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-8 text-center shadow-[0_24px_60px_-34px_rgba(15,23,42,0.8)]">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-100/70">Pairing code</p>
                <p className="mt-5 text-5xl font-mono font-bold tracking-[0.4em] text-white sm:text-6xl">
                  {pairingCode || '------'}
                </p>
                <p className="mt-4 text-sm text-cyan-100/80">
                  {hasPairingCode ? `Expires in ~${codeMinutesLeft} min` : 'Generate a fresh code when the POS app is ready.'}
                </p>
              </div>

              <div className="rounded-3xl border border-teal-100 bg-white/90 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_12px_30px_-20px_rgba(15,23,42,0.18)]">
                <p className="text-sm font-semibold text-slate-900">Inside the POS app</p>
                <ul className="mt-4 space-y-3 text-sm text-slate-600">
                  <li className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">Open the pairing screen on the terminal.</li>
                  <li className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">Enter the 6-digit code shown here.</li>
                  <li className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">Wait a few seconds for the terminal to appear below in Connected devices.</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </AdminPanel>

        <AdminPanel className="overflow-hidden border-emerald-200/80 bg-gradient-to-br from-white via-emerald-50/50 to-teal-50/60 shadow-[0_20px_55px_-34px_rgba(16,185,129,0.28)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50">
            <div>
              <CardTitle className="flex items-center gap-3 text-lg text-slate-900">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-[0_10px_24px_-14px_rgba(5,150,105,0.75)]">
                  <Monitor className="h-5 w-5" />
                </span>
                Connected devices
              </CardTitle>
              <CardDescription className="text-slate-600">Terminals currently paired to this store</CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={loadDevices}
              aria-label="Refresh"
              className="rounded-xl border border-emerald-200 bg-white/80 text-emerald-700 hover:bg-emerald-50"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-6">
            {loadingDevices ? (
              <div className="rounded-3xl border border-dashed border-emerald-200 bg-white/75 px-6 py-10 text-center text-sm text-slate-500">
                Loading paired terminals…
              </div>
            ) : devices.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-emerald-200 bg-white/75 px-6 py-10 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-[0_12px_26px_-14px_rgba(5,150,105,0.75)]">
                  <Monitor className="h-6 w-6" />
                </div>
                <p className="mt-4 text-base font-semibold text-slate-900">No devices paired yet</p>
                <p className="mt-1 text-sm text-slate-600">Download the installer, open the POS app, then use a pairing code to connect the first terminal.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {devices.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-white/90 px-4 py-4 shadow-[0_12px_26px_-22px_rgba(15,23,42,0.22)] sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-[0_10px_24px_-14px_rgba(5,150,105,0.7)]">
                        <Monitor className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{d.deviceName || 'Unnamed device'}</p>
                        <p className="text-xs uppercase tracking-[0.2em] text-emerald-700/75">{d.platform || 'windows'} terminal</p>
                        <p className="mt-1 text-xs text-slate-500">Device ID: {d.id.slice(0, 8)}…</p>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Last sync</p>
                      <p className="mt-1 font-medium text-slate-900">
                        {d.lastSyncAt?.toDate?.() ? d.lastSyncAt.toDate().toLocaleString() : 'Never synced'}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </AdminPanel>
      </AdminPageShell>
    </ModuleGate>
  );
};

export default PosPairing;
