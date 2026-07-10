/**
 * Unified DB ops — Firestore (Grabio) by default; Supabase when VITE_USE_SUPABASE_LEGACY=true.
 * Matches supabaseOps API so AppContext needs no per-entity changes.
 */

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getFinanceDb } from '@/integrations/firebase/client';
import { getReadableError } from '@/lib/getReadableError';
import { retryRequest } from '@/lib/retryRequest';
import { toast } from 'sonner';
import { FINANCE_COLLECTIONS } from '@/lib/firestore/paths';
import { patchToFirestore, rowToFirestore } from '@/lib/firestore/mappers';
import { getFinanceStoreId } from '@/lib/firestore/storeContext';
import { resolveTable } from '@/lib/firestore/tableMap';
import {
  dbInsert as sbInsert,
  dbUpdate as sbUpdate,
  dbDelete as sbDelete,
  dbBulkInsert as sbBulkInsert,
  dbDeleteWhere as sbDeleteWhere,
  flushPendingOps as sbFlushPendingOps,
} from '@/context/helpers/supabaseOps';

type LogPrefix = string;

const USE_SUPABASE_LEGACY = import.meta.env.VITE_USE_SUPABASE_LEGACY === 'true';

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

const blockOffline = (op: string): boolean => {
  if (isOffline()) {
    toast.error('You are offline. Changes cannot be saved.');
    console.warn(`[dbOps][${op}] blocked: offline`);
    return true;
  }
  return false;
};

const reportError = (prefix: LogPrefix, op: string, err: unknown) => {
  console.error(`[${prefix}][${op}] DB error:`, err);
  toast.error(getReadableError(err));
};

function requireStoreId(prefix: LogPrefix): string | null {
  const storeId = getFinanceStoreId();
  if (!storeId) {
    toast.error('No active store. Please sign in again.');
    console.error(`[${prefix}] missing storeId`);
    return null;
  }
  return storeId;
}

function docRefForTable(table: string, storeId: string, id: string) {
  const loc = resolveTable(table);
  if (!loc) throw new Error(`Unknown table: ${table}`);
  if (loc.kind === 'top') return doc(getFinanceDb(), loc.collection, id);
  if (loc.kind === 'store') return doc(getFinanceDb(), 'stores', storeId, FINANCE_COLLECTIONS[loc.key], id);
  throw new Error(`No doc ref for noop table: ${table}`);
}

function colRefForTable(table: string, storeId: string) {
  const loc = resolveTable(table);
  if (!loc) throw new Error(`Unknown table: ${table}`);
  if (loc.kind === 'top') return collection(getFinanceDb(), loc.collection);
  if (loc.kind === 'store') return collection(getFinanceDb(), 'stores', storeId, FINANCE_COLLECTIONS[loc.key]);
  throw new Error(`No collection for noop table: ${table}`);
}

export const dbInsert = async (table: string, data: Record<string, unknown>, prefix: LogPrefix): Promise<boolean> => {
  if (USE_SUPABASE_LEGACY) return sbInsert(table, data, prefix);
  if (blockOffline('insert')) return false;

  const loc = resolveTable(table);
  if (loc?.kind === 'noop') return true;

  const storeId = requireStoreId(prefix);
  if (!storeId) return false;

  const id = String(data.id || '');
  if (!id) {
    reportError(prefix, 'insert', new Error('Missing document id'));
    return false;
  }

  try {
    const payload = rowToFirestore(table, storeId, data);
    await retryRequest(async () => {
      await setDoc(docRefForTable(table, storeId, id), payload);
    });
    return true;
  } catch (err) {
    reportError(prefix, 'insert', err);
    return false;
  }
};

export const dbUpdate = async (
  table: string,
  id: string,
  data: Record<string, unknown>,
  prefix: LogPrefix,
): Promise<boolean> => {
  if (USE_SUPABASE_LEGACY) return sbUpdate(table, id, data, prefix);
  if (blockOffline('update')) return false;

  const loc = resolveTable(table);
  if (loc?.kind === 'noop') return true;

  const storeId = requireStoreId(prefix);
  if (!storeId) return false;

  try {
    const patch = patchToFirestore(table, data);
    await retryRequest(async () => {
      await updateDoc(docRefForTable(table, storeId, id), patch);
    });
    return true;
  } catch (err) {
    reportError(prefix, 'update', err);
    return false;
  }
};

export const dbDelete = async (table: string, id: string, prefix: LogPrefix): Promise<boolean> => {
  if (USE_SUPABASE_LEGACY) return sbDelete(table, id, prefix);
  if (blockOffline('delete')) return false;

  const loc = resolveTable(table);
  if (loc?.kind === 'noop') return true;

  const storeId = requireStoreId(prefix);
  if (!storeId) return false;

  try {
    await retryRequest(async () => {
      await deleteDoc(docRefForTable(table, storeId, id));
    });
    return true;
  } catch (err) {
    reportError(prefix, 'delete', err);
    return false;
  }
};

export const dbBulkInsert = async (
  table: string,
  rows: Record<string, unknown>[],
  prefix: LogPrefix,
): Promise<boolean> => {
  if (USE_SUPABASE_LEGACY) return sbBulkInsert(table, rows, prefix);
  // Line items are embedded in parent finance docs on Firestore.
  if (resolveTable(table)?.kind === 'noop') return true;
  if (rows.length === 0) return true;
  if (blockOffline('bulkInsert')) return false;

  const storeId = requireStoreId(prefix);
  if (!storeId) return false;

  try {
    const batch = writeBatch(getFinanceDb());
    for (const row of rows) {
      const id = String(row.id || `${table}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
      const payload = rowToFirestore(table, storeId, row);
      batch.set(docRefForTable(table, storeId, id), payload);
    }
    await retryRequest(async () => {
      await batch.commit();
    });
    return true;
  } catch (err) {
    reportError(prefix, 'bulkInsert', err);
    return false;
  }
};

export const dbDeleteWhere = async (
  table: string,
  column: string,
  value: string,
  prefix: LogPrefix,
): Promise<boolean> => {
  if (USE_SUPABASE_LEGACY) return sbDeleteWhere(table, column, value, prefix);
  // Embedded line items — nothing to delete separately.
  if (resolveTable(table)?.kind === 'noop') return true;
  if (blockOffline('deleteWhere')) return false;

  const storeId = requireStoreId(prefix);
  if (!storeId) return false;

  try {
    const col = colRefForTable(table, storeId);
    const field = column === 'invoice_id' ? 'invoiceId' : column === 'estimate_id' ? 'estimateId' : column;
    const snap = await getDocs(query(col, where(field, '==', value)));
    if (snap.empty) return true;
    const batch = writeBatch(getFinanceDb());
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    return true;
  } catch (err) {
    reportError(prefix, 'deleteWhere', err);
    return false;
  }
};

export const flushPendingOps = async (): Promise<void> => {
  if (USE_SUPABASE_LEGACY) return sbFlushPendingOps();
};
