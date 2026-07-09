import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KanbanSquare, Plus, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useCrmStore } from '@/hooks/useCrmStore';
import { CRM_PIPELINE_STAGES } from '@/types/crm';
import { CRM_PIPELINE_LABELS } from '@/lib/crm';
import { setPipelineStage, type CrmClient } from '@/lib/crmService';
import AddCrmClientDialog from '@/components/crm/AddCrmClientDialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

function stageOf(c: CrmClient): (typeof CRM_PIPELINE_STAGES)[number] {
  const s = c.pipelineStage;
  if (s && CRM_PIPELINE_STAGES.includes(s as (typeof CRM_PIPELINE_STAGES)[number])) {
    return s as (typeof CRM_PIPELINE_STAGES)[number];
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
  const [crmOnly, setCrmOnly] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const { clients, reps, loading, storeId, reload, setClients } = useCrmStore({ crmOnly });

  const repName = useMemo(() => {
    const m = new Map(reps.map((r) => [r.id, r.name]));
    return (id: string | null | undefined) => (id ? m.get(id) ?? '—' : '—');
  }, [reps]);

  const byStage = useMemo(() => {
    const map = new Map<(typeof CRM_PIPELINE_STAGES)[number], CrmClient[]>();
    for (const st of CRM_PIPELINE_STAGES) map.set(st, []);
    for (const c of clients) {
      const st = stageOf(c);
      map.get(st)!.push(c);
    }
    return map;
  }, [clients]);

  const handleDrop = async (e: React.DragEvent, stage: (typeof CRM_PIPELINE_STAGES)[number]) => {
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

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {CRM_PIPELINE_STAGES.map((stage) => (
            <div
              key={stage}
              className="min-w-[260px] max-w-[280px] flex-shrink-0 rounded-lg border bg-muted/30 p-2"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => void handleDrop(e, stage)}
            >
              <div className="mb-2 px-1 font-medium text-sm text-muted-foreground">
                {CRM_PIPELINE_LABELS[stage]}
                <span className="ml-1 text-xs">({byStage.get(stage)?.length ?? 0})</span>
              </div>
              <div className="flex flex-col gap-2 min-h-[120px]">
                {(byStage.get(stage) ?? []).map((c) => (
                  <PipelineCard
                    key={c.id}
                    client={c}
                    repLabel={repName(c.assignedRepId)}
                    onNavigate={() => navigate(`/admin/crm/clients/${c.id}`)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {storeId && (
        <AddCrmClientDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          storeId={storeId}
          reps={reps}
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
          <span className="font-medium text-foreground/80">Next follow-up:</span>{' '}
          {formatFollowUp(client.nextFollowUpAt)}
        </p>
      </CardContent>
    </Card>
  );
}

export default CrmPipeline;
