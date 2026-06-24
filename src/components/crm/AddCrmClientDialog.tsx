import React, { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CrmRep } from '@/types/crm';
import { createCrmClient } from '@/lib/crmService';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  reps: CrmRep[];
  defaultRepId?: string;
  onCreated: () => void;
};

export default function AddCrmClientDialog({ open, onOpenChange, storeId, reps, defaultRepId, onCreated }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [assignedRepId, setAssignedRepId] = useState(defaultRepId || '');
  const [dealValue, setDealValue] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createCrmClient(storeId, {
        name,
        phone,
        email,
        assignedRepId: assignedRepId || undefined,
        dealValue: dealValue ? parseFloat(dealValue) : undefined,
      });
      onOpenChange(false);
      onCreated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add CRM client</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label>Assigned rep</Label>
            <Select value={assignedRepId || 'none'} onValueChange={(v) => setAssignedRepId(v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {reps.map((r) => (<SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Deal value (USD)</Label><Input type="number" min="0" step="0.01" value={dealValue} onChange={(e) => setDealValue(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>{saving ? 'Saving…' : 'Add client'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
