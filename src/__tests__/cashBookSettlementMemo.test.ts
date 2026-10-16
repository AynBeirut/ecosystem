import { describe, expect, it } from 'vitest';
import { parseCashBookSettlementMemo, scoreSettlementInvoiceCandidates } from '@/lib/cashBookSettlementMemo';

describe('parseCashBookSettlementMemo', () => {
  it('parses Be2yin Men Fetoura abel', () => {
    const m = parseCashBookSettlementMemo('Be2yin Men Fetoura abel');
    expect(m?.kind).toBe('prior_invoice_balance');
    expect(m?.referenceName).toBe('abel');
  });
});

describe('scoreSettlementInvoiceCandidates', () => {
  it('ranks same-amount prior purchases', () => {
    const hits = scoreSettlementInvoiceCandidates(
      [
        {
          id: 'settle',
          supplierName: 'Be2yin Men Fetoura abel',
          invoiceNumber: 'PO-6',
          orderDate: '2026-03-20',
          total: 12,
        },
        {
          id: 'prior',
          supplierName: 'Le Charcutier',
          invoiceNumber: 'PO-2026-03-01-000006',
          orderDate: '2026-03-01',
          total: 12,
        },
      ],
      {
        settlementPurchaseId: 'settle',
        settlementDate: '2026-03-20',
        amount: 12,
        referenceName: 'abel',
      },
    );
    expect(hits[0]?.purchaseId).toBe('prior');
  });
});
