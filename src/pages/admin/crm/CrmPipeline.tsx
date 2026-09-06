import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KanbanSquare, Plus, Loader2, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCrmStore } from '@/hooks/useCrmStore';
import { useAuth } from '@/context/useAuth';
import { CRM_PIPELINE_STAGES, type CrmPipelineStage } from '@/types/crm';
import { CRM_PIPELINE_LABELS } from '@/lib/crm';
import { agentsForMapFilterChips } from '@/lib/crmAssignableAgents';
import { setPipelineStage, type CrmClient } from '@/lib/crmService';
import AddCrmClientDialog from '@/components/crm/AddCrmClientDialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

const ACTIVE_STAGES: CrmPipelineStage[] = [
  'new_lead',
  'contacted',
  'interested',
  'proposal_sent',
  'negotiation',
];

function stageOf(c: CrmClient): CrmPipelineStage {
  const s = c.pipelineStage;
  if (s && CRM_PIPELINE_STAGES.includes(s as CrmPipelineStage)) {
    return s as CrmPipelineStage;
  }
  return 'new_lead';
}

function formatMoney(v: number | null | undefined, cur?: string | null) {
  if (v == null || Number.isNaN(v)) return '—';
  const c = cur || 'USD';
  return `${c} ${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatFollowUp(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

const CrmPipeline: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [crmOnly, setCrmOnly] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [repFilter, setRepFilter] = useState('all');
  const [stageScope, setStageScope] = useState<'active' | 'all' | CrmPipelineStage>('active');
  const [focusStage, setFocusStage] = useState<CrmPipelineStage | 'all'>('all');
  const { clients, reps, loading, storeId, reload, setClients } = useCrmStore({ crmOnly });

  const filterAgents = useMemo(
    () =>
      agentsForMapFilterChips(
        reps.map((r) => ({
          id: r.id,
          name: r.name,
          email: r.email,
          role: r.id.startsWith('sub:') ? 'sales' : 'crm_rep',
        })),
      ),
    [reps],
  );

  const repName = useMemo(() => {
    const m = new Map(reps.map((r) => [r.id, r.name]));
    return (id: string | null | undefined) => (id ? m.get(id) ?? '—' : '—');
  }, [reps]);

  const visibleStages = useMemo(() => {
    if (stageScope === 'all') return [...CRM_PIPELINE_STAGES];
    if (stageScope === 'active') return ACTIVE_STAGES;
    return [stageScope];
  }, [stageScope]);

  const displayStages = useMemo(() => {
    if (focusStage === 'all') return visibleStages;
    return visibleStages.includes(focusStage) ? [focusStage] : visibleStages;
  }, [visibleStages, focusStage]);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (c.status === 'inactive') return false;
      if (repFilter !== 'all' && c.assignedRepId !== repFilter) return false;
      if (!visibleStages.includes(stageOf(c))) return false;
      if (!q) return true;
      const hay = [c.name, c.phone, c.customerCode, c.district, c.area]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [clients, repFilter, search, visibleStages]);

  const byStage = useMemo(() => {
    const map = new Map<CrmPipelineStage, CrmClient[]>();
    for (const st of CRM_PIPELINE_STAGES) map.set(st, []);
    for (const c of filteredClients) {
      map.get(stageOf(c))!.push(c);
    }
    return map;
  }, [filteredClients]);

  const totalShown = filteredClients.length;

  const handleDrop = async (e: React.DragEvent, stage: CrmPipelineStage) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (!id) return;
    const client = clients.find((c) => c.id === id);
    if (!client || stageOf(client) === stage) return;
    try {
      await setPipelineStage(id, stage);
      setClients((prev) =>
        prev.map((c) => (c.id === id ? { ...c, pipelineStage: stage, crmEnabled: true } : c)),
      );
      toast({ title: 'Stage updated' });
    } catch (err) {
      toast({
        title: 'Could not update stage',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
      await reload();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <KanbanSquare className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-semibold">Pipeline</h2>
          <span className="text-sm text-muted-foreground">({totalShown} clients)</span>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch id="crm-only" checked={crmOnly} onCheckedChange={setCrmOnly} />
            <Label htmlFor="crm-only" className="text-sm text-muted-foreground cursor-pointer">
              CRM clients only
            </Label>
          </div>
          <Button onClick={() => setAddOpen(true)} disabled={!storeId}>
            <Plus className="h-4 w-4 mr-2" />
            Add client
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 items-end pb-4">
          <div className="min-w-[200px] flex-1">
            <Label className="text-xs">Search</Label>
            <div className="relative mt-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Name, phone, area…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="min-w-[160px]">
            <Label className="text-xs">Sales agent</Label>
            <Select value={repFilter} onValueChange={setRepFilter}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All agents</SelectItem>
                {filterAgents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[160px]">
            <Label className="text-xs">Stage group</Label>
            <Select
              value={stageScope}
              onValueChange={(v) => {
                setStageScope(v as typeof stageScope);
                setFocusStage('all');
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active pipeline</SelectItem>
                <SelectItem value="all">All stages</SelectItem>
                {CRM_PIPELINE_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>{CRM_PIPELINE_LABELS[s]} only</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[160px]">
            <Label className="text-xs">Focus column</Label>
            <Select value={focusStage} onValueChange={(v) => setFocusStage(v as typeof focusStage)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All visible columns</SelectItem>
                {visibleStages.map((s) => (
                  <SelectItem key={s} value={s}>{CRM_PIPELINE_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : totalShown === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No clients match these filters. Widen stage group or clear search.
          </CardContent>
        </Card>
      ) : (
        <div
          className={cn(
            'gap-3 pb-4',
            displayStages.length === 1
              ? 'grid grid-cols-1 max-w-xl mx-auto'
              : 'flex overflow-x-auto',
          )}
        >
          {displayStages.map((stage) => {
            const stageClients = byStage.get(stage) ?? [];
            return (
              <div
                key={stage}
                className={cn(
                  'flex-shrink-0 rounded-lg border bg-muted/30 p-2',
                  displayStages.length === 1 ? 'w-full' : 'min-w-[260px] max-w-[300px]',
                )}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => void handleDrop(e, stage)}
              >
                <div className="mb-2 px-1 font-medium text-sm text-muted-foreground flex justify-between">
                  <span>{CRM_PIPELINE_LABELS[stage]}</span>
                  <span className="text-xs">({stageClients.length})</span>
                </div>
                <ScrollArea className={displayStages.length === 1 ? 'h-[65vh]' : 'h-[58vh]'}>
                  <div className="flex flex-col gap-2 pr-2">
                    {stageClients.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-1 py-4 text-center">Empty</p>
                    ) : (
                      stageClients.map((c) => (
                        <PipelineCard
                          key={c.id}
                          client={c}
                          repLabel={repName(c.assignedRepId)}
                          onNavigate={() => navigate(`/admin/crm/clients/${c.id}`)}
                        />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            );
          })}
        </div>
      )}

      {storeId && (
        <AddCrmClientDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          storeId={storeId}
          reps={reps}
          userId={user?.id}
          onCreated={() => void reload()}
        />
      )}
    </div>
  );
};

type PipelineCardProps = {
  client: CrmClient;
  repLabel: string;
  onNavigate: () => void;
};

function PipelineCard({ client, repLabel, onNavigate }: PipelineCardProps) {
  const ignoreClick = useRef(false);

  return (
    <Card
      className={cn('cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow')}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', client.id);
        e.dataTransfer.effectAllowed = 'move';
        ignoreClick.current = false;
      }}
      onDragEnd={() => {
        ignoreClick.current = true;
        window.setTimeout(() => {
          ignoreClick.current = false;
        }, 0);
      }}
      onClick={() => {
        if (ignoreClick.current) return;
        onNavigate();
      }}
    >
      <CardHeader className="p-3 pb-0">
        <CardTitle className="text-sm font-semibold leading-tight">{client.name || 'Unnamed'}</CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-2 text-xs text-muted-foreground space-y-1">
        <p>
          <span className="font-medium text-foreground/80">Rep:</span> {repLabel}
        </p>
        <p>
          <span className="font-medium text-foreground/80">Deal:</span>{' '}
          {formatMoney(client.dealValue ?? null, client.dealCurrency)}
        </p>
        <p>
          <span className="font-medium text-foreground/80">Follow-up:</span>{' '}
          {formatFollowUp(client.nextFollowUpAt)}
        </p>
      </CardContent>
    </Card>
  );
}

export default CrmPipeline;
