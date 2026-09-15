import React, { useEffect, useState } from 'react';
import { getFirestore } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  addStaffPresenceDate,
  countPresenceDays,
  defaultPresenceDateInput,
  getPresenceEntries,
  isValidPresenceDate,
  maxPresenceDate,
  removeStaffPresenceDate,
  totalPresenceHours,
  type StaffPresenceEntry,
  type StaffPresenceRecord,
} from '@/lib/staffPresence';
import {
  formatStaffPayLine,
  formatStaffRoleLabel,
  resolvePaymentFrequency,
  type StaffPayrollRecord,
} from '@/lib/staffPayrollDisplay';

type StaffPresenceEditorProps = {
  staff: StaffPayrollRecord;
  month: string;
  storeId: string;
  record?: StaffPresenceRecord | null;
  actor: { id: string; name: string };
  onUpdated: (record: StaffPresenceRecord) => void;
};

const formatPresenceDay = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

export default function StaffPresenceEditor({
  staff,
  month,
  storeId,
  record,
  actor,
  onUpdated,
}: StaffPresenceEditorProps) {
  const { toast } = useToast();
  const [dateInput, setDateInput] = useState(defaultPresenceDateInput(month));
  const [hoursInput, setHoursInput] = useState('');
  const [saving, setSaving] = useState(false);

  const freq = resolvePaymentFrequency(staff);
  const entries = getPresenceEntries(record);
  const minDate = `${month}-01`;
  const maxDate = maxPresenceDate(month);

  useEffect(() => {
    setDateInput(defaultPresenceDateInput(month));
    setHoursInput('');
  }, [month, staff.id]);

  const handleAdd = async () => {
    if (saving) return;
    const date = dateInput.trim();
    if (!isValidPresenceDate(date, month)) {
      toast({
        title: 'Invalid date',
        description: `Choose a day in ${month} — today or earlier only.`,
        variant: 'destructive',
      });
      return;
    }
    if (entries.some((entry) => entry.date === date)) {
      toast({ title: 'Already marked', description: `${formatPresenceDay(date)} is already logged.` });
      return;
    }

    const hours = hoursInput.trim() ? Number(hoursInput) : undefined;
    if (freq === 'hourly' && hours != null && (!Number.isFinite(hours) || hours <= 0)) {
      toast({ title: 'Invalid hours', description: 'Enter hours worked or leave blank.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const db = getFirestore();
      const next = await addStaffPresenceDate(db, {
        storeId,
        staffId: staff.id,
        staffName: staff.name || staff.staffName || 'Employee',
        month,
        date,
        hours: freq === 'hourly' ? hours : undefined,
        existingDates: record?.dates || [],
        existingEntries: entries,
        actor,
      });
      onUpdated(next);
      toast({ title: 'Saved', description: `Present on ${formatPresenceDay(date)}` });
      setDateInput(defaultPresenceDateInput(month));
      setHoursInput('');
    } catch (error) {
      toast({
        title: 'Could not save',
        description: error instanceof Error ? error.message : 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (date: string) => {
    if (saving) return;
    setSaving(true);
    try {
      const db = getFirestore();
      const next = await removeStaffPresenceDate(db, {
        storeId,
        staffId: staff.id,
        staffName: staff.name || staff.staffName || 'Employee',
        month,
        date,
        existingDates: record?.dates || entries.map((entry) => entry.date),
        existingEntries: entries,
        actor,
      });
      onUpdated(next);
      toast({ title: 'Removed', description: formatPresenceDay(date) });
    } catch (error) {
      toast({
        title: 'Could not remove',
        description: error instanceof Error ? error.message : 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="capitalize">
          {freq}
        </Badge>
        <Badge variant="secondary">{formatStaffRoleLabel(staff)}</Badge>
        <span className="text-sm text-muted-foreground">{formatStaffPayLine(staff)}</span>
      </div>

      <div className={`grid gap-3 ${freq === 'hourly' ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        <div>
          <Label htmlFor={`presence-date-${staff.id}`}>Date present</Label>
          <Input
            id={`presence-date-${staff.id}`}
            type="date"
            min={minDate}
            max={maxDate}
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
          />
        </div>
        {freq === 'hourly' ? (
          <div>
            <Label htmlFor={`presence-hours-${staff.id}`}>Hours (optional)</Label>
            <Input
              id={`presence-hours-${staff.id}`}
              type="number"
              min="0"
              step="0.5"
              placeholder="e.g. 8"
              value={hoursInput}
              onChange={(e) => setHoursInput(e.target.value)}
            />
          </div>
        ) : null}
        <div className="flex items-end">
          <Button onClick={handleAdd} disabled={saving} className="w-full md:w-auto">
            <Plus className="h-4 w-4 mr-1" />
            Mark present
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Allowed: {minDate} → {maxDate}. Past dates OK (e.g. enter yesterday today).
      </p>

      <div className="rounded-lg border">
        <div className="border-b bg-muted/40 px-3 py-2 text-sm font-medium flex flex-wrap justify-between gap-2">
          <span>
            {countPresenceDays(record)} day{countPresenceDays(record) === 1 ? '' : 's'} in {month}
          </span>
          {freq === 'hourly' && totalPresenceHours(record) > 0 ? (
            <span className="text-muted-foreground">{totalPresenceHours(record).toFixed(1)} hrs logged</span>
          ) : null}
        </div>
        {entries.length === 0 ? (
          <p className="px-3 py-8 text-sm text-center text-muted-foreground">No days marked yet.</p>
        ) : (
          <ul className="divide-y">
            {entries.map((entry: StaffPresenceEntry) => (
              <li key={entry.date} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div>
                  <p>{formatPresenceDay(entry.date)}</p>
                  {entry.hours != null && entry.hours > 0 ? (
                    <p className="text-xs text-muted-foreground">{entry.hours.toFixed(1)} hours</p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={saving}
                  onClick={() => handleRemove(entry.date)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
