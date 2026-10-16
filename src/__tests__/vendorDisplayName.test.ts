import { describe, expect, it } from 'vitest';
import { stripCashBookLineFromVendorName } from '@/lib/vendorDisplayName';

describe('stripCashBookLineFromVendorName', () => {
  it('strips invoice item lists from Le Marchet titles', () => {
    expect(stripCashBookLineFromVendorName('Le Marchet Selectif ( Chedar Cheese, Tortilla Bread …)')).toBe(
      'Le Marchet Selectif',
    );
    expect(stripCashBookLineFromVendorName('Le Marchet Selectif ( Ice, Lazagna, Water…)')).toBe('Le Marchet Selectif');
  });

  it('normalizes Le Marche / typo spellings to one vendor label', () => {
    expect(stripCashBookLineFromVendorName('Le Marche selectif ( Orange )')).toBe('Le Marchet Selectif');
    expect(stripCashBookLineFromVendorName('Le Marchet Ice For Birthday 9-5-')).toBe('Le Marchet Selectif');
  });

  it('keeps distinct suffix names without item parens', () => {
    expect(stripCashBookLineFromVendorName('Le Marchet Selectif Firas')).toBe('Le Marchet Selectif Firas');
  });
});
