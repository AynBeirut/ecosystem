import type {
  Client,
  Supplier,
  Product,
  Invoice,
  Estimate,
  PurchaseOrder,
  PaymentOrder,
  Receipt,
  Payment,
  Expense,
} from '@/context/AppContext';

const nowIso = () => new Date().toISOString();

function financeProductType(type: string): 'simple' | 'service' | 'composed' {
  if (type === 'service') return 'service';
  if (type === 'composed') return 'composed';
  return 'simple';
}

function appProductType(productType?: string, legacyType?: string): Product['type'] {
  if (legacyType === 'service' || productType === 'service') return 'service';
  if (legacyType === 'composed' || productType === 'composed') return 'composed';
  return 'product';
}

/** Platform purchase status → finance PO status (for GL / AP views). */
export function mapPlatformPurchaseStatus(platformStatus: string): PurchaseOrder['status'] {
  const s = String(platformStatus || 'draft').toLowerCase();
  if (s === 'received') return 'fulfilled';
  if (s === 'confirmed' || s === 'ordered') return 'approved';
  if (s === 'sent') return 'sent';
  if (s === 'cancelled') return 'draft';
  return 'draft';
}

/** Finance PO status → platform purchase status for writes. */
export function mapFinancePurchaseStatus(financeStatus: string): string {
  const s = String(financeStatus || 'draft').toLowerCase();
  if (s === 'fulfilled') return 'received';
  if (s === 'approved') return 'confirmed';
  if (s === 'sent') return 'sent';
  return 'draft';
}

function mapPlatformPurchaseItems(items: unknown): PurchaseOrder['items'] {
  if (!Array.isArray(items)) return [];
  return items.map((raw, idx) => {
    const item = raw as Record<string, unknown>;
    const qty = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice ?? item.unitCost ?? item.costPerUnit ?? 0) || 0;
    const subtotal = Number(item.subtotal ?? item.totalPrice ?? qty * unitPrice) || 0;
    return {
      id: String(item.id || `item-${idx}`),
      description: String(item.materialName || item.productName || item.description || 'Item'),
      quantity: qty,
      unitPrice,
      rawPrice: unitPrice,
      subtotal,
    };
  });
}

function derivePlatformPurchasePaymentStatus(
  data: Record<string, unknown>,
  total: number,
): PurchaseOrder['paymentStatus'] {
  const raw = String(data.paymentStatus || '').toLowerCase();
  if (raw === 'paid' || raw === 'unpaid' || raw === 'partial') return raw;
  const amountPaid = Number(data.amountPaid ?? data.paidAmount ?? 0) || 0;
  if (total > 0 && amountPaid >= total) return 'paid';
  if (amountPaid > 0) return 'partial';
  return 'unpaid';
}

/** Top-level `purchases` doc → finance PurchaseOrder. */
export function mapFsPlatformPurchase(id: string, data: Record<string, unknown>): PurchaseOrder {
  const items = mapPlatformPurchaseItems(data.items);
  const total = Number(
    data.total ?? data.totalCost ?? data.totalAmount ?? data.amount
      ?? items.reduce((s, i) => s + i.subtotal, 0),
  ) || 0;
  const amountPaid = Number(data.amountPaid ?? data.paidAmount ?? 0) || 0;
  return {
    id,
    date: String(data.orderDate ?? data.date ?? data.createdAt ?? nowIso()),
    supplierId: data.supplierId != null ? String(data.supplierId) : undefined,
    supplierName: String(data.supplierName ?? ''),
    items,
    amount: total,
    total,
    paidAmount: amountPaid,
    paymentStatus: derivePlatformPurchasePaymentStatus(data, total),
    currency: String(data.currency ?? 'USD'),
    status: mapPlatformPurchaseStatus(String(data.status ?? 'draft')),
    notes: data.notes ? String(data.notes) : undefined,
    source: 'platform',
    subtotal: Number(data.subtotal ?? 0) || undefined,
    taxRate: Number(data.taxRate ?? 0) || undefined,
    taxAmount: Number(data.taxAmount ?? data.vat ?? 0) || undefined,
    taxType: data.taxType != null ? String(data.taxType) : undefined,
    totalCost: Number(data.totalCost ?? 0) || undefined,
  };
}

