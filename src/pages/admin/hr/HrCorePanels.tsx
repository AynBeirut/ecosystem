import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { employeeDisplayName, hrDashboardCounts, type HrEmployeeStatus, type HrLeaveType } from '@/lib/hrCore';
import {
  completeHrTraining,
  createHrDocument,
  createHrEmployee,
  createHrLeave,
  createHrTrainingAssignment,
  createHrTrainingItem,
  decideHrLeave,
  loadHrCore,
  updateHrEmployee,
  type HrCoreBundle,
} from '@/lib/hrCoreService';

const emptyBundle: HrCoreBundle = {
  employees: [],
  leave: [],
  trainingItems: [],
  trainingAssignments: [],
  documents: [],
  shifts: [],
  notes: [],
  assets: [],
};

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

export function useHrCoreData(storeId: string | null) {
  const [bundle, setBundle] = useState<HrCoreBundle>(emptyBundle);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      setBundle(await loadHrCore(storeId));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load HR.');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { bundle, loading, error, reload };
}

export function HrOverview({
  bundle,
  payrollAllowed,
}: {
  bundle: HrCoreBundle;
  payrollAllowed: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const counts = hrDashboardCounts({
    employees: bundle.employees,
    leave: bundle.leave,
    training: bundle.trainingAssignments,
    documents: bundle.documents,
    today,
  });
  const cards = [
    { label: 'Active employees', value: counts.activeEmployees, to: '/admin/hr/employees' },
    { label: 'Pending leave', value: counts.openLeave, to: '/admin/hr/leave' },
    { label: 'Overdue training', value: counts.overdueTraining, to: '/admin/hr/training' },
    { label: 'Expiring documents', value: counts.expiringDocuments, to: '/admin/hr/documents' },
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.label} to={card.to} className="rounded-lg border bg-white p-4">
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="text-2xl font-semibold text-slate-900">{card.value}</p>
          </Link>
        ))}
      </div>
      {payrollAllowed ? (
        <p>
          Payroll stays on the existing screens.{' '}
          <Link to="/admin/salaries" className="font-medium text-teal-800 underline">Salary Payments</Link>
        </p>
      ) : (
        <p>Payroll is hidden while finance is off. Employee, leave, training, and document records do not need a wage.</p>
      )}
    </div>
  );
}

