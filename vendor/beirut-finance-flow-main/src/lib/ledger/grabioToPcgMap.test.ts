import { describe, expect, it } from 'vitest';
import { GRABIO_TO_PCG_CODE, mapGrabioCodeToPcg, resolvePcgDisplay, displayPcgCode, formatPcgAccountLabel } from '@/lib/ledger/grabioToPcgMap';
import type { PcgClientAccount } from '@/types/generalLedger';

describe('grabioToPcgMap', () => {
  it('maps E-Moove trial balance accounts to PCG detail codes', () => {
    expect(mapGrabioCodeToPcg('102')).toBe('5300');
    expect(mapGrabioCodeToPcg('120')).toBe('3110');
    expect(mapGrabioCodeToPcg('201')).toBe('4011');
    expect(mapGrabioCodeToPcg('220')).toBe('4427');
    expect(mapGrabioCodeToPcg('401')).toBe('7010');
    expect(mapGrabioCodeToPcg('506')).toBe('6018');
  });

  it('resolves PCG names from generated chart', () => {
    const cash = resolvePcgDisplay('102', 'POS Cash Drawer');
    expect(cash?.pcgCode).toBe('5300');
    expect(cash?.name).toBe('Cash On Hand');
    expect(cash?.nameAr).toContain('الصندوق');

    const rm = resolvePcgDisplay('120');
    expect(rm?.pcgCode).toBe('3110');
    expect(rm?.nameAr).toContain('مخزون مواد أولية');
  });

  it('prefers client sub-account code over default PCG map', () => {
    const clientByGrabio = new Map<string, PcgClientAccount>([
      [
        '102',
        {
          id: 'x',
          clientCode: '53001000002',
          grabioOperationalCode: '102',
          parentPcgCode: '5300',
          name: 'Legacy cash',
          nameAr: 'صندوق قديم',
          currency: 'USD',
        },
      ],
    ]);
    const display = resolvePcgDisplay('102', 'POS Cash Drawer', clientByGrabio);
    expect(display?.pcgCode).toBe('53001000002');
    expect(display?.name).toBe('Legacy cash');
    expect(display?.currency).toBe('USD');
  });

  it('displayPcgCode returns PCG code for voucher-style lines', () => {
    expect(displayPcgCode('103')).toBe('5110');
    expect(displayPcgCode('401')).toBe('7010');
    expect(displayPcgCode('220')).toBe('4427');
  });

  it('formatPcgAccountLabel uses PCG code in dropdown labels', () => {
    expect(formatPcgAccountLabel({ code: '102', name: 'POS Cash Drawer' })).toBe('5300 — Cash On Hand');
  });

  it('covers every Grabio SMB seed code', () => {
    const seedCodes = [
      '101', '102', '103', '105', '106', '108', '110', '112', '120', '121', '122', '123', '125', '130', '135',
      '140', '142', '150', '151', '155', '156', '201', '202', '210', '212', '213', '220', '222', '250', '252',
      '301', '302', '303', '304', '305', '401', '402', '403', '405', '410', '450', '455', '501', '502', '503',
      '505', '506', '601', '602', '604', '610', '612', '613', '615', '616', '620', '622', '630', '650', '653',
      '655', '701', '704', '710', '713', '799',
    ];
    for (const code of seedCodes) {
      expect(GRABIO_TO_PCG_CODE[code], `missing map for ${code}`).toBeTruthy();
    }
  });
});
