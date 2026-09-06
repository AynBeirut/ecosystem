import { describe, expect, it } from 'vitest';
import { accountSearchScore, filterAccountsByQuery } from '@/lib/ledger/accountSearch';

describe('accountSearch', () => {
  const rows = [
    { id: 'a', code: '102', displayCode: '5300', name: 'POS Cash' },
    { id: 'b', code: '110', displayCode: '4111', name: 'Accounts Receivable' },
    { id: 'c', code: '1120', displayCode: '4111.120', name: 'AR detail' },
    { id: 'd', code: '201', displayCode: '4011', name: 'Accounts Payable' },
    { id: 'e', code: '401', displayCode: '7010', name: 'Sales' },
    { id: 'f', code: '7010', displayCode: '7010', name: 'Sales PCG' },
    { id: 'g', code: '1870', displayCode: '1870', name: 'Other' },
  ];

  const fields = (row: (typeof rows)[number]) => ({
    code: row.code,
    displayCode: row.displayCode,
    name: row.name,
  });

  it('matches code prefix, not embedded digits in mapped PCG code', () => {
    expect(accountSearchScore('20', fields(rows[3]))).toBeGreaterThan(0);
    expect(accountSearchScore('20', fields(rows[2]))).toBe(-1);
    expect(accountSearchScore('1120', fields(rows[2]))).toBeGreaterThan(0);
  });

  it('prefers 70xx over 1870 for query 70', () => {
    const hits = filterAccountsByQuery(rows, '70', fields);
    expect(hits.map((r) => r.code)).toContain('7010');
    expect(hits.map((r) => r.code)).not.toContain('1870');
  });

  it('does not match 102 when searching 20', () => {
    const hits = filterAccountsByQuery(rows, '20', fields).map((r) => r.code);
    expect(hits).not.toContain('102');
    expect(hits).toContain('201');
  });
});
