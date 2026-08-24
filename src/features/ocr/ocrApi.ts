import { getApiBaseUrl } from '../../lib/apiBase';
import { auth } from '../../lib/firebase';
import type { OcrDraft } from './types';

export async function scanReceiptOcr(
  storeId: string,
  imageBase64: string,
  mimeType: string,
): Promise<OcrDraft> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Sign in required');

  const res = await fetch(`${getApiBaseUrl()}/ocr/receipt`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ storeId, imageBase64, mimeType }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    draft?: OcrDraft;
  };

  if (!res.ok) {
    throw new Error(body.error || `OCR failed (${res.status})`);
  }
  if (!body.draft) {
    throw new Error('OCR returned no draft');
  }
  return body.draft;
}
