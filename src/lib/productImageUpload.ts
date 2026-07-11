import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { R2_UPLOAD_ENABLED, uploadImageToR2 } from '@/lib/r2Upload';

/**
 * Upload a product image, routing to Cloudflare R2 when VITE_R2_UPLOAD_ENABLED=true,
 * otherwise the existing Firebase Storage path. Returns the public image URL.
 *
 * Plan-limit checks (assertCanUploadCatalogImage / trackStorageUsageAfterUpload)
 * remain the caller's responsibility so behavior is unchanged for both paths.
 */
export async function uploadProductImage(
  file: File,
  storeId: string,
  onProgress?: (percent: number) => void,
): Promise<string> {
  if (R2_UPLOAD_ENABLED) {
    const result = await uploadImageToR2(file, storeId, 'products');
    return result.url;
  }

  const safeFileName = encodeURIComponent(file.name);
  const imageRef = ref(storage, `products/${Date.now()}_${safeFileName}`);
  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(imageRef, file);
    task.on(
      'state_changed',
      (snap) => onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      (err) => reject(err),
      () => resolve(),
    );
  });
  return getDownloadURL(imageRef);
}
