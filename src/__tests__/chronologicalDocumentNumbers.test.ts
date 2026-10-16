import { describe, expect, it } from 'vitest';
import { rebuildChronologicalNumbers } from '../lib/chronologicalDocumentNumbers';

describe('rebuildChronologicalNumbers', () => {
  it('assigns daily sequences in date then createdAt order', () => {
    const map = rebuildChronologicalNumbers(
      [
        { id: 'b', documentDateKey: '2026-08-01', createdAtMs: 2 },
        { id: 'a', documentDateKey: '2026-08-01', createdAtMs: 1 },
        { id: 'c', documentDateKey: '2026-09-19', createdAtMs: 1 },
      ],
      'INV',
    );
    expect(map.get('a')).toBe('INV-000001');
    expect(map.get('b')).toBe('INV-000002');
    expect(map.get('c')).toBe('INV-000003');
  });
});