function mapPlatformOrderItems(items: unknown): Invoice['items'] {
  if (!Array.isArray(items)) return [];
  return items.map((raw, idx) => {
    const item = raw as Record<string, unknown>;
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice ?? item.price ?? 0) || 0;
    const subtotal = Number(item.total ?? item.subtotal ?? quantity * unitPrice) || 0;
    return {
      id: String(item.id || item.productId || `item-${idx}`),
      description: String(item.name || item.description || 'Item'),
      quantity,
      unitPrice,
      subtotal,
      rawPrice: unitPrice,
    };
  });
}

function mapPlatformOrderInvoiceStatus(data: Record<string, unknown>): Invoice['status'] {
  const paymentStatus = String(data.paymentStatus || '').toLowerCase();
  const status = String(data.status || '').toLowerCase();
  const total = Number(data.total || 0) || 0;
  const amountPaid = Number(data.amountPaid ?? data.paidAmount ?? (paymentStatus === 'paid' ? total : 0)) || 0;
  if (paymentStatus === 'paid' || ['completed', 'delivered', 'paid'].includes(status)) return 'paid';
  if (amountPaid > 0 && amountPaid < total) return 'partial';
  if (status === 'pending_manual_payment') return 'pending_manual_payment';
  return 'sent';
}

/** Top-level `orders` doc -> finance Invoice view. */
export function mapFsPlatformOrder(id: string, data: Record<string, unknown>): Invoice {
  const items = mapPlatformOrderItems(data.items);
  const total = Number(data.total ?? data.amountPaid ?? items.reduce((s, i) => s + i.subtotal, 0)) || 0;
  const amountPaid = Number(data.amountPaid ?? data.paidAmount ?? (String(data.paymentStatus || '').toLowerCase() === 'paid' ? total : 0)) || 0;
  return {
    id,
    date: String(data.posSaleTimestamp ?? data.date ?? data.createdAt ?? nowIso()),
    clientId: data.customerId != null ? String(data.customerId) : undefined,
    clientName: String(data.customerName ?? 'Walk-in Customer'),
    items,
    amount: total,
    currency: String(data.currency ?? 'USD'),
    status: mapPlatformOrderInvoiceStatus(data),
    total,
    notes: data.invoiceNumber ? `Source invoice: ${String(data.invoiceNumber)}` : undefined,
    paymentMethod: data.paymentMethod ? String(data.paymentMethod) : undefined,
    paidAmount: amountPaid,
    paidAt: amountPaid > 0 ? String(data.updatedAt ?? data.posSaleTimestamp ?? data.createdAt ?? nowIso()) : undefined,
  };
}

function financeLineItemsToPurchaseItems(items: unknown): Record<string, unknown>[] {
  if (!Array.isArray(items)) return [];
  return items.map((raw) => {
    const item = raw as Record<string, unknown>;
    const qty = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice ?? item.rawPrice ?? 0) || 0;
    const subtotal = Number(item.subtotal ?? qty * unitPrice) || 0;
    const name = String(item.description || item.materialName || 'Item');
    return {
      materialName: name,
      sku: String(item.sku || ''),
      quantity: qty,
      unitCost: unitPrice,
      unitPrice,
      subtotal,
      totalPrice: subtotal,
    };
  });
}

// ——— Read: Firestore doc → app model ———

export function mapFsClient(id: string, data: Record<string, unknown>): Client {
  return {
    id,
    name: String(data.name || ''),
    address: String(data.address || ''),
    phone: String(data.phone || ''),
    email: String(data.email || ''),
    taxId: String(data.taxId || data.tax_id || ''),
  };
}

export function mapFsSupplier(id: string, data: Record<string, unknown>): Supplier {
  return {
    id,
    name: String(data.name || ''),
    address: String(data.address || ''),
    phone: String(data.phone || ''),
    email: String(data.email || ''),
  };
}

