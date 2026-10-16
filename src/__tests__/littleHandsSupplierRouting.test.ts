import { describe, expect, it } from 'vitest';
import {
  classifyLittleHandsSupplierName,
  isLittleHandsSocialMediaName,
  shouldShowOnLittleHandsSupplierList,
} from '@/lib/littleHandsSupplierRouting';

describe('littleHandsSupplierRouting', () => {
  it('routes all social media labels to social_media', () => {
    expect(classifyLittleHandsSupplierName('Rasha Social Media')).toBe('social_media');
    expect(classifyLittleHandsSupplierName('Social Media ( Sara, Sanaa) July')).toBe('social_media');
    expect(classifyLittleHandsSupplierName('Reels Colaboration Social Media')).toBe('social_media');
    expect(isLittleHandsSocialMediaName('Anything with social media inside')).toBe(true);
  });

  it('routes payroll people off supplier list', () => {
    expect(classifyLittleHandsSupplierName('Tina Ibrahim Employee')).toBe('payroll');
    expect(shouldShowOnLittleHandsSupplierList('Tina Ibrahim Employee')).toBe(false);
    expect(shouldShowOnLittleHandsSupplierList('Angelina')).toBe(false);
    expect(shouldShowOnLittleHandsSupplierList('Nour Malek')).toBe(false);
    expect(shouldShowOnLittleHandsSupplierList('Circus Show')).toBe(false);
  });

  it('keeps real vendors', () => {
    expect(shouldShowOnLittleHandsSupplierList('Spinneys')).toBe(true);
    expect(shouldShowOnLittleHandsSupplierList('Karam Beik')).toBe(true);
  });

  it('routes divers items and Thaer gas off suppliers', () => {
    expect(classifyLittleHandsSupplierName('Masyadet Deben')).toBe('divers_misc');
    expect(classifyLittleHandsSupplierName('Flower Mothers Day')).toBe('divers_misc');
    expect(classifyLittleHandsSupplierName('Kassab')).toBe('divers_misc');
    expect(classifyLittleHandsSupplierName('Balkis')).toBe('divers_misc');
    expect(classifyLittleHandsSupplierName('Ghaz by Thaer')).toBe('fuel');
    expect(classifyLittleHandsSupplierName('Lucciana')).toBe('payroll');
    expect(classifyLittleHandsSupplierName('Mariam Fegir')).toBe('payroll');
    expect(classifyLittleHandsSupplierName('Noour Malek')).toBe('payroll');
    expect(classifyLittleHandsSupplierName('Wish Transfer Event Characters')).toBe('payroll');
    expect(classifyLittleHandsSupplierName('Charbel Ghostin')).toBe('payroll');
    expect(classifyLittleHandsSupplierName('Nour Haybe Nursery Visite')).toBe('payroll');
    expect(classifyLittleHandsSupplierName('Egg For Egg Hunt')).toBe('divers_misc');
    expect(classifyLittleHandsSupplierName('Teben For Furm')).toBe('divers_misc');
    expect(classifyLittleHandsSupplierName('Disposables')).toBe('divers_misc');
    expect(classifyLittleHandsSupplierName('Prodel Disposables')).toBe('divers_misc');
  });
});
