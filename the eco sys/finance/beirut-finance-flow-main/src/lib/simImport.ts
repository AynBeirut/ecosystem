export interface SimClientImport {
  id: string;
  externalId: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  taxId?: string;
}

export interface SimProductImport {
  id: string;
  externalId: string;
  name: string;
  description?: string;
  type: "product" | "service";
  salePrice: number;
  rawPrice?: number;
  stockQuantity?: number;
  lowStockAlert?: number;
  sku?: string;
  category?: string;
}

export interface SimLineItemImport {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  rawPrice?: number;
  subtotal: number;
  productExternalId?: string;
  productId?: string;
}

export interface SimInvoiceImport {
  id: string;
  externalId: string;
  originalNumber: string;
  date: string;
  clientId?: string;
  clientExternalId?: string;
  clientName: string;
  items: SimLineItemImport[];
  amount: number;
  currency: string;
  status: "draft" | "sent" | "paid";
  tax?: number;
  discount?: number;
  total?: number;
  notes?: string;
}

export interface SimReceiptImport {
  id: string;
  externalId: string;
  date: string;
  clientId?: string;
  clientExternalId?: string;
  clientName: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  currency: string;
  notes?: string;
  invoiceId?: string;
  invoiceExternalId?: string;
}

export interface SimMigrationData {
  source: {
    format: "simple-invoice-manager-json";
    appVersion?: string;
    serverOrgId?: string | number;
    serverUserId?: string | number;
  };
  clients: SimClientImport[];
  products: SimProductImport[];
  invoices: SimInvoiceImport[];
  receipts: SimReceiptImport[];
  unsupportedCounts: Record<string, number>;
  warnings: string[];
}

export interface SimImportRunSummary {
  clients: number;
  products: number;
  invoices: number;
  receipts: number;
  skipped: number;
  failed: number;
  errors: string[];
}

type SimSection = Record<string, unknown>;

const CURRENCY = "USD";

function asArray(value: unknown): SimSection[] {
  return Array.isArray(value) ? value.filter((item): item is SimSection => !!item && typeof item === "object" && !Array.isArray(item)) : [];
}

