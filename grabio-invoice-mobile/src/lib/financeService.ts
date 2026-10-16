import firestore from '@react-native-firebase/firestore';
import type {
  FinanceClient,
  FinanceEstimate,
  FinanceExpense,
  FinanceInvoice,
  FinanceProduct,
  FinancePurchaseOrder,
  FinanceReceipt,
  FinanceSupplier,
  LineItem,
} from '../types';
import { FINANCE_COLLECTIONS, SHARED_COLLECTIONS } from './dataModel';
import { allocateMobileDocumentNumber, isHumanDocumentNumber } from './documentSerial';
import { assertNipcoInvoiceTemplateWritable } from './nipcoInvoiceTemplateLock';

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
      description: String(row.description || row.name || ''),
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
    clientName: String(data.clientName || data.client_name || ''),
    items,
    lineItems: items,
    amount: Number(data.amount ?? data.total) || 0,
    total: Number(data.total ?? data.amount) || 0,
    currency: String(data.currency || 'USD'),
    status: (data.status as FinanceInvoice['status']) || 'draft',
    tax: data.tax != null ? Number(data.tax) : undefined,
    discount: data.discount != null ? Number(data.discount) : undefined,
    discountType: data.discountType === 'percent' ? 'percent' : data.discountType === 'fixed' ? 'fixed' : undefined,
    discountValue: data.discountValue != null ? Number(data.discountValue) : undefined,
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
  const existingSnap = input.id ? await ref.get() : null;
  const existingData = existingSnap?.data() as Record<string, unknown> | undefined;
  const invoiceNumber =
    (input.invoiceNumber && isHumanDocumentNumber(input.invoiceNumber) ? input.invoiceNumber : '') ||
    (existingData?.invoiceNumber && isHumanDocumentNumber(String(existingData.invoiceNumber))
      ? String(existingData.invoiceNumber)
      : '') ||
    (await allocateMobileDocumentNumber(storeId, 'INV'));
  const payload = {
    storeId,
    invoiceNumber,
    date: input.date || now,
    createdAt: existingData?.createdAt || now,
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
    discountType: input.discountType || 'fixed',
    discountValue: input.discountValue ?? discount,
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
      estimateNumber: data.estimateNumber ? String(data.estimateNumber) : undefined,
      date: String(data.date || data.createdAt || nowIso()),
      clientId: data.clientId ? String(data.clientId) : undefined,
      clientName: String(data.clientName || data.client_name || ''),
      items,
      amount: Number(data.amount ?? data.total) || 0,
      total: Number(data.total ?? data.amount) || 0,
      currency: String(data.currency || 'USD'),
      status: (data.status as FinanceEstimate['status']) || 'pending',
      tax: data.tax != null ? Number(data.tax) : undefined,
      discount: data.discount != null ? Number(data.discount) : undefined,
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
    estimateNumber: data.estimateNumber ? String(data.estimateNumber) : undefined,
    date: String(data.date || data.createdAt || nowIso()),
    clientId: data.clientId ? String(data.clientId) : undefined,
    clientName: String(data.clientName || data.client_name || ''),
    items,
    amount: Number(data.amount ?? data.total) || 0,
    total: Number(data.total ?? data.amount) || 0,
    currency: String(data.currency || 'USD'),
    status: (data.status as FinanceEstimate['status']) || 'pending',
    tax: data.tax != null ? Number(data.tax) : undefined,
    discount: data.discount != null ? Number(data.discount) : undefined,
    discountType: data.discountType === 'percent' ? 'percent' : data.discountType === 'fixed' ? 'fixed' : undefined,
    discountValue: data.discountValue != null ? Number(data.discountValue) : undefined,
    expiryDate: data.expiryDate ? String(data.expiryDate) : undefined,
    notes: data.notes ? String(data.notes) : undefined,
  };
}

