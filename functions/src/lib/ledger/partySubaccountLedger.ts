import * as admin from 'firebase-admin';
import { GL_ACCOUNT_CODES } from './defaultChartOfAccounts';
import type { LedgerAccount } from './postingService';

const PCG_PARENT: Record<string, string> = { '401': '7010', '501': '6111' };

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

export async function findSupplierByVendorName(
  storeId: string,
  vendor: string,
): Promise<{ id: string; name: string } | null> {
  const needle = String(vendor || '').trim().toLowerCase();
  if (!needle || needle.length < 3) return null;
  const snap = await getDb().collection('suppliers').where('storeId', '==', storeId).get();
  for (const doc of snap.docs) {
    const name = String(doc.data().name || '').trim();
    if (!name) continue;
    const lower = name.toLowerCase();
    if (needle.includes(lower) || lower.includes(needle)) {
      return { id: doc.id, name };
    }
  }
  return null;
}

export async function ensurePartyLedgerAccount(
  storeId: string,
  kind: 'client' | 'supplier',
  partyId: string,
  partyName: string,
  accounts: LedgerAccount[],
): Promise<LedgerAccount | null> {
  const id = String(partyId || '').trim();
  if (!storeId || !id) return null;

  const existing = accounts.find((row) => row.partyType === kind && row.partyId === id);
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
  const hit = ledgerRows.find((row) => row.partyType === kind && row.partyId === id);
  if (hit) {
    accounts.push(hit);
    return hit;
  }

  const mode = profileSnap.data()?.accountingMode === 'lebanese' ? 'lebanese' : 'international';
  const parent = kind === 'client' ? GL_ACCOUNT_CODES.REVENUE : GL_ACCOUNT_CODES.COGS;
  const usedCodes = [
    ...ledgerRows.map((row) => String(row.code || '').trim()),
    ...pcgSnap.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) =>
      String(d.data().clientCode || '').trim(),
    ),
  ];
  const code = nextSibling(parent, usedCodes, 4);
  const name = partyName.trim() || (kind === 'client' ? 'Client' : 'Supplier');
  const ts = new Date().toISOString();
  const parentRow = ledgerRows.find((row) => row.code === parent);
  const accountId = ledgerDocId(code);
  const body: Record<string, unknown> = {
    storeId,
    code,
    name,
    type: kind === 'client' ? 'revenue' : 'expense',
    normalBalance: kind === 'client' ? 'credit' : 'debit',
    parentCode: parent,
    isSystem: false,
    isActive: true,
    openingBalance: 0,
    isPcgChart: false,
    partyId: id,
    partyType: kind,
    createdAt: ts,
    updatedAt: ts,
  };
  if (mode === 'lebanese') {
    body.pcgKind = 'D';
    body.grabioOperationalCode = parent;
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
      parentPcgCode: PCG_PARENT[parent] || parent,
      name,
      currency: parentRow?.currency === 'USD' ? 'USD' : 'LL',
      partyId: id,
      partyType: kind,
      createdAt: ts,
      updatedAt: ts,
    });
  }

  const created = { id: accountId, ...body } as LedgerAccount;
  accounts.push(created);
  return created;
}

export async function supplierDebitAccount(
  storeId: string,
  supplierId: string | undefined,
  supplierName: string | undefined,
  accounts: LedgerAccount[],
  fallbackCode: string,
): Promise<LedgerAccount> {
  const id = String(supplierId || '').trim();
  if (!id) return accounts.find((row) => row.code === fallbackCode) || accounts[0];
  const party = await ensurePartyLedgerAccount(storeId, 'supplier', id, supplierName || 'Supplier', accounts);
  return party || accounts.find((row) => row.code === fallbackCode) || accounts[0];
}
