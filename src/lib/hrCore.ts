export type HrEmploymentType = 'full_time' | 'part_time' | 'casual';
export type HrEmployeeStatus = 'active' | 'suspended' | 'terminated';
export type HrLeaveType = 'annual' | 'sick' | 'unpaid' | 'other';
export type HrLeaveStatus = 'requested' | 'approved' | 'declined';
export type HrTrainingStatus = 'assigned' | 'acknowledged' | 'completed';
export type HrDocumentState = 'current' | 'expiring' | 'expired' | 'no_expiry';

export type HrEmployeeInput = {
  storeId: string;
  name: string;
  position?: string;
  department?: string;
  employmentType?: HrEmploymentType;
  status?: HrEmployeeStatus;
  hireDate?: string;
  endDate?: string;
  phone?: string;
  email?: string;
  now?: string;
};

export type HrEmployeeView = {
  id: string;
  name: string;
  position: string;
  department: string;
  employmentType: string;
  status: string;
  hireDate: string;
  endDate: string;
  phone: string;
  email: string;
  storeId: string;
};

export function employeeDisplayName(employee: { name?: string | null }): string {
  const name = String(employee.name || '').trim();
  return name || 'Unnamed employee';
}

export function buildHrEmployeeWrite(input: HrEmployeeInput): Record<string, unknown> {
  const storeId = input.storeId.trim();
  const name = input.name.trim();
  if (!storeId) throw new Error('Store is required.');
  if (!name) throw new Error('Employee name is required.');
  const now = input.now || new Date().toISOString();
  const status = input.status || 'active';
  const position = String(input.position || '').trim();
  if (!position) throw new Error('Position is required.');
  const payload: Record<string, unknown> = {
    name,
    staffName: name,
    role: position,
    position,
    department: String(input.department || '').trim(),
    employmentType: input.employmentType || 'full_time',
    status,
    isActive: status === 'active',
    hireDate: input.hireDate || now.slice(0, 10),
    phone: String(input.phone || '').trim(),
    email: String(input.email || '').trim(),
    storeId,
    payrollExcluded: true,
    createdAt: now,
    updatedAt: now,
  };
  const endDate = String(input.endDate || '').trim();
  if (endDate) payload.endDate = endDate;
  return payload;
}

/** Edits name, role, and contact only. Does not write salary or payroll exclusion. */
export function buildHrEmployeePatch(input: HrEmployeeInput): Record<string, unknown> {
  const created = buildHrEmployeeWrite(input);
  delete created.createdAt;
  delete created.payrollExcluded;
  delete created.storeId;
  return created;
}

export function toHrEmployeeView(id: string, data: Record<string, unknown>): HrEmployeeView | null {
  const storeId = String(data.storeId || '').trim();
  if (!storeId) return null;
  return {
    id,
    name: employeeDisplayName({ name: String(data.name || data.staffName || '') }),
    position: String(data.position || data.role || '').trim(),
    department: String(data.department || '').trim(),
    employmentType: String(data.employmentType || '').trim(),
    status: String(data.status || (data.isActive === false ? 'terminated' : 'active')),
    hireDate: String(data.hireDate || '').slice(0, 10),
    endDate: String(data.endDate || '').slice(0, 10),
    phone: String(data.phone || '').trim(),
    email: String(data.email || '').trim(),
    storeId,
  };
}

export function recordsForStore<T extends { storeId?: string }>(rows: T[], storeId: string): T[] {
  return rows.filter((row) => row.storeId === storeId);
}

type NamedEmployee = { id: string; name: string; storeId: string };

function requireEmployee(storeId: string, employee: NamedEmployee) {
  if (!storeId.trim()) throw new Error('Store is required.');
  if (employee.storeId !== storeId) throw new Error('Employee is not in this store.');
}

export function buildLeaveWrite(input: {
  storeId: string;
  employee: NamedEmployee;
  leaveType: HrLeaveType;
  startDate: string;
  endDate: string;
  note?: string;
  now?: string;
}): Record<string, unknown> {
  requireEmployee(input.storeId, input.employee);
  if (!input.startDate || !input.endDate) throw new Error('Leave dates are required.');
  const now = input.now || new Date().toISOString();
  return {
    storeId: input.storeId,
    staffId: input.employee.id,
    staffName: employeeDisplayName(input.employee),
    leaveType: input.leaveType,
    startDate: input.startDate,
    endDate: input.endDate,
    status: 'requested' as HrLeaveStatus,
    note: String(input.note || '').trim(),
    createdAt: now,
    updatedAt: now,
  };
}

