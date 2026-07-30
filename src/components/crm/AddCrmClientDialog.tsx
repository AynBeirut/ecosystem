import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CrmRep, CrmGeoLocation } from '@/types/crm';
import { CRM_CUSTOMER_TYPES } from '@/types/crm';
import { CRM_CUSTOMER_TYPE_LABELS } from '@/lib/crm';
import { createCrmClient } from '@/lib/crmService';
import CrmLocationSelects from '@/components/crm/CrmLocationSelects';
import CrmGpsInput from '@/components/crm/CrmGpsInput';
import { crmDefaultLocation, type CrmLocationSelection } from '@/lib/crmLebanonLocations';

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
  const [customerCode, setCustomerCode] = useState('');
  const [customerType, setCustomerType] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [locationSelection, setLocationSelection] = useState<CrmLocationSelection>(crmDefaultLocation());
  const [assignedRepId, setAssignedRepId] = useState(defaultRepId || '');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [gpsLocation, setGpsLocation] = useState<CrmGeoLocation | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLocationSelection(crmDefaultLocation());
    setAssignedRepId(defaultRepId || '');
    setGpsLocation(null);
  }, [open, defaultRepId]);

  const resetForm = () => {
    setName('');
    setCustomerCode('');
    setCustomerType('');
    setPhone('');
    setEmail('');
    setLocationSelection(crmDefaultLocation());
    setGpsLocation(null);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createCrmClient(storeId, {
        name,
        customerCode,
        customerType: customerType || undefined,
        phone,
        email,
        country: locationSelection.country || undefined,
        district: locationSelection.district || undefined,
        area: locationSelection.area || undefined,
        location: gpsLocation,
        assignedRepId: assignedRepId || undefined,
        status,
      });
      onOpenChange(false);
      resetForm();
      onCreated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add customer</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Customer name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Customer code</Label>
            <Input value={customerCode} onChange={(e) => setCustomerCode(e.target.value)} placeholder="Unique ID" />
          </div>
          <div>
            <Label>Customer type</Label>
            <Select value={customerType || 'none'} onValueChange={(v) => setCustomerType(v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {CRM_CUSTOMER_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{CRM_CUSTOMER_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="sm:col-span-2 rounded-lg border border-teal-200/80 bg-teal-50/30 p-3">
            <CrmLocationSelects value={locationSelection} onChange={setLocationSelection} />
          </div>
          <div className="sm:col-span-2">
            <CrmGpsInput value={gpsLocation} onChange={setGpsLocation} />
          </div>
          <div>
            <Label>Assigned sales rep</Label>
            <Select value={assignedRepId || 'none'} onValueChange={(v) => setAssignedRepId(v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {reps.map((r) => (<SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as 'active' | 'inactive')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>{saving ? 'Saving…' : 'Add customer'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
