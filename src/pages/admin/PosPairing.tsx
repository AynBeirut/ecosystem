import React, { useCallback, useEffect, useState } from 'react';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import ModuleGate from '@/components/ModuleGate';
import { useToast } from '@/hooks/use-toast';
import { Download, KeyRound, Monitor, RefreshCw, Smartphone } from 'lucide-react';
import {
  downloadPairingJson,
  generateInstallToken,
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

  const [deviceName, setDeviceName] = useState('Front counter');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [codeExpiresAt, setCodeExpiresAt] = useState<number | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);

  const [installToken, setInstallToken] = useState<string | null>(null);
  const [generatingToken, setGeneratingToken] = useState(false);

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

  const handleGenerateToken = async () => {
    setGeneratingToken(true);
    try {
      const result = await generateInstallToken(deviceName.trim() || 'POS Terminal');
      setInstallToken(result.installToken);
      toast({
        title: 'Install token created',
        description: 'Download pairing.json and place it next to the installer before first launch.',
      });
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to generate token',
        variant: 'destructive',
      });
    } finally {
      setGeneratingToken(false);
    }
  };

  const codeMinutesLeft = codeExpiresAt
    ? Math.max(0, Math.ceil((codeExpiresAt - Date.now()) / 60000))
    : 0;

  return (
    <ModuleGate moduleId="pos">
      <AdminPageShell
        title="Grabio POS"
        description="Download the Windows app, pair your terminal, and sync sales to this store."
        eyebrow="POS"
        backTo="/admin/dashboard"
        className="max-w-4xl"
      >
        <AdminPanel>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Download className="h-5 w-5" />
              Download Grabio POS
            </CardTitle>
            <CardDescription>Version 1.1.0 — Windows installer (offline-first, cloud sync)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
              <li>Generate an install token below</li>
              <li>Download the installer and pairing.json</li>
              <li>Put pairing.json in the same folder as the installer</li>
              <li>Run the installer — POS auto-links to this store on first launch</li>
            </ol>
            <Button asChild size="lg">
              <a href={POS_INSTALLER_URL} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4 mr-2" />
                Download Grabio POS for Windows
              </a>
            </Button>
            {storeId ? (
              <p className="text-xs text-muted-foreground">
                Store ID: <code className="bg-muted px-1 rounded break-all">{storeId}</code>
              </p>
            ) : null}
          </CardContent>
        </AdminPanel>

        <AdminPanel>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-5 w-5" />
              Auto-pair (recommended)
            </CardTitle>
            <CardDescription>One-time token — POS links automatically on first launch</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="device-name">Device name</Label>
              <Input
                id="device-name"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="Front counter"
                maxLength={80}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={handleGenerateToken} disabled={generatingToken || !storeId}>
                {generatingToken ? 'Generating…' : 'Generate install token'}
              </Button>
              {installToken && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => downloadPairingJson(installToken, deviceName)}
                >
                  Download pairing.json
                </Button>
              )}
            </div>
            {installToken && (
              <p className="text-xs text-muted-foreground break-all">
                Token (single use): <code className="bg-muted px-1 rounded">{installToken}</code>
              </p>
            )}
          </CardContent>
        </AdminPanel>

        <AdminPanel>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Smartphone className="h-5 w-5" />
              Manual pairing code
            </CardTitle>
            <CardDescription>If POS is already installed — enter this 6-digit code in the app</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button type="button" onClick={handleGenerateCode} disabled={generatingCode || !storeId}>
              {generatingCode ? 'Generating…' : 'Generate 6-digit code'}
            </Button>
            {pairingCode && (
              <div className="text-center p-6 bg-muted rounded-lg">
                <p className="text-4xl font-mono font-bold tracking-widest">{pairingCode}</p>
                <p className="text-sm text-muted-foreground mt-2">Expires in ~{codeMinutesLeft} min</p>
              </div>
            )}
          </CardContent>
        </AdminPanel>

        <AdminPanel>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Monitor className="h-5 w-5" />
                Connected devices
              </CardTitle>
              <CardDescription>Terminals paired to this store</CardDescription>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={loadDevices} aria-label="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {loadingDevices ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : devices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No devices paired yet.</p>
            ) : (
              <ul className="divide-y">
                {devices.map((d) => (
                  <li key={d.id} className="py-3 flex justify-between items-start gap-4">
                    <div>
                      <p className="font-medium">{d.deviceName || 'Unnamed device'}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.platform || 'windows'} · {d.id.slice(0, 8)}…
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground text-right">
                      {d.lastSyncAt?.toDate?.()
                        ? `Last sync: ${d.lastSyncAt.toDate().toLocaleString()}`
                        : 'Never synced'}
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
