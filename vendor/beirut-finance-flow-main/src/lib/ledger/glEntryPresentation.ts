import type { JournalEntry, JournalLine, LedgerAccount } from '@/types/generalLedger';
import {
  buildPurchasePartyLookup,
  resolvePartyFromEntry,
  type PurchasePartyLookup,
} from '@/lib/ledger/partyStatement';

export type InvoiceLookupRow = {
  invoiceNumber: string;
  clientName: string;
  amount?: number;
  paymentMethod?: string;
  itemsSummary?: string;
};

export type InvoiceLookup = Map<string, InvoiceLookupRow>;

export type ExpenseLookupRow = {
  category: string;
  name: string;
};

export type ExpenseLookup = Map<string, ExpenseLookupRow>;

export type PurchaseDetailRow = {
  supplierName: string;
  poRef: string;
  itemsSummary?: string;
};

export type PurchaseDetailLookup = Map<string, PurchaseDetailRow>;

export type GlPresentationContext = {
  purchaseLookup: PurchasePartyLookup;
  invoiceLookup: InvoiceLookup;
  expenseLookup: ExpenseLookup;
  purchaseDetailLookup: PurchaseDetailLookup;
  accountsById: Map<string, LedgerAccount>;
};

export type GlEntryPresentation = {
  typeLabel: string;
  voucherLabel: string;
  party: string;
  category: string;
  description: string;
  reference: string;
};

type LineItemLike = { description?: string };

type PurchaseOrderLike = {
  id: string;
  supplierId?: string;
  supplierName?: string;
  poNumber?: string;
  purchaseOrderNumber?: string;
  items?: LineItemLike[];
};

type PaymentOrderLike = {
  id: string;
  supplierId?: string;
  supplierName?: string;
  purchaseOrderId?: string;
};

type InvoiceLike = {
  id: string;
  invoiceNumber?: string;
  clientName: string;
  amount?: number;
  paymentMethod?: string;
  items?: LineItemLike[];
};

type ExpenseLike = {
  id: string;
  category: string;
  name: string;
};

function meta(entry: JournalEntry): Record<string, unknown> | undefined {
  return entry.voucherMeta as Record<string, unknown> | undefined;
}

function humanizeCategory(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^[A-Z][a-z]/.test(trimmed) && trimmed.includes(' ')) return trimmed;
  return trimmed
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function summarizeItems(items: LineItemLike[] | undefined, maxLen = 36): string {
  if (!items?.length) return '';
  const first = (items[0].description || '').trim();
  if (!first) return items.length > 1 ? `${items.length} items` : '';
  if (items.length === 1) return first.length > maxLen ? `${first.slice(0, maxLen - 1)}…` : first;
  const suffix = ` +${items.length - 1}`;
  const room = Math.max(8, maxLen - suffix.length);
  return `${first.slice(0, room)}${first.length > room ? '…' : ''}${suffix}`;
}

export function createGlPresentationContext(
  purchaseOrders: PurchaseOrderLike[] = [],
  paymentOrders: PaymentOrderLike[] = [],
  invoices: InvoiceLike[] = [],
  expenses: ExpenseLike[] = [],
  accounts: LedgerAccount[] = [],
): GlPresentationContext {
  const invoiceLookup: InvoiceLookup = new Map();
  for (const inv of invoices) {
    invoiceLookup.set(inv.id, {
      invoiceNumber: inv.invoiceNumber || inv.id,
      clientName: inv.clientName || '',
      amount: inv.amount,
      paymentMethod: inv.paymentMethod,
      itemsSummary: summarizeItems(inv.items),
    });
  }

  const purchaseDetailLookup: PurchaseDetailLookup = new Map();
  for (const po of purchaseOrders) {
    const poRef = po.poNumber || po.purchaseOrderNumber || po.id;
    purchaseDetailLookup.set(po.id, {
      supplierName: po.supplierName || '',
      poRef,
      itemsSummary: summarizeItems(po.items),
    });
  }
  for (const payment of paymentOrders) {
    const linked = payment.purchaseOrderId ? purchaseDetailLookup.get(payment.purchaseOrderId) : undefined;
    purchaseDetailLookup.set(payment.id, {
      supplierName: payment.supplierName || linked?.supplierName || '',
      poRef: linked?.poRef || payment.purchaseOrderId || payment.id,
      itemsSummary: linked?.itemsSummary,
    });
  }

  const expenseLookup: ExpenseLookup = new Map();
  for (const exp of expenses) {
    expenseLookup.set(exp.id, {
      category: humanizeCategory(exp.category || exp.name),
      name: exp.name || '',
    });
  }

  const accountsById = new Map(accounts.map((a) => [a.id, a]));

  return {
    purchaseLookup: buildPurchasePartyLookup(purchaseOrders, paymentOrders),
    invoiceLookup,
    expenseLookup,
    purchaseDetailLookup,
    accountsById,
  };
}

