import { jsPDF } from 'jspdf';

let amiriBase64Cache: string | null = null;
let vfsRegistered = false;
let arabicFontAvailable = false;

const loadBundledAmiriBase64 = async (): Promise<string> => {
  if (amiriBase64Cache) return amiriBase64Cache;
  const mod = await import('./fonts/amiri-regular-base64.txt?raw');
  amiriBase64Cache = (mod.default as string).replace(/\s+/g, '');
  return amiriBase64Cache;
};

const registerAmiriOnDoc = (doc: jsPDF, fontData: string): void => {
  if (!vfsRegistered) {
    doc.addFileToVFS('Amiri-Regular.ttf', fontData);
    vfsRegistered = true;
  }
  doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
};

const isAmiriActive = (doc: jsPDF): boolean => {
  const { fontName } = doc.getFont();
  return fontName.toLowerCase() === 'amiri';
};

/**
 * Setup Arabic font support in a jsPDF document.
 * Font is bundled (no network) so PDFs work on Windows/PWA where /fonts/*.ttf may 404.
 */
export const setupArabicFont = async (doc: jsPDF): Promise<boolean> => {
  try {
    const fontData = await loadBundledAmiriBase64();
    registerAmiriOnDoc(doc, fontData);
    arabicFontAvailable = true;
    return true;
  } catch (error) {
    console.warn('Failed to load Arabic font:', error);
    arabicFontAvailable = false;
    return false;
  }
};

/**
 * Check if text contains Arabic characters
 */
export const hasArabicCharacters = (text: string): boolean => {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
};

/**
 * Fallback when Arabic font cannot be used (ASCII placeholders, not mojibake).
 */
export const cleanTextForPDF = (text: string): string => {
  return text.replace(/[^\u0000-\u007F]/g, '?');
};

/**
 * Write text with automatic Arabic support
 */
export const writeText = (
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  options?: { align?: 'left' | 'center' | 'right' | 'justify' },
): void => {
  if (!text) {
    doc.text('', x, y, options);
    return;
  }

  const hasArabic = hasArabicCharacters(text);

  if (hasArabic && arabicFontAvailable) {
    const currentFont = doc.getFont();
    try {
      doc.setFont('Amiri', 'normal');
      if (!isAmiriActive(doc)) {
        doc.setFont(currentFont.fontName, currentFont.fontStyle);
        doc.text(cleanTextForPDF(text), x, y, options);
        return;
      }
      doc.text(text, x, y, options);
      doc.setFont(currentFont.fontName, currentFont.fontStyle);
    } catch (error) {
      console.warn('Error using Arabic font, falling back:', error);
      doc.setFont(currentFont.fontName, currentFont.fontStyle);
      doc.text(cleanTextForPDF(text), x, y, options);
    }
  } else if (hasArabic) {
    doc.text(cleanTextForPDF(text), x, y, options);
  } else {
    doc.text(text, x, y, options);
  }
};

/**
 * Initialize PDF with Arabic support — call before any writeText with Arabic.
 */
export const initArabicPDF = async (doc: jsPDF): Promise<void> => {
  await setupArabicFont(doc);
};
