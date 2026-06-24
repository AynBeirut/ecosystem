import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, ClipboardList, UserX } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import {
  fetchCrmClient,
  fetchActivities,
  fetchCrmReps,
  updateCrmClientFields,
  removeFromCrm,
  logCrmActivity,
  type CrmClient,
} from '@/lib/crmService';
import type { CrmActivity, CrmPipelineStage } from '@/types/crm';
import { CRM_PIPELINE_STAGES } from '@/types/crm';
import { CRM_PIPELINE_LABELS, CRM_ACTIVITY_TYPE_LABELS, CRM_ACTIVITY_RESULT_LABELS } from '@/lib/crm';
import LogActivityDialog, { type LogActivitySubmit } from '@/components/crm/LogActivityDialog';
import { useToast } from '@/hooks/use-toast';
import { collection, getDocs, query, where, getFirestore } from 'firebase/firestore';
import type { Order } from '@/types/order';

function normalizePhone(p: string | null | undefined): string {
  return (p || '').replace(/\D/g, '');
}

const CrmClientProfile: React.FC = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const storeId = getActualStoreId(user);

  const [client, setClient] = useState<CrmClient | null>(null);
  const [reps, setReps] = useState<Awaited<ReturnType<typeof fetchCrmReps>>>([]);
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [logOpen, setLogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);

  const [assignedRepId, setAssignedRepId] = useState<string>('');
  const [pipelineStage, setPipelineStage] = useState<CrmPipelineStage>('new_lead');
  const [dealValue, setDealValue] = useState<string>('');
  const [nextFollowUp, setNextFollowUp] = useState<string>('');

  const load = useCallback(async () => {
    if (!storeId || !clientId) {
      setClient(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [c, repList, acts] = await Promise.all([
        fetchCrmClient(clientId),
        fetchCrmReps(storeId),
        fetchActivities(storeId, { customerId: clientId }, 200),
      ]);
      setReps(repList);
      setActivities(acts);
      if (!c) {
        setClient(null);
        setOrders([]);
        return;
      }
      setClient(c);
      setAssignedRepId(c.assignedRepId || 'none');
      setPipelineStage(
        (c.pipelineStage && CRM_PIPELINE_STAGES.includes(c.pipelineStage as CrmPipelineStage)
          ? c.pipelineStage
          : 'new_lead') as CrmPipelineStage,
      );
      setDealValue(c.dealValue != null ? String(c.dealValue) : '');
      if (c.nextFollowUpAt) {
        const d = new Date(c.nextFollowUpAt);
        const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        setNextFollowUp(local);
      } else {
        setNextFollowUp('');
      }

      const db = getFirestore();
      const orderSnap = await getDocs(query(collection(db, 'orders'), where('storeId', '==', storeId)));
      const phoneNorm = normalizePhone(c.phone);
      const matched = orderSnap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Order))
        .filter(
          (o) =>
            o.customerId === clientId ||
            (!!phoneNorm && normalizePhone(o.customerPhone) === phoneNorm && !!phoneNorm),
        )
        .sort((a, b) => {
          const ta = new Date(a.createdAt as string).getTime();
          const tb = new Date(b.createdAt as string).getTime();
          return tb - ta;
        });
      setOrders(matched.slice(0, 50));
    } catch (e) {
      toast({
        title: 'Failed to load client',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [storeId, clientId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSaveFields = async () => {
    if (!clientId || !client) return;
    setSaving(true);
    try {
      const dv = dealValue.trim() === '' ? null : parseFloat(dealValue);
      const nextIso = nextFollowUp ? new Date(nextFollowUp).toISOString() : null;
      const repValue = assignedRepId === 'none' ? null : assignedRepId;
      await updateCrmClientFields(clientId, {
        assignedRepId: repValue,
        pipelineStage,
        dealValue: dv != null && !Number.isNaN(dv) ? dv : null,
        nextFollowUpAt: nextIso,
        crmEnabled: true,
        // if admin explicitly assigns a rep, unlock auto-assign; if clearing rep, lock it
        crmAdminUnassigned: repValue === null,
      });
      toast({ title: 'Client updated' });
      await load();
    } catch (e) {
      toast({
        title: 'Save failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveFromCrm = async () => {
    if (!clientId) return;
    setRemoving(true);
    try {
      await removeFromCrm(clientId);
      toast({ title: 'Client removed from CRM', description: 'The client is kept as a customer but no longer in the sales pipeline.' });
      setConfirmRemove(false);
      await load();
    } catch (e) {
      toast({ title: 'Failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setRemoving(false);
    }
  };

  const openLogDialog = () => {
    if (!client) return;
    if (!client.assignedRepId) {
      toast({ title: 'Assign a rep before logging activity', variant: 'destructive' });
      return;
    }
    const rep = reps.find((r) => r.id === client.assignedRepId);
    if (!rep) {
      toast({ title: 'Assigned rep not found', variant: 'destructive' });
      return;
    }
    setLogOpen(true);
  };

  const submitLog = async (data: LogActivitySubmit) => {
    if (!client || !storeId || !user?.id) return;
    const repId = client.assignedRepId!;
    const rep = reps.find((r) => r.id === repId);
    if (!rep) return;
    await logCrmActivity({
      storeId,
      customerId: client.id,
      repId,
      repName: rep.name,
      type: data.type,
      loggedAt: data.loggedAt,
      result: data.result,
      notes: data.notes,
      followUpAt: data.followUpAt,
      location: data.location,
      source: 'web',
      createdBy: user.id,
      advancePipeline: true,
    });
    toast({ title: 'Activity logged' });
    await load();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!client || !clientId) {
    return <p className="text-muted-foreground">Client not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/crm/pipeline" className="flex items-center gap-1">
              <ArrowLeft className="h-4 w-4" />
              Pipeline
            </Link>
          </Button>
          <h2 className="text-xl font-semibold">{client.name || 'Client'}</h2>
        </div>
        {client.assignedRepId ? (
          !confirmRemove ? (
            <Button
              variant="outline"
              size="sm"
              className="border-red-300 text-red-600 hover:bg-red-50"
              onClick={() => setConfirmRemove(true)}
            >
              <UserX className="h-4 w-4 mr-1" />
              Remove from rep's list
            </Button>
          ) : (
            <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-sm text-red-700">
              <span>Unassign this client from the rep?</span>
              <Button size="sm" variant="destructive" disabled={removing} onClick={() => void handleRemoveFromCrm()}>
                {removing ? 'Removing…' : 'Confirm'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(false)}>Cancel</Button>
            </div>
          )
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contact and deal</CardTitle>
            <CardDescription>Managed in Sales CRM. Save changes before leaving.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p><span className="text-muted-foreground">Email:</span> {client.email || '—'}</p>
            <p><span className="text-muted-foreground">Phone:</span> {client.phone || '—'}</p>
            <p><span className="text-muted-foreground">City:</span> {client.city || '—'}</p>

            <div>
              <Label>Assigned rep</Label>
              <Select value={assignedRepId || 'none'} onValueChange={setAssignedRepId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {reps.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Pipeline stage</Label>
              <Select value={pipelineStage} onValueChange={(v) => setPipelineStage(v as CrmPipelineStage)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CRM_PIPELINE_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>{CRM_PIPELINE_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Deal value (USD)</Label>
              <Input type="number" min={0} step="0.01" value={dealValue} onChange={(e) => setDealValue(e.target.value)} />
            </div>
            <div>
              <Label>Next follow-up</Label>
              <Input type="datetime-local" value={nextFollowUp} onChange={(e) => setNextFollowUp(e.target.value)} />
            </div>
            <Button onClick={() => void handleSaveFields()} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Activity</CardTitle>
              <CardDescription>Log touches; pipeline may advance from the activity result.</CardDescription>
            </div>
            <Button size="sm" onClick={openLogDialog}>
              <ClipboardList className="h-4 w-4 mr-2" />
              Log activity
            </Button>
          </CardHeader>
          <CardContent>
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activities yet.</p>
            ) : (
              <ul className="space-y-3 max-h-[360px] overflow-y-auto pr-2">
                {activities.map((a) => (
                  <li key={a.id} className="border rounded-md p-3 text-sm">
                    <div className="font-medium">{new Date(a.loggedAt).toLocaleString()}</div>
                    <div className="text-muted-foreground text-xs mt-1">
                      {a.repName} · {CRM_ACTIVITY_TYPE_LABELS[a.type]} · {CRM_ACTIVITY_RESULT_LABELS[a.result]}
                    </div>
                    {a.notes ? <p className="mt-2 text-xs">{a.notes}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Related orders</CardTitle>
          <CardDescription>Orders matching this customer ID or phone.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No matching orders.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.orderNumber || o.id}</TableCell>
                    <TableCell>
                      {o.createdAt ? new Date(o.createdAt as string).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell>{o.total != null ? String(o.total) : '—'}</TableCell>
                    <TableCell>{o.status || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <LogActivityDialog
        open={logOpen}
        onOpenChange={setLogOpen}
        clientName={client.name || 'Client'}
        onSubmit={submitLog}
      />
    </div>
  );
};

export default CrmClientProfile;