export function mapFsProduct(id: string, data: Record<string, unknown>): Product {
  const stock = data.stock ?? data.stock_quantity;
  return {
    id,
    name: String(data.name || ''),
    description: data.description ? String(data.description) : undefined,
    type: appProductType(data.productType as string, data.type as string),
    salePrice: Number(data.price ?? data.sale_price ?? 0),
    rawPrice: data.costPrice != null ? Number(data.costPrice) : data.raw_price != null ? Number(data.raw_price) : undefined,
    stockQuantity: stock != null ? Number(stock) : undefined,
    lowStockAlert: data.lowStockAlert != null ? Number(data.lowStockAlert) : data.low_stock_alert != null ? Number(data.low_stock_alert) : undefined,
    sku: data.sku ? String(data.sku) : undefined,
    category: data.category ? String(data.category) : undefined,
    components: (data.components as Product['components']) || [],
    serviceCost: Number(data.serviceCost ?? data.service_cost ?? 0),
  };
}

export function mapFsInvoice(id: string, data: Record<string, unknown>): Invoice {
  const items = (data.lineItems ?? data.items ?? []) as Invoice['items'];
  return {
    id,
    date: String(data.date ?? data.createdAt ?? nowIso()),
    clientId: data.clientId != null ? String(data.clientId) : data.client_id != null ? String(data.client_id) : undefined,
    clientName: String(data.clientName ?? data.client_name ?? ''),
    items,
    amount: Number(data.amount ?? 0),
    currency: String(data.currency ?? 'USD'),
    status: String(data.status ?? 'draft') as Invoice['status'],
    tax: data.tax != null ? Number(data.tax) : undefined,
    discount: data.discount != null ? Number(data.discount) : undefined,
    total: data.total != null ? Number(data.total) : undefined,
    template: data.template as Invoice['template'],
    notes: data.notes ? String(data.notes) : undefined,
    paymentMethod: (data.paymentMethod ?? data.payment_method) as string | null,
    paidAmount: data.paidAmount != null ? Number(data.paidAmount) : data.paid_amount != null ? Number(data.paid_amount) : undefined,
    paidAt: (data.paidAt ?? data.paid_at) as string | null,
  } as Invoice;
}

export function mapFsEstimate(id: string, data: Record<string, unknown>): Estimate {
  return {
    id,
    date: String(data.date ?? data.createdAt ?? nowIso()),
    clientId: data.clientId != null ? String(data.clientId) : data.client_id != null ? String(data.client_id) : undefined,
    clientName: String(data.clientName ?? data.client_name ?? ''),
    items: (data.lineItems ?? data.items ?? []) as Estimate['items'],
    amount: Number(data.amount ?? 0),
    currency: String(data.currency ?? 'USD'),
    status: String(data.status ?? 'pending') as Estimate['status'],
    expiryDate: (data.expiryDate ?? data.expiry_date) as string | undefined,
    notes: data.notes ? String(data.notes) : undefined,
  };
}

export function mapFsPurchaseOrder(id: string, data: Record<string, unknown>): PurchaseOrder {
  const amount = Number(data.amount ?? data.total ?? 0);
  const paidAmount = Number(data.paidAmount ?? data.paid_amount ?? 0) || 0;
  return {
    id,
    date: String(data.date ?? data.createdAt ?? nowIso()),
    supplierId: data.supplierId != null ? String(data.supplierId) : data.supplier_id != null ? String(data.supplier_id) : undefined,
    supplierName: String(data.supplierName ?? data.supplier_name ?? ''),
    items: (data.lineItems ?? data.items ?? []) as PurchaseOrder['items'],
    amount,
    total: amount,
    paidAmount: paidAmount || undefined,
    currency: String(data.currency ?? 'USD'),
    status: String(data.status ?? 'draft') as PurchaseOrder['status'],
    notes: data.notes ? String(data.notes) : undefined,
    source: 'finance',
  };
}

