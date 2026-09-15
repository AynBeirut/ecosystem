/** Flatten store logos onto solid white — strips fake transparency checkerboards from exports. */

const LOGO_CANVAS_SIZE = 512;
const LOGO_MARGIN = 40;

function isCheckerboardGray(r: number, g: number, b: number): boolean {
  return (
    r > 200 &&
    r < 230 &&
    g > 200 &&
    g < 230 &&
    b > 200 &&
    b < 230 &&
    Math.abs(r - g) <= 4 &&
    Math.abs(g - b) <= 4
  );
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image file'));
    };
    img.src = url;
  });
}

/**
 * Center-fit on white 512×512 PNG; remove baked-in gray checkerboard pixels.
 */
export async function prepareStoreLogoFile(file: File): Promise<File> {
  const img = await loadImageFromFile(file);
  const canvas = document.createElement('canvas');
  canvas.width = LOGO_CANVAS_SIZE;
  canvas.height = LOGO_CANVAS_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, LOGO_CANVAS_SIZE, LOGO_CANVAS_SIZE);

  const maxSide = LOGO_CANVAS_SIZE - LOGO_MARGIN * 2;
  const scale = Math.min(maxSide / img.width, maxSide / img.height, 1);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const x = Math.floor((LOGO_CANVAS_SIZE - w) / 2);
  const y = Math.floor((LOGO_CANVAS_SIZE - h) / 2);
  ctx.drawImage(img, x, y, w, h);

  const imageData = ctx.getImageData(0, 0, LOGO_CANVAS_SIZE, LOGO_CANVAS_SIZE);
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (isCheckerboardGray(r, g, b)) {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Logo export failed'))), 'image/png');
  });

  const baseName = file.name.replace(/\.[^.]+$/, '') || 'store-logo';
  return new File([blob], `${baseName}-marketplace.png`, { type: 'image/png' });
}

export function readFilePreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Preview read failed'));
    reader.readAsDataURL(file);
  });
}
