import firestore from '@react-native-firebase/firestore';
import type {
  FinanceClient,
  FinanceEstimate,
  FinanceInvoice,
  FinanceProduct,
  FinanceReceipt,
  LineItem,
} from '../types';
import { FINANCE_COLLECTIONS, SHARED_COLLECTIONS } from './dataModel';

const nowIso = () => new Date().toISOString();

function financeCol(storeId: string, name: keyof typeof FINANCE_COLLECTIONS) {
  return firestore().collection('stores').doc(storeId).collection(FINANCE_COLLECTIONS[name]);
}

function mapLineItems(raw: unknown): LineItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, idx) => {
    const row = item as Record<string, unknown>;
    const qty = Number(row.quantity) || 0;
    const unitPrice = Number(row.unitPrice) || 0;
    return {
      id: String(row.id || `line-${idx}`),
      description: String(row.description || ''),
      quantity: qty,
      unitPrice,
      subtotal: Number(row.subtotal) || qty * unitPrice,
      rawPrice: row.rawPrice != null ? Number(row.rawPrice) : undefined,
    };
  });
}

function mapInvoice(id: string, data: Record<string, unknown>): FinanceInvoice {
  const items = mapLineItems(data.items || data.lineItems);
  return {
    id,
    invoiceNumber: data.invoiceNumber ? String(data.invoiceNumber) : undefined,
    date: String(data.date || data.createdAt || nowIso()),
    clientId: data.clientId ? String(data.clientId) : undefined,
    clientName: String(data.clientName || ''),
    items,
    lineItems: items,
    amount: Number(data.amount ?? data.total) || 0,
    total: Number(data.total ?? data.amount) || 0,
    currency: String(data.currency || 'USD'),
    status: (data.status as FinanceInvoice['status']) || 'draft',
    tax: data.tax != null ? Number(data.tax) : undefined,
    discount: data.discount != null ? Number(data.discount) : undefined,
    notes: data.notes ? String(data.notes) : undefined,
    template: data.template ? String(data.template) : undefined,
    paymentMethod: data.paymentMethod ? String(data.paymentMethod) : undefined,
    paidAmount: data.paidAmount != null ? Number(data.paidAmount) : undefined,
    paidAt: data.paidAt ? String(data.paidAt) : undefined,
  };
}

function calcTotals(items: LineItem[], taxRate = 0, discount = 0) {
  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = Math.max(0, subtotal + taxAmount - discount);
  return { subtotal, taxAmount, total };
}

export async function fetchStoreProfile(storeId: string) {
  const snap = await firestore().collection(SHARED_COLLECTIONS.storeProfiles).doc(storeId).get();
  return snap.exists() ? snap.data() : null;
}

export async function listInvoices(storeId: string): Promise<FinanceInvoice[]> {
  const snap = await financeCol(storeId, 'invoices').orderBy('date', 'desc').limit(200).get();
  return snap.docs.map((d) => mapInvoice(d.id, d.data()));
}

export async function getInvoice(storeId: string, invoiceId: string): Promise<FinanceInvoice | null> {
  const snap = await financeCol(storeId, 'invoices').doc(invoiceId).get();
  if (!snap.exists()) return null;
  return mapInvoice(snap.id, snap.data()!);
}

export async function saveInvoice(
  storeId: string,
  input: Omit<FinanceInvoice, 'id' | 'date'> & { id?: string; date?: string },
): Promise<string> {
  const items = input.items.map((i) => ({ ...i, subtotal: i.quantity * i.unitPrice }));
  const tax = input.tax ?? 0;
  const discount = input.discount ?? 0;
  const { total } = calcTotals(items, tax, discount);
  const now = nowIso();
  const ref = input.id ? financeCol(storeId, 'invoices').doc(input.id) : financeCol(storeId, 'invoices').doc();
  const invoiceNumber = input.invoiceNumber || `INV-${Date.now()}`;
  const payload = {
    storeId,
    invoiceNumber,
    date: input.date || now,
    createdAt: now,
    updatedAt: now,
    clientId: input.clientId || null,
    clientName: input.clientName,
    items,
    lineItems: items,
    amount: total,
    total,
    currency: input.currency || 'USD',
    status: input.status || 'sent',
    tax,
    discount,
    notes: input.notes || '',
    template: input.template || 'basic',
    paymentMethod: input.paymentMethod || null,
    paidAmount: input.paidAmount ?? 0,
    paidAt: input.paidAt || null,
  };
  await ref.set(payload, { merge: true });
  return ref.id;
}