export function mapFsPaymentOrder(id: string, data: Record<string, unknown>): PaymentOrder {
  return {
    id,
    date: String(data.date ?? data.createdAt ?? nowIso()),
    supplierId: data.supplierId != null ? String(data.supplierId) : data.supplier_id != null ? String(data.supplier_id) : undefined,
    supplierName: String(data.supplierName ?? data.supplier_name ?? ''),
    amount: Number(data.amount ?? 0),
    currency: String(data.currency ?? 'USD'),
    status: String(data.status ?? 'draft') as PaymentOrder['status'],
    paymentMethod: String(data.paymentMethod ?? data.payment_method ?? 'bank'),
    notes: data.notes ? String(data.notes) : undefined,
    purchaseOrderId: data.purchaseOrderId != null
      ? String(data.purchaseOrderId)
      : data.purchase_order_id != null
        ? String(data.purchase_order_id)
        : undefined,
  };
}

export function mapFsReceipt(id: string, data: Record<string, unknown>): Receipt {
  return {
    id,
    date: String(data.date ?? data.createdAt ?? nowIso()),
    clientId: data.clientId != null ? String(data.clientId) : data.client_id != null ? String(data.client_id) : undefined,
    clientName: String(data.clientName ?? data.client_name ?? ''),
    amount: Number(data.amount ?? 0),
    paymentDate: String(data.paymentDate ?? data.payment_date ?? ''),
    paymentMethod: String(data.paymentMethod ?? data.payment_method ?? ''),
    currency: String(data.currency ?? 'USD'),
    notes: data.notes ? String(data.notes) : undefined,
    category: data.category ? String(data.category) : undefined,
    vendor: data.vendor ? String(data.vendor) : undefined,
    items: (data.items ?? []) as Receipt['items'],
  };
}

export function mapFsPayment(id: string, data: Record<string, unknown>): Payment {
  return {
    id,
    invoiceId: String(data.invoiceId ?? data.invoice_id ?? ''),
    amount: Number(data.amount ?? 0),
    paymentMethod: String(data.paymentMethod ?? data.payment_method ?? 'cash'),
    paymentDate: String(data.paymentDate ?? data.payment_date ?? data.createdAt ?? nowIso()),
    notes: data.notes ? String(data.notes) : undefined,
  };
}

export function mapFsExpense(id: string, data: Record<string, unknown>): Expense {
  return {
    id,
    name: String(data.name ?? data.description ?? ''),
    description: data.description ? String(data.description) : undefined,
    category: String(data.category ?? 'other'),
    amount: Number(data.amount ?? 0),
    expenseDate: String(
      data.expenseDate ?? data.expense_date ?? data.startDate ?? data.date ?? data.createdAt ?? nowIso(),
    ),
    paymentMethod: String(data.paymentMethod ?? data.payment_method ?? 'cash'),
    status: String(data.status ?? 'paid') as Expense['status'],
    receiptUrl: data.receiptUrl ? String(data.receiptUrl) : data.receipt_url ? String(data.receipt_url) : undefined,
    notes: data.notes ? String(data.notes) : undefined,
  };
}

// ——— Write: Supabase-shaped row → Firestore doc ———

