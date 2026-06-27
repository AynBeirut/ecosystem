import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/context/useAuth';
import { useBuilderAccount } from '@/hooks/useBuilderAccount';
import {
  createDemoStore,
  transferDemoStore,
  updateDemoBranding,
} from '@/lib/builderService';
import { BUILDER_BUSINESS_TYPES, BUILDER_MAX_DEMO_SLOTS } from '@/lib/builderConstants';
import { toast } from 'sonner';
import PoweredByEmoove from '@/components/PoweredByEmoove';

const BuilderDashboard: React.FC = () => {
  const { user, upgradeToAdmin } = useAuth();
  const navigate = useNavigate();
  const builderUid = user?.id;
  const { account, demos, loading, refresh } = useBuilderAccount(builderUid);

  const [newDemoName, setNewDemoName] = useState('');
  const [creatingDemo, setCreatingDemo] = useState(false);
  const [selectedDemoId, setSelectedDemoId] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferClientUid, setTransferClientUid] = useState('');
  const [transferring, setTransferring] = useState(false);

  useEffect(() => {
    if (!loading && builderUid && !account) {
      navigate('/onboarding/builder', { replace: true });
    }
  }, [account, builderUid, loading, navigate]);

  useEffect(() => {
    if (builderUid && !transferClientUid) {
      setTransferClientUid(builderUid);
    }
  }, [builderUid, transferClientUid]);

  const activeDemos = useMemo(
    () => demos.filter((d) => d.status !== 'deleted' && d.status !== 'converted'),
    [demos],
  );

  const businessLabel = BUILDER_BUSINESS_TYPES.find((t) => t.id === account?.businessType)?.label;

  const openDemoEditor = (demoId: string, tab: 'design' | 'products' = 'design') => {
    navigate(`/builder/demo/${demoId}/edit?tab=${tab}`);
  };

  const handleCreateDemo = async () => {
    if (!builderUid) return;
    setCreatingDemo(true);
    try {
      const demoId = await createDemoStore(builderUid, newDemoName);
      setNewDemoName('');
      await refresh();
      toast.success('Demo store created');
      openDemoEditor(demoId, 'design');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create demo');
    } finally {
      setCreatingDemo(false);
    }
  };

  const handleTransfer = async () => {
    if (!builderUid || !selectedDemoId || !user?.email) return;
    const clientUid = transferClientUid.trim();
    if (!clientUid) {
      toast.error('Client UID is required');
      return;
    }

    setTransferring(true);
    try {
      const result = await transferDemoStore(
        builderUid,
        selectedDemoId,
        clientUid,
        user.email,
      );

      if (clientUid === builderUid) {
        try {
          await upgradeToAdmin();
        } catch (upgradeErr) {
          console.warn('Seller upgrade after transfer:', upgradeErr);
        }
      }

      setTransferOpen(false);
      await refresh();
      toast.success(`Transferred to real store ${result.storeId} (${result.productCount} products)`);

      if (clientUid === builderUid) {
        navigate('/admin/profile', { replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Transfer failed');
    } finally {
      setTransferring(false);
    }
  };

  const openTransfer = async (demoId: string) => {
    if (!builderUid) return;
    setSelectedDemoId(demoId);
    try {
      const demo = demos.find((d) => d.id === demoId);
      if (demo?.name) {
        await updateDemoBranding(builderUid, demoId, { name: demo.name });
      }
    } catch {
      // non-blocking
    }
    setTransferOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#eef2f7]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600" />
      </div>
    );
  }

  if (!account || !builderUid) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#eef2f7]">
      <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-teal-700">Builder dashboard</p>
            <h1 className="text-2xl font-bold text-slate-900">{businessLabel || 'Builder account'}</h1>
            <p className="text-sm text-slate-600">
              {activeDemos.length}/{BUILDER_MAX_DEMO_SLOTS} demo slots used
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/">Home</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create demo store</CardTitle>
            <CardDescription>Demos stay under your builder path until you transfer them.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Demo store name"
              value={newDemoName}
              onChange={(e) => setNewDemoName(e.target.value)}
            />
            <Button
              disabled={creatingDemo || !newDemoName.trim() || activeDemos.length >= BUILDER_MAX_DEMO_SLOTS}
              onClick={() => void handleCreateDemo()}
            >
              {creatingDemo ? 'Creating…' : 'Create demo'}
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {demos.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-slate-600">
                No demo stores yet. Create one above to start.
              </CardContent>
            </Card>
          )}

          {demos.map((demo) => (
            <Card key={demo.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">{demo.name}</CardTitle>
                  <CardDescription className="font-mono text-xs">{demo.id}</CardDescription>
                </div>
                <Badge variant={demo.status === 'converted' ? 'secondary' : 'default'}>{demo.status}</Badge>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {demo.status !== 'converted' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDemoEditor(demo.id, 'design')}
                    >
                      Edit design & templates
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDemoEditor(demo.id, 'products')}
                    >
                      Edit products
                    </Button>
                    <Button size="sm" onClick={() => void openTransfer(demo.id)}>
                      Transfer to real store
                    </Button>
                  </>
                )}
                {demo.status === 'converted' && demo.transferredStoreId && (
                  <p className="text-sm text-slate-600">
                    Real store: <span className="font-mono">{demo.transferredStoreId}</span>
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {selectedDemoId && demos.find((d) => d.id === selectedDemoId && d.status !== 'converted') && (
          <Card>
            <CardHeader>
              <CardTitle>Quick actions</CardTitle>
              <CardDescription>
                Selected demo: <span className="font-mono">{selectedDemoId}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => openDemoEditor(selectedDemoId, 'design')}>
                Open template tabs
              </Button>
              <Button variant="outline" onClick={() => openDemoEditor(selectedDemoId, 'products')}>
                Open product list
              </Button>
            </CardContent>
          </Card>
        )}

        <PoweredByEmoove />
      </div>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer demo to real store</DialogTitle>
            <DialogDescription>
              Creates a real `storeProfiles/` record and copies demo products into production `products/`.
              Use your own UID to test the full handoff on your account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="clientUid">Client owner UID</Label>
            <Input
              id="clientUid"
              value={transferClientUid}
              onChange={(e) => setTransferClientUid(e.target.value)}
              placeholder={builderUid}
            />
            <p className="text-xs text-slate-500">
              Same as your UID = self-transfer (client SDK). Different UID = Cloud Function admin transfer (deploy required).
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>
              Cancel
            </Button>
            <Button disabled={transferring} onClick={() => void handleTransfer()}>
              {transferring ? 'Transferring…' : 'Confirm transfer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BuilderDashboard;
