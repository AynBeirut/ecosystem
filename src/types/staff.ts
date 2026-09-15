// Staff and salary management types

export type StaffStatus = 'active' | 'suspended' | 'terminated';
export type PaymentFrequency = 'hourly' | 'daily' | 'monthly';

export interface StaffMember {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: string; // Flexible role - any job title (cashier, manager, cook, cleaner, etc.)
  status: StaffStatus;
  hireDate: string;
  endDate?: string;
  storeId: string;
  salary: number; // Amount based on payment frequency
  baseSalary?: number; // alias for salary
  paymentFrequency: PaymentFrequency;
  paymentType?: 'hourly' | 'monthly' | 'daily' | string;
  hourlyRate?: number;
  monthlySalary?: number;
  payBasis?: string;
  isActive?: boolean;
  localId?: string;
  staffName?: string;
  position?: string;
  department?: string;
  importSource?: string;
  usbTimesheetSummary?: {
    totalPayUsd?: number;
    shiftCount?: number;
    periods?: Array<{
      sheetName?: string;
      dateFrom?: string;
      dateTo?: string;
      totalPayUsd?: number;
      shiftCount?: number;
      hourlyRateUsd?: number;
      sourceFile?: string;
    }>;
    sourceFiles?: string[];
  };
  commissionRate?: number; // percentage
  totalCommissionEarned?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Salary {
  id: string;
  staffId: string;
  staffName: string;
  baseSalary: number;
  paymentFrequency: 'weekly' | 'bi-weekly' | 'monthly';
  commissionRate?: number; // percentage
  bonus?: number;
  deductions?: number;
  effectiveDate: string;
  storeId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SalaryPayment {
  id: string;
  staffId: string;
  staffName: string;
  salaryId: string;
  month?: string; // format: YYYY-MM
  paymentDate: string;
  baseSalary: number;
  commission: number;
  commissionAmount?: number; // alias for commission
  bonus: number;
  deductions: number;
  transportAmount?: number;
  hourlyRate?: number;
  hoursWorked?: number;
  dailyRate?: number;
  daysWorked?: number;
  totalAmount: number;
  paymentMethod: string;
  reference?: string;
  notes?: string;
  signatureUrl?: string;
  status?: 'paid' | 'pending' | 'void';
  idempotencyKey?: string;
  storeId: string;
  createdAt: string;
}

export interface Commission {
  id: string;
  staffId: string;
  orderId: string;
  orderTotal: number;
  commissionRate: number;
  commissionAmount: number;
  paymentStatus: 'pending' | 'paid';
  paidDate?: string;
  storeId: string;
  createdAt: string;
}
