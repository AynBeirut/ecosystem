import React, { useEffect, useState } from 'react';
import CrmAddonGate from '@/components/crm/CrmAddonGate';
import MobileHeader from '@/components/MobileHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { useCrmStore } from '@/hooks/useCrmStore';
import { isFollowUpOverdue } from '@/lib/crmService';
import LogActivityDialog, { type LogActivitySubmit } from '@/components/crm/LogActivityDialog';
import { logCrmActivity } from '@/lib/crmService';
import { useToast } from '@/hooks/use-toast';
import { CRM_PIPELINE_LABELS } from '@/lib/crm';
import type { CrmClient } from '@/lib/crmService';
import { cn } from '@/lib/utils';
import { ArrowLeft, ClipboardList, Phone } from 'lucide-react';
import type { CrmPipelineStage } from '@/types/crm';
import { CRM_PIPELINE_STAGES } from '@/types/crm';

function stageLabel(c: CrmClient): string {
  const s = c.pipelineStage;
  if (s && CRM_PIPELINE_STAGES.includes(s as CrmPipelineStage)) {
    return CRM_PIPELINE_LABELS[s as CrmPipelineStage];
  }
  return CRM_PIPELINE_LABELS.new_lead;
}

function formatFollowUp(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

export default function CrmRepPortal() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { clients, loading, reload, storeId } = useCrmStore({ crmOnly: true });
  const [selected, setSelected] = useState<CrmClient | null>(null);
  const [logOpen, setLogOpen] = useState(false);

  useEffect(() => {
    if (!selected) return;
    const fresh = clients.find((c) => c.id === selected.id);
    if (fresh) setSelected(fresh);
  }, [clients, selected?.id]);

  const submitLog = async (data: LogActivitySubmit) => {
    if (!selected || !storeId || !user?.crmRepId || !user?.id) return;
    await logCrmActivity({
      storeId,
      customerId: selected.id,
      repId: user.crmRepId,
      repName: user.name || 'Rep',
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
    await reload();
    setLogOpen(false);
  };

  return (
    <CrmAddonGate>
      <div className="min-h-screen bg-gray-50">
        {isMobile ? (
          <MobileHeader title="Sales CRM" showBackButton={false} showHomeButton={false} />
        ) : (
          <div className="container mx-auto px-4 pt-6">
            <h1 className="text-2xl font-bold">Sales CRM</h1>
            <p className="text-sm text-muted-foreground mt-1">Hello, {user?.name}</p>
          </div>
        )}
        <main className="container mx-auto px-4 py-6 max-w-3xl">
          {!selected ? (
            <Card>
              <CardHeader>
                <CardTitle>Your clients</CardTitle>
                <CardDescription>
                  The pipeline advances when you log activities. You cannot change stages manually here.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : clients.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No assigned CRM clients yet.</p>
                ) : (
                  <ul className="divide-y rounded-md border bg-white">
                    {clients.map((c) => {
                      const overdue = isFollowUpOverdue(c);
                      return (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => setSelected(c)}
                            className="w-full text-left px-4 py-3 flex flex-col gap-1 hover:bg-muted/40 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">{c.name || 'Unnamed'}</span>
                              {overdue ? (
                                <Badge variant="destructive" className="shrink-0">Overdue</Badge>
                              ) : null}
                            </div>
                            <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                              <span>{stageLabel(c)}</span>
                              <span>Follow-up: {formatFollowUp(c.nextFollowUpAt)}</span>
                              {c.dealValue != null ? (
                                <span>${c.dealValue.toLocaleString()}</span>
                              ) : null}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <Button variant="ghost" size="sm" className="gap-1" onClick={() => setSelected(null)}>
                <ArrowLeft className="h-4 w-4" />
                All clients
              </Button>
              <Card>
                <CardHeader>
                  <CardTitle>{selected.name || 'Client'}</CardTitle>
                  <CardDescription className="space-y-1">
                    <span className="flex items-center gap-2">
                      <Phone className="h-3 w-3" />
                      {selected.phone || '—'} · {selected.email || '—'}
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div
                    className={cn(
                      'rounded-lg border p-3 space-y-1',
                      isFollowUpOverdue(selected) && 'border-destructive/50 bg-destructive/5',
                    )}
                  >
                    <p>
                      <span className="text-muted-foreground">Stage:</span>{' '}
                      <span className="font-medium">{stageLabel(selected)}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Next follow-up:</span>{' '}
                      {formatFollowUp(selected.nextFollowUpAt)}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Deal:</span>{' '}
                      {selected.dealValue != null
                        ? `${selected.dealCurrency || 'USD'} ${selected.dealValue.toLocaleString()}`
                        : '—'}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => setLogOpen(true)}>
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Log activity
                  </Button>
                </CardContent>
              </Card>

              <LogActivityDialog
                open={logOpen}
                onOpenChange={setLogOpen}
                clientName={selected.name || 'Client'}
                onSubmit={submitLog}
              />
            </div>
          )}
        </main>
      </div>
    </CrmAddonGate>
  );
}
