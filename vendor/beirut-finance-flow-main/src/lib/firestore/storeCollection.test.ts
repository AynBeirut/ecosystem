import { describe, expect, it } from 'vitest';
import { sanitizeForFirestore } from '@/lib/firestore/storeCollection';

describe('sanitizeForFirestore', () => {
  it('strips nested undefined values from voucherMeta', () => {
    const cleaned = sanitizeForFirestore({
      voucherType: 'PV',
      voucherMeta: {
        payee: 'shartetieh',
        checkNumber: undefined,
        checkStatus: undefined,
        amount: 1000,
      },
    });
    expect(cleaned.voucherMeta).toEqual({ payee: 'shartetieh', amount: 1000 });
  });
});
