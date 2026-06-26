import React, { useCallback, useEffect, useState } from 'react';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import { getApiBaseUrl } from '@/lib/apiBase';
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
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

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

      const data = (await response.json()) as { success?: boolean; error?: string; email?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create CRM rep');
      }

      setName('');
      setEmail('');
      setPhone('');
      setPassword('');
      toast({
        title: 'CRM rep created',
        description: `${data.email || email.trim()} can sign in on web or mobile. Your session was not affected.`,
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
            CRM reps
          </CardTitle>
          <CardDescription>
            Rep accounts are created on the server (Admin SDK). Your owner login stays active — no sign-out when adding a rep.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                <li key={rep.id} className="flex items-center justify-between px-4 py-3 gap-2 flex-wrap">
                  <div>
                    <p className="font-medium">{rep.name}</p>
                    <p className="text-sm text-muted-foreground">{rep.email}</p>
                    {rep.firebaseUid ? (
                      <p className="text-xs text-muted-foreground font-mono mt-1">Auth linked</p>
                    ) : (
                      <p className="text-xs text-amber-700 mt-1">No login linked</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={rep.status === 'active' ? 'default' : 'secondary'}>{rep.status}</Badge>
                    <Button variant="outline" size="sm" onClick={() => void toggleStatus(rep)}>
                      {rep.status === 'active' ? 'Suspend' : 'Activate'}
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
