// Utility to generate SRA numbers
export function generateSRANumber(storeId: string, sequence: number): string {
  return `SRA-${storeId}-${sequence.toString().padStart(5, '0')}`;
}
