// RMA (Return Merchandise Authorization) number generator

/**
 * Generate RMA number with format: RMA-{storeId}-{sequence}
 * Example: RMA-store123-00042
 */
export function generateRMANumber(storeId: string, sequence: number): string {
  return `RMA-${storeId}-${sequence.toString().padStart(5, '0')}`;
}

/**
 * Parse RMA number to extract components
 */
export function parseRMANumber(rmaNumber: string): {
  prefix: string;
  storeId: string;
  sequence: number;
} | null {
  const pattern = /^RMA-([^-]+)-(\d{5})$/;
  const match = rmaNumber.match(pattern);
  
  if (!match) {
    return null;
  }
  
  return {
    prefix: 'RMA',
    storeId: match[1],
    sequence: parseInt(match[2], 10)
  };
}

/**
 * Validate RMA number format
 */
export function validateRMANumber(rmaNumber: string): boolean {
  const pattern = /^RMA-[^-]+-\d{5}$/;
  return pattern.test(rmaNumber);
}
