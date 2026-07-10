import * as admin from 'firebase-admin';
import { buildDefaultLedgerAccounts } from './defaultChartOfAccounts';
import { assertPeriodOpenForPost } from './periodLock';

function getDb() {
  return admin.firestore();
}

const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export type JournalLineInput = {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
};

export type PostJournalInput = {
  storeId: string;
  date: string;
  memo: string;
  sourceType: string;
  sourceId: string;
  event: string;
  createdBy?: string;
  currency?: string;
  lines: JournalLineInput[];
};

export type LedgerAccount = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
};

export function buildSourceKey(sourceType: string, sourceId: string, event: string): string {
  return `${sourceType}:${sourceId}:${event}`;
}

export function validateBalancedLines(lines: JournalLineInput[]): void {
  if (!lines.length) throw new Error('Journal entry requires at least one line.');
  let debitTotal = 0;
  let creditTotal = 0;
  for (const line of lines) {
    const debit = round2(line.debit);
    const credit = round2(line.credit);
    if (debit < 0 || credit < 0) throw new Error('Amounts cannot be negative.');
    if (debit > 0 && credit > 0) throw new Error('Each line must be debit OR credit, not both.');
    if (debit === 0 && credit === 0) throw new Error('Each line needs a debit or credit amount.');
    debitTotal += debit;
    creditTotal += credit;
  }
  if (round2(debitTotal) !== round2(creditTotal)) {
    throw new Error(`Entry is out of balance (debits ${debitTotal} ≠ credits ${creditTotal}).`);
  }
}

async function findEntryBySourceKey(storeId: string, sourceKey: string) {
  const snap = await getDb()
    .collection('stores')
    .doc(storeId)
    .collection('journalEntries')
    .where('sourceKey', '==', sourceKey)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

export type PostJournalResult = {
  entryId: string;
  sourceKey: string;
  idempotentReplay: boolean;
};

export async function postJournalEntry(
  input: PostJournalInput,
  accountsById: Map<string, LedgerAccount>,
): Promise<PostJournalResult> {
  validateBalancedLines(input.lines);
  const sourceId = input.sourceId || `gen-${Date.now()}`;
  const sourceKey = buildSourceKey(input.sourceType, sourceId, input.event);

  const existing = await findEntryBySourceKey(input.storeId, sourceKey);
  if (existing) {
    return { entryId: existing.id, sourceKey, idempotentReplay: true };
  }

  await assertPeriodOpenForPost(input.storeId, input.date);

  const entryId = `JE-${Date.now()}`;
  const now = new Date().toISOString();
  const entry = {
    id: entryId,
    storeId: input.storeId,
    date: input.date,
    memo: input.memo,
    status: 'posted',
    sourceType: input.sourceType,
    sourceId,
    sourceKey,
    currency: input.currency || 'USD',
    createdAt: now,
    updatedAt: now,
    ...(input.createdBy ? { createdBy: input.createdBy } : {}),
  };

  const batch = getDb().batch();
  batch.set(getDb().collection('stores').doc(input.storeId).collection('journalEntries').doc(entryId), entry);

  input.lines.forEach((line, index) => {
    const account = accountsById.get(line.accountId);
    if (!account || !account.isActive) {
      throw new Error(`Invalid or inactive account: ${line.accountId}`);
    }
    const lineId = `${entryId}-L${index + 1}`;
    batch.set(getDb().collection('stores').doc(input.storeId).collection('journalLines').doc(lineId), {
      id: lineId,
      storeId: input.storeId,
      entryId,
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name,
      debit: round2(line.debit),
      credit: round2(line.credit),
      ...(line.description ? { description: line.description } : {}),
      lineOrder: index,
    });
  });

  await batch.commit();
  return { entryId, sourceKey, idempotentReplay: false };
}

export async function ensureDefaultChartOfAccounts(storeId: string): Promise<LedgerAccount[]> {
  const col = getDb().collection('stores').doc(storeId).collection('ledgerAccounts');
  const snap = await col.get();

  if (!snap.empty) {
    const accounts: LedgerAccount[] = snap.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = d.data();
      return { id: d.id, code: String(data.code), name: String(data.name), isActive: data.isActive !== false };
    });
    const existingCodes = new Set(accounts.map((a) => a.code));
    const missing = buildDefaultLedgerAccounts(storeId).filter((seed) => !existingCodes.has(seed.code));
    if (missing.length > 0) {
      const batch = getDb().batch();
      for (const seed of missing) {
        batch.set(col.doc(seed.id), seed);
        accounts.push({ id: seed.id, code: seed.code, name: seed.name, isActive: true });
      }
      await batch.commit();
    }
    return accounts;
  }

  const accounts = buildDefaultLedgerAccounts(storeId);
  const batch = getDb().batch();
  for (const account of accounts) {
    batch.set(col.doc(account.id), account);
  }
  batch.set(getDb().collection('stores').doc(storeId).collection('ledgerMeta').doc('coa'), {
    storeId,
    initialized: true,
    accountCount: accounts.length,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  await batch.commit();
  return accounts.map((a) => ({ id: a.id, code: a.code, name: a.name, isActive: true }));
}

export function accountsMap(accounts: LedgerAccount[]): Map<string, LedgerAccount> {
  return new Map(accounts.map((a) => [a.id, a]));
}

export function accountByCode(accounts: LedgerAccount[], code: string): LedgerAccount {
  const found = accounts.find((a) => a.code === code && a.isActive);
  if (!found) throw new Error(`GL account ${code} not found. Initialize Chart of Accounts first.`);
  return found;
}
