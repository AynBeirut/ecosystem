import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Expense,
  ExpenseEntry,
  Staff,
  StaffPayment,
  DeliveryPerson,
  DeliveryOrder,
  CashCollection,
  CashBalance,
  CashTransaction,
  ExpenseCategory,
  PaymentStatus,
  PaymentMethod,
  DeliveryOrderStatus,
  TransactionType,
  CashBucket
} from '@/types/accounting';
import { useAppContext } from '@/context/AppContext';
import {
  DEFAULT_CASH_BALANCE,
  loadAccountingFromFirestore,
  saveAccountingSlice,
} from '@/lib/firestore/accountingFirestore';

interface AccountingContextType {
  // Expenses
  expenses: Expense[];
  expenseEntries: ExpenseEntry[];
  createExpense: (expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateExpense: (id: string, data: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
  payExpense: (expenseId: string, amount: number, paymentMethod: PaymentMethod) => void;
  generateRecurringExpenses: () => void;

  // Staff
  staff: Staff[];
  staffPayments: StaffPayment[];
  addStaff: (staffMember: Omit<Staff, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateStaff: (id: string, data: Partial<Staff>) => void;
  deleteStaff: (id: string) => void;
  createStaffPayment: (payment: Omit<StaffPayment, 'id' | 'createdAt'>) => string;
  payStaffPayment: (paymentId: string, paymentMethod: PaymentMethod) => void;

  // Delivery
  deliveryPersons: DeliveryPerson[];
  deliveryOrders: DeliveryOrder[];
  cashCollections: CashCollection[];
  addDeliveryPerson: (person: Omit<DeliveryPerson, 'id' | 'walletBalance' | 'createdAt' | 'updatedAt'>) => string;
  updateDeliveryPerson: (id: string, data: Partial<DeliveryPerson>) => void;
  deleteDeliveryPerson: (id: string) => void;
  assignOrderToDelivery: (invoiceId: string, invoiceNumber: string, deliveryPersonId: string, clientName: string, amount: number) => string;
  updateDeliveryOrderStatus: (orderId: string, status: DeliveryOrderStatus) => void;
  collectCashFromDelivery: (deliveryPersonId: string, orderIds: string[], notes?: string) => string;

  // Cash Flow
  cashBalance: CashBalance;
  cashTransactions: CashTransaction[];
  updateCashBalance: (bucket: CashBucket, amount: number, type: TransactionType, description: string, referenceId?: string) => void;
  transferBetweenBuckets: (fromBucket: CashBucket, toBucket: CashBucket, amount: number, notes?: string) => void;

  // Calculations
  getTotalExpensesByCategory: (startDate?: string, endDate?: string) => Record<ExpenseCategory, number>;
  getTotalPayroll: (startDate?: string, endDate?: string) => { paid: number; pending: number };
  getDeliveryStats: () => { totalOrders: number; pendingCash: number; collectedCash: number };
}

const AccountingContext = createContext<AccountingContextType | undefined>(undefined);

export const AccountingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeOrganizationId: storeId } = useAppContext();
  const hydratingRef = useRef(true);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseEntries, setExpenseEntries] = useState<ExpenseEntry[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [staffPayments, setStaffPayments] = useState<StaffPayment[]>([]);
  const [deliveryPersons, setDeliveryPersons] = useState<DeliveryPerson[]>([]);
  const [deliveryOrders, setDeliveryOrders] = useState<DeliveryOrder[]>([]);
  const [cashCollections, setCashCollections] = useState<CashCollection[]>([]);
  const [cashBalance, setCashBalance] = useState<CashBalance>(DEFAULT_CASH_BALANCE);
  const [cashTransactions, setCashTransactions] = useState<CashTransaction[]>([]);

  const scheduleSave = useCallback(<K extends Parameters<typeof saveAccountingSlice>[1]>(
    key: K,
    value: Parameters<typeof saveAccountingSlice>[2],
  ) => {
    if (!storeId || hydratingRef.current) return;
    const timerKey = String(key);
    if (saveTimers.current[timerKey]) clearTimeout(saveTimers.current[timerKey]);
    saveTimers.current[timerKey] = setTimeout(() => {
      void saveAccountingSlice(storeId, key, value).catch((err) => {
        console.error(`[Accounting] failed to save ${timerKey}:`, err);
      });
    }, 600);
  }, [storeId]);

  useEffect(() => {
    if (!storeId) {
      hydratingRef.current = false;
      return;
    }
    let cancelled = false;
    hydratingRef.current = true;
    void loadAccountingFromFirestore(storeId).then((data) => {
      if (cancelled) return;
      setExpenses(data.expenses);
      setExpenseEntries(data.expenseEntries);
      setStaff(data.staff);
      setStaffPayments(data.staffPayments);
      setDeliveryPersons(data.deliveryPersons);
      setDeliveryOrders(data.deliveryOrders);
      setCashCollections(data.cashCollections);
      setCashBalance(data.cashBalance || DEFAULT_CASH_BALANCE);
      setCashTransactions(data.cashTransactions);
      hydratingRef.current = false;
    }).catch((err) => {
      console.error('[Accounting] load failed:', err);
      hydratingRef.current = false;
    });
    return () => { cancelled = true; };
  }, [storeId]);

  useEffect(() => { scheduleSave('expenses', expenses); }, [expenses, scheduleSave]);
  useEffect(() => { scheduleSave('expenseEntries', expenseEntries); }, [expenseEntries, scheduleSave]);
  useEffect(() => { scheduleSave('staff', staff); }, [staff, scheduleSave]);
  useEffect(() => { scheduleSave('staffPayments', staffPayments); }, [staffPayments, scheduleSave]);
  useEffect(() => { scheduleSave('deliveryPersons', deliveryPersons); }, [deliveryPersons, scheduleSave]);
  useEffect(() => { scheduleSave('deliveryOrders', deliveryOrders); }, [deliveryOrders, scheduleSave]);
  useEffect(() => { scheduleSave('cashCollections', cashCollections); }, [cashCollections, scheduleSave]);
  useEffect(() => { scheduleSave('cashBalance', cashBalance); }, [cashBalance, scheduleSave]);
  useEffect(() => { scheduleSave('cashTransactions', cashTransactions); }, [cashTransactions, scheduleSave]);

  // ============= EXPENSE FUNCTIONS =============
  const createExpense = (expenseData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>): string => {
    const id = `EXP-${Date.now()}`;
    const now = new Date().toISOString();
    const expense: Expense = {
      ...expenseData,
      id,
      createdAt: now,
      updatedAt: now
    };
    setExpenses(prev => [...prev, expense]);
    console.log('[Accounting] Expense created:', id);
    return id;
  };

  const updateExpense = (id: string, data: Partial<Expense>) => {
    setExpenses(prev => prev.map(exp => 
      exp.id === id ? { ...exp, ...data, updatedAt: new Date().toISOString() } : exp
    ));
  };

  const deleteExpense = (id: string) => {
    setExpenses(prev => prev.filter(exp => exp.id !== id));
    setExpenseEntries(prev => prev.filter(entry => entry.expenseId !== id));
  };

  const payExpense = (expenseId: string, amount: number, paymentMethod: PaymentMethod) => {
    const expense = expenses.find(e => e.id === expenseId);
    if (!expense) return;

    const paidAmount = (expense.paidAmount || 0) + amount;
    const newStatus: PaymentStatus = paidAmount >= expense.amount ? 'paid' : 'partial';

    setExpenses(prev => prev.map(exp => 
      exp.id === expenseId 
        ? { ...exp, status: newStatus, paidAmount, paymentMethod, updatedAt: new Date().toISOString() }
        : exp
    ));

    // Update cash balance
    const bucket = paymentMethod === 'bank' || paymentMethod === 'card' ? 'bank' : 'cash';
    updateCashBalance(bucket, -amount, 'expense_payment', `Expense: ${expense.name}`, expenseId);
  };

  const generateRecurringExpenses = () => {
    const now = new Date();
    const recurringExpenses = expenses.filter(e => e.type === 'recurring' && (!e.endDate || new Date(e.endDate) >= now));

    recurringExpenses.forEach(expense => {
      // Check if we need to generate a new entry
      const existingEntries = expenseEntries.filter(entry => entry.expenseId === expense.id);
      const lastEntry = existingEntries.sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime())[0];
      
      if (lastEntry) {
        const lastDue = new Date(lastEntry.dueDate);
        let nextDue = new Date(lastDue);
        
        switch (expense.recurrenceInterval) {
          case 'hourly': nextDue.setHours(nextDue.getHours() + 1); break;
          case 'daily': nextDue.setDate(nextDue.getDate() + 1); break;
          case 'weekly': nextDue.setDate(nextDue.getDate() + 7); break;
          case 'monthly': nextDue.setMonth(nextDue.getMonth() + 1); break;
        }

        if (nextDue <= now) {
          const entry: ExpenseEntry = {
            id: `EXPE-${Date.now()}`,
            expenseId: expense.id,
            amount: expense.amount,
            dueDate: nextDue.toISOString(),
            status: 'unpaid',
            createdAt: new Date().toISOString()
          };
          setExpenseEntries(prev => [...prev, entry]);
        }
      }
    });
  };

