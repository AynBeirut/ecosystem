import {
  addDoc,
  collection,
  doc,
  getDocs,
  getFirestore,
  query,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import {
  buildDocumentWrite,
  buildHrAssetWrite,
  buildHrEmployeePatch,
  buildHrEmployeeWrite,
  buildHrNoteWrite,
  buildHrRecordPatch,
  buildLeaveDecision,
  buildLeaveWrite,
  buildShiftWrite,
  buildTrainingAssignmentWrite,
  buildTrainingCompletion,
  buildTrainingItemWrite,
  recordsForStore,
  toHrEmployeeView,
  type HrEmployeeInput,
  type HrEmployeeView,
  type HrLeaveType,
} from '@/lib/hrCore';

export type HrLeaveRow = {
  id: string;
  storeId: string;
  staffName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  status: string;
  note: string;
};

export type HrTrainingItemRow = {
  id: string;
  storeId: string;
  title: string;
  category: string;
};

export type HrTrainingAssignmentRow = {
  id: string;
  storeId: string;
  staffName: string;
  trainingTitle: string;
  status: string;
  dueDate: string;
};

export type HrDocumentRow = {
  id: string;
  storeId: string;
  staffName: string;
  title: string;
  documentType: string;
  issueDate: string;
  expiryDate: string;
  notes: string;
  status: string;
};

export type HrShiftRow = {
  id: string;
  storeId: string;
  staffName: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  station: string;
  notes: string;
};

export type HrNoteRow = {
  id: string;
  storeId: string;
  staffName: string;
  noteDate: string;
  category: string;
  severity: string;
  note: string;
};

export type HrAssetRow = {
  id: string;
  storeId: string;
  staffName: string;
  itemType: string;
  itemName: string;
  issueDate: string;
  returnDate: string;
  status: string;
  notes: string;
};

export type HrCoreBundle = {
  employees: HrEmployeeView[];
  leave: HrLeaveRow[];
  trainingItems: HrTrainingItemRow[];
  trainingAssignments: HrTrainingAssignmentRow[];
  documents: HrDocumentRow[];
  shifts: HrShiftRow[];
  notes: HrNoteRow[];
  assets: HrAssetRow[];
};

function text(value: unknown): string {
  return String(value || '').trim();
}

async function listByStore(db: Firestore, name: string, storeId: string) {
  const snap = await getDocs(query(collection(db, name), where('storeId', '==', storeId)));
  return snap.docs.map((row) => ({ id: row.id, data: row.data() as Record<string, unknown> }));
}

export async function loadHrCore(storeId: string): Promise<HrCoreBundle> {
  const db = getFirestore();
  const [staffRows, leaveRows, itemRows, assignmentRows, documentRows, shiftRows, noteRows, assetRows] = await Promise.all([
    listByStore(db, 'staff', storeId),
    listByStore(db, 'hrLeaveRequests', storeId),
    listByStore(db, 'hrTrainingItems', storeId),
    listByStore(db, 'hrTrainingAssignments', storeId),
    listByStore(db, 'hrDocuments', storeId),
    listByStore(db, 'hrSchedules', storeId),
    listByStore(db, 'hrNotes', storeId),
    listByStore(db, 'hrAssets', storeId),
  ]);

  return {
    employees: recordsForStore(
      staffRows
        .map((row) => toHrEmployeeView(row.id, row.data))
        .filter((row): row is HrEmployeeView => Boolean(row)),
      storeId,
    ),
    leave: recordsForStore(
      leaveRows.map((row) => ({
        id: row.id,
        storeId: text(row.data.storeId),
        staffName: text(row.data.staffName) || 'Unnamed employee',
        leaveType: text(row.data.leaveType),
        startDate: text(row.data.startDate),
        endDate: text(row.data.endDate),
        status: text(row.data.status),
        note: text(row.data.note),
      })),
      storeId,
    ),
    trainingItems: recordsForStore(
      itemRows.map((row) => ({
        id: row.id,
        storeId: text(row.data.storeId),
        title: text(row.data.title) || 'Untitled training',
        category: text(row.data.category),
      })),
      storeId,
    ),
    trainingAssignments: recordsForStore(
      assignmentRows.map((row) => ({
        id: row.id,
        storeId: text(row.data.storeId),
        staffName: text(row.data.staffName) || 'Unnamed employee',
        trainingTitle: text(row.data.trainingTitle) || 'Untitled training',
        status: text(row.data.status),
        dueDate: text(row.data.dueDate),
      })),
      storeId,
    ),
    documents: recordsForStore(
      documentRows.map((row) => ({
        id: row.id,
        storeId: text(row.data.storeId),
        staffName: text(row.data.staffName) || 'Unnamed employee',
        title: text(row.data.title) || 'Untitled document',
        documentType: text(row.data.documentType),
        issueDate: text(row.data.issueDate),
        expiryDate: text(row.data.expiryDate),
        notes: text(row.data.notes),
        status: text(row.data.status),
      })),
      storeId,
    ),
    shifts: recordsForStore(
      shiftRows.map((row) => ({
        id: row.id,
        storeId: text(row.data.storeId),
        staffName: text(row.data.staffName) || 'Unnamed employee',
        shiftDate: text(row.data.shiftDate),
        startTime: text(row.data.startTime),
        endTime: text(row.data.endTime),
        station: text(row.data.station),
        notes: text(row.data.notes),
      })),
      storeId,
    ),
    notes: recordsForStore(
      noteRows.map((row) => ({
        id: row.id,
        storeId: text(row.data.storeId),
        staffName: text(row.data.staffName) || 'Unnamed employee',
        noteDate: text(row.data.noteDate),
        category: text(row.data.category),
        severity: text(row.data.severity),
        note: text(row.data.note),
      })),
      storeId,
    ),
    assets: recordsForStore(
      assetRows.map((row) => ({
        id: row.id,
        storeId: text(row.data.storeId),
        staffName: text(row.data.staffName) || 'Unnamed employee',
        itemType: text(row.data.itemType),
        itemName: text(row.data.itemName) || 'Untitled item',
        issueDate: text(row.data.issueDate),
        returnDate: text(row.data.returnDate),
        status: text(row.data.status),
        notes: text(row.data.notes),
      })),
      storeId,
    ),
  };
}

export async function createHrEmployee(input: HrEmployeeInput): Promise<void> {
  await addDoc(collection(getFirestore(), 'staff'), buildHrEmployeeWrite(input));
}

export async function updateHrEmployee(employeeId: string, input: HrEmployeeInput): Promise<void> {
  await updateDoc(doc(getFirestore(), 'staff', employeeId), buildHrEmployeePatch(input));
}

export async function createHrLeave(input: {
  storeId: string;
  employee: HrEmployeeView;
  leaveType: HrLeaveType;
  startDate: string;
  endDate: string;
  note?: string;
}): Promise<void> {
  await addDoc(collection(getFirestore(), 'hrLeaveRequests'), buildLeaveWrite(input));
}

export async function decideHrLeave(leaveId: string, status: 'approved' | 'declined'): Promise<void> {
  await updateDoc(doc(getFirestore(), 'hrLeaveRequests', leaveId), buildLeaveDecision({ status }));
}

export async function createHrTrainingItem(input: {
  storeId: string;
  title: string;
  category?: string;
}): Promise<void> {
  await addDoc(collection(getFirestore(), 'hrTrainingItems'), buildTrainingItemWrite(input));
}

export async function createHrTrainingAssignment(input: {
  storeId: string;
  employee: HrEmployeeView;
  trainingItemId: string;
  trainingTitle: string;
  dueDate?: string;
}): Promise<void> {
  await addDoc(
    collection(getFirestore(), 'hrTrainingAssignments'),
    buildTrainingAssignmentWrite(input),
  );
}

export async function completeHrTraining(assignmentId: string): Promise<void> {
  await updateDoc(doc(getFirestore(), 'hrTrainingAssignments', assignmentId), buildTrainingCompletion());
}

export async function createHrDocument(input: {
  storeId: string;
  employee: HrEmployeeView;
  title: string;
  documentType?: string;
  issueDate?: string;
  expiryDate?: string;
  notes?: string;
  today: string;
}): Promise<void> {
  await addDoc(collection(getFirestore(), 'hrDocuments'), buildDocumentWrite(input));
}

export async function saveHrShift(id: string | null, input: Parameters<typeof buildShiftWrite>[0]) {
  const payload = buildShiftWrite(input);
  const db = getFirestore();
  if (id) await updateDoc(doc(db, 'hrSchedules', id), buildHrRecordPatch(payload));
  else await addDoc(collection(db, 'hrSchedules'), payload);
}

export async function saveHrNote(input: Parameters<typeof buildHrNoteWrite>[0]) {
  await addDoc(collection(getFirestore(), 'hrNotes'), buildHrNoteWrite(input));
}

export async function saveHrAsset(id: string | null, input: Parameters<typeof buildHrAssetWrite>[0]) {
  const payload = buildHrAssetWrite(input);
  const db = getFirestore();
  if (id) await updateDoc(doc(db, 'hrAssets', id), buildHrRecordPatch(payload));
  else await addDoc(collection(db, 'hrAssets'), payload);
}
