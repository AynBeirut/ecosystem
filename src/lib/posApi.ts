import { auth } from '@/lib/firebase';

const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ||
  'https://us-central1-market-flow-7b074.cloudfunctions.net/api';

export const POS_INSTALLER_URL =
  'https://firebasestorage.googleapis.com/v0/b/market-flow-7b074.firebasestorage.app/o/pos%2FGrabio-POS-Setup.exe?alt=media';

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

export async function generatePairingCode(storeId: string): Promise<{ code: string; expiresInSeconds: number }> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/pos/pairing-code`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ storeId }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.error || `Failed to generate code (${response.status})`);
  }
  return { code: data.code, expiresInSeconds: data.expiresInSeconds || 900 };
}

export async function generateInstallToken(deviceName: string): Promise<{ installToken: string; deviceName: string }> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/pos/generate-install-token`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ deviceName }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.error || `Failed to generate install token (${response.status})`);
  }
  return { installToken: data.installToken, deviceName: data.deviceName || deviceName };
}

export function downloadPairingJson(installToken: string, deviceName: string) {
  const payload = { installToken, deviceName };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'pairing.json';
  anchor.click();
  URL.revokeObjectURL(url);
}