function getSection(root: SimSection, name: string): SimSection[] {
  const entries = asArray(root?.InvoiceTBLs);
  const match = entries.find(entry => Object.prototype.hasOwnProperty.call(entry, name));
  return asArray(match?.[name]);
}

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function num(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = text(value).replace(/[^0-9,.-]/g, "");
  if (!raw) return 0;
  const decimalComma = /^-?\d+,\d+$/.test(raw) && !raw.includes(".");
  const normalized = decimalComma ? raw.replace(",", ".") : raw.replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function date(value: unknown): string {
  const raw = text(value);
  if (!raw) return new Date().toISOString();
  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  const epoch = Number(raw);
  if (Number.isFinite(epoch) && epoch > 0) {
    const ms = epoch > 10_000_000_000 ? epoch : epoch * 1000;
    return new Date(ms).toISOString();
  }
  return new Date().toISOString();
}

function safeId(prefix: string, externalId: string, fallback: number): string {
  const source = externalId || String(fallback);
  const clean = source.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
  return `${prefix}-${clean || fallback}`;
}

function joinAddress(row: SimSection): string {
  return [row.address_line1, row.address_line2, row.address_line3, row.state, row.pin_code]
    .map(text)
    .filter(Boolean)
    .join(", ");
}

function clientExternalId(row: SimSection): string {
  return text(row.unique_key_client) || text(row._id);
}

function productExternalId(row: SimSection): string {
  return text(row.unique_key_product) || text(row._id);
}

function invoiceExternalId(row: SimSection): string {
  return text(row.unique_key_invoice) || text(row._id) || text(row.invoice_number);
}

function lineInvoiceExternalId(row: SimSection): string {
  return text(row.unique_key_fk_invoice) || text(row.local_invoice_id);
}

function paymentExternalId(row: SimSection): string {
  return text(row.unique_key_payment) || text(row._id) || text(row.voucher_no);
}

function paymentInvoiceExternalId(row: SimSection): string {
  return text(row.unique_key_fk_invoice) || text(row.invoice_id);
}

function mapInvoiceStatus(row: SimSection): "draft" | "sent" | "paid" {
  const status = text(row.status).toLowerCase();
  if (status.includes("paid") || num(row.balance) <= 0) return "paid";
  if (status.includes("sent") || status.includes("due")) return "sent";
  return "draft";
}

function mapProductType(row: SimSection): "product" | "service" {
  const type = `${text(row.type_of_commodity)} ${text(row.product_type)} ${text(row.prod_type)}`.toLowerCase();
  return type.includes("service") ? "service" : "product";
}

export function parseSimpleInvoiceManagerBackup(input: string): SimMigrationData {
  let root: unknown;
  try {
    root = JSON.parse(input.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error("The selected .sim file is not valid JSON.");
  }

  if (!root || typeof root !== "object" || Array.isArray(root) || !Array.isArray((root as SimSection).InvoiceTBLs)) {
    throw new Error("Unsupported .sim backup: missing InvoiceTBLs.");
  }
  const backup = root as SimSection;
  const otherData = backup.OtherData && typeof backup.OtherData === "object" && !Array.isArray(backup.OtherData)
    ? backup.OtherData as SimSection
    : {};

  const warnings: string[] = [];
  const rawClients = getSection(backup, "clients");
  const rawProducts = getSection(backup, "products");
  const rawInvoices = getSection(backup, "invoice");
  const rawItems = getSection(backup, "list_item");
  const rawPayments = getSection(backup, "invoice_payment");
  const rawReceipts = getSection(backup, "tbl_recepit");

  const clients = rawClients.map((row, index): SimClientImport => {
    const externalId = clientExternalId(row);
    return {
      id: safeId("SIM-CLI", externalId, index + 1),
      externalId,
      name: text(row.name) || `Client ${index + 1}`,
      address: joinAddress(row),
      phone: text(row.number),
      email: text(row.email),
      taxId: text(row.business_id) || undefined,
    };
  });

  const clientByExternalId = new Map(clients.map(client => [client.externalId, client]));

  const products = rawProducts.map((row, index): SimProductImport => {
    const externalId = productExternalId(row);
    return {
      id: safeId("SIM-PRD", externalId, index + 1),
      externalId,
      name: text(row.prod_name) || `Product ${index + 1}`,
      description: text(row.discription) || undefined,
      type: mapProductType(row),
      salePrice: num(row.rate),
      rawPrice: num(row.buy_rate) || num(row.stock_rate) || undefined,
      stockQuantity: num(row.current_stock),
      lowStockAlert: num(row.minimum_stock) || undefined,
      sku: text(row.product_code) || text(row.barcode) || undefined,
      category: text(row.category_name) || undefined,
    };
  });

  const productByExternalId = new Map(products.map(product => [product.externalId, product]));
  const itemsByInvoice = new Map<string, SimLineItemImport[]>();
  rawItems.forEach((row, index) => {
    const invoiceKey = lineInvoiceExternalId(row);
    const productKey = text(row.unique_key_fk_product) || text(row.prod_id);
    const product = productByExternalId.get(productKey);
    const quantity = num(row.quantity) || 1;
    const unitPrice = num(row.rate);
    const subtotal = num(row.total) || quantity * unitPrice;
    const item: SimLineItemImport = {
      id: product?.id || safeId("SIM-ITEM", text(row.unique_key_list_item) || String(index + 1), index + 1),
      description: text(row.product_name) || product?.name || `Line item ${index + 1}`,
      quantity,
      unitPrice,
      subtotal,
      productExternalId: productKey || undefined,
      productId: product?.id,
    };
    itemsByInvoice.set(invoiceKey, [...(itemsByInvoice.get(invoiceKey) || []), item]);
  });

  const invoices = rawInvoices.map((row, index): SimInvoiceImport => {
    const externalId = invoiceExternalId(row);
    const clientKey = text(row.unique_key_fk_client) || text(row.customer_id);
    const client = clientByExternalId.get(clientKey);
    const amount = num(row.payable_amount) || num(row.amount) || num(row.gross_amount);
    return {
      id: safeId("SIM-INV", externalId, index + 1),
      externalId,
      originalNumber: text(row.invoice_number) || externalId || String(index + 1),
      date: date(row.created_date || row.created_on || row.device_created_date),
      clientId: client?.id,
      clientExternalId: clientKey || undefined,
      clientName: client?.name || text(row.client_name) || "Imported Client",
      items: itemsByInvoice.get(externalId) || [],
      amount,
      currency: CURRENCY,
      status: mapInvoiceStatus(row),
      tax: num(row.tax_amount) || num(row.taxrate) || undefined,
      discount: num(row.discount) || undefined,
      total: amount,
      notes: text(row.invoice_note) || text(row.reference) || undefined,
    };
  });

  const invoiceByExternalId = new Map(invoices.map(invoice => [invoice.externalId, invoice]));
  const receipts: SimReceiptImport[] = [
    ...rawPayments.map((row, index): SimReceiptImport => {
      const externalId = paymentExternalId(row);
      const invoiceKey = paymentInvoiceExternalId(row);
      const invoice = invoiceByExternalId.get(invoiceKey);
      const clientKey = text(row.unique_key_fk_client) || text(row.client_id) || invoice?.clientExternalId || "";
      const client = clientByExternalId.get(clientKey);
      return {
        id: safeId("SIM-PAY", externalId, index + 1),
        externalId,
        date: date(row.created_on || row.date_of_payment),
        clientId: client?.id || invoice?.clientId,
        clientExternalId: clientKey || undefined,
        clientName: client?.name || invoice?.clientName || "Imported Client",
        amount: num(row.paid_amount),
        paymentDate: date(row.date_of_payment || row.created_on),
        paymentMethod: text(row.payment_type) || "imported",
        currency: CURRENCY,
        notes: text(row.payment_note) || undefined,
        invoiceId: invoice?.id,
        invoiceExternalId: invoiceKey || undefined,
      };
    }),
    ...rawReceipts.map((row, index): SimReceiptImport => {
      const externalId = text(row.unique_key_receipt) || text(row._id) || text(row.receipt_No);
      const clientKey = text(row.unique_key_fk_client);
      const client = clientByExternalId.get(clientKey);
      return {
        id: safeId("SIM-REC", externalId, index + 1),
        externalId,
        date: date(row.created_date || row.device_created_date),
        clientId: client?.id,
        clientExternalId: clientKey || undefined,
        clientName: client?.name || "Imported Client",
        amount: num(row.total),
        paymentDate: date(row.created_date || row.device_created_date),
        paymentMethod: "receipt",
        currency: CURRENCY,
        notes: text(row.discription) || text(row.receipt_No) || undefined,
      };
    }),
  ].filter(receipt => receipt.amount > 0);

  invoices.forEach(invoice => {
    if (invoice.items.length === 0) {
      warnings.push(`Invoice ${invoice.originalNumber} has no line items in the SIM backup.`);
    }
  });

  const supported = new Set(["clients", "products", "invoice", "list_item", "invoice_payment", "tbl_recepit"]);
  const unsupportedCounts: Record<string, number> = {};
  asArray(backup.InvoiceTBLs).forEach(entry => {
    Object.keys(entry).forEach(key => {
      if (!supported.has(key)) unsupportedCounts[key] = asArray(entry[key]).length;
    });
  });

  return {
    source: {
      format: "simple-invoice-manager-json",
      appVersion: text(otherData.AppVersion) || undefined,
      serverOrgId: typeof otherData.ServerOrgId === "string" || typeof otherData.ServerOrgId === "number" ? otherData.ServerOrgId : undefined,
      serverUserId: typeof otherData.ServerUserId === "string" || typeof otherData.ServerUserId === "number" ? otherData.ServerUserId : undefined,
    },
    clients,
    products,
    invoices,
    receipts,
    unsupportedCounts,
    warnings,
  };
}
