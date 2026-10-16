import { describe, expect, it } from 'vitest';
import { shouldShowOnLittleHandsSupplierList } from '@/lib/littleHandsSupplierListEligibility';

describe('shouldShowOnLittleHandsSupplierList', () => {
  it('hides payroll and treasury noise', () => {
    expect(shouldShowOnLittleHandsSupplierList('Mariam')).toBe(false);
    expect(shouldShowOnLittleHandsSupplierList('Cynthia Helo')).toBe(false);
    expect(shouldShowOnLittleHandsSupplierList('Returne To Sara Exchange')).toBe(false);
  });

  it('keeps named vendors', () => {
    expect(shouldShowOnLittleHandsSupplierList('Spinneys')).toBe(true);
    expect(shouldShowOnLittleHandsSupplierList('Karam Beik')).toBe(true);
  });

  it('hides staff and event labor miscodes', () => {
    expect(shouldShowOnLittleHandsSupplierList('Mariam Fegir')).toBe(false);
    expect(shouldShowOnLittleHandsSupplierList('Lucciana')).toBe(false);
    expect(shouldShowOnLittleHandsSupplierList('Noour Malek')).toBe(false);
    expect(shouldShowOnLittleHandsSupplierList('Wish Transfer Event Characters')).toBe(false);
    expect(shouldShowOnLittleHandsSupplierList('Egg For Egg Hunt')).toBe(false);
  });

  it('hides marketing and animator miscodes', () => {
    expect(shouldShowOnLittleHandsSupplierList('Reels Colaboration Social Media')).toBe(false);
    expect(shouldShowOnLittleHandsSupplierList('Circus Show')).toBe(false);
    expect(shouldShowOnLittleHandsSupplierList('Zammour')).toBe(false);
    expect(shouldShowOnLittleHandsSupplierList('Karam Bek')).toBe(false);
  });
});
