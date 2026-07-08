/**
 * Cloudflare R2 upload scaffold — disabled until credentials + presign API are deployed.
 * Set VITE_R2_UPLOAD_ENABLED=true only after functions/r2 presign endpoint is live.
 */

import { getApiBaseUrl } from '@/lib/apiBase';
import { auth } from '@/lib/firebase';

export const R2_UPLOAD_ENABLED = import.meta.env.VITE_R2_UPLOAD_ENABLED === 'true';

export const R2_MAX_BYTES = 1_572_864; // ~1.5 MB per image after client-side resize

export type R2UploadResult = {
  url: string;
  key: string;
  bytes: number;
  contentType: string;
};

type PresignResponse = {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  contentType: string;
};

export async function uploadImageToR2(
  file: File,
  storeId: string,
  folder: 'products' | 'templates' | 'builder',
): Promise<R2UploadResult> {
  if (!R2_UPLOAD_ENABLED) {
    throw new Error('R2 uploads are not enabled. Continue using Firebase Storage.');
  }
  if (file.size > R2_MAX_BYTES) {
    throw new Error(`Image must be under ${Math.round(R2_MAX_BYTES / 1024 / 1024)}MB`);
  }

  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Sign in required to upload');

  const presignRes = await fetch(`${getApiBaseUrl()}/r2/presign`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      storeId,
      folder,
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
    }),
  });

  if (!presignRes.ok) {
    const err = await presignRes.text();
    throw new Error(err || 'Failed to get upload URL');
  }

  const presign = (await presignRes.json()) as PresignResponse;

  const putRes = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': presign.contentType },
    body: file,
  });

  if (!putRes.ok) {
    throw new Error('R2 upload failed');
  }

  return {
    url: presign.publicUrl,
    key: presign.key,
    bytes: file.size,
    contentType: presign.contentType,
  };
}