export function HrEmployees({
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
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [status, setStatus] = useState<HrEmployeeStatus>('active');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [hireDate, setHireDate] = useState('');
  const [saving, setSaving] = useState(false);

  const clearForm = () => {
    setEditingId(null);
    setName('');
    setPosition('');
    setStatus('active');
    setPhone('');
    setEmail('');
    setDepartment('');
    setHireDate('');
  };

  const save = async () => {
    setSaving(true);
    const input = { storeId, name, position, status, phone, email, department, hireDate };
    const updating = Boolean(editingId);
    try {
      if (editingId) await updateHrEmployee(editingId, input);
      else await createHrEmployee(input);
      clearForm();
      await onSaved();
      toast({ title: updating ? 'Employee updated' : 'Employee added' });
    } catch (err) {
      toast({
        title: 'Could not save employee',
        description: err instanceof Error ? err.message : 'Save failed.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" value={name} onChange={setName} />
        <Field label="Position" value={position} onChange={setPosition} />
        <label className="block space-y-1 text-sm">
          <Label>Status</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={status}
            onChange={(event) => setStatus(event.target.value as HrEmployeeStatus)}
          >
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="terminated">Terminated</option>
          </select>
        </label>
        <Field label="Phone" value={phone} onChange={setPhone} />
        <Field label="Email" value={email} onChange={setEmail} />
        <Field label="Department" value={department} onChange={setDepartment} />
        <Field label="Hire date" value={hireDate} onChange={setHireDate} type="date" />
      </div>
      <div className="flex gap-2">
        <Button type="button" onClick={() => void save()} disabled={saving || !name.trim() || !position.trim()}>
          {editingId ? 'Save employee' : 'Add employee'}
        </Button>
        {editingId ? (
          <Button type="button" variant="outline" onClick={clearForm}>Cancel</Button>
        ) : null}
      </div>
      <ul className="divide-y rounded-lg border bg-white">
        {bundle.employees.map((employee) => (
          <li key={employee.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <span>
              <span className="font-medium">{employeeDisplayName(employee)}</span>
              <span className="text-slate-500">
                {' '}· {[employee.position, employee.department, employee.status, employee.hireDate].filter(Boolean).join(' · ')}
              </span>
            </span>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditingId(employee.id);
                setName(employee.name === 'Unnamed employee' ? '' : employee.name);
                setPosition(employee.position);
                setStatus((employee.status as HrEmployeeStatus) || 'active');
                setPhone(employee.phone);
                setEmail(employee.email);
                setDepartment(employee.department);
                setHireDate(employee.hireDate);
              }}
            >
              Edit
            </Button>
          </li>
        ))}
        {bundle.employees.length === 0 ? <li className="px-3 py-2 text-slate-500">No employees yet.</li> : null}
      </ul>
    </div>
  );
}

export function HrAttendance({ payrollLinks = [] }: { payrollLinks?: { to: string; label: string }[] }) {
  return (
    <div className="space-y-2">
      <p>
        Daily attendance stays on the existing presence screen.{' '}
        <Link to="/admin/staff-presence" className="font-medium text-teal-800 underline">Open Daily Presence</Link>
      </p>
      {payrollLinks.map((link) => (
        <p key={link.to}>
          <Link to={link.to} className="font-medium text-teal-800 underline">{link.label}</Link>
        </p>
      ))}
    </div>
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
      <select
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select an employee</option>
        {employees.map((employee) => (
          <option key={employee.id} value={employee.id}>
            {employeeDisplayName(employee)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function HrLeave({
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
  const [leaveType, setLeaveType] = useState<HrLeaveType>('annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [note, setNote] = useState('');
  const [statusFilter, setStatusFilter] = useState('requested');
  const [saving, setSaving] = useState(false);
  const visibleLeave = bundle.leave.filter((row) => statusFilter === 'all' || row.status === statusFilter);

  const save = async () => {
    const employee = bundle.employees.find((row) => row.id === employeeId);
    if (!employee) return;
    setSaving(true);
    try {
      await createHrLeave({ storeId, employee, leaveType, startDate, endDate, note });
      setNote('');
      await onSaved();
      toast({ title: 'Leave request saved' });
    } catch (err) {
      toast({
        title: 'Could not save leave',
        description: err instanceof Error ? err.message : 'Save failed.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const decide = async (status: 'approved' | 'declined', leaveId: string) => {
    setSaving(true);
    try {
      await decideHrLeave(leaveId, status);
      await onSaved();
      toast({ title: status === 'approved' ? 'Leave approved' : 'Leave rejected' });
    } catch (err) {
      toast({
        title: 'Could not update leave',
        description: err instanceof Error ? err.message : 'Save failed.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <EmployeeSelect employees={bundle.employees} value={employeeId} onChange={setEmployeeId} />
        <label className="block space-y-1 text-sm">
          <Label>Type</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={leaveType}
            onChange={(event) => setLeaveType(event.target.value as HrLeaveType)}
          >
            <option value="annual">Annual</option>
            <option value="sick">Sick</option>
            <option value="unpaid">Unpaid</option>
            <option value="other">Other</option>
          </select>
        </label>
        <Field label="Start" value={startDate} onChange={setStartDate} type="date" />
        <Field label="End" value={endDate} onChange={setEndDate} type="date" />
        <Field label="Note" value={note} onChange={setNote} />
      </div>
      <Button type="button" onClick={() => void save()} disabled={saving || !employeeId || !startDate || !endDate}>
        Save leave request
      </Button>
      <div className="flex flex-wrap gap-2">
        {['requested', 'approved', 'declined', 'all'].map((status) => (
          <Button key={status} type="button" variant={statusFilter === status ? 'default' : 'outline'} onClick={() => setStatusFilter(status)}>
            {status === 'all' ? 'All' : status[0].toUpperCase() + status.slice(1)}
          </Button>
        ))}
      </div>
      <ul className="divide-y rounded-lg border bg-white">
        {visibleLeave.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <span>
              <span className="font-medium">{row.staffName}</span>
              <span className="text-slate-500"> · {row.leaveType} · {row.startDate} to {row.endDate} · {row.status}</span>
            </span>
            {row.status === 'requested' ? (
              <span className="flex gap-2">
                <Button type="button" onClick={() => void decide('approved', row.id)} disabled={saving}>Approve</Button>
                <Button type="button" variant="outline" onClick={() => void decide('declined', row.id)} disabled={saving}>Reject</Button>
              </span>
            ) : null}
          </li>
        ))}
        {visibleLeave.length === 0 ? <li className="px-3 py-2 text-slate-500">No leave requests in this list.</li> : null}
      </ul>
    </div>
  );
}

export function HrTraining({
  storeId,
  bundle,
  onSaved,
}: {
  storeId: string;
  bundle: HrCoreBundle;
  onSaved: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [itemId, setItemId] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const saveItem = async () => {
    setSaving(true);
    try {
      await createHrTrainingItem({ storeId, title });
      setTitle('');
      await onSaved();
      toast({ title: 'Training saved' });
    } catch (err) {
      toast({
        title: 'Could not save training',
        description: err instanceof Error ? err.message : 'Save failed.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const assign = async () => {
    const employee = bundle.employees.find((row) => row.id === employeeId);
    const item = bundle.trainingItems.find((row) => row.id === itemId);
    if (!employee || !item) return;
    setSaving(true);
    try {
      await createHrTrainingAssignment({
        storeId,
        employee,
        trainingItemId: item.id,
        trainingTitle: item.title,
        dueDate,
      });
      await onSaved();
      toast({ title: 'Training assigned' });
    } catch (err) {
      toast({
        title: 'Could not assign training',
        description: err instanceof Error ? err.message : 'Save failed.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem] flex-1">
          <Field label="Training title" value={title} onChange={setTitle} />
        </div>
        <Button type="button" onClick={() => void saveItem()} disabled={saving || !title.trim()}>
          Add training
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <Label>Training</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={itemId}
            onChange={(event) => setItemId(event.target.value)}
          >
            <option value="">Select training</option>
            {bundle.trainingItems.map((item) => (
              <option key={item.id} value={item.id}>{item.title}</option>
            ))}
          </select>
        </label>
        <EmployeeSelect employees={bundle.employees} value={employeeId} onChange={setEmployeeId} />
        <Field label="Due date" value={dueDate} onChange={setDueDate} type="date" />
      </div>
      <Button type="button" onClick={() => void assign()} disabled={saving || !employeeId || !itemId}>
        Assign
      </Button>
      <ul className="divide-y rounded-lg border bg-white">
        {bundle.trainingAssignments.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <span>
              <span className="font-medium">{row.trainingTitle}</span>
              <span className="text-slate-500"> · {row.staffName} · {row.status}{row.dueDate ? ` · due ${row.dueDate}` : ''}</span>
            </span>
            {row.status === 'assigned' ? (
              <Button
                type="button"
                onClick={() => {
                  setSaving(true);
                  void completeHrTraining(row.id)
                    .then(() => onSaved())
                    .then(() => toast({ title: 'Training completed' }))
                    .catch((err: unknown) => toast({
                      title: 'Could not update training',
                      description: err instanceof Error ? err.message : 'Save failed.',
                      variant: 'destructive',
                    }))
                    .finally(() => setSaving(false));
                }}
                disabled={saving}
              >
                Mark complete
              </Button>
            ) : null}
          </li>
        ))}
        {bundle.trainingAssignments.length === 0 ? <li className="px-3 py-2 text-slate-500">No assignments yet.</li> : null}
      </ul>
    </div>
  );
}

export function HrDocuments({
  storeId,
  bundle,
  onSaved,
}: {
  storeId: string;
  bundle: HrCoreBundle;
  onSaved: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const save = async () => {
    const employee = bundle.employees.find((row) => row.id === employeeId);
    if (!employee) return;
    setSaving(true);
    try {
      await createHrDocument({ storeId, employee, title, documentType, issueDate, expiryDate, notes, today });
      setTitle('');
      setDocumentType('');
      setIssueDate('');
      setExpiryDate('');
      setNotes('');
      await onSaved();
      toast({ title: 'Document saved' });
    } catch (err) {
      toast({
        title: 'Could not save document',
        description: err instanceof Error ? err.message : 'Save failed.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <EmployeeSelect employees={bundle.employees} value={employeeId} onChange={setEmployeeId} />
        <Field label="Type" value={documentType} onChange={setDocumentType} />
        <Field label="Title" value={title} onChange={setTitle} />
        <Field label="Issue date" value={issueDate} onChange={setIssueDate} type="date" />
        <Field label="Expiry" value={expiryDate} onChange={setExpiryDate} type="date" />
        <Field label="Notes" value={notes} onChange={setNotes} />
      </div>
      <Button type="button" onClick={() => void save()} disabled={saving || !employeeId || !(title.trim() || documentType.trim())}>
        Save document
      </Button>
      <ul className="divide-y rounded-lg border bg-white">
        {bundle.documents.map((row) => (
          <li key={row.id} className="px-3 py-2">
            <span className="font-medium">{row.title}</span>
            <span className="text-slate-500">
              {' '}· {row.staffName} · {row.documentType || 'Document'} · {row.issueDate || 'No issue date'} · {row.expiryDate || 'No expiry'} · {row.status}{row.notes ? ` · ${row.notes}` : ''}
            </span>
          </li>
        ))}
        {bundle.documents.length === 0 ? <li className="px-3 py-2 text-slate-500">No documents yet.</li> : null}
      </ul>
    </div>
  );
}
