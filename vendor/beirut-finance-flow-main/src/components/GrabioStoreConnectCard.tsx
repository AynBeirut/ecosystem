import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  loadExternalAccountingConnection,
  pairExternalAccounting,
} from '@/lib/grabio/accountingPairing';

export default function GrabioStoreConnectCard() {
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [systemName, setSystemName] = useState('Beirut Finance');
  const [connection, setConnection] = useState(loadExternalAccountingConnection);
  const [pairing, setPairing] = useState(false);

  const handlePair = async () => {
    const normalized = code.replace(/\D/g, '');
    if (normalized.length !== 8) {
      toast({ title: 'Invalid code', description: 'Enter the 8-digit code from Grabio POS.', variant: 'destructive' });
      return;
    }
    setPairing(true);
    try {
      const result = await pairExternalAccounting(normalized, systemName.trim() || 'External accounting');
      setConnection(result);
      setCode('');
      toast({
        title: 'Store connected',
        description: result.storeName ? `Linked to ${result.storeName}` : `Linked to store ${result.storeId}`,
      });
    } catch (err) {
      toast({
        title: 'Connection failed',
        description: err instanceof Error ? err.message : 'Could not pair',
        variant: 'destructive',
      });
    } finally {
      setPairing(false);
    }
  };

  const handleDisconnect = () => {
    localStorage.removeItem('grabio_external_accounting_connection');
    setConnection(null);
    toast({ title: 'Disconnected', description: 'External accounting link removed from this browser.' });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect to Grabio store</CardTitle>
        <CardDescription>
          Enter the 8-digit code from Admin → POS → External accounting system
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {connection ? (
          <div className="space-y-3">
            <p className="text-sm">
              Connected to <strong>{connection.storeName || connection.storeId}</strong>
            </p>
            <Button type="button" variant="outline" onClick={handleDisconnect}>
              Disconnect
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="grabio-system-name">Accounting system name</Label>
              <Input
                id="grabio-system-name"
                value={systemName}
                onChange={(e) => setSystemName(e.target.value)}
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="grabio-pair-code">8-digit code</Label>
              <Input
                id="grabio-pair-code"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="12345678"
                className="font-mono tracking-widest"
              />
            </div>
            <Button type="button" onClick={() => void handlePair()} disabled={pairing || code.length !== 8}>
              {pairing ? 'Connecting…' : 'Connect store'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
