// DB row <-> App model mappers

import type { Client, Supplier, Product, Invoice, Estimate, PurchaseOrder, Receipt, Payment, Expense } from "../AppContext";

export const mapDbClient = (row: any): Client => ({
  id: row.id,
  name: row.name || '',
  address: row.address || '',
  phone: row.phone || '',
  email: row.email || '',
  taxId: row.tax_id || '',
});

export const mapDbSupplier = (row: any): Supplier => ({
  id: row.id,
  name: row.name || '',
  address: row.address || '',
  phone: row.phone || '',
  email: row.email || '',
});

export const mapDbProduct = (row: any): Product => ({
  id: row.id,
  name: row.name || '',
  description: row.description,
  type: row.type || 'product',
  salePrice: Number(row.sale_price) || 0,
  rawPrice: row.raw_price != null ? Number(row.raw_price) : undefined,
  stockQuantity: row.stock_quantity != null ? Number(row.stock_quantity) : undefined,
  lowStockAlert: row.low_stock_alert != null ? Number(row.low_stock_alert) : undefined,
  sku: row.sku,
  category: row.category,
  components: row.components || [],
  serviceCost: Number(row.service_cost) || 0,
});

export const mapDbInvoice = (row: any): Invoice => ({
  id: row.id,
  date: row.date || row.created_at,
  clientId: row.client_id,
  clientName: row.client_name || '',
  items: row.items || [],
  amount: Number(row.amount) || 0,
  currency: row.currency || 'USD',
  status: row.status || 'draft',
  tax: row.tax != null ? Number(row.tax) : undefined,
  discount: row.discount != null ? Number(row.discount) : undefined,
  total: row.total != null ? Number(row.total) : undefined,
  template: row.template,
  notes: row.notes,
  paymentMethod: row.payment_method || null,
  paidAt: row.paid_at || null,
} as any);

export const mapDbEstimate = (row: any): Estimate => ({
  id: row.id,
  date: row.date || row.created_at,
  clientId: row.client_id,
  clientName: row.client_name || '',
  items: row.items || [],
  amount: Number(row.amount) || 0,
  currency: row.currency || 'USD',
  status: row.status || 'pending',
  expiryDate: row.expiry_date,
  notes: row.notes,
});

export const mapDbPurchaseOrder = (row: any): PurchaseOrder => ({
  id: row.id,
  date: row.date || row.created_at,
  supplierId: row.supplier_id,
  supplierName: row.supplier_name || '',
  items: row.items || [],
  amount: Number(row.amount) || 0,
  currency: row.currency || 'USD',
  status: row.status || 'draft',
  notes: row.notes,
});

export const mapDbReceipt = (row: any): Receipt => ({
  id: row.id,
  date: row.date || row.created_at,
  clientId: row.client_id,
  clientName: row.client_name || '',
  amount: Number(row.amount) || 0,
  paymentDate: row.payment_date || '',
  paymentMethod: row.payment_method || '',
  currency: row.currency || 'USD',
  notes: row.notes,
  category: row.category,
  vendor: row.vendor,
  items: row.items || [],
});

export const mapDbPayment = (row: any): Payment => ({
  id: row.id,
  invoiceId: row.invoice_id,
  amount: Number(row.amount) || 0,
  paymentMethod: row.payment_method || 'cash',
  paymentDate: row.payment_date || row.created_at,
  notes: row.notes,
});

export const mapDbExpense = (row: any): Expense => ({
  id: row.id,
  name: row.name || '',
  description: row.description,
  category: row.category || 'other',
  amount: Number(row.amount) || 0,
  expenseDate: row.expense_date || row.created_at,
  paymentMethod: row.payment_method || 'cash',
  status: row.status || 'paid',
  receiptUrl: row.receipt_url,
  notes: row.notes,
});
