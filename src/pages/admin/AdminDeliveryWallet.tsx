import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/useAuth';
import { useToast } from '@/hooks/use-toast';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wallet, ArrowDownToLine, RefreshCw, Truck } from 'lucide-react';
import {
  loadDeliveryWalletSummary,
  settleDeliveryWalletOrders,
} from '@/lib/deliveryWalletService';

const formatMoney = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const AdminDeliveryWallet: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const storeId = user?.storeId || '';

  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(false);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof loadDeliveryWalletSummary>> | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [destination, setDestination] = useState<'cash' | 'bank'>('cash');
  const [notes, setNotes] = useState('');

  const refresh = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const data = await loadDeliveryWalletSummary(storeId);
      setSummary(data);
    } catch (err) {
      console.error(err);
      toast({ title: 'Failed to load delivery wallets', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [storeId, toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const unsettledForPerson = useMemo(() => {
    if (!summary || !selectedPersonId) return [];
    return summary.deliveryOrders.filter(
      (o) => o.deliveryPersonId === selectedPersonId && o.status === 'paid' && !o.returnedAt,
    );
  }, [summary, selectedPersonId]);

  const settleTotal = unsettledForPerson
    .filter((o) => selectedOrderIds.includes(o.id))
    .reduce((s, o) => s + Number(o.amount || 0), 0);

  const handleSettle = async () => {
    if (!storeId || !selectedPersonId || selectedOrderIds.length === 0) return;
    setSettling(true);
    try {
      const id = await settleDeliveryWalletOrders(storeId, selectedPersonId, selectedOrderIds, destination, notes || undefined);
      toast({ title: 'Settlement complete', description: `${id} posted to GL` });
      setSelectedOrderIds([]);
      setNotes('');
      await refresh();
    } catch (err) {
      toast({
        title: 'Settlement failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setSettling(false);
    }
  };

  return (
    <AdminPageShell title="Delivery Wallets" description="COD cash held by couriers until settlement">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            COD orders marked <strong>delivered</strong> in Admin Orders credit the courier wallet and GL Delivery Wallet (1050).
          </p>
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-2 border-amber-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-amber-800">Outstanding delivery cash</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-amber-700">{formatMoney(summary?.pendingCash || 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Couriers</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{summary?.deliveryPersons.length || 0}</p></CardContent>
          </Card>
        </div>

        <AdminPanel title="Courier wallets" description="Settle when cash is handed to the office">
          {!summary?.deliveryPersons.length ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No courier wallets yet. Deliver a COD order in Admin Orders.</p>
          ) : (
            <div className="space-y-3">
              {summary.deliveryPersons.map((person) => {
                const pending = summary.deliveryOrders.filter(
                  (o) => o.deliveryPersonId === person.id && o.status === 'paid' && !o.returnedAt,
                ).length;
                return (
                  <div key={person.id} className="flex flex-wrap items-center justify-between gap-3 p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{person.name}</p>
                      <p className="text-xs text-muted-foreground">{pending} COD pending settlement</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`font-bold ${person.walletBalance > 0 ? 'text-amber-600' : ''}`}>
                        {formatMoney(Number(person.walletBalance) || 0)}
                      </span>
                      {person.walletBalance > 0 && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedPersonId(person.id);
                            setSelectedOrderIds(
                              summary.deliveryOrders
                                .filter((o) => o.deliveryPersonId === person.id && o.status === 'paid' && !o.returnedAt)
                                .map((o) => o.id),
                            );
                          }}
                        >
                          <ArrowDownToLine className="h-4 w-4 mr-1" /> Settle
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </AdminPanel>

        {selectedPersonId && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5" /> Settle courier wallet</CardTitle>
              <CardDescription>Select orders and post GL settlement (Dr Cash/Bank · Cr Delivery Wallet)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Deposit to</Label>
                  <Select value={destination} onValueChange={(v) => setDestination(v as 'cash' | 'bank')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash on hand</SelectItem>
                      <SelectItem value="bank">Bank</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
                </div>
              </div>

              <div className="space-y-2">
                {unsettledForPerson.map((order) => (
                  <div key={order.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <Checkbox
                      checked={selectedOrderIds.includes(order.id)}
                      onCheckedChange={(checked) => {
                        setSelectedOrderIds((prev) =>
                          checked ? [...prev, order.id] : prev.filter((id) => id !== order.id),
                        );
                      }}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{order.clientName}</p>
                      <p className="text-xs text-muted-foreground">{order.invoiceNumber || order.platformOrderId}</p>
                    </div>
                    <p className="font-bold">{formatMoney(Number(order.amount) || 0)}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <p className="text-lg font-bold text-green-700">Total: {formatMoney(settleTotal)}</p>
                <Button onClick={() => void handleSettle()} disabled={settling || settleTotal <= 0}>
                  {settling ? 'Settling…' : 'Settle & post GL'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <AdminPanel title="Settlement history" description="Posted wallet settlements">
          {!summary?.cashCollections.length ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No settlements yet</p>
          ) : (
            <div className="space-y-2">
              {[...summary.cashCollections].reverse().slice(0, 20).map((c) => (
                <div key={c.id} className="flex justify-between items-center p-3 border rounded-lg text-sm">
                  <div>
                    <p className="font-medium">{c.deliveryPersonName}</p>
                    <p className="text-muted-foreground">{new Date(c.collectedAt).toLocaleString()} · {c.id}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">+{formatMoney(Number(c.totalAmount) || 0)}</p>
                    {c.destination && <Badge variant="outline" className="capitalize">{c.destination}</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </AdminPanel>
      </div>
    </AdminPageShell>
  );
};

export default AdminDeliveryWallet;
