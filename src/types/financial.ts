// Financial transaction and expense types

export type ExpenseCategory =
  | 'rent'
  | 'utilities'
  | 'marketing'
  | 'salaries'
  | 'supplies'
  | 'transportation'
  | 'maintenance'
  | 'insurance'
  | 'taxes'
  | 'other';

export type TransactionType =
  | 'sale'
  | 'purchase'
  | 'expense'
  | 'salary'
  | 'adjustment'
  | 'refund'
  | 'supplier_credit';

export interface Expense {
  id: string;
  date: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  paymentMethod: string;
  receiptUrl?: string;
  receiptNumber?: string;
  invoiceNumber?: string;
  vendor?: string;
  notes?: string;
  recurring?: boolean; // alias for isRecurring
  taxDeductible: boolean;
  isRecurring: boolean;
  recurringFrequency?: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'quarterly';
  vendorSupplier?: string;
  bankAccount?: string;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  staffId?: string; // For salary expenses - links to staff member
  storeId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  referenceId?: string;
  referenceNumber?: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  storeId: string;
  createdAt: string;
}

export interface TaxConfig {
  taxType: 'none' | 'VAT' | 'TTC';
  defaultRate: number;
  taxNumber?: string;
  taxInclusive: boolean;
}

export interface Discount {
  type: 'percentage' | 'fixed';
  value: number;
  code?: string;
}

export interface BankStatement {
  id: string;
  bankName: string;
  accountNumber: string;
  statementDate: string;
  uploadDate: string;
  fileUrl: string;
  transactions: BankTransaction[];
  matchedCount: number;
  unmatchedCount: number;
  reconciliationStatus: 'pending' | 'completed' | 'partial';
  storeId: string;
  createdAt: string;
}

export interface BankTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  balance: number;
  matched: boolean;
  matchedExpenseId?: string;
  matchedPurchaseId?: string;
}

export interface CashCollectionAllocation {
  orderId: string;
  invoiceNumber: string;
  customerName: string;
  amount: number;
}

export interface CashCollectionRecord {
  id: string;
  storeId: string;
  collectionDate: string;
  bankAccount: string;
  depositReference: string;
  notes?: string;
  totalAmount: number;
  ordersCount: number;
  allocations: CashCollectionAllocation[];
  createdById: string;
  createdByName: string;
  createdAt?: Date | string | number;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: string;
  action: 'create' | 'update' | 'delete' | 'approve' | 'reject';
  entityType: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  userAgent?: string;
  storeId: string;
}
