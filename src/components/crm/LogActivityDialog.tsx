import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CRM_ACTIVITY_TYPES,
  CRM_ACTIVITY_RESULTS,
  type CrmActivityType,
  type CrmActivityResult,
  type CrmGeoLocation,
} from '@/types/crm';
import {
  CRM_ACTIVITY_TYPE_LABELS,
  CRM_ACTIVITY_RESULT_LABELS,
} from '@/lib/crm';
import { useGeolocation } from '@/hooks/useGeolocation';
import { MapPin, Loader2 } from 'lucide-react';

export type LogActivitySubmit = {
  type: CrmActivityType;
  loggedAt: string;
  result: CrmActivityResult;
  notes: string;
  followUpAt: string | null;
  location: CrmGeoLocation | null;
  timeIn: string;
  timeOut: string | null;
  visitCompleted: boolean;
  orderTaken: boolean;
};

type LogActivityDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  onSubmit: (data: LogActivitySubmit) => Promise<void>;
  captureGps?: boolean;
};

export default function LogActivityDialog({
  open,
  onOpenChange,
  clientName,
  onSubmit,
  captureGps = true,
}: LogActivityDialogProps) {
  const { capture, loading: gpsLoading, error: gpsError } = useGeolocation();
  const [type, setType] = useState<CrmActivityType>('visit');
  const [loggedAt, setLoggedAt] = useState('');
  const [timeIn, setTimeIn] = useState('');
  const [timeOut, setTimeOut] = useState('');
  const [result, setResult] = useState<CrmActivityResult>('follow_up');
  const [notes, setNotes] = useState('');
  const [followUpAt, setFollowUpAt] = useState('');
  const [location, setLocation] = useState<CrmGeoLocation | null>(null);
  const [visitCompleted, setVisitCompleted] = useState(true);
  const [orderTaken, setOrderTaken] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const now = new Date();
      const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setLoggedAt(local);
      setTimeIn(local);
      setTimeOut('');
      setType('visit');
      setResult('follow_up');
      setNotes('');
      setFollowUpAt('');
      setLocation(null);
      setVisitCompleted(true);
      setOrderTaken(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !captureGps) return;
    capture().then(setLocation);
  }, [open, captureGps, capture]);

  const handleSave = async () => {
    if (result === 'follow_up' && !followUpAt) {
      return;
    }
    setSaving(true);
    try {
      const isoLogged = new Date(loggedAt).toISOString();
      const isoTimeIn = new Date(timeIn || loggedAt).toISOString();
      const isoTimeOut = timeOut ? new Date(timeOut).toISOString() : null;
      const isoFollow = followUpAt ? new Date(followUpAt).toISOString() : null;
      await onSubmit({
        type,
        loggedAt: isoLogged,
        result,
        notes,
        followUpAt: isoFollow,
        location,
        timeIn: isoTimeIn,
        timeOut: isoTimeOut,
        visitCompleted: type === 'visit' ? visitCompleted : false,
        orderTaken: type === 'visit' ? orderTaken : false,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const isVisit = type === 'visit';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log visit — {clientName}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as CrmActivityType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CRM_ACTIVITY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{CRM_ACTIVITY_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Date</Label>
            <Input type="datetime-local" value={loggedAt} onChange={(e) => setLoggedAt(e.target.value)} />
          </div>
          {isVisit && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Time in</Label>
                  <Input type="datetime-local" value={timeIn} onChange={(e) => setTimeIn(e.target.value)} />
                </div>
                <div>
                  <Label>Time out</Label>
                  <Input type="datetime-local" value={timeOut} onChange={(e) => setTimeOut(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <Label htmlFor="visit-completed">Visit completed</Label>
                <Switch id="visit-completed" checked={visitCompleted} onCheckedChange={setVisitCompleted} />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <Label htmlFor="order-taken">Order taken</Label>
                <Switch id="order-taken" checked={orderTaken} onCheckedChange={setOrderTaken} />
              </div>
            </>
          )}
          <div>
            <Label>Result</Label>
            <Select value={result} onValueChange={(v) => setResult(v as CrmActivityResult)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CRM_ACTIVITY_RESULTS.map((r) => (
                  <SelectItem key={r} value={r}>{CRM_ACTIVITY_RESULT_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {captureGps && (
            <div className="rounded-md border p-3 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <MapPin className="h-4 w-4" />
                GPS location
                {gpsLoading && <Loader2 className="h-3 w-3 animate-spin" />}
              </div>
              {location ? (
                <p className="text-muted-foreground mt-1">
                  {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                  {location.accuracy ? ` (±${Math.round(location.accuracy)}m)` : ''}
                </p>
              ) : (
                <p className="text-muted-foreground mt-1">{gpsError || 'Waiting for location…'}</p>
              )}
              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => capture().then(setLocation)}>
                Refresh GPS
              </Button>
            </div>
          )}
          <div>
            <Label>Follow-up date {result === 'follow_up' ? '*' : '(optional)'}</Label>
            <Input type="date" value={followUpAt} onChange={(e) => setFollowUpAt(e.target.value)} />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Visit details…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || (result === 'follow_up' && !followUpAt)}>
            {saving ? 'Saving…' : 'Save visit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
