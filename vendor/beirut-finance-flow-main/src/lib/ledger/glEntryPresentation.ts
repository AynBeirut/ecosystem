import type { JournalEntry, JournalLine, LedgerAccount } from '@/types/generalLedger';
import {
  buildPurchasePartyLookup,
  resolvePartyFromEntry,
  type PurchasePartyLookup,
} from '@/lib/ledger/partyStatement';
import {
  journalEntryDisplayLabel,
  journalEntryReferenceLabel,
  parseOrderMemoClientName,
  resolveOrderClientName,
  sanitizeDisplayLabel,
  sanitizeJournalMemoForDisplay,
} from '@/lib/ledger/ledgerHumanLabels';

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
  if (entry.voucherNumber?.startsWith('CRN-')) return 'CRN';
  if (entry.voucherNumber?.startsWith('DRN-')) return 'DRN';
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

function orderPresentation(
  entry: JournalEntry,
  ctx: GlPresentationContext,
  orderHints?: { clientId?: string; clientName?: string },
): Omit<GlEntryPresentation, 'typeLabel' | 'voucherLabel'> {
  const inv = entry.sourceId ? ctx.invoiceLookup.get(entry.sourceId) : undefined;
  const memoInv = entry.memo?.match(/^Order\s+(\S+)/i)?.[1] || entry.memo?.match(/^Sale\s+(\S+)/i)?.[1];
  const invoiceNumber = inv?.invoiceNumber || memoInv || '';
  const m = meta(entry);
  const clientName =
    resolveOrderClientName({
      clientId: typeof m?.clientId === 'string' ? m.clientId : undefined,
      clientName: typeof m?.clientName === 'string' ? m.clientName : undefined,
      customerId: typeof m?.customerId === 'string' ? m.customerId : undefined,
      customerName: typeof m?.customerName === 'string' ? m.customerName : undefined,
    }) ||
    resolveOrderClientName(orderHints || {}) ||
    resolveOrderClientName({ clientName: inv?.clientName }) ||
    parseOrderMemoClientName(entry.memo || '');
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
    reference: poRef && !poRef.includes('/') ? poRef : '—',
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
  const memo = sanitizeJournalMemoForDisplay((entry.memo || '').trim());
  const m = meta(entry);
  const supplierName =
    (typeof m?.supplierName === 'string' ? m.supplierName : '') ||
    (typeof m?.payee === 'string' ? m.payee : '');

  return {
    party: supplierName || exp?.name || memo || '',
    category: exp?.category || humanizeCategory(memo || '') || 'Operating expense',
    description: exp?.name || memo || 'Expense',
    reference: journalEntryReferenceLabel(entry.sourceId),
  };
}

export function presentGlEntry(
  entry: JournalEntry,
  line: JournalLine | undefined,
  ctx: GlPresentationContext,
  entryLines: JournalLine[] = [],
): GlEntryPresentation {
  const memo = sanitizeJournalMemoForDisplay((entry.memo || '').trim());
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
  if (!core.party && typeof m?.supplierName === 'string') core.party = m.supplierName;
  if (!core.party && typeof m?.clientName === 'string') core.party = m.clientName;
  if (!core.party && typeof m?.partyName === 'string') core.party = m.partyName;
  if (!core.party && typeof m?.payee === 'string') core.party = m.payee;
  if (!core.party && typeof m?.payer === 'string') core.party = m.payer;

  const party = sanitizeDisplayLabel(core.party);
  const category = sanitizeDisplayLabel(core.category) || core.category;
  const description = sanitizeDisplayLabel(core.description) || core.description;
  const reference =
    core.reference && core.reference !== '—'
      ? journalEntryReferenceLabel(core.reference, core.reference)
      : core.reference;

  return {
    typeLabel: typeLabel(entry),
    voucherLabel: journalEntryDisplayLabel(entry),
    ...core,
    party,
    category,
    description,
    reference,
  };
}

export function resolveVoucherParty(
  entry: JournalEntry,
  ctx?: Pick<GlPresentationContext, 'invoiceLookup'>,
  orderHints?: { clientId?: string; clientName?: string },
): { kind: 'client' | 'supplier' | ''; name: string } {
  const m = meta(entry);
  if (m) {
    if (typeof m.supplierName === 'string' && m.supplierName.trim()) {
      return { kind: 'supplier', name: m.supplierName.trim() };
    }
    const metaClient = resolveOrderClientName({
      clientId: typeof m.clientId === 'string' ? m.clientId : undefined,
      clientName: typeof m.clientName === 'string' ? m.clientName : undefined,
      customerId: typeof m.customerId === 'string' ? m.customerId : undefined,
      customerName: typeof m.customerName === 'string' ? m.customerName : undefined,
    });
    if (metaClient) return { kind: 'client', name: metaClient };
    if (typeof m.staffName === 'string' && m.staffName.trim()) {
      return { kind: 'client', name: m.staffName.trim() };
    }
    if (typeof m.partyName === 'string' && m.partyName.trim()) {
      const kind = m.supplierId ? 'supplier' : m.clientId ? 'client' : '';
      return { kind: kind || '', name: m.partyName.trim() };
    }
    if (typeof m.payee === 'string' && m.payee.trim()) {
      return { kind: 'supplier', name: m.payee.trim() };
    }
    if (typeof m.payer === 'string' && m.payer.trim()) {
      return { kind: 'client', name: m.payer.trim() };
    }
  }

  if (entry.sourceType === 'order') {
    const fromOrder = resolveOrderClientName(orderHints || {});
    if (fromOrder) return { kind: 'client', name: fromOrder };
    const inv = entry.sourceId && ctx?.invoiceLookup ? ctx.invoiceLookup.get(entry.sourceId) : undefined;
    const fromInvoice = resolveOrderClientName({ clientName: inv?.clientName });
    if (fromInvoice) return { kind: 'client', name: fromInvoice };
    const fromMemo = parseOrderMemoClientName(entry.memo || '');
    if (fromMemo) return { kind: 'client', name: fromMemo };
  }

  return { kind: '', name: '' };
}

export function voucherPartyLabel(entry: JournalEntry): { kind: 'client' | 'supplier' | ''; name: string } {
  return resolveVoucherParty(entry);
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