function typeLabel(entry: JournalEntry): string {
  if (entry.voucherType) return entry.voucherType;
  if (entry.voucherNumber?.startsWith('RV-')) return 'RV';
  if (entry.voucherNumber?.startsWith('PV-')) return 'PV';
  if (entry.voucherNumber?.startsWith('JV-')) return 'JV';
  if (entry.voucherNumber?.startsWith('CV-')) return 'CV';
  if (entry.sourceType === 'order') return 'Sale';
  if (entry.sourceType === 'purchase') return 'Purchase';
  if (entry.sourceType === 'purchase_payment') return 'PV';
  if (entry.sourceType === 'expense') return 'Expense';
  return 'System';
}

function accountLabel(account: LedgerAccount | undefined): string {
  if (!account) return '';
  return account.name || account.code;
}

function resolveOffsetCategory(
  entry: JournalEntry,
  line: JournalLine | undefined,
  entryLines: JournalLine[],
  ctx: GlPresentationContext,
): string {
  if (!line) return '';
  const offsets = entryLines.filter((l) => l.accountId !== line.accountId);
  if (!offsets.length) return '';

  const scored = offsets.map((l) => {
    const acct = ctx.accountsById.get(l.accountId);
    let score = 0;
    if (acct?.type === 'revenue') score += 50;
    if (acct?.type === 'expense') score += 40;
    if (acct?.type === 'liability' && (l.credit || 0) > 0) score += 30;
    if (acct?.type === 'asset' && l.accountCode.startsWith('14')) score += 25;
    if ((l.debit || 0) > 0 && acct?.type === 'expense') score += 10;
    if ((l.credit || 0) > 0 && acct?.type === 'revenue') score += 10;
    return { line: l, acct, score };
  });
  scored.sort((a, b) => b.score - a.score || a.line.lineOrder - b.line.lineOrder);
  const best = scored[0]?.acct;
  return accountLabel(best);
}

function orderPresentation(entry: JournalEntry, ctx: GlPresentationContext): Omit<GlEntryPresentation, 'typeLabel' | 'voucherLabel'> {
  const inv = entry.sourceId ? ctx.invoiceLookup.get(entry.sourceId) : undefined;
  const memoInv = entry.memo?.match(/^Order\s+(\S+)/i)?.[1];
  const invoiceNumber = inv?.invoiceNumber || memoInv || entry.sourceId?.slice(0, 8) || '';
  const clientName = inv?.clientName || (typeof meta(entry)?.payer === 'string' ? meta(entry)!.payer : '');
  const paymentHint = inv?.paymentMethod ? humanizeCategory(inv.paymentMethod) : '';
  const isReversal = entry.event.includes('reversal') || /reversal/i.test(entry.memo || '');

  return {
    party: clientName || 'Walk-in / POS',
    category: inv?.itemsSummary || 'Sales revenue',
    description: isReversal
      ? `Sales return${paymentHint ? ` · ${paymentHint}` : ''}`
      : `Cash sale${paymentHint ? ` · ${paymentHint}` : ''}`,
    reference: invoiceNumber ? `INV ${invoiceNumber.replace(/^INV-/i, '')}` : 'POS',
  };
}

function purchasePaymentPresentation(
  entry: JournalEntry,
  ctx: GlPresentationContext,
): Omit<GlEntryPresentation, 'typeLabel' | 'voucherLabel'> {
  const resolved = resolvePartyFromEntry(entry, ctx.purchaseLookup);
  const detail = entry.sourceId ? ctx.purchaseDetailLookup.get(entry.sourceId) : undefined;
  const memo = (entry.memo || '').trim();
  const poInParens = memo.match(/\((PO-[^)]+)\)/i)?.[1];
  const poRef = poInParens || detail?.poRef || resolved.refNumber;
  const supplier = detail?.supplierName || resolved.supplierName || (typeof meta(entry)?.payee === 'string' ? meta(entry)!.payee : '');

  return {
    party: supplier || 'Supplier',
    category: detail?.itemsSummary || 'Supplier payment',
    description: 'Payment to supplier',
    reference: poRef && !poRef.includes('/') ? poRef : entry.sourceId?.slice(0, 8) || '—',
  };
}

