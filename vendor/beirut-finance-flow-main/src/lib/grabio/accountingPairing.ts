const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ||
  'https://us-central1-market-flow-7b074.cloudfunctions.net/api';

const STORAGE_KEY = 'grabio_external_accounting_connection';

export type ExternalAccountingConnection = {
  storeId: string;
  storeName: string | null;
  connectionId: string;
  connectionToken: string;
};

export function loadExternalAccountingConnection(): ExternalAccountingConnection | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ExternalAccountingConnection;
  } catch {
    return null;
  }
}

export function saveExternalAccountingConnection(connection: ExternalAccountingConnection): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(connection));
}

export async function pairExternalAccounting(
  code: string,
  systemName: string,
): Promise<ExternalAccountingConnection> {
  const response = await fetch(`${API_BASE}/accounting/pair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, systemName }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.error || `Failed to pair (${response.status})`);
  }
  const connection: ExternalAccountingConnection = {
    storeId: data.storeId,
    storeName: data.storeName ?? null,
    connectionId: data.connectionId,
    connectionToken: data.connectionToken,
  };
  saveExternalAccountingConnection(connection);
  return connection;
}
