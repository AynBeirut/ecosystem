import { describe, expect, it } from 'vitest';
import { partyGrabioCode, partyParentCode } from '@/lib/ledger/partySubaccountCodes';
import { nextSiblingAccountCode } from '@/lib/ledger/nextSiblingAccountCode';

describe('partySubaccount codes', () => {
  it('uses 4111/4011 in Lebanese and 110/201 internationally', () => {
    expect(partyParentCode('client', 'lebanese')).toBe('4111');
    expect(partyParentCode('supplier', 'lebanese')).toBe('4011');
    expect(partyParentCode('client', 'international')).toBe('110');
    expect(partyParentCode('supplier', 'international')).toBe('201');
    expect(partyGrabioCode('client')).toBe('110');
    expect(partyGrabioCode('supplier')).toBe('201');
  });

  it('assigns parent + 4-digit sequence', () => {
    expect(nextSiblingAccountCode('4111', [], 4)).toBe('41110001');
    expect(nextSiblingAccountCode('4111', ['41110001', '41110002'], 4)).toBe('41110003');
  });
});
