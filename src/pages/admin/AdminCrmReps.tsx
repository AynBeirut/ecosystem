import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import {
  fetchCrmTeamReps,
  updateTeamRepCrmSettings,
} from '@/lib/crmAssignableAgents';
import type { CrmRep } from '@/types/crm';
import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AdminPanel from '@/components/admin/AdminPanel';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Users } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AdminCrmReps() {
  const { user } = useAuth();
  const { toast } = useToast();
  const storeId = getActualStoreId(user);
  const [reps, setReps] = useState<CrmRep[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingTargets, setEditingTargets] = useState<Record<string, { territory: string; target: string }>>({});

  const loadReps = useCallback(async () => {
    if (!storeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = (await fetchCrmTeamReps(storeId))
        .filter((r) => !r.id.startsWith('owner:'))
        .sort((a, b) => a.name.localeCompare(b.name));
      setReps(list);
      const edits: Record<string, { territory: string; target: string }> = {};
      for (const r of list) {
        edits[r.id] = {
          territory: r.assignedTerritory || '',
          target: r.dailyVisitTarget != null ? String(r.dailyVisitTarget) : '',
        };
      }
      setEditingTargets(edits);
    } catch (err) {
      toast({
        title: 'Could not load team',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [storeId, toast]);

  useEffect(() => {
    void loadReps();
  }, [loadReps]);

  const saveRepSettings = async (rep: CrmRep) => {
    const edit = editingTargets[rep.id];
    if (!edit) return;
    setSavingId(rep.id);
    try {
      await updateTeamRepCrmSettings(rep.id, {
        assignedTerritory: edit.territory.trim() || null,
        dailyVisitTarget: edit.target.trim() ? parseInt(edit.target, 10) : null,
      });
      toast({ title: 'Rep settings saved' });
      await loadReps();
    } catch (err) {
      toast({
        title: 'Update failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPanel>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Sales reps
          </CardTitle>
          <CardDescription>
            Set territory and daily visit target for your field team. To add logins, use{' '}
            <Link to="/admin/sub-accounts" className="text-primary underline underline-offset-2">
              Team → Sub-accounts
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading team…</p>
          ) : reps.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No sales team yet. Add sales accounts under Team → Sub-accounts, then set targets here.
            </p>
          ) : (
            <ul className="divide-y rounded-md border bg-white">
              {reps.map((rep) => (
                <li key={rep.id} className="px-4 py-4 gap-3 space-y-3">
                  <div>
                    <p className="font-medium">{rep.name}</p>
                    {rep.email ? <p className="text-sm text-muted-foreground">{rep.email}</p> : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3 items-end">
                    <div>
                      <Label className="text-xs">Assigned territory</Label>
                      <Input
                        value={editingTargets[rep.id]?.territory ?? ''}
                        onChange={(e) =>
                          setEditingTargets((prev) => ({
                            ...prev,
                            [rep.id]: {
                              territory: e.target.value,
                              target: prev[rep.id]?.target ?? '',
                            },
                          }))
                        }
                        placeholder="e.g. Metn"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Daily visit target</Label>
                      <Input
                        type="number"
                        min="0"
                        value={editingTargets[rep.id]?.target ?? ''}
                        onChange={(e) =>
                          setEditingTargets((prev) => ({
                            ...prev,
                            [rep.id]: {
                              territory: prev[rep.id]?.territory ?? '',
                              target: e.target.value,
                            },
                          }))
                        }
                        placeholder="35"
                      />
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={savingId === rep.id}
                      onClick={() => void saveRepSettings(rep)}
                    >
                      {savingId === rep.id ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </AdminPanel>
    </div>
  );
}
