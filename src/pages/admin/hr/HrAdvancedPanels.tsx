import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { employeeDisplayName, hrReportCounts, weekBounds, type HrAssetStatus, type HrNoteCategory, type HrNoteSeverity } from '@/lib/hrCore';
import { saveHrAsset, saveHrNote, saveHrShift, type HrCoreBundle } from '@/lib/hrCoreService';

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium text-slate-800">{label}</span>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function EmployeeSelect({
  employees,
  value,
  onChange,
}: {
  employees: HrCoreBundle['employees'];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <Label>Employee</Label>
      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select an employee</option>
        {employees.map((employee) => (
          <option key={employee.id} value={employee.id}>{employeeDisplayName(employee)}</option>
        ))}
      </select>
    </label>
  );
}

export function HrSchedule({
  storeId,
  bundle,
  onSaved,
}: {
  storeId: string;
  bundle: HrCoreBundle;
  onSaved: () => Promise<void>;
}) {
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const week = weekBounds(today);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState('');
  const [shiftDate, setShiftDate] = useState(today);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [station, setStation] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const weekShifts = bundle.shifts.filter((row) => row.shiftDate >= week.start && row.shiftDate <= week.end);

  const clear = () => {
    setEditingId(null);
    setEmployeeId('');
    setStation('');
    setNotes('');
  };

  const save = async () => {
    const employee = bundle.employees.find((row) => row.id === employeeId);
    if (!employee) return;
    setSaving(true);
    const updating = Boolean(editingId);
    try {
      await saveHrShift(editingId, { storeId, employee, shiftDate, startTime, endTime, station, notes });
      clear();
      await onSaved();
      toast({ title: updating ? 'Shift updated' : 'Shift saved' });
    } catch (err) {
      toast({ title: 'Could not save shift', description: err instanceof Error ? err.message : 'Save failed.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p>Week of {week.start} to {week.end}.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <EmployeeSelect employees={bundle.employees} value={employeeId} onChange={setEmployeeId} />
        <Field label="Date" value={shiftDate} onChange={setShiftDate} type="date" />
        <Field label="Start" value={startTime} onChange={setStartTime} type="time" />
        <Field label="End" value={endTime} onChange={setEndTime} type="time" />
        <Field label="Station" value={station} onChange={setStation} />
        <Field label="Notes" value={notes} onChange={setNotes} />
      </div>
      <div className="flex gap-2">
        <Button type="button" onClick={() => void save()} disabled={saving || !employeeId || !shiftDate || !startTime || !endTime}>
          {editingId ? 'Save shift' : 'Add shift'}
        </Button>
        {editingId ? <Button type="button" variant="outline" onClick={clear}>Cancel</Button> : null}
      </div>
      <ul className="divide-y rounded-lg border bg-white">
        {weekShifts.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <span>
              <span className="font-medium">{row.staffName}</span>
              <span className="text-slate-500"> · {row.shiftDate} · {row.startTime}–{row.endTime}{row.station ? ` · ${row.station}` : ''}</span>
            </span>
            <Button type="button" variant="outline" onClick={() => {
              const employee = bundle.employees.find((person) => employeeDisplayName(person) === row.staffName);
              setEditingId(row.id);
              setEmployeeId(employee?.id || '');
              setShiftDate(row.shiftDate);
              setStartTime(row.startTime);
              setEndTime(row.endTime);
              setStation(row.station);
              setNotes(row.notes);
            }}>Edit</Button>
          </li>
        ))}
        {weekShifts.length === 0 ? <li className="px-3 py-2 text-slate-500">No shifts this week.</li> : null}
      </ul>
    </div>
  );
}

export function HrNotes({
  storeId,
  bundle,
  onSaved,
}: {
  storeId: string;
  bundle: HrCoreBundle;
  onSaved: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [employeeId, setEmployeeId] = useState('');
  const [noteDate, setNoteDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<HrNoteCategory>('note');
  const [severity, setSeverity] = useState<HrNoteSeverity>('low');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const employee = bundle.employees.find((row) => row.id === employeeId);
    if (!employee) return;
    setSaving(true);
    try {
      await saveHrNote({ storeId, employee, noteDate, category, severity, note });
      setNote('');
      await onSaved();
      toast({ title: 'Note saved' });
    } catch (err) {
      toast({ title: 'Could not save note', description: err instanceof Error ? err.message : 'Save failed.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p>Only an owner or manager can see this list.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <EmployeeSelect employees={bundle.employees} value={employeeId} onChange={setEmployeeId} />
        <Field label="Date" value={noteDate} onChange={setNoteDate} type="date" />
        <label className="block space-y-1 text-sm">
          <Label>Type</Label>
          <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={category} onChange={(event) => setCategory(event.target.value as HrNoteCategory)}>
            <option value="note">Note</option>
            <option value="incident">Incident</option>
            <option value="warning">Warning</option>
            <option value="praise">Praise</option>
            <option value="review">Review</option>
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <Label>Severity</Label>
          <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={severity} onChange={(event) => setSeverity(event.target.value as HrNoteSeverity)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
        <Field label="Note" value={note} onChange={setNote} />
      </div>
      <Button type="button" onClick={() => void save()} disabled={saving || !employeeId || !note.trim()}>Save note</Button>
      <ul className="divide-y rounded-lg border bg-white">
        {bundle.notes.map((row) => (
          <li key={row.id} className="px-3 py-2">
            <span className="font-medium">{row.staffName}</span>
            <span className="text-slate-500"> · {row.category} · {row.severity} · {row.noteDate} · {row.note}</span>
          </li>
        ))}
        {bundle.notes.length === 0 ? <li className="px-3 py-2 text-slate-500">No notes yet.</li> : null}
      </ul>
    </div>
  );
}

export function HrAssets({
  storeId,
  bundle,
  onSaved,
}: {
  storeId: string;
  bundle: HrCoreBundle;
  onSaved: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState('');
  const [itemType, setItemType] = useState('uniform');
  const [itemName, setItemName] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [status, setStatus] = useState<HrAssetStatus>('issued');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const clear = () => {
    setEditingId(null);
    setItemName('');
    setIssueDate('');
    setReturnDate('');
    setNotes('');
    setStatus('issued');
  };

  const save = async () => {
    const employee = bundle.employees.find((row) => row.id === employeeId);
    if (!employee) return;
    setSaving(true);
    const updating = Boolean(editingId);
    try {
      await saveHrAsset(editingId, { storeId, employee, itemType, itemName, issueDate, returnDate, status, notes });
      clear();
      await onSaved();
      toast({ title: updating ? 'Asset updated' : 'Asset assigned' });
    } catch (err) {
      toast({ title: 'Could not save asset', description: err instanceof Error ? err.message : 'Save failed.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <EmployeeSelect employees={bundle.employees} value={employeeId} onChange={setEmployeeId} />
        <Field label="Item type" value={itemType} onChange={setItemType} />
        <Field label="Item name" value={itemName} onChange={setItemName} />
        <Field label="Issue date" value={issueDate} onChange={setIssueDate} type="date" />
        <Field label="Return date" value={returnDate} onChange={setReturnDate} type="date" />
        <label className="block space-y-1 text-sm">
          <Label>Status</Label>
          <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value as HrAssetStatus)}>
            <option value="issued">Issued</option>
            <option value="returned">Returned</option>
          </select>
        </label>
        <Field label="Notes" value={notes} onChange={setNotes} />
      </div>
      <div className="flex gap-2">
        <Button type="button" onClick={() => void save()} disabled={saving || !employeeId || !itemName.trim()}>
          {editingId ? 'Save asset' : 'Assign asset'}
        </Button>
        {editingId ? <Button type="button" variant="outline" onClick={clear}>Cancel</Button> : null}
      </div>
      <ul className="divide-y rounded-lg border bg-white">
        {bundle.assets.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <span>
              <span className="font-medium">{row.itemName}</span>
              <span className="text-slate-500"> · {row.staffName} · {row.itemType || 'Item'} · {row.status}</span>
            </span>
            <Button type="button" variant="outline" onClick={() => {
              const employee = bundle.employees.find((person) => employeeDisplayName(person) === row.staffName);
              setEditingId(row.id);
              setEmployeeId(employee?.id || '');
              setItemType(row.itemType || 'uniform');
              setItemName(row.itemName);
              setIssueDate(row.issueDate);
              setReturnDate(row.returnDate);
              setStatus(row.status === 'returned' ? 'returned' : 'issued');
              setNotes(row.notes);
            }}>Edit</Button>
          </li>
        ))}
        {bundle.assets.length === 0 ? <li className="px-3 py-2 text-slate-500">No assets yet.</li> : null}
      </ul>
    </div>
  );
}

export function HrReports({ bundle }: { bundle: HrCoreBundle }) {
  const today = new Date().toISOString().slice(0, 10);
  const counts = hrReportCounts({
    employees: bundle.employees,
    leave: bundle.leave,
    training: bundle.trainingAssignments,
    documents: bundle.documents,
    shifts: bundle.shifts,
    notes: bundle.notes,
    assets: bundle.assets,
    today,
  });
  const cards = [
    { label: 'Active employees', value: counts.activeEmployees, to: '/admin/hr/employees' },
    { label: 'Pending leave', value: counts.openLeave, to: '/admin/hr/leave' },
    { label: 'Training overdue', value: counts.overdueTraining, to: '/admin/hr/training' },
    { label: 'Expiring documents', value: counts.expiringDocuments, to: '/admin/hr/documents' },
    { label: 'Shifts this week', value: counts.shiftsThisWeek, to: '/admin/hr/schedule' },
    { label: 'Open incidents', value: counts.openIncidents, to: '/admin/hr/notes' },
    { label: 'Issued assets', value: counts.openAssets, to: '/admin/hr/assets' },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <Link key={card.label} to={card.to} className="rounded-lg border bg-white p-4">
          <p className="text-sm text-slate-500">{card.label}</p>
          <p className="text-2xl font-semibold text-slate-900">{card.value}</p>
        </Link>
      ))}
    </div>
  );
}