export async function saveEstimate(
  storeId: string,
  input: Omit<FinanceEstimate, 'id' | 'date'> & { id?: string; date?: string },
): Promise<string> {
  const items = input.items.map((i) => ({
    ...i,
    name: i.description,
    description: i.description,
    subtotal: i.quantity * i.unitPrice,
  }));
  const tax = input.tax ?? 0;
  const discount = input.discount ?? 0;
  const { total } = calcTotals(items, tax, discount);
  const now = nowIso();
  const ref = input.id ? financeCol(storeId, 'estimates').doc(input.id) : financeCol(storeId, 'estimates').doc();
  const existingSnap = input.id ? await ref.get() : null;
  const existingData = existingSnap?.data() as Record<string, unknown> | undefined;
  const estimateNumber =
    (input.estimateNumber && isHumanDocumentNumber(input.estimateNumber) ? input.estimateNumber : '') ||
    (existingData?.estimateNumber && isHumanDocumentNumber(String(existingData.estimateNumber))
      ? String(existingData.estimateNumber)
      : '') ||
    (await allocateMobileDocumentNumber(storeId, 'EST'));
  await ref.set(
    {
      storeId,
      estimateNumber,
      date: input.date || existingData?.date || now,
      createdAt: existingData?.createdAt || now,
      updatedAt: now,
      clientId: input.clientId || null,
      clientName: input.clientName,
      client_name: input.clientName,
      items,
      lineItems: items,
      amount: total,
      total,
      currency: input.currency || 'USD',
      status: input.status ?? existingData?.status ?? 'pending',
      tax,
      discount,
      discountType: input.discountType || 'fixed',
      discountValue: input.discountValue ?? discount,
      expiryDate: input.expiryDate || null,
      notes: input.notes || '',
    },
    { merge: true },
  );
  return ref.id;
}

export async function deleteEstimate(storeId: string, estimateId: string): Promise<void> {
  await financeCol(storeId, 'estimates').doc(estimateId).delete();
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
      clientName: String(data.clientName || data.client_name || ''),
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
    productType:
      data.productType === 'service' || data.itemType === 'service'
        ? 'service'
        : data.productType === 'raw_material' || data.itemType === 'raw_material'
          ? 'raw_material'
          : data.productType || data.itemType
            ? 'item'
            : undefined,
    storeId,
  };
}

export async function saveProduct(
  storeId: string,
  input: Omit<FinanceProduct, 'id'> & { id?: string },
): Promise<string> {
  if (!storeId?.trim()) {
    throw new Error('Store is not ready. Sign out and sign in again.');
  }
  const now = nowIso();
  const price = Number(input.sellingPrice ?? input.price ?? input.salePrice ?? 0);
  const ref = input.id
    ? firestore().collection(SHARED_COLLECTIONS.products).doc(input.id)
    : firestore().collection(SHARED_COLLECTIONS.products).doc();
  try {
    await ref.set(
      {
        storeId,
        name: input.name,
        sku: input.sku || '',
        sellingPrice: price,
        price,
        salePrice: price,
        productType: input.productType === 'raw_material' ? 'raw_material' : input.productType === 'service' ? 'service' : 'simple',
        itemType: input.productType === 'raw_material' ? 'raw_material' : input.productType === 'service' ? 'service' : 'item',
        isSellable: input.productType !== 'raw_material',
        updatedAt: now,
        ...(input.id ? {} : { createdAt: now, inStock: true }),
      },
      { merge: true },
    );
    return ref.id;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Could not save product';
    throw new Error(message);
  }
}

export type DocumentTemplatePatch = {
  documentTemplateNumber: number;
  documentColorMode: 'colored' | 'bw';
  documentFontScale: string;
  documentBorderColor: string;
  documentHeaderSpace: number;
  documentOrgAlign: 'left' | 'center' | 'right';
  documentLogoAlign: 'left' | 'center' | 'right';
  primaryColor: string;
  documentCompanyName?: string;
  documentPhone?: string;
  documentEmail?: string;
  documentAddress?: string;
  documentTaxId?: string;
};

