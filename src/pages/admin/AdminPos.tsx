import React, { useCallback, useEffect, useState } from 'react';
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Monitor, Download, KeyRound, RefreshCw, Smartphone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import MobileHeader from '@/components/MobileHeader';
import BackButton from '@/components/BackButton';
import { useIsMobile } from '@/hooks/use-mobile';
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

const AdminPos: React.FC = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const db = getFirestore();
  const storeId = user?.storeId || user?.id || '';

  const [posEnabled, setPosEnabled] = useState<boolean | null>(null);
  const [devices, setDevices] = useState<PosDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(true);

  const [deviceName, setDeviceName] = useState('Front counter');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [codeExpiresAt, setCodeExpiresAt] = useState<number | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);

  const [installToken, setInstallToken] = useState<string | null>(null);
  const [generatingToken, setGeneratingToken] = useState(false);

  useEffect(() => {
    document.title = 'POS — Grabio';
  }, []);

  const loadDevices = useCallback(async () => {
    if (!storeId) return;
    setLoadingDevices(true);
    try {
      const devicesRef = collection(db, 'stores', storeId, 'posDevices');
      const snap = await getDocs(devicesRef);
      setDevices(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PosDevice)));
    } catch (e) {
      console.error('Failed to load POS devices', e);
    } finally {
      setLoadingDevices(false);
    }
  }, [db, storeId]);

  useEffect(() => {
    const checkPosModule = async () => {
      if (!storeId) {
        setPosEnabled(false);
        return;
      }
      try {
        const profileSnap = await getDoc(doc(db, 'storeProfiles', storeId));
        const profile = profileSnap.data() || {};
        const modules = (profile.enabledModules as Record<string, boolean> | undefined) || {};
        setPosEnabled(Boolean(modules.pos));
      } catch {
        setPosEnabled(false);
      }
    };
    checkPosModule();
    loadDevices();
  }, [db, storeId, loadDevices]);

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

  if (posEnabled === false) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        {isMobile && <MobileHeader title="POS" />}
        <BackButton />
        <Card className="max-w-xl mx-auto mt-8">
          <CardHeader>
            <CardTitle>POS module not active</CardTitle>
            <CardDescription>
              Upgrade your Grabio plan to include POS, then return here to download and pair your terminal.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {isMobile && <MobileHeader title="Grabio POS" />}
      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Monitor className="h-7 w-7 text-market-primary" />
              Grabio POS
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Download the Windows app, pair your terminal, and sync sales to this store.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
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
              <Button onClick={handleGenerateToken} disabled={generatingToken}>
                {generatingToken ? 'Generating…' : 'Generate install token'}
              </Button>
              {installToken && (
                <Button variant="outline" onClick={() => downloadPairingJson(installToken, deviceName)}>
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
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Manual pairing code
            </CardTitle>
            <CardDescription>If POS is already installed — enter this 6-digit code in the app</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleGenerateCode} disabled={generatingCode}>
              {generatingCode ? 'Generating…' : 'Generate 6-digit code'}
            </Button>
            {pairingCode && (
              <div className="text-center p-6 bg-muted rounded-lg">
                <p className="text-4xl font-mono font-bold tracking-widest">{pairingCode}</p>
                <p className="text-sm text-muted-foreground mt-2">Expires in ~{codeMinutesLeft} min</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Connected devices</CardTitle>
              <CardDescription>Terminals paired to this store</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={loadDevices} aria-label="Refresh">
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
                      <p className="text-xs text-muted-foreground">{d.platform || 'windows'} · {d.id.slice(0, 8)}…</p>
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
        </Card>
      </div>
    </div>
  );
};

export default AdminPos;
