import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import { fetchCrmClients, type CrmClient } from '@/lib/crmService';
import {
  agentDisplayName,
  fetchCrmAssignableAgents,
} from '@/lib/crmAssignableAgents';
import {
  buildStopsFromClients,
  createVisitRoute,
  fetchVisitRoute,
  REPEAT_LABELS,
  toDateYmd,
  updateVisitRoute,
  type VisitRouteRepeat,
} from '@/lib/crmVisitRouteService';
import { useToast } from '@/hooks/use-toast';
import { resolveAuthActorId } from '@/lib/authActorId';
import { cn } from '@/lib/utils';

const REPEAT_OPTIONS: VisitRouteRepeat[] = ['none', 'weekly', 'every_15_days', 'monthly'];

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

const CrmVisitRouteForm: React.FC = () => {
  const location = useLocation();
  const editMatch = location.pathname.match(/\/visit-routes\/([^/]+)\/edit$/);
  const routeId = editMatch?.[1];
  const isEdit = Boolean(routeId);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const storeId = getActualStoreId(user);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agents, setAgents] = useState<Awaited<ReturnType<typeof fetchCrmAssignableAgents>>>([]);
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [title, setTitle] = useState('');
  const [dateMode, setDateMode] = useState<'today' | 'tomorrow' | 'pick'>('today');
  const [pickDate, setPickDate] = useState(() => toDateYmd(new Date()));
  const [repeatRule, setRepeatRule] = useState<VisitRouteRepeat>('none');
  const [assignedRepId, setAssignedRepId] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const visitDate = useMemo(() => {
    if (dateMode === 'today') return toDateYmd(new Date());
    if (dateMode === 'tomorrow') return toDateYmd(addDays(new Date(), 1));
    return pickDate || toDateYmd(new Date());
  }, [dateMode, pickDate]);

  const load = useCallback(async () => {
    if (!storeId || !user) {
      setLoading(false);
      return;
    }
    try {
      const [agentList, clientList] = await Promise.all([
        fetchCrmAssignableAgents(storeId),
        fetchCrmClients(storeId, { crmOnly: false }),
      ]);
      setAgents(agentList);
      setClients(clientList.filter((c) => c.status !== 'inactive'));

      if (isEdit && routeId) {
        const existing = await fetchVisitRoute(routeId);
        if (!existing || existing.storeId !== storeId) {
          toast({ title: 'Route not found', variant: 'destructive' });
          navigate('/admin/crm/map');
          return;
        }
        setTitle(existing.title);
        setRepeatRule(existing.repeatRule);
        setAssignedRepId(existing.assignedRepId);
        setSelectedIds(new Set(existing.stops.map((s) => s.clientId)));
        const today = toDateYmd(new Date());
        if (existing.visitDate === today) setDateMode('today');
        else if (existing.visitDate === toDateYmd(addDays(new Date(), 1))) setDateMode('tomorrow');
        else {
          setDateMode('pick');
          setPickDate(existing.visitDate);
        }
      } else {
        const defaultRep = agentList.find((a) => a.role !== 'owner')?.id || agentList[0]?.id || '';
        setAssignedRepId(defaultRep);
      }
    } catch (e) {
      toast({
        title: 'Load failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [storeId, user, isEdit, routeId, navigate, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        (c.name || '').toLowerCase().includes(q)
        || (c.phone || '').includes(q)
        || (c.district || '').toLowerCase().includes(q)
        || (c.area || '').toLowerCase().includes(q),
    );
  }, [clients, search]);

  const selectedClients = useMemo(
    () => clients.filter((c) => selectedIds.has(c.id)),
    [clients, selectedIds],
  );

  const toggleClient = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    if (!storeId || !user || !assignedRepId) {
      toast({ title: 'Select a sales agent', variant: 'destructive' });
      return;
    }
    if (selectedIds.size === 0) {
      toast({ title: 'Select at least one client', variant: 'destructive' });
      return;
    }
    const chosen = clients.filter((c) => selectedIds.has(c.id));
    setSaving(true);
    try {
      const assignedUserId = agents.find((a) => a.id === assignedRepId)?.userId;
      const payload = {
        storeId,
        title: title.trim() || `Route · ${visitDate}`,
        assignedRepId,
        assignedRepName:
          agentDisplayName(agents, assignedRepId) || user.name || resolveAuthActorId(user) || 'Sales',
        visitDate,
        repeatRule,
        stops: buildStopsFromClients(chosen),
        assignedUserId,
      };
      if (isEdit && routeId) {
        await updateVisitRoute({ routeId, ...payload });
        navigate(`/admin/crm/visit-routes/${routeId}?date=${visitDate}`);
      } else {
        const createdBy = resolveAuthActorId(user);
        if (!createdBy) {
          throw new Error('Sign in again — missing user id for audit trail');
        }
        const newId = await createVisitRoute({ ...payload, createdBy });
        navigate(`/admin/crm/visit-routes/${newId}?date=${visitDate}`);
      }
    } catch (e) {
      toast({
        title: 'Save failed',
        description: e instanceof Error ? e.message : 'Could not save route',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const chipBtn = (active: boolean) =>
    cn('rounded-full px-3 py-1.5 text-sm border transition-colors', active
      ? 'bg-primary text-primary-foreground border-primary'
      : 'bg-muted/50 hover:bg-muted border-transparent');

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button type="button" variant="ghost" size="sm" asChild>
        <Link to="/admin/crm/map">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Map & pipeline
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{isEdit ? 'Edit visit route' : 'Create visit route'}</CardTitle>
          <CardDescription>Set date, agent, and clients for this route.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Route name (optional)</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Beirut east · Tuesday"
            />
          </div>

          <div>
            <Label>Visit date</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {(['today', 'tomorrow', 'pick'] as const).map((mode) => (
                <button key={mode} type="button" className={chipBtn(dateMode === mode)} onClick={() => setDateMode(mode)}>
                  {mode === 'today' ? 'Today' : mode === 'tomorrow' ? 'Tomorrow' : 'Pick date'}
                </button>
              ))}
            </div>
            {dateMode === 'pick' ? (
              <Input type="date" value={pickDate} onChange={(e) => setPickDate(e.target.value)} className="mt-2 w-[200px]" />
            ) : (
              <p className="text-sm mt-2">📅 {visitDate}</p>
            )}
          </div>

          <div>
            <Label>Repeat</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {REPEAT_OPTIONS.map((r) => (
                <button key={r} type="button" className={chipBtn(repeatRule === r)} onClick={() => setRepeatRule(r)}>
                  {REPEAT_LABELS[r]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Sales agent</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {agents.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={chipBtn(assignedRepId === a.id)}
                  onClick={() => setAssignedRepId(a.id)}
                >
                  {a.name}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Clients ({selectedIds.size} selected)
          </CardTitle>
          <div className="flex gap-2 text-sm">
            <button
              type="button"
              className="text-primary font-medium"
              onClick={() => setSelectedIds(new Set(filteredClients.map((c) => c.id)))}
            >
              Select shown
            </button>
            <span className="text-muted-foreground">·</span>
            <button type="button" className="text-primary font-medium" onClick={() => setSelectedIds(new Set())}>
              Clear
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, district…"
          />
          {selectedClients.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selectedClients.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="rounded-full px-2 py-1 text-xs bg-primary/10 border border-primary text-primary"
                  onClick={() => toggleClient(c.id)}
                >
                  {c.name || 'Unnamed'} ×
                </button>
              ))}
            </div>
          ) : null}
          <ScrollArea className="h-[320px] border rounded-md">
            <ul className="divide-y">
              {filteredClients.map((c) => {
                const checked = selectedIds.has(c.id);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={cn(
                        'w-full flex items-start gap-3 px-3 py-2 text-left hover:bg-muted/50',
                        checked && 'bg-primary/5',
                      )}
                      onClick={() => toggleClient(c.id)}
                    >
                      <Checkbox checked={checked} className="mt-1 pointer-events-none" />
                      <div>
                        <p className="font-medium text-sm">{c.name || 'Unnamed'}</p>
                        <p className="text-xs text-muted-foreground">
                          {[c.district, c.area].filter(Boolean).join(' · ') || '—'}
                          {c.location?.lat != null ? '' : ' · No GPS'}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="button" onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {isEdit ? 'Save route' : 'Create route'}
        </Button>
      </div>
    </div>
  );
};

export default CrmVisitRouteForm;
