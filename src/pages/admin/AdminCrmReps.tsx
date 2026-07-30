import React, { useCallback, useEffect, useState } from 'react';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import { getApiBaseUrl } from '@/lib/apiBase';
import { updateCrmRep } from '@/lib/crmService';
import type { CrmRep } from '@/types/crm';
import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AdminPanel from '@/components/admin/AdminPanel';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Users, Plus } from 'lucide-react';

export default function AdminCrmReps() {
  const { user } = useAuth();
  const { toast } = useToast();
  const storeId = getActualStoreId(user);
  const [reps, setReps] = useState<CrmRep[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [assignedTerritory, setAssignedTerritory] = useState('');
  const [dailyVisitTarget, setDailyVisitTarget] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingTargets, setEditingTargets] = useState<Record<string, { territory: string; target: string }>>({});

  const loadReps = useCallback(async () => {
    if (!storeId) {
      setLoading(false);
      return;
    }
    const db = getFirestore();
    const snap = await getDocs(query(collection(db, 'crmReps'), where('storeId', '==', storeId)));
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CrmRep));
    list.sort((a, b) => a.name.localeCompare(b.name));
    setReps(list);
    const edits: Record<string, { territory: string; target: string }> = {};
    for (const r of list) {
      edits[r.id] = {
        territory: r.assignedTerritory || '',
        target: r.dailyVisitTarget != null ? String(r.dailyVisitTarget) : '',
      };
    }
    setEditingTargets(edits);
    setLoading(false);
  }, [storeId]);

  useEffect(() => {
    void loadReps();
  }, [loadReps]);

  const handleAdd = async () => {
    if (!storeId || !user?.id) return;
    if (!name.trim() || !email.trim() || !password.trim()) {
      toast({ title: 'Name, email, and password are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const currentUser = getAuth().currentUser;
      if (!currentUser) {
        throw new Error('You must be signed in as the store owner');
      }
      const token = await currentUser.getIdToken();
      const apiUrl = getApiBaseUrl();
      const response = await fetch(`${apiUrl}/crm/reps/create`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          storeId,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          password,
        }),
      });

      const data = (await response.json()) as { success?: boolean; error?: string; email?: string; repId?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create CRM rep');
      }

      if (data.repId && (assignedTerritory.trim() || dailyVisitTarget.trim())) {
        await updateCrmRep(data.repId, {
          assignedTerritory: assignedTerritory.trim() || null,
          dailyVisitTarget: dailyVisitTarget.trim() ? parseInt(dailyVisitTarget, 10) : null,
        });
      }

      setName('');
      setEmail('');
      setPhone('');
      setAssignedTerritory('');
      setDailyVisitTarget('');
      setPassword('');
      toast({
        title: 'CRM rep created',
        description: `${data.email || email.trim()} can sign in on web or mobile.`,
        duration: 6000,
      });
      await loadReps();
    } catch (err: unknown) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const saveRepSettings = async (rep: CrmRep) => {
    const edit = editingTargets[rep.id];
    if (!edit) return;
    try {
      await updateCrmRep(rep.id, {
        assignedTerritory: edit.territory.trim() || null,
        dailyVisitTarget: edit.target.trim() ? parseInt(edit.target, 10) : null,
      });
      toast({ title: 'Rep updated' });
      await loadReps();
    } catch (err) {
      toast({
        title: 'Update failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const toggleStatus = async (rep: CrmRep) => {
    const db = getFirestore();
    await updateDoc(doc(db, 'crmReps', rep.id), {
      status: rep.status === 'active' ? 'suspended' : 'active',
      updatedAt: new Date().toISOString(),
    });
    await loadReps();
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
            Rep accounts for field visits. Set territory and daily visit target for the morning dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label htmlFor="rep-name">Name</Label>
              <Input id="rep-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="rep-email">Email</Label>
              <Input id="rep-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="rep-phone">Phone</Label>
              <Input id="rep-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="rep-territory">Assigned territory</Label>
              <Input id="rep-territory" value={assignedTerritory} onChange={(e) => setAssignedTerritory(e.target.value)} placeholder="e.g. Metn" />
            </div>
            <div>
              <Label htmlFor="rep-target">Daily visit target</Label>
              <Input id="rep-target" type="number" min="0" value={dailyVisitTarget} onChange={(e) => setDailyVisitTarget(e.target.value)} placeholder="35" />
            </div>
            <div>
              <Label htmlFor="rep-password">Password</Label>
              <Input
                id="rep-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
              />
            </div>
          </div>
          <Button onClick={() => void handleAdd()} disabled={saving}>
            <Plus className="h-4 w-4 mr-2" />
            {saving ? 'Adding...' : 'Add rep'}
          </Button>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : reps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No CRM reps yet.</p>
          ) : (
            <ul className="divide-y rounded-md border bg-white">
              {reps.map((rep) => (
                <li key={rep.id} className="px-4 py-4 gap-3 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-medium">{rep.name}</p>
                      <p className="text-sm text-muted-foreground">{rep.email}</p>
                      {rep.phone ? <p className="text-sm text-muted-foreground">{rep.phone}</p> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={rep.status === 'active' ? 'default' : 'secondary'}>{rep.status}</Badge>
                      <Button variant="outline" size="sm" onClick={() => void toggleStatus(rep)}>
                        {rep.status === 'active' ? 'Suspend' : 'Activate'}
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3 items-end">
                    <div>
                      <Label className="text-xs">Territory</Label>
                      <Input
                        value={editingTargets[rep.id]?.territory ?? ''}
                        onChange={(e) =>
                          setEditingTargets((prev) => ({
                            ...prev,
                            [rep.id]: { ...prev[rep.id], territory: e.target.value, target: prev[rep.id]?.target ?? '' },
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Daily target</Label>
                      <Input
                        type="number"
                        min="0"
                        value={editingTargets[rep.id]?.target ?? ''}
                        onChange={(e) =>
                          setEditingTargets((prev) => ({
                            ...prev,
                            [rep.id]: { territory: prev[rep.id]?.territory ?? '', target: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => void saveRepSettings(rep)}>
                      Save settings
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