  // ============= STAFF FUNCTIONS =============
  const addStaff = (staffData: Omit<Staff, 'id' | 'createdAt' | 'updatedAt'>): string => {
    const id = `STF-${Date.now()}`;
    const now = new Date().toISOString();
    const newStaff: Staff = {
      ...staffData,
      id,
      createdAt: now,
      updatedAt: now
    };
    setStaff(prev => [...prev, newStaff]);
    console.log('[Accounting] Staff added:', id);
    return id;
  };

  const updateStaff = (id: string, data: Partial<Staff>) => {
    setStaff(prev => prev.map(s => 
      s.id === id ? { ...s, ...data, updatedAt: new Date().toISOString() } : s
    ));
  };

  const deleteStaff = (id: string) => {
    setStaff(prev => prev.filter(s => s.id !== id));
  };

  const createStaffPayment = (paymentData: Omit<StaffPayment, 'id' | 'createdAt'>): string => {
    const id = `SPAY-${Date.now()}`;
    const payment: StaffPayment = {
      ...paymentData,
      id,
      createdAt: new Date().toISOString()
    };
    setStaffPayments(prev => [...prev, payment]);

    // Create corresponding expense
    const expenseId = createExpense({
      name: `Payroll: ${paymentData.staffName}`,
      category: 'payroll',
      type: 'one-time',
      amount: paymentData.amount,
      startDate: paymentData.periodStart,
      paymentMethod: paymentData.paymentMethod || 'cash',
      status: paymentData.status,
      linkedStaffId: paymentData.staffId,
      notes: `Period: ${paymentData.periodStart} to ${paymentData.periodEnd}`
    });

    // Link expense to payment
    setStaffPayments(prev => prev.map(p => 
      p.id === id ? { ...p, expenseId } : p
    ));

    console.log('[Accounting] Staff payment created:', id);
    return id;
  };

