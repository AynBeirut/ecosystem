import * as admin from 'firebase-admin';
import { buildDefaultLedgerAccounts, coaModeVersion } from './defaultChartOfAccounts';
import { resolveStoreAccountingMode, lockAccountingModeOnFirstPost } from './accountingModeService';
import { assertPeriodOpenForPost } from './periodLock';
import { normalizeCurrencyCode } from '../money/currencies';
import { resolvePostingAccount } from './postingAccountResolver';
import { allocateVoucherNumberInTransaction } from './voucherSerial';
import { computeAccountNetDebitBalance } from './cogsInventoryRelief';

function getDb() {
  return admin.firestore();
}

/**
 * Resolve a store's base currency for GL labeling (multi-currency Phase 1).
 * By design a store calculates in ONE currency, so this is accurate labeling —
 * not multi-currency math. Falls back to USD (never throws).
 */
async function resolveStoreCurrency(storeId: string): Promise<string> {
  try {
    const snap = await getDb().collection('storeProfiles').doc(storeId).get();
    const data = snap.exists ? snap.data() || {} : {};
    return normalizeCurrencyCode((data as { mainCurrency?: unknown }).mainCurrency);
  } catch {
    return normalizeCurrencyCode(undefined);
  }
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
  voucherType?: 'JV' | 'PV' | 'RV' | 'CV';
  voucherNumber?: string;
  lines: JournalLineInput[];
};

export type LedgerAccount = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  openingBalance?: number;
  isPcgChart?: boolean;
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

function getEntryKeyRef(storeId: string, sourceKey: string) {
  return getDb().collection('stores').doc(storeId).collection('journalEntryKeys').doc(sourceKey);
}

async function findEntryByKey(storeId: string, sourceKey: string): Promise<{ entryId: string } | null> {
  const snap = await getEntryKeyRef(storeId, sourceKey).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  const entryId = typeof data.entryId === 'string' ? data.entryId : '';
  return entryId ? { entryId } : null;
}

async function seedEntryKey(storeId: string, sourceKey: string, entryId: string): Promise<void> {
  const now = new Date().toISOString();
  await getEntryKeyRef(storeId, sourceKey).set(
    {
      storeId,
      sourceKey,
      entryId,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true },
  );
}

export type PostJournalResult = {
  entryId: string;
  sourceKey: string;
  idempotentReplay: boolean;
  voucherNumber?: string;
};

export async function postJournalEntry(
  input: PostJournalInput,
  accountsById: Map<string, LedgerAccount>,
): Promise<PostJournalResult> {
  validateBalancedLines(input.lines);
  const sourceId = input.sourceId || `gen-${Date.now()}`;
  const sourceKey = buildSourceKey(input.sourceType, sourceId, input.event);

  const existingByKey = await findEntryByKey(input.storeId, sourceKey);
  if (existingByKey) {
    return { entryId: existingByKey.entryId, sourceKey, idempotentReplay: true };
  }

  const existing = await findEntryBySourceKey(input.storeId, sourceKey);
  if (existing) {
    await seedEntryKey(input.storeId, sourceKey, existing.id);
    return { entryId: existing.id, sourceKey, idempotentReplay: true };
  }

  await assertPeriodOpenForPost(input.storeId, input.date);

  // Accurate currency label: use caller-provided currency, else the store's base currency.
  const currency = input.currency
    ? normalizeCurrencyCode(input.currency)
    : await resolveStoreCurrency(input.storeId);

  const entryId = `JE-${Date.now()}`;
  const now = new Date().toISOString();
  const event = String(input.event || '').trim();
  if (!event) {
    throw new Error('Journal entry event is required.');
  }

  const entry = {
    id: entryId,
    storeId: input.storeId,
    date: input.date,
    memo: input.memo,
    status: 'posted',
    sourceType: input.sourceType,
    sourceId,
    sourceKey,
    event,
    currency,
    createdAt: now,
    updatedAt: now,
    ...(input.createdBy ? { createdBy: input.createdBy } : {}),
  };

  const lineDocs = input.lines.map((line, index) => {
    const account = accountsById.get(line.accountId);
    if (!account || !account.isActive) {
      throw new Error(`Invalid or inactive account: ${line.accountId}`);
    }
    const lineId = `${entryId}-L${index + 1}`;
    return {
      id: lineId,
      storeId: input.storeId,
      entryId,
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name,
      currency,
      debit: round2(line.debit),
      credit: round2(line.credit),
      ...(line.description ? { description: line.description } : {}),
      lineOrder: index,
    };
  });

  try {
    const created = await getDb().runTransaction(async (tx: FirebaseFirestore.Transaction) => {
      const keyRef = getEntryKeyRef(input.storeId, sourceKey);
      const keySnap = (await tx.get(keyRef as unknown as FirebaseFirestore.DocumentReference)) as unknown as FirebaseFirestore.DocumentSnapshot;
      if (keySnap.exists) {
        const data = keySnap.data() || {};
        return {
          entryId: typeof data.entryId === 'string' ? data.entryId : entryId,
          idempotentReplay: true,
        };
      }

      let voucherNumber = input.voucherNumber;
      if (input.voucherType && !voucherNumber) {
        const serialRef = getDb().collection('stores').doc(input.storeId).collection('ledgerMeta').doc('voucherSerials');
        const serialSnap = (await tx.get(serialRef as FirebaseFirestore.DocumentReference)) as unknown as FirebaseFirestore.DocumentSnapshot;
        voucherNumber = allocateVoucherNumberInTransaction(
          tx,
          serialRef,
          serialSnap,
          input.storeId,
          input.voucherType,
        );
      }

      const entryWithVoucher = {
        ...entry,
        ...(input.voucherType ? { voucherType: input.voucherType } : {}),
        ...(voucherNumber ? { voucherNumber } : {}),
      };

      tx.create(keyRef, {
        storeId: input.storeId,
        sourceKey,
        entryId,
        createdAt: now,
        updatedAt: now,
      });
      tx.set(getDb().collection('stores').doc(input.storeId).collection('journalEntries').doc(entryId), entryWithVoucher);
      lineDocs.forEach((lineDoc) => {
        tx.set(getDb().collection('stores').doc(input.storeId).collection('journalLines').doc(lineDoc.id), lineDoc);
      });
      return { entryId, idempotentReplay: false, voucherNumber };
    });
    if (!created.idempotentReplay) {
      await lockAccountingModeOnFirstPost(input.storeId);
    }
    return {
      entryId: created.entryId,
      sourceKey,
      idempotentReplay: created.idempotentReplay,
      ...(created.voucherNumber ? { voucherNumber: created.voucherNumber } : {}),
    };
  } catch (error) {
    const replay = await findEntryByKey(input.storeId, sourceKey);
    if (replay) {
      return { entryId: replay.entryId, sourceKey, idempotentReplay: true };
    }
    throw error;
  }
}

