import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Briefcase,
  Building2,
  ExternalLink,
  LayoutTemplate,
  Plus,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/useAuth';
import { useBuilderAccount } from '@/hooks/useBuilderAccount';
import { BUILDER_MAX_DEMO_SLOTS } from '@/lib/builderConstants';
import { createDemoStore } from '@/lib/builderService';
import {
  ACCOUNTING_MAX_SANDBOXES,
  createAccountingSandbox,
  getPlatformFreelancer,
  listAccountingSandboxes,
  listFreelancerClients,
  syncFreelancerClientStoreIds,
  type FreelancerClient,
} from '@/lib/freelancerService';
import type { PlatformFreelancer } from '@/types/career';
import type { AccountingTestSandbox } from '@/types/career';
import { toast } from 'sonner';
import PoweredByEmoove from '@/components/PoweredByEmoove';

const FreelancerPortal: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const uid = user?.id;
  const [profile, setProfile] = useState<PlatformFreelancer | null>(null);
  const [clients, setClients] = useState<FreelancerClient[]>([]);
  const [sandboxes, setSandboxes] = useState<AccountingTestSandbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDemoName, setNewDemoName] = useState('');
  const [newSandboxName, setNewSandboxName] = useState('');
  const [newSandboxFocus, setNewSandboxFocus] = useState('');
  const [creatingDemo, setCreatingDemo] = useState(false);
  const [creatingSandbox, setCreatingSandbox] = useState(false);

  const { account, demos, refresh: refreshBuilder } = useBuilderAccount(
    profile?.track === 'designer_builder' ? uid : undefined,
  );

  const activeDemos = useMemo(
    () => demos.filter((d) => d.status !== 'deleted' && d.status !== 'converted'),
    [demos],
  );

  useEffect(() => {
    if (!uid || !user?.email) {
      setLoading(false);
      return;
    }

    void (async () => {
      setLoading(true);
      try {
        const freelancer = await getPlatformFreelancer(uid);
        if (!freelancer) {
          navigate('/onboarding/freelancer', { replace: true });
          return;
        }
        setProfile(freelancer);
        const clientList = await listFreelancerClients(user.email);
        setClients(clientList);
        await syncFreelancerClientStoreIds(uid, user.email);
        if (freelancer.track === 'accounting') {
          setSandboxes(await listAccountingSandboxes(uid));
        }
      } catch (err) {
        console.error(err);
        toast.error('Could not load freelancer workspace');
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate, uid, user?.email]);

  const handleCreateDemo = async () => {
    if (!uid) return;
    setCreatingDemo(true);
    try {
      const demoId = await createDemoStore(uid, newDemoName);
      setNewDemoName('');
      await refreshBuilder();
      toast.success('Demo website created');
      navigate(`/builder/demo/${demoId}/edit?tab=design`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create demo');
    } finally {
      setCreatingDemo(false);
    }
  };

  const handleCreateSandbox = async () => {
    if (!uid) return;
    setCreatingSandbox(true);
    try {
      await createAccountingSandbox(uid, newSandboxName, newSandboxFocus);
      setNewSandboxName('');
      setNewSandboxFocus('');
      setSandboxes(await listAccountingSandboxes(uid));
      toast.success('Accounting sandbox created');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create sandbox');
    } finally {
      setCreatingSandbox(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#eef2f7]">
        <p className="text-slate-600">Loading freelancer workspace…</p>
      </div>
    );
  }

  if (!profile) return null;

  const trackLabel =
    profile.track === 'designer_builder' ? 'Designer / Web Builder' : 'Accounting Freelancer';

  return (
    <div className="min-h-screen bg-[#eef2f7]">
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">Freelancer</p>
            <h1 className="text-2xl font-bold text-slate-900">{profile.displayName}</h1>
            <p className="text-sm text-slate-600">{trackLabel}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {profile.track === 'designer_builder' && (
              <Button asChild variant="outline">
                <Link to="/builder">Builder workspace</Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link to="/careers">Careers</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-teal-600" />
              Your clients
            </CardTitle>
            <CardDescription>
              Stores that added your email as a sub-account ({clients.length})
            </CardDescription>
          </CardHeader>
          <CardContent>
            {clients.length === 0 ? (
              <p className="text-sm text-slate-600">
                No clients yet. Ask a store owner to add{' '}
                <span className="font-medium text-slate-900">{profile.email}</span> as sub-account (
                {profile.track === 'designer_builder' ? 'web maintenance' : 'accounting'} role).
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {clients.map((client) => (
                  <div
                    key={client.subAccountId}
                    className="rounded-xl border bg-slate-50 p-4 flex items-start justify-between gap-3"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{client.storeName}</p>
                      <p className="text-xs text-slate-500 mt-1">Role: {client.role}</p>
                      <Badge variant="secondary" className="mt-2 capitalize">
                        {client.status}
                      </Badge>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link
                        to={
                          client.role === 'accounting'
                            ? `/admin/finance?storeId=${client.storeId}`
                            : `/admin/dashboard?storeId=${client.storeId}`
                        }
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1" />
                        Open
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {profile.track === 'designer_builder' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutTemplate className="h-5 w-5 text-violet-600" />
                Demo websites
              </CardTitle>
              <CardDescription>
                Up to {BUILDER_MAX_DEMO_SLOTS} portfolio models — transfer to a store owner when ready
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="Demo store name"
                  value={newDemoName}
                  onChange={(e) => setNewDemoName(e.target.value)}
                />
                <Button
                  onClick={handleCreateDemo}
                  disabled={creatingDemo || activeDemos.length >= BUILDER_MAX_DEMO_SLOTS}
                  className="bg-violet-600 hover:bg-violet-700 shrink-0"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  New demo
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {activeDemos.map((demo) => (
                  <div key={demo.id} className="rounded-xl border bg-white p-4">
                    <p className="font-semibold text-slate-900">{demo.name}</p>
                    <p className="text-xs text-slate-500 mt-1 capitalize">{demo.status}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/builder/demo/${demo.id}/edit`}>Edit</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/builder/demo/${demo.id}/preview`}>Preview</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {activeDemos.length === 0 && (
                <p className="text-sm text-slate-500">Create your first demo website model.</p>
              )}
            </CardContent>
          </Card>
        )}

        {profile.track === 'accounting' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-emerald-600" />
                Accounting test sandboxes
              </CardTitle>
              <CardDescription>
                Up to {ACCOUNTING_MAX_SANDBOXES} isolated test stores for finance workflows
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Sandbox name</Label>
                  <Input
                    value={newSandboxName}
                    onChange={(e) => setNewSandboxName(e.target.value)}
                    placeholder="e.g. Retail VAT pilot"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Module focus (optional)</Label>
                  <Input
                    value={newSandboxFocus}
                    onChange={(e) => setNewSandboxFocus(e.target.value)}
                    placeholder="Purchases, GL, invoicing…"
                  />
                </div>
              </div>
              <Button
                onClick={handleCreateSandbox}
                disabled={creatingSandbox || sandboxes.filter((s) => s.status !== 'archived').length >= ACCOUNTING_MAX_SANDBOXES}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4 mr-1" />
                New sandbox
              </Button>
              <div className="grid gap-3 md:grid-cols-3">
                {sandboxes.filter((s) => s.status !== 'archived').map((sandbox) => (
                  <div key={sandbox.id} className="rounded-xl border bg-white p-4">
                    <div className="flex items-start gap-2">
                      <Building2 className="h-4 w-4 text-emerald-600 mt-1 shrink-0" />
                      <div>
                        <p className="font-semibold text-slate-900">{sandbox.name}</p>
                        {sandbox.moduleFocus && (
                          <p className="text-xs text-slate-500 mt-1">{sandbox.moduleFocus}</p>
                        )}
                      </div>
                    </div>
                    {sandbox.storeId && (
                      <Button asChild size="sm" variant="outline" className="mt-3">
                        <Link to={`/admin/finance?storeId=${sandbox.storeId}`}>Open finance test</Link>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
      <div className="pb-8 flex justify-center">
        <PoweredByEmoove />
      </div>
    </div>
  );
};

export default FreelancerPortal;
