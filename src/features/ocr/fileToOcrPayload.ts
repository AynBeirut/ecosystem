/** Prepare gallery/camera/PDF for OCR. File is never uploaded to Storage. */

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.72;
const MAX_BYTES = 4 * 1024 * 1024;

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.replace(/^data:[^;]+;base64,/, ''));
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

async function imageFileToJpegBase64(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not prepare image');
    ctx.drawImage(bitmap, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    return dataUrl.replace(/^data:[^;]+;base64,/, '');
  } finally {
    bitmap.close();
  }
}

export async function fileToOcrPayload(file: File): Promise<{ base64: string; mimeType: string }> {
  const mime = (file.type || '').toLowerCase();
  const name = file.name.toLowerCase();
  const isPdf = mime === 'application/pdf' || name.endsWith('.pdf');
  const isImage =
    mime.startsWith('image/') ||
    /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(name);

  if (!isPdf && !isImage) {
    throw new Error('Use a photo or PDF invoice');
  }

  if (file.size > MAX_BYTES * 1.5 && isPdf) {
    throw new Error('PDF must be under ~4MB');
  }

  if (isPdf) {
    if (file.size > MAX_BYTES) {
      throw new Error('PDF must be under 4MB');
    }
    const base64 = await readAsBase64(file);
    return { base64, mimeType: 'application/pdf' };
  }

  try {
    const base64 = await imageFileToJpegBase64(file);
    return { base64, mimeType: 'image/jpeg' };
  } catch {
    // HEIC / odd formats: send original if small enough
    if (file.size > MAX_BYTES) {
      throw new Error('Image must be under 4MB');
    }
    const base64 = await readAsBase64(file);
    return { base64, mimeType: mime || 'image/jpeg' };
  }
}
