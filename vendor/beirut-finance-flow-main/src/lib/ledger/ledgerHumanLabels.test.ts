import { describe, expect, it } from 'vitest';
import {
  displayMemoForJournalEntry,
  formatExpenseJournalMemo,
  humanizeSystemJournalMemo,
  isOpaqueInternalId,
  journalEntryDisplayLabel,
  sanitizeJournalLineDescriptionForDisplay,
  sanitizeJournalMemoForDisplay,
} from '@/lib/ledger/ledgerHumanLabels';

describe('ledgerHumanLabels', () => {
  it('flags pos and firebase ids as opaque', () => {
    expect(isOpaqueInternalId('pos-8WgfKtgaE8aAXdqFhIfweEo5WFq2-bill-481')).toBe(true);
    expect(isOpaqueInternalId('8WgfKtgaE8aAXdqFhIfweEo5WFq2')).toBe(true);
    expect(isOpaqueInternalId('8WgfKtgaE8aAXdqFhIfweEo5WFq2-12')).toBe(true);
    expect(isOpaqueInternalId('17468')).toBe(false);
    expect(isOpaqueInternalId('INV-1024')).toBe(false);
  });

  it('formats expense memo from description only', () => {
    expect(
      formatExpenseJournalMemo({
        description: 'Bill #17468 - Librarie Mallah',
        category: 'supplies',
      }),
    ).toBe('Bill #17468 - Librarie Mallah');
  });

  it('strips opaque ids from parenthesized legacy expense memos', () => {
    expect(
      sanitizeJournalMemoForDisplay(
        '(Expense pos-8WgfKtgaE8aAXdqFhIfweEo5WFq2-bill-481 — Bill #17468 - Librarie Mallah)',
      ),
    ).toBe('Bill #17468 - Librarie Mallah');
  });

  it('hides internal cash-book alignment memos from the UI', () => {
    expect(
      humanizeSystemJournalMemo({
        sourceType: 'cashbook_sales',
        sourceId: '2026-08',
        memo: 'Align Class 7 to cash book column C - 2026-08',
      }),
    ).toBe('Sales adjustment — August 2026');
    expect(
      sanitizeJournalLineDescriptionForDisplay('Sales align down - cash book column C', {
        sourceType: 'cashbook_sales',
        sourceId: '2026-08',
      }),
    ).toBe('Cash');
    expect(
      displayMemoForJournalEntry({
        sourceType: 'cashbook_sales',
        sourceId: '2026-08',
        memo: 'Align Class 7 to cash book column C - 2026-08',
      }),
    ).toBe('Sales adjustment — August 2026');
  });

  it('prefers voucher number for display label', () => {
    expect(
      journalEntryDisplayLabel({
        voucherNumber: 'PV-00042',
        memo: 'Expense pos-abc — Rent',
      }),
    ).toBe('PV-00042');
  });
});