export function buildLeaveDecision(input: {
  status: 'approved' | 'declined';
  now?: string;
}): Record<string, unknown> {
  return {
    status: input.status,
    updatedAt: input.now || new Date().toISOString(),
  };
}

export function buildTrainingItemWrite(input: {
  storeId: string;
  title: string;
  category?: string;
  now?: string;
}): Record<string, unknown> {
  const storeId = input.storeId.trim();
  const title = input.title.trim();
  if (!storeId) throw new Error('Store is required.');
  if (!title) throw new Error('Training title is required.');
  const now = input.now || new Date().toISOString();
  return {
    storeId,
    title,
    category: String(input.category || '').trim(),
    createdAt: now,
    updatedAt: now,
  };
}

export function buildTrainingAssignmentWrite(input: {
  storeId: string;
  employee: NamedEmployee;
  trainingTitle: string;
  trainingItemId: string;
  dueDate?: string;
  now?: string;
}): Record<string, unknown> {
  requireEmployee(input.storeId, input.employee);
  const trainingTitle = input.trainingTitle.trim();
  if (!trainingTitle) throw new Error('Training title is required.');
  const now = input.now || new Date().toISOString();
  return {
    storeId: input.storeId,
    staffId: input.employee.id,
    staffName: employeeDisplayName(input.employee),
    trainingItemId: input.trainingItemId,
    trainingTitle,
    dueDate: String(input.dueDate || now.slice(0, 10)).trim(),
    status: 'assigned' as HrTrainingStatus,
    createdAt: now,
    updatedAt: now,
  };
}

export function buildTrainingCompletion(now?: string): Record<string, unknown> {
  return {
    status: 'completed' as HrTrainingStatus,
    updatedAt: now || new Date().toISOString(),
  };
}

export function isTrainingOverdue(row: { status?: string; dueDate?: string }, today: string): boolean {
  return row.status === 'assigned' && Boolean(row.dueDate) && String(row.dueDate) <= today;
}

export function documentState(expiryDate: string, today: string): HrDocumentState {
  const expiry = expiryDate.trim();
  if (!expiry) return 'no_expiry';
  if (expiry < today) return 'expired';
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + 30);
  const limitIso = limit.toISOString().slice(0, 10);
  if (expiry <= limitIso) return 'expiring';
  return 'current';
}

export function buildDocumentWrite(input: {
  storeId: string;
  employee: NamedEmployee;
  title: string;
  documentType?: string;
  issueDate?: string;
  expiryDate?: string;
  notes?: string;
  today: string;
  now?: string;
}): Record<string, unknown> {
  requireEmployee(input.storeId, input.employee);
  const documentType = String(input.documentType || '').trim();
  const title = input.title.trim() || documentType;
  if (!title) throw new Error('Document type is required.');
  const expiryDate = String(input.expiryDate || '').trim();
  const now = input.now || new Date().toISOString();
  return {
    storeId: input.storeId,
    staffId: input.employee.id,
    staffName: employeeDisplayName(input.employee),
    title,
    documentType,
    issueDate: String(input.issueDate || '').trim(),
    expiryDate,
    notes: String(input.notes || '').trim(),
    status: documentState(expiryDate, input.today),
    createdAt: now,
    updatedAt: now,
  };
}

export type HrNoteCategory = 'note' | 'incident' | 'warning' | 'praise' | 'review';
export type HrNoteSeverity = 'low' | 'medium' | 'high';
export type HrAssetStatus = 'issued' | 'returned';

