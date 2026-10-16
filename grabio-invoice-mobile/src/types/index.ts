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
  discountType?: 'fixed' | 'percent';
  discountValue?: number;
  notes?: string;
  template?: string;
  paymentMethod?: string;
  paidAmount?: number;
  paidAt?: string;
};

export type FinanceEstimate = {
  id: string;
  estimateNumber?: string;
  date: string;
  clientId?: string;
  clientName: string;
  items: LineItem[];
  amount: number;
  total?: number;
  currency: string;
  status: 'pending' | 'approved' | 'rejected';
  tax?: number;
  discount?: number;
  discountType?: 'fixed' | 'percent';
  discountValue?: number;
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
  productType?: 'raw_material' | 'item' | 'service';
};

export type FinanceExpense = {
  id: string;
  name: string;
  description?: string;
  category: string;
  amount: number;
  startDate: string;
  paymentMethod: string;
  status: string;
  vendorName?: string;
  notes?: string;
  currency: string;
};

export type FinancePurchaseOrder = {
  id: string;
  poNumber?: string;
  orderNumber?: string;
  date: string;
  supplierId?: string;
  supplierName: string;
  items: LineItem[];
  amount: number;
  total?: number;
  currency: string;
  status: string;
  notes?: string;
};

export type FinanceSupplier = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  storeId?: string;
};

export type BillingType = 'one_time' | 'monthly';
export type ServiceTaskDirection = 'from_client' | 'to_freelancer';
export type ServiceTaskCompletionOutcome = 'done' | 'reported' | 'call';
export type ServiceTaskCompletion = { at: string; outcome: ServiceTaskCompletionOutcome };

export type FinanceServiceTask = {
  id: string;
  storeId?: string;
  direction: ServiceTaskDirection;
  counterpartyId: string;
  counterpartyName: string;
  title: string;
  billingType: BillingType;
  amount: number;
  isFree?: boolean;
  currency: string;
  monthlyUnits?: number;
  paymentMethod: string;
  paymentSource?: string;
  status: string;
  unitsCompleted?: number;
  completions?: ServiceTaskCompletion[];
  unitsUsedThisMonth?: number;
  usageMonth?: string;
  scheduledAt?: string;
  scheduleWeekday?: number;
  scheduleWeekdays?: number[];
  scheduleHour?: number;
  scheduleMinute?: number;
  nextDueAt?: string;
  linkedDailyTaskId?: string;
  lastPaymentAt?: string;
  notes?: string;
};

export type FinanceClientPlan = {
  id: string;
  storeId?: string;
  clientId: string;
  clientName: string;
  productId?: string;
  productName?: string;
  title: string;
  billingType: BillingType;
  amount: number;
  currency: string;
  monthlyUnits?: number;
  paymentMethod: string;
  paymentSource?: string;
  status: 'active' | 'cancelled';
  unitsUsedThisMonth: number;
  usageMonth?: string;
  lastPaymentAt?: string;
  notes?: string;
};

export type RootStackParamList = {
  Login: undefined;
  MainTabs: undefined;
  InvoiceEditor: { invoiceId?: string };
  InvoicePreview: { invoiceId: string };
  InvoiceTemplate: undefined;
  InvoiceTemplateSettings: undefined;
  InvoiceDocumentSettings: undefined;
  InvoiceHeaderSettings: undefined;
  EstimatesList: undefined;
  EstimateEditor: { estimateId?: string };
  ReceiptsList: undefined;
  ReceiptEditor: { receiptId?: string };
  PurchasesList: undefined;
  PurchaseEditor: { purchaseId?: string };
  ExpenseEditor: { expenseId?: string };
  ClientEditor: { clientId?: string };
  ClientsList: undefined;
  ProductsList: undefined;
  ProductEditor: { productId?: string };
  TeamTodos: undefined;
  ServiceTasksList: undefined;
  ServiceTaskEditor: {
    taskId?: string;
    planId?: string;
    direction?: ServiceTaskDirection;
    counterpartyId?: string;
  };
  ClientPlansList: undefined;
  ClientPlanEditor: { planId?: string; clientId?: string };
  CrmClientDetail: { clientId: string; clientName: string };
};

export type MainTabParamList = {
  Invoices: undefined;
  Expenses: undefined;
  Tasks: undefined;
  Menu: undefined;
  Clients: undefined;
  Products: undefined;
  Crm: undefined;
};
