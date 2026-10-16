import { describe, expect, it } from 'vitest';
import { buildTableReservationWrite, tableReservationLabel } from '@/lib/tableReservation';

describe('online table reservation', () => {
  it('stores a requested booking with a human reference', () => {
    const row = buildTableReservationWrite('store-1', {
      guestName: ' Nora ',
      guestPhone: '03000000',
      visitDate: '2026-09-28',
      visitTime: '19:30',
      partySize: 4,
      notes: 'Window',
    });
    expect(row.status).toBe('requested');
    expect(row.tableLabel).toBe('');
    expect(row.reference).toBe('TBL-2026-09-28-1930');
    expect(tableReservationLabel({ ...row, tableLabel: 'Garden 4' })).toContain('Nora');
    expect(tableReservationLabel({ ...row, tableLabel: 'Garden 4' })).toContain('Garden 4');
    expect(JSON.stringify(row)).not.toMatch(/price|salary|amount/i);
  });

  it('rejects an empty party', () => {
    expect(() => buildTableReservationWrite('store-1', {
      guestName: 'Nora',
      guestPhone: '03000000',
      visitDate: '2026-09-28',
      visitTime: '19:30',
      partySize: 0,
    })).toThrow(/Party size/);
  });
});
