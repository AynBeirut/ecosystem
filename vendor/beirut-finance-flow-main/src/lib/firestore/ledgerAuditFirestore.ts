import { collection, doc, getDocs, orderBy, query, setDoc } from 'firebase/firestore';
import { getFinanceDb } from '@/integrations/firebase/client';
import { sanitizeForFirestore } from '@/lib/firestore/storeCollection';
import type { LedgerAuditAction, LedgerAuditLogEntry } from '@/types/generalLedger';

const nowIso = () => new Date().toISOString();

function auditCol(storeId: string) {
  return collection(getFinanceDb(), 'stores', storeId, 'ledgerAuditLog');
}

export async function appendLedgerAuditLog(
  storeId: string,
  action: LedgerAuditAction,
  params: { entryId?: string; actorUid?: string; memo?: string },
): Promise<string> {
  const id = `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const entry: LedgerAuditLogEntry = sanitizeForFirestore({
    id,
    storeId,
    action,
    entryId: params.entryId,
    actorUid: params.actorUid || 'system',
    timestamp: nowIso(),
    memo: params.memo,
  }) as LedgerAuditLogEntry;
  await setDoc(doc(auditCol(storeId), id), entry);
  return id;
}

export async function loadLedgerAuditLog(storeId: string, limit = 200): Promise<LedgerAuditLogEntry[]> {
  const snap = await getDocs(query(auditCol(storeId), orderBy('timestamp', 'desc')));
  return snap.docs.slice(0, limit).map((d) => ({ id: d.id, ...(d.data() as Omit<LedgerAuditLogEntry, 'id'>) }));
}
