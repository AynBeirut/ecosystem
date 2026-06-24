// ============= ACCOUNTING SYSTEM TYPES =============

// Expense Management
export type ExpenseCategory = 
  | 'rent'
  | 'utilities'
  | 'fuel'
  | 'internet'
  | 'maintenance'
  | 'office_supplies'
  | 'marketing'
  | 'insurance'
  | 'legal'
  | 'travel'
  | 'meals'
  | 'payroll'
  | 'other';

export type RecurrenceType = 'one-time' | 'recurring';
export type RecurrenceInterval = 'hourly' | 'daily' | 'weekly' | 'monthly';
export type PaymentMethod = 'cash' | 'bank' | 'card' | 'other';
export type PaymentStatus = 'paid' | 'unpaid' | 'partial';

export interface Expense {
  id: string;
  name: string;
  description?: string;
  category: ExpenseCategory;
  type: RecurrenceType;
  recurrenceInterval?: RecurrenceInterval;
  amount: number;
  startDate: string;
  endDate?: string;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  paidAmount?: number;
  notes?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  linkedStaffId?: string; // For payroll expenses
  createdAt: string;
  updatedAt: string;
}

// Generated expense entries from recurring expenses
export interface ExpenseEntry {
  id: string;
  expenseId: string;
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: PaymentStatus;
  paymentMethod?: PaymentMethod;
  notes?: string;
  createdAt: string;
}

// Staff / Labor Management
export type StaffPaymentType = 'hourly' | 'daily' | 'monthly';

export interface Staff {
  id: string;
  name: string;
  role: string;
  phone?: string;
  email?: string;
  paymentType: StaffPaymentType;
  rate: number; // Per hour, day, or month
  workingHours?: number; // For hourly staff
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StaffPayment {
  id: string;
  staffId: string;
  staffName: string;
  amount: number;
  periodStart: string;
  periodEnd: string;
  hoursWorked?: number;
  daysWorked?: number;
  status: PaymentStatus;
  paidDate?: string;
  paymentMethod?: PaymentMethod;
  notes?: string;
  expenseId?: string; // Links to expense record
  createdAt: string;
}

// Delivery Account Management
export type DeliveryOrderStatus = 
  | 'pending_delivery' 
  | 'delivered_unpaid' 
  | 'paid' 
  | 'returned'
  | 'cancelled';

export interface DeliveryPerson {
  id: string;
  name: string;
  phone: string;
  email?: string;
  walletBalance: number; // Cash in delivery person's hands
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryOrder {
  id: string;
  invoiceId: string;
  invoiceNumber?: string;
  deliveryPersonId: string;
  deliveryPersonName: string;
  clientName: string;
  amount: number;
  status: DeliveryOrderStatus;
  assignedAt: string;
  deliveredAt?: string;
  collectedAt?: string; // When cash was collected from client
  returnedAt?: string; // When cash was returned to company
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Cash Collection - when delivery person returns cash
export interface CashCollection {
  id: string;
  deliveryPersonId: string;
  deliveryPersonName: string;
  orderIds: string[]; // Multiple orders can be settled at once
  totalAmount: number;
  collectedAt: string;
  notes?: string;
  createdAt: string;
}

// Cash Flow Management
export interface CashBalance {
  cashOnHand: number;
  bankBalance: number;
  deliveryHeldCash: number; // Sum of all delivery person wallets
  outstandingClientBalances: number; // Unpaid invoices
  lastUpdated: string;
}

// Transaction log for cash movements
export type CashBucket = 'cash' | 'bank' | 'delivery';
export type TransactionType = 
  | 'invoice_payment'
  | 'expense_payment'
  | 'payroll_payment'
  | 'delivery_collection'
  | 'cash_return'
  | 'transfer'
  | 'adjustment';

export interface CashTransaction {
  id: string;
  type: TransactionType;
  bucket: CashBucket;
  amount: number; // Positive = inflow, negative = outflow
  referenceId?: string; // Invoice, expense, or order ID
  description: string;
  createdAt: string;
}

// Report Types
export interface ExpenseReportData {
  period: { start: string; end: string };
  byCategory: Record<ExpenseCategory, number>;
  recurring: number;
  oneTime: number;
  total: number;
  entries: ExpenseEntry[];
}

export interface PayrollReportData {
  period: { start: string; end: string };
  payments: StaffPayment[];
  totalPaid: number;
  totalPending: number;
  byStaff: Record<string, { name: string; paid: number; pending: number }>;
}

export interface DeliveryReportData {
  period: { start: string; end: string };
  byPerson: Record<string, {
    name: string;
    ordersCount: number;
    cashCollected: number;
    cashReturned: number;
    pendingBalance: number;
  }>;
  totalOrders: number;
  totalCollected: number;
  totalReturned: number;
  totalPending: number;
}

export interface ProfitLossData {
  period: { start: string; end: string };
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenses: {
    operating: number;
    payroll: number;
    other: number;
    total: number;
  };
  netProfit: number;
}

// Expense category labels
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  rent: 'Rent',
  utilities: 'Utilities',
  fuel: 'Fuel',
  internet: 'Internet',
  maintenance: 'Maintenance',
  office_supplies: 'Office Supplies',
  marketing: 'Marketing',
  insurance: 'Insurance',
  legal: 'Legal & Professional',
  travel: 'Travel',
  meals: 'Meals & Entertainment',
  payroll: 'Payroll',
  other: 'Other'
};