export async function ensureDefaultChartOfAccounts(storeId: string): Promise<LedgerAccount[]> {
  const mode = await resolveStoreAccountingMode(storeId);
  const col = getDb().collection('stores').doc(storeId).collection('ledgerAccounts');
  const snap = await col.get();
  const expectedVersion = coaModeVersion(mode);
  const seeds = buildDefaultLedgerAccounts(storeId, mode);
  const FIRESTORE_BATCH_LIMIT = 400;

  const commitSeeds = async (toCreate: typeof seeds) => {
    for (let i = 0; i < toCreate.length; i += FIRESTORE_BATCH_LIMIT) {
      const batch = getDb().batch();
      for (const seed of toCreate.slice(i, i + FIRESTORE_BATCH_LIMIT)) {
        batch.set(col.doc(seed.id), seed);
      }
      await batch.commit();
    }
  };

  if (!snap.empty) {
    const accounts: LedgerAccount[] = snap.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = d.data();
      return {
        id: d.id,
        code: String(data.code),
        name: String(data.name),
        isActive: data.isActive !== false,
        openingBalance: Number(data.openingBalance) || 0,
      };
    });
    const existingCodes = new Set(accounts.map((a) => a.code));
    const missing = seeds.filter((seed) => !existingCodes.has(seed.code));
    if (missing.length > 0) {
      await commitSeeds(missing);
      for (const seed of missing) {
        accounts.push({
          id: seed.id,
          code: seed.code,
          name: seed.name,
          isActive: seed.isActive,
          openingBalance: seed.openingBalance,
        });
      }
    }
    await getDb().collection('stores').doc(storeId).collection('ledgerMeta').doc('coa').set(
      {
        storeId,
        initialized: true,
        coaMode: mode,
        coaVersion: expectedVersion,
        accountCount: accounts.length,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    return accounts;
  }

  await commitSeeds(seeds);
  await getDb().collection('stores').doc(storeId).collection('ledgerMeta').doc('coa').set({
    storeId,
    initialized: true,
    accountCount: seeds.length,
    coaMode: mode,
    coaVersion: expectedVersion,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return seeds.map((a) => ({
    id: a.id,
    code: a.code,
    name: a.name,
    isActive: a.isActive,
    openingBalance: a.openingBalance,
  }));
}

export function accountsMap(accounts: LedgerAccount[]): Map<string, LedgerAccount> {
  return new Map(accounts.map((a) => [a.id, a]));
}

export function accountByCode(accounts: LedgerAccount[], code: string): LedgerAccount {
  return resolvePostingAccount(accounts, code) as LedgerAccount;
}

/** Posted net debit balance for inventory relief (excludes the entry being posted). */
export async function getPostedAccountNetDebitBalance(
  storeId: string,
  account: LedgerAccount,
): Promise<number> {
  const db = getDb();
  const [entriesSnap, linesSnap] = await Promise.all([
    db.collection('stores').doc(storeId).collection('journalEntries').where('status', '==', 'posted').get(),
    db.collection('stores').doc(storeId).collection('journalLines').where('accountId', '==', account.id).get(),
  ]);
  const postedEntryIds = new Set<string>(entriesSnap.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => d.id));
  const lines = linesSnap.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => {
    const data = d.data();
    return {
      accountId: String(data.accountId),
      entryId: String(data.entryId),
      debit: Number(data.debit) || 0,
      credit: Number(data.credit) || 0,
    };
  });
  return computeAccountNetDebitBalance(account.id, account.openingBalance || 0, lines, postedEntryIds);
}

export async function loadJournalLinesForEntry(storeId: string, entryId: string) {
  const snap = await getDb()
    .collection('stores')
    .doc(storeId)
    .collection('journalLines')
    .where('entryId', '==', entryId)
    .get();
  return snap.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => d.data());
}
