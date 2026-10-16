/** Cash-book Arabic/Franco memos: balance from a prior invoice (باقي من فاتورة …). */

export type CashBookSettlementMemo = {
  kind: 'prior_invoice_balance';
  rawLine: string;
  referenceName: string;
  humanLabel: string;
};

export function parseCashBookSettlementMemo(line: string): CashBookSettlementMemo | null {
  const raw = String(line || '').trim();
  if (!raw) return null;
  const t = raw.toLowerCase().replace(/\s+/g, ' ');
  const isSettlement =
    /be2yin|baqiy|ba2yin|ba2i\b|men\s+fetoura|min\s+fetoura|من\s+فاتورة/.test(t) ||
    (/fetoura/.test(t) && /\b(abel|abdel|abd)\b/.test(t));
  if (!isSettlement) return null;

  let referenceName = '';
  const afterFetoura = t.match(/fetoura\s+([a-z][a-z\s.'-]{1,40})$/i);
  if (afterFetoura) referenceName = afterFetoura[1].trim();
  if (!referenceName) {
    const tail = t.match(/\b(abel|abdel\w*)\b/i);
    if (tail) referenceName = tail[1];
  }

  return {
    kind: 'prior_invoice_balance',
    rawLine: raw,
    referenceName,
    humanLabel: referenceName
      ? `Balance from prior invoice (${referenceName})`
      : 'Balance from prior invoice (cash-book memo)',
  };
}

export type SettlementInvoiceCandidate = {
  purchaseId: string;
  invoiceNumber: string;
  supplierName: string;
  orderDate: string;
  total: number;
  matchReason: string;
};

export function scoreSettlementInvoiceCandidates(
  purchases: Array<{
    id: string;
    supplierName?: string;
    invoiceNumber?: string;
    purchaseOrderNumber?: string;
    orderDate?: string;
    total?: number;
    totalAmount?: number;
    totalCost?: number;
  }>,
  params: {
    settlementPurchaseId: string;
    settlementDate: string;
    amount: number;
    referenceName: string;
  },
): SettlementInvoiceCandidate[] {
  const ref = params.referenceName.toLowerCase().trim();
  const amount = params.amount;
  const out: SettlementInvoiceCandidate[] = [];

  for (const p of purchases) {
    if (p.id === params.settlementPurchaseId) continue;
    const supplier = String(p.supplierName || '');
    const inv = String(p.invoiceNumber || p.purchaseOrderNumber || p.id);
    const od = String(p.orderDate || '').slice(0, 10);
    const total = Number(p.total ?? p.totalAmount ?? p.totalCost ?? 0);
    if (!od || od >= params.settlementDate.slice(0, 10)) continue;

    const reasons: string[] = [];
    if (ref && supplier.toLowerCase().includes(ref)) reasons.push(`supplier name contains “${params.referenceName}”`);
    if (Math.abs(total - amount) < 0.01) reasons.push(`same amount $${amount.toFixed(2)}`);
    if (ref && inv.toLowerCase().includes(ref)) reasons.push('invoice # mentions reference');

    if (reasons.length === 0) continue;
    out.push({
      purchaseId: p.id,
      invoiceNumber: inv,
      supplierName: supplier,
      orderDate: od,
      total,
      matchReason: reasons.join('; '),
    });
  }

  return out
    .sort((a, b) => {
      const aName = ref && a.supplierName.toLowerCase().includes(ref) ? 1 : 0;
      const bName = ref && b.supplierName.toLowerCase().includes(ref) ? 1 : 0;
      if (bName !== aName) return bName - aName;
      const aAmt = Math.abs(a.total - amount) < 0.01 ? 1 : 0;
      const bAmt = Math.abs(b.total - amount) < 0.01 ? 1 : 0;
      return bAmt - aAmt;
    })
    .slice(0, 5);
}