export function weekBounds(today: string) {
  const date = new Date(`${today}T00:00:00Z`);
  const day = date.getUTCDay();
  const start = new Date(date);
  start.setUTCDate(date.getUTCDate() + (day === 0 ? -6 : 1 - day));
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  const iso = (value: Date) => value.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

export function buildHrRecordPatch(created: Record<string, unknown>) {
  const patch = { ...created };
  delete patch.createdAt;
  delete patch.storeId;
  return patch;
}

export function buildShiftWrite(input: {
  storeId: string;
  employee: NamedEmployee;
  shiftDate: string;
  startTime: string;
  endTime: string;
  station?: string;
  notes?: string;
  now?: string;
}) {
  requireEmployee(input.storeId, input.employee);
  const shiftDate = input.shiftDate.trim();
  if (!shiftDate || !input.startTime || !input.endTime) throw new Error('Shift date and times are required.');
  const now = input.now || new Date().toISOString();
  return {
    storeId: input.storeId,
    staffId: input.employee.id,
    staffName: employeeDisplayName(input.employee),
    shiftDate,
    startTime: input.startTime,
    endTime: input.endTime,
    station: String(input.station || '').trim(),
    notes: String(input.notes || '').trim(),
    weekStart: weekBounds(shiftDate).start,
    createdAt: now,
    updatedAt: now,
  };
}

export function buildHrNoteWrite(input: {
  storeId: string;
  employee: NamedEmployee;
  noteDate: string;
  category: HrNoteCategory;
  severity?: HrNoteSeverity;
  note: string;
  now?: string;
}) {
  requireEmployee(input.storeId, input.employee);
  const note = input.note.trim();
  if (!note) throw new Error('Note text is required.');
  const now = input.now || new Date().toISOString();
  return {
    storeId: input.storeId,
    staffId: input.employee.id,
    staffName: employeeDisplayName(input.employee),
    noteDate: input.noteDate.trim() || now.slice(0, 10),
    category: input.category,
    severity: input.severity || 'low',
    note,
    managerOnly: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function buildHrAssetWrite(input: {
  storeId: string;
  employee: NamedEmployee;
  itemType: string;
  itemName: string;
  issueDate?: string;
  returnDate?: string;
  status?: HrAssetStatus;
  notes?: string;
  now?: string;
}) {
  requireEmployee(input.storeId, input.employee);
  const itemName = input.itemName.trim();
  if (!itemName) throw new Error('Item name is required.');
  const now = input.now || new Date().toISOString();
  return {
    storeId: input.storeId,
    staffId: input.employee.id,
    staffName: employeeDisplayName(input.employee),
    itemType: String(input.itemType || '').trim(),
    itemName,
    issueDate: String(input.issueDate || '').trim(),
    returnDate: String(input.returnDate || '').trim(),
    status: input.status || 'issued',
    notes: String(input.notes || '').trim(),
    createdAt: now,
    updatedAt: now,
  };
}

export function hrReportCounts(input: {
  employees: { status?: string }[];
  leave: { status?: string }[];
  training: { status?: string; dueDate?: string }[];
  documents: { status?: string }[];
  shifts: { shiftDate?: string }[];
  notes: { category?: string }[];
  assets: { status?: string }[];
  today: string;
}) {
  const week = weekBounds(input.today);
  const employees = input.employees || [];
  const leave = input.leave || [];
  const training = input.training || [];
  const documents = input.documents || [];
  const shifts = input.shifts || [];
  const notes = input.notes || [];
  const assets = input.assets || [];
  const base = hrDashboardCounts({
    employees: employees as HrEmployeeView[],
    leave,
    training,
    documents,
    today: input.today,
  });
  return {
    ...base,
    shiftsThisWeek: shifts.filter((row) => {
      const date = String(row.shiftDate || '');
      return date >= week.start && date <= week.end;
    }).length,
    openIncidents: notes.filter((row) => row.category === 'incident').length,
    openAssets: assets.filter((row) => row.status !== 'returned').length,
  };
}

export function hrDashboardCounts(input: {
  employees: HrEmployeeView[];
  leave: { status?: string }[];
  training: { status?: string; dueDate?: string }[];
  documents: { status?: string }[];
  today: string;
}) {
  return {
    employees: input.employees.length,
    activeEmployees: input.employees.filter((row) => row.status === 'active').length,
    openLeave: input.leave.filter((row) => row.status === 'requested').length,
    openTraining: input.training.filter((row) => row.status === 'assigned').length,
    overdueTraining: input.training.filter((row) => isTrainingOverdue(row, input.today)).length,
    expiringDocuments: input.documents.filter((row) => row.status === 'expiring' || row.status === 'expired').length,
  };
}
