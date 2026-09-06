import { describe, expect, it } from 'vitest';
import type { JournalEntry } from '@/types/generalLedger';
import {
  deriveVoucherCountersFromEntries,
  peekAutoVoucherReference,
} from '@/lib/ledger/voucherReference';

function entry(voucherNumber: string): JournalEntry {
  return {
    id: voucherNumber,
    storeId: 's1',
    date: '2026-09-04',
    memo: 'test',
    status: 'posted',
    voucherNumber,
    sourceType: 'manual',
    event: 'journal-voucher',
    currency: 'USD',
    createdAt: '2026-09-04',
    updatedAt: '2026-09-04',
  };
}

describe('auto voucher reference', () => {
  it('derives counters from register serials', () => {
    const counters = deriveVoucherCountersFromEntries([
      entry('JV-2026-00009'),
      entry('JV-2026-00010'),
      entry('PV-2026-00003'),
    ]);
    expect(counters['JV-2026']).toBe(10);
    expect(counters['PV-2026']).toBe(3);
  });

  it('peeks next JV reference for entry date year', () => {
    const ref = peekAutoVoucherReference('JV', '2026-09-04', [entry('JV-2026-00009')]);
    expect(ref).toBe('JV-2026-00010');
  });
});