function accountPaymentPresentation(entry: JournalEntry): Omit<GlEntryPresentation, 'typeLabel' | 'voucherLabel'> {
  const memo = (entry.memo || '').trim();
  const accountPay = memo.match(/^Account payment\s+\S+\s*[—–-]\s*(.+)$/i);
  const payee = accountPay?.[1]?.trim() || (typeof meta(entry)?.payee === 'string' ? meta(entry)!.payee : '');

  return {
    party: payee || 'Payee',
    category: 'Account payment',
    description: 'Outgoing payment',
    reference:
      (typeof meta(entry)?.paymentRef === 'string' && meta(entry)!.paymentRef) ||
      entry.sourceId?.slice(0, 8) ||
      '—',
  };
}

function purchaseReceivePresentation(
  entry: JournalEntry,
  ctx: GlPresentationContext,
): Omit<GlEntryPresentation, 'typeLabel' | 'voucherLabel'> {
  const resolved = resolvePartyFromEntry(entry, ctx.purchaseLookup);
  const detail = entry.sourceId ? ctx.purchaseDetailLookup.get(entry.sourceId) : undefined;

  return {
    party: detail?.supplierName || resolved.supplierName || 'Supplier',
    category: detail?.itemsSummary || 'Inventory purchase',
    description: 'Goods received',
    reference: detail?.poRef || resolved.refNumber || '—',
  };
}

function expensePresentation(entry: JournalEntry, ctx: GlPresentationContext): Omit<GlEntryPresentation, 'typeLabel' | 'voucherLabel'> {
  const exp = entry.sourceId ? ctx.expenseLookup.get(entry.sourceId) : undefined;
  const memo = (entry.memo || '').trim();
  const memoTail = memo.match(/^Expense\s+\S+\s*[—–-]\s*(.+)$/i)?.[1]?.trim();

  return {
    party: exp?.name || memoTail || '',
    category: exp?.category || humanizeCategory(memoTail || '') || 'Operating expense',
    description: exp?.name || memoTail || 'Expense',
    reference: entry.sourceId?.slice(0, 10) || '—',
  };
}

export function presentGlEntry(
  entry: JournalEntry,
  line: JournalLine | undefined,
  ctx: GlPresentationContext,
  entryLines: JournalLine[] = [],
): GlEntryPresentation {
  const memo = (entry.memo || '').trim();
  const m = meta(entry);
  const offsetCategory = resolveOffsetCategory(entry, line, entryLines, ctx);

  let core: Omit<GlEntryPresentation, 'typeLabel' | 'voucherLabel'>;

  if (entry.sourceType === 'order' || (entry.voucherType === 'RV' && /^Order\s+/i.test(memo))) {
    core = orderPresentation(entry, ctx);
  } else if (entry.sourceType === 'purchase_payment' || /^Purchase payment/i.test(memo)) {
    core = purchasePaymentPresentation(entry, ctx);
  } else if (/^Account payment/i.test(memo)) {
    core = accountPaymentPresentation(entry);
  } else if (entry.sourceType === 'purchase' || /^Purchase\s+/i.test(memo)) {
    core = purchaseReceivePresentation(entry, ctx);
  } else if (entry.sourceType === 'expense' || /^Expense\s+/i.test(memo)) {
    core = expensePresentation(entry, ctx);
  } else if (entry.voucherType === 'PV' && typeof m?.payee === 'string') {
    core = {
      party: m.payee,
      category: offsetCategory || 'Payment',
      description: memo || 'Payment voucher',
      reference: (typeof m.paymentRef === 'string' && m.paymentRef) || '—',
    };
  } else if (entry.voucherType === 'RV' && typeof m?.payer === 'string') {
    core = {
      party: m.payer,
      category: offsetCategory || 'Receipt',
      description: memo || 'Receipt voucher',
      reference: (typeof m.receiptRef === 'string' && m.receiptRef) || '—',
    };
  } else {
    const lineDetail = line?.description?.trim();
    core = {
      party: '',
      category: offsetCategory || humanizeCategory(entry.sourceType),
      description: lineDetail && lineDetail !== memo ? `${memo || 'Entry'} · ${lineDetail}` : memo || lineDetail || '—',
      reference: entry.sourceType || 'Ledger',
    };
  }

  if (!core.category && offsetCategory) core.category = offsetCategory;
  if (!core.party && typeof m?.payee === 'string') core.party = m.payee;
  if (!core.party && typeof m?.payer === 'string') core.party = m.payer;

  return {
    typeLabel: typeLabel(entry),
    voucherLabel: entry.voucherNumber || entry.id.slice(0, 12),
    ...core,
  };
}

export function presentGlRowMemo(
  entry: JournalEntry,
  line: JournalLine | undefined,
  ctx: GlPresentationContext,
  entryLines: JournalLine[] = [],
): string {
  const p = presentGlEntry(entry, line, ctx, entryLines);
  return [p.party, p.category, p.description, p.reference !== '—' ? `(${p.reference})` : '']
    .filter(Boolean)
    .join(' · ');
}