export function rowToFirestore(table: string, storeId: string, row: Record<string, unknown>): Record<string, unknown> {
  const ts = nowIso();
  switch (table) {
    case 'clients':
      return {
        storeId,
        name: row.name,
        address: row.address || '',
        phone: row.phone || '',
        email: row.email || '',
        taxId: row.tax_id || '',
        financeClient: true,
        status: 'active',
        createdAt: ts,
        updatedAt: ts,
      };
    case 'products':
      return {
        storeId,
        name: row.name,
        description: row.description || '',
        price: row.sale_price ?? 0,
        costPrice: row.raw_price ?? 0,
        stock: row.stock_quantity ?? 0,
        productType: financeProductType(String(row.type || 'product')),
        sku: row.sku || '',
        category: row.category || 'General',
        inStock: Number(row.stock_quantity ?? 0) > 0,
        listedInStore: false,
        financeCatalog: true,
        deliveryTime: '1-3 days',
        image: '',
        components: row.components || [],
        serviceCost: row.service_cost ?? 0,
        lowStockAlert: row.low_stock_alert ?? 10,
        createdAt: ts,
        updatedAt: ts,
      };
    case 'invoices':
      return {
        storeId,
        clientId: row.client_id || null,
        clientName: row.client_name || '',
        lineItems: row.items || [],
        amount: row.amount ?? 0,
        currency: row.currency || 'USD',
        status: row.status || 'draft',
        tax: row.tax ?? 0,
        discount: row.discount ?? 0,
        total: row.total ?? row.amount ?? 0,
        template: row.template || null,
        notes: row.notes || null,
        paymentMethod: row.payment_method || null,
        paidAt: row.paid_at || null,
        date: row.date || ts,
        createdAt: row.date || ts,
        updatedAt: ts,
      };
    case 'estimates':
      return {
        storeId,
        clientId: row.client_id || null,
        clientName: row.client_name || '',
        lineItems: row.items || [],
        amount: row.amount ?? 0,
        currency: row.currency || 'USD',
        status: row.status || 'pending',
        expiryDate: row.expiry_date || null,
        notes: row.notes || null,
        date: row.date || ts,
        createdAt: row.date || ts,
        updatedAt: ts,
      };
    case 'receipts':
      return {
        storeId,
        clientId: row.client_id || null,
        clientName: row.client_name || '',
        amount: row.amount ?? 0,
        paymentDate: row.payment_date || null,
        paymentMethod: row.payment_method || '',
        currency: row.currency || 'USD',
        notes: row.notes || null,
        category: row.category || null,
        vendor: row.vendor || null,
        items: row.items || [],
        date: row.date || ts,
        createdAt: row.date || ts,
        updatedAt: ts,
      };
    case 'payments':
      return {
        storeId,
        invoiceId: row.invoice_id,
        amount: row.amount ?? 0,
        paymentMethod: row.payment_method || 'cash',
        paymentDate: row.payment_date || ts,
        notes: row.notes || null,
        createdAt: ts,
        updatedAt: ts,
      };
    case 'expenses':
      return {
        storeId,
        name: row.name,
        description: row.description || null,
        category: row.category || 'other',
        amount: row.amount ?? 0,
        expenseDate: row.expense_date || ts,
        paymentMethod: row.payment_method || 'cash',
        status: row.status || 'paid',
        receiptUrl: row.receipt_url || null,
        notes: row.notes || null,
        createdAt: ts,
        updatedAt: ts,
      };
    case 'suppliers':
      return {
        storeId,
        name: row.name,
        address: row.address || '',
        phone: row.phone || '',
        email: row.email || '',
        contactPerson: row.contact_person || row.name || '',
        supplierCode: row.supplier_code || `SUP-${Date.now()}`,
        status: 'active',
        createdAt: ts,
        updatedAt: ts,
      };
    case 'purchase_orders': {
      const items = financeLineItemsToPurchaseItems(row.items);
      const amount = Number(row.amount ?? 0);
      const financeStatus = String(row.status || 'draft');
      const poId = String(row.id || `PO-${Date.now()}`);
      return {
        storeId,
        supplierId: row.supplier_id || null,
        supplierName: row.supplier_name || '',
        items,
        subtotal: amount,
        taxAmount: 0,
        discount: 0,
        total: amount,
        totalCost: amount,
        totalAmount: amount,
        purchaseOrderNumber: poId,
        poNumber: poId,
        status: mapFinancePurchaseStatus(financeStatus),
        orderDate: row.date || ts,
        paymentStatus: 'unpaid',
        financeOrigin: true,
        createdAt: ts,
        updatedAt: ts,
      };
    }
    case 'payment_orders':
      return {
        storeId,
        supplierId: row.supplier_id || null,
        supplierName: row.supplier_name || '',
        amount: row.amount ?? 0,
        currency: row.currency || 'USD',
        status: row.status || 'draft',
        paymentMethod: row.payment_method || 'bank',
        notes: row.notes || null,
        purchaseOrderId: row.purchase_order_id || null,
        date: row.date || ts,
        createdAt: row.date || ts,
        updatedAt: ts,
      };
    case 'inventory_movements':
      return {
        storeId,
        productId: row.product_id,
        movementType: row.movement_type,
        quantity: row.quantity,
        referenceId: row.reference_id,
        referenceType: row.reference_type,
        notes: row.notes || null,
        createdAt: ts,
      };
    default:
      return { storeId, ...row, updatedAt: ts };
  }
}

