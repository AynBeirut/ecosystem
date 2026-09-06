import { auth } from '@/lib/firebase';

const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ||
  'https://us-central1-market-flow-7b074.cloudfunctions.net/api';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Sign in required');
  }
  const token = await currentUser.getIdToken();
  headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function generateAccountingPairingCode(
  storeId: string,
): Promise<{ code: string; expiresInSeconds: number }> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/accounting/pairing-code`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ storeId }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.error || `Failed to generate code (${response.status})`);
  }
  return { code: data.code, expiresInSeconds: data.expiresInSeconds || 365 * 24 * 60 * 60 };
}

export type ExternalAccountingPairResult = {
  storeId: string;
  storeName: string | null;
  connectionId: string;
  connectionToken: string;
};

const EXTERNAL_ACCOUNTING_STORAGE_KEY = 'grabio_external_accounting_connection';

export function saveExternalAccountingConnection(result: ExternalAccountingPairResult): void {
  localStorage.setItem(EXTERNAL_ACCOUNTING_STORAGE_KEY, JSON.stringify(result));
}

export function loadExternalAccountingConnection(): ExternalAccountingPairResult | null {
  const raw = localStorage.getItem(EXTERNAL_ACCOUNTING_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ExternalAccountingPairResult;
  } catch {
    return null;
  }
}

export async function pairExternalAccounting(
  code: string,
  systemName: string,
): Promise<ExternalAccountingPairResult> {
  const response = await fetch(`${API_BASE}/accounting/pair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, systemName }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.error || `Failed to pair (${response.status})`);
  }
  const result: ExternalAccountingPairResult = {
    storeId: data.storeId,
    storeName: data.storeName ?? null,
    connectionId: data.connectionId,
    connectionToken: data.connectionToken,
  };
  saveExternalAccountingConnection(result);
  return result;
}
