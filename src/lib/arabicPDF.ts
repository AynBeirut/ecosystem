import { jsPDF } from 'jspdf';

// We'll load the font dynamically from the public folder
let arabicFontLoaded = false;
let fontLoadError = false;

/**
 * Load Arabic font from file
 */
const loadArabicFontData = async (): Promise<string | null> => {
  try {
    const response = await fetch('/fonts/Amiri-Regular.ttf');
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        // Remove data URL prefix
        const base64Data = base64.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Failed to load Arabic font:', error);
    return null;
  }
};

/**
 * Setup Arabic font support in a jsPDF document
 * @param doc - The jsPDF document instance
 */
export const setupArabicFont = async (doc: jsPDF): Promise<boolean> => {
  if (arabicFontLoaded) return true;
  if (fontLoadError) return false;

  try {
    const fontData = await loadArabicFontData();
    if (!fontData) {
      fontLoadError = true;
      return false;
    }

    // Add Amiri font to jsPDF
    doc.addFileToVFS('Amiri-Regular.ttf', fontData);
    doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
    arabicFontLoaded = true;
    return true;
  } catch (error) {
    console.warn('Failed to load Arabic font:', error);
    fontLoadError = true;
    return false;
  }
};

/**
 * Check if text contains Arabic characters
 * @param text - The text to check
 */
export const hasArabicCharacters = (text: string): boolean => {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
};

/**
 * Clean text by removing Arabic characters (fallback method)
 * Use this only if Arabic font support fails
 * @param text - The text to clean
 */
export const cleanTextForPDF = (text: string): string => {
  return text.replace(/[^\x00-\x7F]/g, '?');
};

/**
 * Write text with automatic Arabic support
 * This is the main function to use - it handles everything automatically
 * @param doc - The jsPDF document
 * @param text - The text to write
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param options - Additional text options
 */
export const writeText = (
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  options?: { align?: 'left' | 'center' | 'right' | 'justify' }
): void => {
  if (!text) {
    doc.text('', x, y, options);
    return;
  }

  const hasArabic = hasArabicCharacters(text);

  if (hasArabic && arabicFontLoaded) {
    // Use Arabic font
    const currentFont = doc.getFont();
    try {
      doc.setFont('Amiri', 'normal');
      doc.text(text, x, y, options);
      // Restore previous font
      doc.setFont(currentFont.fontName, currentFont.fontStyle);
    } catch (error) {
      console.warn('Error using Arabic font, falling back:', error);
      const cleanText = cleanTextForPDF(text);
      doc.text(cleanText, x, y, options);
    }
  } else if (hasArabic && !arabicFontLoaded) {
    // Arabic font not loaded, use clean text
    const cleanText = cleanTextForPDF(text);
    doc.text(cleanText, x, y, options);
  } else {
    // No Arabic characters, use normal text
    doc.text(text, x, y, options);
  }
};

/**
 * Initialize PDF with Arabic support
 * Call this at the start of your PDF generation
 * @param doc - The jsPDF document
 */
export const initArabicPDF = async (doc: jsPDF): Promise<void> => {
  await setupArabicFont(doc);
};

