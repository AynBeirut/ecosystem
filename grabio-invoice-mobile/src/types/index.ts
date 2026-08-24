export type LineItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  rawPrice?: number;
};

export type FinanceInvoice = {
  id: string;
  invoiceNumber?: string;
  date: string;
  clientId?: string;
  clientName: string;
  items: LineItem[];
  lineItems?: LineItem[];
  amount: number;
  total?: number;
  currency: string;
  status: 'draft' | 'sent' | 'partial' | 'paid' | 'pending_manual_payment';
  tax?: number;
  discount?: number;
  notes?: string;
  template?: string;
  paymentMethod?: string;
  paidAmount?: number;
  paidAt?: string;
};

export type FinanceEstimate = {
  id: string;
  date: string;
  clientId?: string;
  clientName: string;
  items: LineItem[];
  amount: number;
  total?: number;
  currency: string;
  status: 'pending' | 'approved' | 'rejected';
  expiryDate?: string;
  notes?: string;
};

export type FinanceReceipt = {
  id: string;
  date: string;
  clientId?: string;
  clientName: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  currency: string;
  notes?: string;
  invoiceId?: string;
};

export type FinanceClient = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  taxId?: string;
  storeId?: string;
};

export type FinanceProduct = {
  id: string;
  name: string;
  sellingPrice?: number;
  price?: number;
  salePrice?: number;
  sku?: string;
  storeId?: string;
};

export type RootStackParamList = {
  Login: undefined;
  MainTabs: undefined;
  InvoiceEditor: { invoiceId?: string };
  InvoicePreview: { invoiceId: string };
  EstimatesList: undefined;
  EstimateEditor: { estimateId?: string };
  ReceiptsList: undefined;
  ReceiptEditor: { receiptId?: string };
  ClientEditor: { clientId?: string };
  ProductEditor: { productId?: string };
  CrmClientDetail: { clientId: string; clientName: string };
};

export type MainTabParamList = {
  Invoices: undefined;
  Clients: undefined;
  Products: undefined;
  Crm: undefined;
  Menu: undefined;
};
