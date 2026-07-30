import { describe, expect, it } from 'vitest';
import {
  parsePcgClientAccountsCsv,
  pcgClientAccountsToCsv,
  validateClientPcgCode,
} from '@/lib/ledger/pcgClientAccountsCsv';

describe('pcgClientAccountsCsv', () => {
  it('round-trips client account rows', () => {
    const csv = pcgClientAccountsToCsv([
      {
        id: 'a1',
        clientCode: '53001000002',
        grabioOperationalCode: '102',
        parentPcgCode: '5300',
        name: 'Cash drawer USD',
        nameAr: 'صندوق',
        currency: 'USD',
      },
    ]);
    const rows = parsePcgClientAccountsCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.clientCode).toBe('53001000002');
    expect(rows[0]?.grabioOperationalCode).toBe('102');
    expect(rows[0]?.currency).toBe('USD');
  });

  it('validates client PCG codes', () => {
    expect(validateClientPcgCode('53001000002')).toBeNull();
    expect(validateClientPcgCode('abc')).toMatch(/4–11 digits/);
  });
});