export async function saveFinanceDocumentFields(storeId: string, patch: Record<string, unknown>) {
  assertNipcoInvoiceTemplateWritable(storeId);
  const ref = firestore().collection(SHARED_COLLECTIONS.storeProfiles).doc(storeId);
  const snap = await ref.get();
  const current = (snap.data()?.financeDocumentSettings ?? {}) as Record<string, unknown>;
  await ref.set(
    { financeDocumentSettings: { ...current, ...patch } },
    { merge: true },
  );
}

export async function saveDocumentTemplateSettings(storeId: string, patch: DocumentTemplatePatch) {
  await saveFinanceDocumentFields(storeId, patch);
}

function matchesTerm(value: string, term: string) {
  return value.toLowerCase().includes(term.trim().toLowerCase());
}

export async function searchClients(storeId: string, term: string, max = 50): Promise<FinanceClient[]> {
  const rows = await listClients(storeId);
  return rows.filter((row) => matchesTerm(row.name, term) || matchesTerm(row.phone || '', term)).slice(0, max);
}

export async function deleteClient(storeId: string, clientId: string): Promise<void> {
  const ref = firestore().collection(SHARED_COLLECTIONS.customers).doc(clientId);
  const snap = await ref.get();
  if (!snap.exists()) return;
  const data = snap.data() || {};
  if (data.storeId && String(data.storeId) !== storeId) {
    throw new Error('This client belongs to another store.');
  }
  await ref.delete();
}

export async function getClient(storeId: string, clientId: string): Promise<FinanceClient | null> {
  const snap = await firestore().collection(SHARED_COLLECTIONS.customers).doc(clientId).get();
  if (!snap.exists()) return null;
  const data = snap.data() || {};
  if (data.storeId && String(data.storeId) !== storeId) return null;
  return {
    id: snap.id,
    name: String(data.name || ''),
    phone: data.phone ? String(data.phone) : undefined,
    email: data.email ? String(data.email) : undefined,
    address: data.address ? String(data.address) : undefined,
    taxId: data.taxId ? String(data.taxId) : undefined,
    storeId,
  };
}

