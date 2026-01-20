// SKU and Barcode generation utilities

/**
 * Generate SKU with format: {storePrefix}-{category}-{sequence}
 * Example: STORE1-ELEC-00001
 */
export function generateSKU(
  storePrefix: string,
  category: string,
  sequence: number
): string {
  const categoryCode = category.substring(0, 4).toUpperCase();
  const sequenceStr = sequence.toString().padStart(5, '0');
  return `${storePrefix}-${categoryCode}-${sequenceStr}`;
}

/**
 * Generate EAN-13 barcode
 * Format: 13 digits with check digit
 */
export function generateBarcode(prefix: string = '200'): string {
  // Generate 12 random digits (prefix + random)
  const randomPart = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
  const barcode12 = prefix + randomPart;
  
  // Calculate check digit
  const checkDigit = calculateEAN13CheckDigit(barcode12);
  
  return barcode12 + checkDigit;
}

/**
 * Calculate EAN-13 check digit
 */
function calculateEAN13CheckDigit(barcode12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(barcode12[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit.toString();
}

/**
 * Validate SKU format
 */
export function validateSKU(sku: string): boolean {
  // Format: PREFIX-CATEGORY-SEQUENCE
  const pattern = /^[A-Z0-9]+-[A-Z]{2,4}-\d{5}$/;
  return pattern.test(sku);
}

/**
 * Validate EAN-13 barcode
 */
export function validateBarcode(barcode: string): boolean {
  if (barcode.length !== 13 || !/^\d+$/.test(barcode)) {
    return false;
  }
  
  const barcode12 = barcode.substring(0, 12);
  const checkDigit = barcode[12];
  const calculatedCheckDigit = calculateEAN13CheckDigit(barcode12);
  
  return checkDigit === calculatedCheckDigit;
}

/**
 * Check if SKU is unique in store (async - requires Firestore check)
 */
export async function checkSKUUnique(
  sku: string,
  storeId: string,
  firestoreCheck: (sku: string, storeId: string) => Promise<boolean>
): Promise<boolean> {
  return await firestoreCheck(sku, storeId);
}
