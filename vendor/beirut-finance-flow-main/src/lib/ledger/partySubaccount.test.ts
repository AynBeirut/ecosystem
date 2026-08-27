import { describe, expect, it } from 'vitest';
import {
  PARTY_CLIENT_PARENT,
  PARTY_SUPPLIER_PARENT,
  partyAccountTypeForKind,
  partyGrabioCode,
  partyParentCode,
} from '@/lib/ledger/partySubaccountCodes';
import { nextSiblingAccountCode } from '@/lib/ledger/nextSiblingAccountCode';

describe('partySubaccount codes', () => {
  it('clients under 401 sales, suppliers under 501 COGS', () => {
    expect(PARTY_CLIENT_PARENT).toBe('401');
    expect(PARTY_SUPPLIER_PARENT).toBe('501');
    expect(partyParentCode('client', 'lebanese')).toBe('401');
    expect(partyParentCode('supplier', 'international')).toBe('501');
    expect(partyGrabioCode('client')).toBe('401');
    expect(partyGrabioCode('supplier')).toBe('501');
  });

  it('inherits revenue/expense type from parent', () => {
    expect(partyAccountTypeForKind('client')).toEqual({ type: 'revenue', normalBalance: 'credit' });
    expect(partyAccountTypeForKind('supplier')).toEqual({ type: 'expense', normalBalance: 'debit' });
  });

  it('assigns parent + 4-digit sequence (4010001, 5010001)', () => {
    expect(nextSiblingAccountCode('401', [], 4)).toBe('4010001');
    expect(nextSiblingAccountCode('401', ['4010001', '4010002'], 4)).toBe('4010003');
    expect(nextSiblingAccountCode('501', [], 4)).toBe('5010001');
  });
});