  const payStaffPayment = (paymentId: string, paymentMethod: PaymentMethod) => {
    const payment = staffPayments.find(p => p.id === paymentId);
    if (!payment) return;

    setStaffPayments(prev => prev.map(p => 
      p.id === paymentId 
        ? { ...p, status: 'paid', paidDate: new Date().toISOString(), paymentMethod }
        : p
    ));

    // Update linked expense
    if (payment.expenseId) {
      payExpense(payment.expenseId, payment.amount, paymentMethod);
    } else {
      // Update cash balance directly
      const bucket = paymentMethod === 'bank' || paymentMethod === 'card' ? 'bank' : 'cash';
      updateCashBalance(bucket, -payment.amount, 'payroll_payment', `Payroll: ${payment.staffName}`, paymentId);
    }
  };

  // ============= DELIVERY FUNCTIONS =============
  const addDeliveryPerson = (personData: Omit<DeliveryPerson, 'id' | 'walletBalance' | 'createdAt' | 'updatedAt'>): string => {
    const id = `DLV-${Date.now()}`;
    const now = new Date().toISOString();
    const person: DeliveryPerson = {
      ...personData,
      id,
      walletBalance: 0,
      createdAt: now,
      updatedAt: now
    };
    setDeliveryPersons(prev => [...prev, person]);
    console.log('[Accounting] Delivery person added:', id);
    return id;
  };

  const updateDeliveryPerson = (id: string, data: Partial<DeliveryPerson>) => {
    setDeliveryPersons(prev => prev.map(p => 
      p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p
    ));
  };

  const deleteDeliveryPerson = (id: string) => {
    const person = deliveryPersons.find(p => p.id === id);
    if (person && person.walletBalance > 0) {
      console.error('Cannot delete delivery person with outstanding balance');
      return;
    }
    setDeliveryPersons(prev => prev.filter(p => p.id !== id));
  };