export async function updateInvoiceStatus(
  storeId: string,
  invoiceId: string,
  status: FinanceInvoice['status'],
  paidAmount?: number,
) {
  const patch: Record<string, unknown> = { status, updatedAt: nowIso() };
  if (paidAmount != null) {
    patch.paidAmount = paidAmount;
    patch.paidAt = nowIso();
  }
  await financeCol(storeId, 'invoices').doc(invoiceId).update(patch);
}

export async function listEstimates(storeId: string): Promise<FinanceEstimate[]> {
  const snap = await financeCol(storeId, 'estimates').orderBy('date', 'desc').limit(200).get();
  return snap.docs.map((d) => {
    const data = d.data();
    const items = mapLineItems(data.items || data.lineItems);
    return {
      id: d.id,
      date: String(data.date || data.createdAt || nowIso()),
      clientId: data.clientId ? String(data.clientId) : undefined,
      clientName: String(data.clientName || ''),
      items,
      amount: Number(data.amount ?? data.total) || 0,
      total: Number(data.total ?? data.amount) || 0,
      currency: String(data.currency || 'USD'),
      status: (data.status as FinanceEstimate['status']) || 'pending',
      expiryDate: data.expiryDate ? String(data.expiryDate) : undefined,
      notes: data.notes ? String(data.notes) : undefined,
    };
  });
}

export async function getEstimate(storeId: string, estimateId: string): Promise<FinanceEstimate | null> {
  const snap = await financeCol(storeId, 'estimates').doc(estimateId).get();
  if (!snap.exists()) return null;
  const data = snap.data()!;
  const items = mapLineItems(data.items || data.lineItems);
  return {
    id: snap.id,
    date: String(data.date || data.createdAt || nowIso()),
    clientId: data.clientId ? String(data.clientId) : undefined,
    clientName: String(data.clientName || ''),
    items,
    amount: Number(data.amount ?? data.total) || 0,
    total: Number(data.total ?? data.amount) || 0,
    currency: String(data.currency || 'USD'),
    status: (data.status as FinanceEstimate['status']) || 'pending',
    expiryDate: data.expiryDate ? String(data.expiryDate) : undefined,
    notes: data.notes ? String(data.notes) : undefined,
  };
}

export async function saveEstimate(
  storeId: string,
  input: Omit<FinanceEstimate, 'id' | 'date'> & { id?: string; date?: string },
): Promise<string> {
  const items = input.items.map((i) => ({ ...i, subtotal: i.quantity * i.unitPrice }));
  const { total } = calcTotals(items);
  const now = nowIso();
  const ref = input.id ? financeCol(storeId, 'estimates').doc(input.id) : financeCol(storeId, 'estimates').doc();
  await ref.set(
    {
      storeId,
      date: input.date || now,
      createdAt: now,
      updatedAt: now,
      clientId: input.clientId || null,
      clientName: input.clientName,
      items,
      lineItems: items,
      amount: total,
      total,
      currency: input.currency || 'USD',
      status: input.status || 'pending',
      expiryDate: input.expiryDate || null,
      notes: input.notes || '',
    },
    { merge: true },
  );
  return ref.id;
}

export async function convertEstimateToInvoice(storeId: string, estimateId: string): Promise<string> {
  const est = await getEstimate(storeId, estimateId);
  if (!est) throw new Error('Estimate not found');
  const invoiceId = await saveInvoice(storeId, {
    clientId: est.clientId,
    clientName: est.clientName,
    items: est.items,
    amount: est.amount,
    total: est.total,
    currency: est.currency,
    status: 'sent',
    notes: est.notes,
  });
  await financeCol(storeId, 'estimates').doc(estimateId).update({ status: 'approved', updatedAt: nowIso() });
  return invoiceId;
}

export async function listReceipts(storeId: string): Promise<FinanceReceipt[]> {
  const snap = await financeCol(storeId, 'receipts').orderBy('date', 'desc').limit(200).get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      date: String(data.date || data.createdAt || nowIso()),
      clientId: data.clientId ? String(data.clientId) : undefined,
      clientName: String(data.clientName || ''),
      amount: Number(data.amount) || 0,
      paymentDate: String(data.paymentDate || data.date || nowIso()),
      paymentMethod: String(data.paymentMethod || 'cash'),
      currency: String(data.currency || 'USD'),
      notes: data.notes ? String(data.notes) : undefined,
      invoiceId: data.invoiceId ? String(data.invoiceId) : undefined,
    };
  });
}

