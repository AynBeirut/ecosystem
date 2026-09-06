import * as admin from 'firebase-admin';
import { mapGrabioCodeToPcg } from './grabioToPcgMap';
import {
  EMPLOYEE_PARENT_GRABIO,
  EMPLOYEE_PARENT_PCG,
  EMPLOYEE_SUFFIX_DIGITS,
  PAYROLL_COMPONENT_LABEL,
  employeePartyKey,
  type PayrollComponentKind,
} from './employeeSubaccountCodes';
import type { LedgerAccount } from './postingService';

function getDb() {
  return admin.firestore();
}

function ledgerDocId(code: string): string {
  return `acct-${code}`;
}

function nextSibling(parent: string, existing: string[], digits: number): string {
  const used = new Set(existing.map((code) => String(code || '').trim()).filter(Boolean));
  const max = 10 ** digits - 1;
  let start = 1;
  for (const code of used) {
    if (!code.startsWith(parent) || code.length !== parent.length + digits) continue;
    const n = Number.parseInt(code.slice(parent.length), 10);
    if (Number.isFinite(n) && n >= start) start = n + 1;
  }
  for (let i = start; i <= max; i += 1) {
    const next = `${parent}${String(i).padStart(digits, '0')}`;
    if (!used.has(next)) return next;
  }
  throw new Error(`No free sibling under ${parent}`);
}

export function findEmployeeComponentAccount(
  staffId: string,
  component: PayrollComponentKind,
  accounts: LedgerAccount[],
): LedgerAccount | undefined {
  const key = employeePartyKey(staffId, component);
  return accounts.find(
    (account) => account.partyType === 'employee' && account.partyId === key && account.isActive !== false,
  );
}

export async function ensureEmployeeComponentAccount(
  storeId: string,
  staffId: string,
  staffName: string,
  component: PayrollComponentKind,
  accounts: LedgerAccount[],
): Promise<LedgerAccount | null> {
  const id = String(staffId || '').trim();
  if (!storeId || !id) return null;

  const existing = findEmployeeComponentAccount(id, component, accounts);
  if (existing) return existing;

  const db = getDb();
  const [ledgerSnap, pcgSnap, profileSnap] = await Promise.all([
    db.collection('stores').doc(storeId).collection('ledgerAccounts').get(),
    db.collection('stores').doc(storeId).collection('pcgClientAccounts').get(),
    db.collection('storeProfiles').doc(storeId).get(),
  ]);
  const ledgerRows = ledgerSnap.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => ({
    id: d.id,
    ...d.data(),
  })) as LedgerAccount[];
  const hit = ledgerRows.find((row) => row.partyType === 'employee' && row.partyId === employeePartyKey(id, component));
  if (hit) {
    accounts.push(hit);
    return hit;
  }

  const mode = profileSnap.data()?.accountingMode === 'lebanese' ? 'lebanese' : 'international';
  const parent = EMPLOYEE_PARENT_GRABIO;
  const usedCodes = [
    ...ledgerRows.map((row) => String(row.code || '').trim()),
    ...pcgSnap.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => String(d.data().clientCode || '').trim()),
  ];
  const code = nextSibling(parent, usedCodes, EMPLOYEE_SUFFIX_DIGITS);
  const label = PAYROLL_COMPONENT_LABEL[component];
  const name = `${staffName.trim() || 'Employee'} — ${label}`;
  const partyId = employeePartyKey(id, component);
  const ts = new Date().toISOString();
  const parentRow = ledgerRows.find((row) => row.code === parent);
  const accountId = ledgerDocId(code);
  const body: Record<string, unknown> = {
    storeId,
    code,
    name,
    type: 'asset',
    normalBalance: 'debit',
    parentCode: parent,
    isSystem: false,
    isActive: true,
    openingBalance: 0,
    isPcgChart: false,
    grabioOperationalCode: parent,
    partyId,
    partyType: 'employee',
    createdAt: ts,
    updatedAt: ts,
  };
  if (mode === 'lebanese') {
    body.pcgKind = 'D';
    body.currency = parentRow?.currency || 'LL';
  } else if (parentRow?.currency) {
    body.currency = parentRow.currency;
  }
  await db.collection('stores').doc(storeId).collection('ledgerAccounts').doc(accountId).set(body, { merge: true });
  if (mode === 'lebanese') {
    await db.collection('stores').doc(storeId).collection('pcgClientAccounts').add({
      storeId,
      clientCode: code,
      grabioOperationalCode: parent,
      parentPcgCode: mapGrabioCodeToPcg(parent) || EMPLOYEE_PARENT_PCG,
      name,
      currency: parentRow?.currency === 'USD' ? 'USD' : 'LL',
      partyId,
      partyType: 'employee',
      createdAt: ts,
      updatedAt: ts,
    });
  }

  const created = { id: accountId, ...body } as LedgerAccount;
  accounts.push(created);
  return created;
}