  const assignOrderToDelivery = (
    invoiceId: string, 
    invoiceNumber: string, 
    deliveryPersonId: string, 
    clientName: string, 
    amount: number
  ): string => {
    const person = deliveryPersons.find(p => p.id === deliveryPersonId);
    if (!person) throw new Error('Delivery person not found');

    const id = `DORD-${Date.now()}`;
    const now = new Date().toISOString();
    const order: DeliveryOrder = {
      id,
      invoiceId,
      invoiceNumber,
      deliveryPersonId,
      deliveryPersonName: person.name,
      clientName,
      amount,
      status: 'pending_delivery',
      assignedAt: now,
      createdAt: now,
      updatedAt: now
    };
    setDeliveryOrders(prev => [...prev, order]);
    console.log('[Accounting] Delivery order created:', id);
    return id;
  };

  const updateDeliveryOrderStatus = (orderId: string, status: DeliveryOrderStatus) => {
    const order = deliveryOrders.find(o => o.id === orderId);
    if (!order) return;

    const now = new Date().toISOString();
    const updates: Partial<DeliveryOrder> = { status, updatedAt: now };

    switch (status) {
      case 'delivered_unpaid':
        updates.deliveredAt = now;
        break;
      case 'paid':
        updates.collectedAt = now;
        // Add to delivery person's wallet
        setDeliveryPersons(prev => prev.map(p => 
          p.id === order.deliveryPersonId 
            ? { ...p, walletBalance: p.walletBalance + order.amount, updatedAt: now }
            : p
        ));
        // Update delivery-held cash
        setCashBalance(prev => ({
          ...prev,
          deliveryHeldCash: prev.deliveryHeldCash + order.amount,
          lastUpdated: now
        }));
        break;
    }

    setDeliveryOrders(prev => prev.map(o => 
      o.id === orderId ? { ...o, ...updates } : o
    ));
  };

  const collectCashFromDelivery = (
    deliveryPersonId: string, 
    orderIds: string[], 
    notes?: string
  ): string => {
    const person = deliveryPersons.find(p => p.id === deliveryPersonId);
    if (!person) throw new Error('Delivery person not found');

    const ordersToCollect = deliveryOrders.filter(o => orderIds.includes(o.id) && o.status === 'paid');
    const totalAmount = ordersToCollect.reduce((sum, o) => sum + o.amount, 0);

    if (totalAmount > person.walletBalance) {
      throw new Error('Collection amount exceeds wallet balance');
    }

    const now = new Date().toISOString();

    // Create collection record
    const collectionId = `CCOL-${Date.now()}`;
    const collection: CashCollection = {
      id: collectionId,
      deliveryPersonId,
      deliveryPersonName: person.name,
      orderIds,
      totalAmount,
      collectedAt: now,
      notes,
      createdAt: now
    };
    setCashCollections(prev => [...prev, collection]);

    // Update orders
    setDeliveryOrders(prev => prev.map(o => 
      orderIds.includes(o.id) ? { ...o, returnedAt: now, updatedAt: now } : o
    ));

    // Update delivery person wallet
    setDeliveryPersons(prev => prev.map(p => 
      p.id === deliveryPersonId 
        ? { ...p, walletBalance: p.walletBalance - totalAmount, updatedAt: now }
        : p
    ));

    // Update cash balance - move from delivery to cash
    setCashBalance(prev => ({
      ...prev,
      deliveryHeldCash: prev.deliveryHeldCash - totalAmount,
      cashOnHand: prev.cashOnHand + totalAmount,
      lastUpdated: now
    }));

    // Log transaction
    const transaction: CashTransaction = {
      id: `TXN-${Date.now()}`,
      type: 'cash_return',
      bucket: 'cash',
      amount: totalAmount,
      referenceId: collectionId,
      description: `Cash return from ${person.name}`,
      createdAt: now
    };
    setCashTransactions(prev => [...prev, transaction]);

    console.log('[Accounting] Cash collected:', collectionId);
    return collectionId;
  };

  // ============= CASH FLOW FUNCTIONS =============
  const updateCashBalance = (
    bucket: CashBucket, 
    amount: number, 
    type: TransactionType, 
    description: string, 
    referenceId?: string
  ) => {
    const now = new Date().toISOString();
    
    setCashBalance(prev => {
      const updated = { ...prev, lastUpdated: now };
      switch (bucket) {
        case 'cash': updated.cashOnHand += amount; break;
        case 'bank': updated.bankBalance += amount; break;
        case 'delivery': updated.deliveryHeldCash += amount; break;
      }
      return updated;
    });

    const transaction: CashTransaction = {
      id: `TXN-${Date.now()}`,
      type,
      bucket,
      amount,
      referenceId,
      description,
      createdAt: now
    };
    setCashTransactions(prev => [...prev, transaction]);
  };

