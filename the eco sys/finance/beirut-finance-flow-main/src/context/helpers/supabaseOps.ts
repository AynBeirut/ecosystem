// Thin wrapper for Supabase CRUD with readable errors and offline blocking.
// Writes are NEVER queued silently — when offline, the operation is rejected
// and the user is told to retry. This prevents phantom local records.

import { supabase } from "@/integrations/supabase/client";
import { loadPendingOps, removePendingOp } from "./offlineQueue";
import { toast } from "sonner";
import { getReadableError } from "@/lib/getReadableError";
import { retryRequest } from "@/lib/retryRequest";

type LogPrefix = string;

const isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;

const blockOffline = (op: string): boolean => {
  if (isOffline()) {
    toast.error("You are offline. Changes cannot be saved.");
    console.warn(`[supabaseOps][${op}] blocked: offline`);
    return true;
  }
  return false;
};

const reportError = (prefix: LogPrefix, op: string, err: any) => {
  console.error(`[${prefix}][${op}] DB error:`, err);
  toast.error(getReadableError(err));
};

export const dbInsert = async (table: string, data: any, prefix: LogPrefix) => {
  if (blockOffline('insert')) return false;
  try {
    const { error } = await retryRequest(async () => await supabase.from(table as any).insert(data as any));
    if (error) { reportError(prefix, 'insert', error); return false; }
    return true;
  } catch (err) { reportError(prefix, 'insert', err); return false; }
};

export const dbUpdate = async (table: string, id: string, data: any, prefix: LogPrefix) => {
  if (blockOffline('update')) return false;
  try {
    const { error } = await retryRequest(async () => await supabase.from(table as any).update(data as any).eq('id', id));
    if (error) { reportError(prefix, 'update', error); return false; }
    return true;
  } catch (err) { reportError(prefix, 'update', err); return false; }
};

export const dbDelete = async (table: string, id: string, prefix: LogPrefix) => {
  if (blockOffline('delete')) return false;
  try {
    const { error } = await retryRequest(async () => await supabase.from(table as any).delete().eq('id', id));
    if (error) { reportError(prefix, 'delete', error); return false; }
    return true;
  } catch (err) { reportError(prefix, 'delete', err); return false; }
};

export const dbBulkInsert = async (table: string, rows: any[], prefix: LogPrefix) => {
  if (rows.length === 0) return true;
  if (blockOffline('bulkInsert')) return false;
  try {
    const { error } = await retryRequest(async () => await supabase.from(table as any).insert(rows as any));
    if (error) { reportError(prefix, 'bulkInsert', error); return false; }
    return true;
  } catch (err) { reportError(prefix, 'bulkInsert', err); return false; }
};

export const dbDeleteWhere = async (table: string, column: string, value: string, prefix: LogPrefix) => {
  if (blockOffline('deleteWhere')) return false;
  try {
    const { error } = await retryRequest(async () => await supabase.from(table as any).delete().eq(column, value));
    if (error) { reportError(prefix, 'deleteWhere', error); return false; }
    return true;
  } catch (err) { reportError(prefix, 'deleteWhere', err); return false; }
};

// Retry pending operations
export const flushPendingOps = async () => {
  const ops = loadPendingOps();
  if (ops.length === 0) return;
  console.log(`[OfflineQueue] Flushing ${ops.length} pending operations...`);

  for (const op of ops) {
    let success = false;
    try {
      if (op.action === 'insert' && op.data) {
        const { error } = await supabase.from(op.table as any).insert(op.data as any);
        success = !error;
      } else if (op.action === 'update' && op.data && op.filters?.id) {
        const { error } = await supabase.from(op.table as any).update(op.data as any).eq('id', op.filters.id);
        success = !error;
      } else if (op.action === 'delete' && op.filters?.id) {
        const { error } = await supabase.from(op.table as any).delete().eq('id', op.filters.id);
        success = !error;
      }
    } catch { /* offline still */ }

    if (success) removePendingOp(op.id);
  }
};
