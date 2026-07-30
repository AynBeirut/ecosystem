import { describe, expect, it } from 'vitest';
import { peekNextVoucherSerial } from '@/lib/ledger/voucherSerial';

describe('peekNextVoucherSerial', () => {
  it('increments JV counter for the year', () => {
    const a = peekNextVoucherSerial({ 'JV-2026': 3 }, 'JV', 2026);
    expect(a.next).toBe(4);
    expect(a.voucherNumber).toBe('JV-2026-00004');
  });
});