export async function listSuppliers(storeId: string): Promise<FinanceSupplier[]> {
  const snap = await firestore().collection(SHARED_COLLECTIONS.suppliers).where('storeId', '==', storeId).get();
  return snap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: String(data.name || ''),
        phone: data.phone ? String(data.phone) : undefined,
        email: data.email ? String(data.email) : undefined,
        storeId,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function searchSuppliers(storeId: string, term: string, max = 50): Promise<FinanceSupplier[]> {
  const rows = await listSuppliers(storeId);
  return rows.filter((row) => matchesTerm(row.name, term)).slice(0, max);
}

export async function saveSupplier(storeId: string, input: Omit<FinanceSupplier, 'id'> & { id?: string }): Promise<string> {
  const now = nowIso();
  const ref = input.id
    ? firestore().collection(SHARED_COLLECTIONS.suppliers).doc(input.id)
    : firestore().collection(SHARED_COLLECTIONS.suppliers).doc();
  await ref.set(
    {
      storeId,
      name: input.name,
      phone: input.phone || '',
      email: input.email || '',
      updatedAt: now,
      ...(input.id ? {} : { createdAt: now }),
    },
    { merge: true },
  );
  return ref.id;
}

export async function searchProducts(storeId: string, term: string, max = 50): Promise<FinanceProduct[]> {
  const rows = await listProducts(storeId);
  return rows.filter((row) => matchesTerm(row.name, term) || matchesTerm(row.sku || '', term)).slice(0, max);
}

function mapExpense(id: string, data: Record<string, unknown>): FinanceExpense {
  const start = data.startDate || data.expenseDate || data.date || data.createdAt || nowIso();
  return {
    id,
    name: String(data.name || data.description || ''),
    description: data.description ? String(data.description) : undefined,
    category: String(data.category || 'other'),
    amount: Number(data.amount) || 0,
    startDate: String(start),
    paymentMethod: String(data.paymentMethod || data.payment_method || 'cash'),
    status: String(data.status || 'paid'),
    vendorName: data.vendorName ? String(data.vendorName) : undefined,
    notes: data.notes ? String(data.notes) : undefined,
    currency: String(data.currency || 'USD'),
  };
}

export async function listExpenses(storeId: string): Promise<FinanceExpense[]> {
  const snap = await financeCol(storeId, 'expenses').limit(200).get();
  return snap.docs.map((d) => mapExpense(d.id, d.data()));
}

export async function getExpense(storeId: string, expenseId: string): Promise<FinanceExpense | null> {
  const snap = await financeCol(storeId, 'expenses').doc(expenseId).get();
  if (!snap.exists()) return null;
  return mapExpense(snap.id, snap.data() || {});
}

export async function saveExpense(
  storeId: string,
  input: Omit<FinanceExpense, 'id'> & { id?: string },
): Promise<string> {
  const now = nowIso();
  const ref = input.id ? financeCol(storeId, 'expenses').doc(input.id) : financeCol(storeId, 'expenses').doc();
  const existing = input.id ? await ref.get() : null;
  await ref.set(
    {
      storeId,
      name: input.name,
      description: input.description || input.name,
      category: input.category || 'other',
      amount: input.amount,
      startDate: input.startDate || now,
      paymentMethod: input.paymentMethod || 'cash',
      status: input.status || 'paid',
      vendorName: input.vendorName || null,
      notes: input.notes || '',
      currency: input.currency || 'USD',
      createdAt: existing?.data()?.createdAt || now,
      updatedAt: now,
    },
    { merge: true },
  );
  return ref.id;
}

function mapPurchaseOrder(id: string, data: Record<string, unknown>): FinancePurchaseOrder {
  const items = mapLineItems(data.items || data.lineItems);
  const amount = Number(data.total ?? data.amount) || items.reduce((s, i) => s + i.subtotal, 0);
  return {
    id,
    poNumber: data.poNumber ? String(data.poNumber) : undefined,
    orderNumber: data.orderNumber ? String(data.orderNumber) : undefined,
    date: String(data.date || data.createdAt || nowIso()),
    supplierId: data.supplierId ? String(data.supplierId) : undefined,
    supplierName: String(data.supplierName || ''),
    items,
    amount,
    total: amount,
    currency: String(data.currency || 'USD'),
    status: String(data.status || 'draft'),
    notes: data.notes ? String(data.notes) : undefined,
  };
}

function mapStorePurchase(id: string, data: Record<string, unknown>): FinancePurchaseOrder {
  const items = mapLineItems(data.items || data.lineItems);
  const amount = Number(data.totalAmount ?? data.total ?? data.amount) || items.reduce((s, i) => s + i.subtotal, 0);
  const po = String(data.poNumber || data.purchaseOrderNumber || data.invoiceNumber || '').trim();
  return {
    id,
    poNumber: po || undefined,
    date: String(data.orderDate || data.date || data.createdAt || nowIso()),
    supplierId: data.supplierId ? String(data.supplierId) : undefined,
    supplierName: String(data.supplierName || data.vendorName || 'Supplier'),
    items,
    amount,
    total: amount,
    currency: String(data.currency || 'USD'),
    status: String(data.status || 'draft'),
    notes: data.notes ? String(data.notes) : undefined,
  };
}

export async function listPurchaseOrders(storeId: string): Promise<FinancePurchaseOrder[]> {
  const financeSnap = await financeCol(storeId, 'purchaseOrders').limit(200).get();
  const finance = financeSnap.docs.map((d) => mapPurchaseOrder(d.id, d.data()));
  let storePurchases: FinancePurchaseOrder[] = [];
  try {
    const snap = await firestore().collection('purchases').where('storeId', '==', storeId).limit(200).get();
    storePurchases = snap.docs.map((d) => mapStorePurchase(d.id, d.data()));
  } catch {
    storePurchases = [];
  }
  const seen = new Set(finance.map((row) => row.id));
  return [...finance, ...storePurchases.filter((row) => !seen.has(row.id))].sort((a, b) => b.date.localeCompare(a.date));
}

export async function getPurchaseOrder(storeId: string, purchaseId: string): Promise<FinancePurchaseOrder | null> {
  const snap = await financeCol(storeId, 'purchaseOrders').doc(purchaseId).get();
  if (snap.exists()) return mapPurchaseOrder(snap.id, snap.data() || {});
  const web = await firestore().collection('purchases').doc(purchaseId).get();
  if (!web.exists()) return null;
  const data = web.data() || {};
  if (data.storeId && String(data.storeId) !== storeId) return null;
  return mapStorePurchase(web.id, data);
}

async function nextPurchaseNumber(storeId: string, dateIso: string): Promise<string> {
  const day = dateIso.slice(0, 10);
  const prefix = `PO-${day}-`;
  const snap = await financeCol(storeId, 'purchaseOrders').limit(400).get();
  let max = 0;
  snap.docs.forEach((d) => {
    const num = String(d.data().poNumber || '');
    if (!num.startsWith(prefix)) return;
    const seq = Number(num.slice(prefix.length));
    if (seq > max) max = seq;
  });
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

export async function savePurchaseOrder(
  storeId: string,
  input: Omit<FinancePurchaseOrder, 'id' | 'date' | 'amount'> & { id?: string; date?: string; amount?: number },
): Promise<string> {
  const items = input.items.map((i) => ({ ...i, subtotal: i.quantity * i.unitPrice }));
  const total = items.reduce((s, i) => s + i.subtotal, 0);
  const now = nowIso();
  const ref = input.id ? financeCol(storeId, 'purchaseOrders').doc(input.id) : financeCol(storeId, 'purchaseOrders').doc();
  const existing = input.id ? await ref.get() : null;
  const existingNumber = existing?.data()?.poNumber ? String(existing.data()?.poNumber) : '';
  const poNumber = existingNumber || input.poNumber || (await nextPurchaseNumber(storeId, input.date || now));
  await ref.set(
    {
      storeId,
      poNumber,
      orderNumber: poNumber,
      date: input.date || existing?.data()?.date || now,
      createdAt: existing?.data()?.createdAt || now,
      updatedAt: now,
      supplierId: input.supplierId || null,
      supplierName: input.supplierName,
      items,
      lineItems: items,
      amount: total,
      total,
      currency: input.currency || 'USD',
      status: input.status || 'sent',
      notes: input.notes || '',
    },
    { merge: true },
  );
  return ref.id;
}

export async function recordServiceTaskPayment(
  storeId: string,
  taskId: string,
  input: { amount: number; paymentMethod: string; paymentSource?: string },
): Promise<void> {
  const { getServiceTask } = await import('./serviceTaskService');
  const task = await getServiceTask(storeId, taskId);
  if (!task) throw new Error('Service task not found');
  const now = nowIso();
  if (task.direction === 'to_freelancer') {
    await saveExpense(storeId, {
      name: `Payment to ${task.counterpartyName}`,
      category: 'subcontractor',
      amount: input.amount,
      startDate: now,
      paymentMethod: input.paymentMethod,
      status: 'paid',
      notes: task.title,
      currency: task.currency,
    });
  } else {
    await saveReceipt(storeId, {
      clientId: task.counterpartyId || undefined,
      clientName: task.counterpartyName,
      amount: input.amount,
      paymentDate: now,
      paymentMethod: input.paymentMethod,
      currency: task.currency,
      notes: `Payment for ${task.title}`,
    });
  }
  await financeCol(storeId, 'serviceTasks').doc(taskId).set(
    { lastPaymentAt: now, paymentMethod: input.paymentMethod, paymentSource: input.paymentSource || null, updatedAt: now },
    { merge: true },
  );
}

export const recordClientPlanPayment = recordServiceTaskPayment;