export function patchToFirestore(table: string, patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { updatedAt: nowIso() };
  const mapKey = (from: string, to: string) => {
    if (patch[from] !== undefined) out[to] = patch[from];
  };

  switch (table) {
    case 'clients':
      mapKey('name', 'name');
      mapKey('address', 'address');
      mapKey('phone', 'phone');
      mapKey('email', 'email');
      mapKey('tax_id', 'taxId');
      break;
    case 'products':
      mapKey('name', 'name');
      mapKey('description', 'description');
      if (patch.type !== undefined) out.productType = financeProductType(String(patch.type));
      mapKey('sale_price', 'price');
      mapKey('raw_price', 'costPrice');
      mapKey('stock_quantity', 'stock');
      if (patch.stock_quantity !== undefined) out.inStock = Number(patch.stock_quantity) > 0;
      mapKey('low_stock_alert', 'lowStockAlert');
      mapKey('sku', 'sku');
      mapKey('category', 'category');
      mapKey('components', 'components');
      mapKey('service_cost', 'serviceCost');
      break;
    case 'invoices':
      mapKey('client_id', 'clientId');
      mapKey('client_name', 'clientName');
      if (patch.items !== undefined) out.lineItems = patch.items;
      mapKey('amount', 'amount');
      mapKey('currency', 'currency');
      mapKey('status', 'status');
      mapKey('tax', 'tax');
      mapKey('discount', 'discount');
      mapKey('total', 'total');
      mapKey('template', 'template');
      mapKey('notes', 'notes');
      mapKey('payment_method', 'paymentMethod');
      mapKey('paid_amount', 'paidAmount');
      mapKey('paid_at', 'paidAt');
      break;
    case 'estimates':
      mapKey('client_id', 'clientId');
      mapKey('client_name', 'clientName');
      if (patch.items !== undefined) out.lineItems = patch.items;
      mapKey('amount', 'amount');
      mapKey('currency', 'currency');
      mapKey('status', 'status');
      mapKey('expiry_date', 'expiryDate');
      mapKey('notes', 'notes');
      break;
    case 'receipts':
      mapKey('client_id', 'clientId');
      mapKey('client_name', 'clientName');
      mapKey('amount', 'amount');
      mapKey('payment_date', 'paymentDate');
      mapKey('payment_method', 'paymentMethod');
      mapKey('currency', 'currency');
      mapKey('notes', 'notes');
      mapKey('category', 'category');
      mapKey('vendor', 'vendor');
      mapKey('items', 'items');
      break;
    case 'suppliers':
      mapKey('name', 'name');
      mapKey('address', 'address');
      mapKey('phone', 'phone');
      mapKey('email', 'email');
      break;
    case 'purchase_orders':
      mapKey('supplier_id', 'supplierId');
      mapKey('supplier_name', 'supplierName');
      if (patch.items !== undefined) out.items = financeLineItemsToPurchaseItems(patch.items);
      if (patch.amount !== undefined) {
        out.subtotal = patch.amount;
        out.total = patch.amount;
        out.totalCost = patch.amount;
        out.totalAmount = patch.amount;
      }
      if (patch.currency !== undefined) out.currency = patch.currency;
      if (patch.status !== undefined) {
        const platformStatus = mapFinancePurchaseStatus(String(patch.status));
        out.status = platformStatus;
        if (platformStatus === 'received') out.receivedDate = nowIso();
      }
      mapKey('notes', 'notes');
      break;
    case 'payment_orders':
      mapKey('supplier_id', 'supplierId');
      mapKey('supplier_name', 'supplierName');
      mapKey('amount', 'amount');
      mapKey('currency', 'currency');
      mapKey('status', 'status');
      mapKey('payment_method', 'paymentMethod');
      mapKey('notes', 'notes');
      mapKey('purchase_order_id', 'purchaseOrderId');
      break;
    default:
      Object.assign(out, patch);
  }
  return out;
}
