import { describe, expect, it } from 'vitest';
import { inferSiblingSuffixDigits, nextSiblingAccountCode } from '@/lib/ledger/nextSiblingAccountCode';

describe('nextSiblingAccountCode', () => {
  it('starts at 01 under an empty parent', () => {
    expect(nextSiblingAccountCode('4111', [])).toBe('411101');
  });

  it('increments existing two-digit siblings', () => {
    expect(nextSiblingAccountCode('4111', ['411101', '411102'])).toBe('411103');
  });

  it('uses 4-digit suffix when siblings already have 4 extra digits', () => {
    expect(nextSiblingAccountCode('4111', ['41110001', '41110002'])).toBe('41110003');
  });

  it('forces 4-digit party sequence', () => {
    expect(nextSiblingAccountCode('4111', [], 4)).toBe('41110001');
    expect(nextSiblingAccountCode('110', ['1100001'], 4)).toBe('1100002');
  });

  it('infers 4 digits when mixed lengths include a 4-digit child', () => {
    expect(inferSiblingSuffixDigits('4011', ['40111', '40110001'])).toBe(4);
  });
});