  const transferBetweenBuckets = (
    fromBucket: CashBucket, 
    toBucket: CashBucket, 
    amount: number, 
    notes?: string
  ) => {
    if (amount <= 0) return;
    
    const now = new Date().toISOString();
    
    setCashBalance(prev => {
      const updated = { ...prev, lastUpdated: now };
      
      // Deduct from source
      switch (fromBucket) {
        case 'cash': updated.cashOnHand -= amount; break;
        case 'bank': updated.bankBalance -= amount; break;
        case 'delivery': updated.deliveryHeldCash -= amount; break;
      }
      
      // Add to destination
      switch (toBucket) {
        case 'cash': updated.cashOnHand += amount; break;
        case 'bank': updated.bankBalance += amount; break;
        case 'delivery': updated.deliveryHeldCash += amount; break;
      }
      
      return updated;
    });

    const transaction: CashTransaction = {
      id: `TXN-${Date.now()}`,
      type: 'transfer',
      bucket: toBucket,
      amount,
      description: `Transfer from ${fromBucket} to ${toBucket}${notes ? `: ${notes}` : ''}`,
      createdAt: now
    };
    setCashTransactions(prev => [...prev, transaction]);
  };

  // ============= CALCULATION FUNCTIONS =============
  const getTotalExpensesByCategory = (startDate?: string, endDate?: string): Record<ExpenseCategory, number> => {
    const result: Record<ExpenseCategory, number> = {
      rent: 0, utilities: 0, fuel: 0, internet: 0, maintenance: 0,
      office_supplies: 0, marketing: 0, insurance: 0, legal: 0,
      travel: 0, meals: 0, payroll: 0, other: 0
    };

    let filteredExpenses = expenses;
    if (startDate) {
      filteredExpenses = filteredExpenses.filter(e => new Date(e.startDate) >= new Date(startDate));
    }
    if (endDate) {
      filteredExpenses = filteredExpenses.filter(e => new Date(e.startDate) <= new Date(endDate));
    }

    filteredExpenses.forEach(expense => {
      if (expense.status === 'paid') {
        result[expense.category] += expense.amount;
      }
    });

    return result;
  };

  const getTotalPayroll = (startDate?: string, endDate?: string): { paid: number; pending: number } => {
    let filtered = staffPayments;
    if (startDate) {
      filtered = filtered.filter(p => new Date(p.periodStart) >= new Date(startDate));
    }
    if (endDate) {
      filtered = filtered.filter(p => new Date(p.periodEnd) <= new Date(endDate));
    }

    return {
      paid: filtered.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0),
      pending: filtered.filter(p => p.status !== 'paid').reduce((sum, p) => sum + p.amount, 0)
    };
  };

  const getDeliveryStats = () => {
    const activeOrders = deliveryOrders.filter(o => o.status !== 'cancelled' && o.status !== 'returned');
    const paidOrders = activeOrders.filter(o => o.status === 'paid');
    const pendingOrders = activeOrders.filter(o => o.status !== 'paid' && !o.returnedAt);
    
    return {
      totalOrders: activeOrders.length,
      pendingCash: deliveryPersons.reduce((sum, p) => sum + p.walletBalance, 0),
      collectedCash: cashCollections.reduce((sum, c) => sum + c.totalAmount, 0)
    };
  };

  const value: AccountingContextType = {
    expenses,
    expenseEntries,
    createExpense,
    updateExpense,
    deleteExpense,
    payExpense,
    generateRecurringExpenses,
    staff,
    staffPayments,
    addStaff,
    updateStaff,
    deleteStaff,
    createStaffPayment,
    payStaffPayment,
    deliveryPersons,
    deliveryOrders,
    cashCollections,
    addDeliveryPerson,
    updateDeliveryPerson,
    deleteDeliveryPerson,
    assignOrderToDelivery,
    updateDeliveryOrderStatus,
    collectCashFromDelivery,
    cashBalance,
    cashTransactions,
    updateCashBalance,
    transferBetweenBuckets,
    getTotalExpensesByCategory,
    getTotalPayroll,
    getDeliveryStats
  };

  return (
    <AccountingContext.Provider value={value}>
      {children}
    </AccountingContext.Provider>
  );
};

export const useAccounting = () => {
  const context = useContext(AccountingContext);
  if (!context) {
    throw new Error('useAccounting must be used within AccountingProvider');
  }
  return context;
};
