import { describe, expect, it } from 'vitest';
import { isAccountsPayableCode, isAccountsReceivableCode, pickDefaultApAccount } from '@/lib/ledger/accountControlCodes';
import type { LedgerAccount } from '@/types/generalLedger';

describe('accountControlCodes', () => {
  it('does not treat Grabio 401 revenue as accounts payable', () => {
    expect(isAccountsPayableCode('401')).toBe(false);
    expect(isAccountsReceivableCode('401')).toBe(false);
  });

  it('recognizes Grabio AP/AR and PCG supplier/client codes', () => {
    expect(isAccountsPayableCode('201')).toBe(true);
    expect(isAccountsPayableCode('4011')).toBe(true);
    expect(isAccountsReceivableCode('110')).toBe(true);
    expect(isAccountsReceivableCode('4111')).toBe(true);
  });

  it('defaults AP picker to Grabio 201, not revenue 401', () => {
    const accounts: LedgerAccount[] = [
      {
        id: 'rev',
        code: '401',
        name: 'Sales',
        type: 'revenue',
        normalBalance: 'credit',
        isActive: true,
        isSystem: true,
        openingBalance: 0,
        storeId: 's',
      },
      {
        id: 'ap',
        code: '201',
        name: 'AP',
        type: 'liability',
        normalBalance: 'credit',
        isActive: true,
        isSystem: true,
        openingBalance: 0,
        storeId: 's',
      },
    ];
    expect(pickDefaultApAccount(accounts)?.id).toBe('ap');
  });
});