export async function saveReceipt(
  storeId: string,
  input: Omit<FinanceReceipt, 'id' | 'date'> & { id?: string; date?: string },
): Promise<string> {
  const now = nowIso();
  const ref = input.id ? financeCol(storeId, 'receipts').doc(input.id) : financeCol(storeId, 'receipts').doc();
  await ref.set(
    {
      storeId,
      date: input.date || now,
      createdAt: now,
      updatedAt: now,
      clientId: input.clientId || null,
      clientName: input.clientName,
      amount: input.amount,
      paymentDate: input.paymentDate || now,
      paymentMethod: input.paymentMethod || 'cash',
      currency: input.currency || 'USD',
      notes: input.notes || '',
      invoiceId: input.invoiceId || null,
    },
    { merge: true },
  );
  if (input.invoiceId) {
    const inv = await getInvoice(storeId, input.invoiceId);
    if (inv) {
      const paid = (inv.paidAmount || 0) + input.amount;
      const total = inv.total ?? inv.amount;
      await updateInvoiceStatus(storeId, input.invoiceId, paid >= total ? 'paid' : 'partial', paid);
    }
  }
  return ref.id;
}

export async function listClients(storeId: string): Promise<FinanceClient[]> {
  const snap = await firestore().collection(SHARED_COLLECTIONS.customers).where('storeId', '==', storeId).get();
  return snap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: String(data.name || ''),
        phone: data.phone ? String(data.phone) : undefined,
        email: data.email ? String(data.email) : undefined,
        address: data.address ? String(data.address) : undefined,
        taxId: data.taxId ? String(data.taxId) : undefined,
        storeId,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveClient(storeId: string, input: Omit<FinanceClient, 'id'> & { id?: string }): Promise<string> {
  const now = nowIso();
  const ref = input.id
    ? firestore().collection(SHARED_COLLECTIONS.customers).doc(input.id)
    : firestore().collection(SHARED_COLLECTIONS.customers).doc();
  await ref.set(
    {
      storeId,
      name: input.name,
      phone: input.phone || '',
      email: input.email || '',
      address: input.address || '',
      taxId: input.taxId || '',
      updatedAt: now,
      ...(input.id ? {} : { createdAt: now }),
    },
    { merge: true },
  );
  return ref.id;
}

export async function listProducts(storeId: string): Promise<FinanceProduct[]> {
  const snap = await firestore().collection(SHARED_COLLECTIONS.products).where('storeId', '==', storeId).get();
  return snap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: String(data.name || ''),
        sellingPrice: data.sellingPrice != null ? Number(data.sellingPrice) : undefined,
        price: data.price != null ? Number(data.price) : undefined,
        salePrice: data.salePrice != null ? Number(data.salePrice) : undefined,
        sku: data.sku ? String(data.sku) : undefined,
        storeId,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function productUnitPrice(p: FinanceProduct): number {
  return Number(p.sellingPrice ?? p.price ?? p.salePrice ?? 0);
}

export async function getProduct(storeId: string, productId: string): Promise<FinanceProduct | null> {
  const snap = await firestore().collection(SHARED_COLLECTIONS.products).doc(productId).get();
  if (!snap.exists()) return null;
  const data = snap.data() || {};
  if (data.storeId && String(data.storeId) !== storeId) return null;
  return {
    id: snap.id,
    name: String(data.name || ''),
    sellingPrice: data.sellingPrice != null ? Number(data.sellingPrice) : undefined,
    price: data.price != null ? Number(data.price) : undefined,
    salePrice: data.salePrice != null ? Number(data.salePrice) : undefined,
    sku: data.sku ? String(data.sku) : undefined,
    storeId,
  };
}

export async function saveProduct(
  storeId: string,
  input: Omit<FinanceProduct, 'id'> & { id?: string },
): Promise<string> {
  const now = nowIso();
  const price = Number(input.sellingPrice ?? input.price ?? input.salePrice ?? 0);
  const ref = input.id
    ? firestore().collection(SHARED_COLLECTIONS.products).doc(input.id)
    : firestore().collection(SHARED_COLLECTIONS.products).doc();
  await ref.set(
    {
      storeId,
      name: input.name,
      sku: input.sku || '',
      sellingPrice: price,
      price,
      salePrice: price,
      updatedAt: now,
      ...(input.id ? {} : { createdAt: now, inStock: true }),
    },
    { merge: true },
  );
  return ref.id;
}
