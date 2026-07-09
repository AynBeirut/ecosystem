import React, { useState, useEffect, useRef } from 'react';
import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { FileDown, Download, ArrowLeft, PlusCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { exportToCSV } from '@/lib/exportUtils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import { initArabicPDF, writeText, cleanTextForPDF } from '@/lib/arabicPDF';
import { isCountedSaleStatus, isDateInRange, normalizeDateString, resolveOrderItemProductKey } from '@/lib/salesRules';

interface StatementLineItem {
  productId?: string;
  productName?: string;
  category?: string;
  quantity?: number;
  price?: number;
  [key: string]: unknown;
}

interface StatementTxn {
  date: string | number | Date;
  type: string;
  ref: string;
  description: string;
  debit: number;
  net: number;
  vat: number;
  credit: number;
  data: Record<string, unknown>;
}

type CsvRow = Record<string, string | number>;

interface CustomerBalance {
  id: string;
  name: string;
  totalPurchases: number;
  totalPayments: number;
  balance: number;
}

interface SupplierBalance {
  id: string;
  name: string;
  totalPurchases: number;
  totalPayments: number;
  balance: number;
}

interface ProductSummary {
  id: string;
  name: string;
  category: string;
  totalSold: number;
  totalRevenue: number;
  totalDiscount?: number;
}

interface PurchaseRecord {
  id: string;
  supplierId?: string;
  date: string;
  supplier: string;
  amount: number;
  amountPaid: number;
  status: string;
  items: Record<string, unknown>[];
  taxAmount?: number;
  invoiceNumber?: string;
}

interface PurchaseStatementRow {
  id: string;
  dateLabel: string;
  sortDate: string;
  ref: string;
  description: string;
  debit: number;
  net: number;
  vat: number;
  credit: number;
  balance: number;
  status: string;
}

interface ExpenseRecord {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  taxAmount?: number;
  paymentMethod?: string;
  reference?: string;
}

interface SalesRecord {
  id: string;
  customerId?: string;
  date: string;
  customer: string;
  invoiceNumber?: string;
  total: number;
  subtotal?: number;
  discountAmount?: number;
  amountPaid: number;
  taxAmount?: number;
  status: string;
  paymentStatus?: string;
  items?: StatementLineItem[];
}

interface CashCollectionRecord {
  id: string;
  collectionDate: string;
  bankAccount: string;
  depositReference: string;
  totalAmount: number;
  ordersCount: number;
  notes?: string;
}

interface DetailedTransaction {
  date: string;
  ref: string;
  description: string;
  debit: number;
  netVat: number;
  credit: number;
  balance: number;
  vatLL: number;
}

interface DetailedStatement {
  accountNo: string;
  accountName: string;
  currency: string;
  asOfDate: string;
  phone: string;
  attn: string;
  openingBalance: number;
  transactions: DetailedTransaction[];
  closingBalance: number;
}

const AdminAccountStatement: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<'customers' | 'suppliers' | 'products' | 'purchases' | 'expenses' | 'sales' | 'cashCollections' | 'payments'>('customers');
  const [loading, setLoading] = useState(true);
  
  const [customers, setCustomers] = useState<CustomerBalance[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierBalance[]>([]);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [sales, setSales] = useState<SalesRecord[]>([]);
  const [cashCollections, setCashCollections] = useState<CashCollectionRecord[]>([]);
  
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalPurchases, setTotalPurchases] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [totalCashDeposited, setTotalCashDeposited] = useState(0);
  const [quarantinedSalesCount, setQuarantinedSalesCount] = useState(0);
  const [customerBalances, setCustomerBalances] = useState(0);
  const [netBalance, setNetBalance] = useState(0);
  
  const [viewingDetailedStatement, setViewingDetailedStatement] = useState<{ type: 'supplier' | 'customer', id: string, name: string } | null>(null);
  const [detailedStatement, setDetailedStatement] = useState<DetailedStatement | null>(null);
  
  // Date filters
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterProduct, setFilterProduct] = useState('');

  // Separate date filters for cash collections tab
  const [cashFilterStart, setCashFilterStart] = useState('');
  const [cashFilterEnd, setCashFilterEnd] = useState('');
  const [cashSearch, setCashSearch] = useState('');

  // Payment filters
  const [paymentFilterStart, setPaymentFilterStart] = useState('');
  const [paymentFilterEnd, setPaymentFilterEnd] = useState('');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentDirectionFilter, setPaymentDirectionFilter] = useState<'all' | 'in' | 'out'>('all');

  // Customer list filters
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerBalanceFilter, setCustomerBalanceFilter] = useState<'all' | 'active' | 'zero'>('all');
  const [expandedCustomerLedger, setExpandedCustomerLedger] = useState<string | null>(null);

  // Supplier list filters
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierBalanceFilter, setSupplierBalanceFilter] = useState<'all' | 'active' | 'zero'>('all');
  const [expandedSupplierLedger, setExpandedSupplierLedger] = useState<string | null>(null);

  // Purchases filters
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [purchaseBalanceFilter, setPurchaseBalanceFilter] = useState<'all' | 'active' | 'zero'>('all');

  // Sales filters
  const [salesSearch, setSalesSearch] = useState('');
  const [salesBalanceFilter, setSalesBalanceFilter] = useState<'all' | 'active' | 'zero'>('all');

  // Products filters
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState<'all' | 'active' | 'zero'>('all');

  // Expenses filters
  const [expenseCategory, setExpenseCategory] = useState('');
  const [expenseSearch, setExpenseSearch] = useState('');

  // Expandable ledger states for grouped tabs
  const [expandedPurchaseSupplier, setExpandedPurchaseSupplier] = useState<string | null>(null);
  const [expandedSalesCustomer, setExpandedSalesCustomer] = useState<string | null>(null);

  // Account-level payments (debit/credit system)
  const [accountPayments, setAccountPayments] = useState<Array<{
    id: string;
    accountId: string;
    accountName: string;
    accountType: 'customer' | 'supplier';
    direction: 'in' | 'out';
    amount: number;
    date: string;
    method: string;
    notes: string;
    createdAt: string;
    idempotencyKey?: string;
    paymentFingerprint?: string;
    orderAllocation?: {
      appliedAmount: number;
      remainingAmount: number;
      appliedOrderIds: string[];
      appliedAt: string;
    };
  }>>([]);
  const [paymentModal, setPaymentModal] = useState<{
    open: boolean;
    accountId: string;
    accountName: string;
    accountType: 'customer' | 'supplier';
    direction: 'in' | 'out';
  } | null>(null);
  const [newPayment, setNewPayment] = useState({
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    method: 'cash',
    notes: '',
  });
  const [savingPayment, setSavingPayment] = useState(false);
  const paymentSaveInFlightRef = useRef(false);
  const paymentSubmitNonceRef = useRef<string | null>(null);

  const PAYMENT_DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

  const buildPaymentFingerprint = (
    accountId: string,
    accountName: string,
    accountType: 'customer' | 'supplier',
    direction: 'in' | 'out',
    amount: number,
    date: string,
    method: string,
  ) => {
    const roundedAmount = Math.round(amount * 100) / 100;
    return [
      user?.storeId || '',
      accountId,
      accountName.trim().toLowerCase(),
      accountType,
      direction,
      date,
      roundedAmount.toFixed(2),
      method,
    ].join('|');
  };

  const buildPaymentIdempotencyKey = (fingerprint: string, submitNonce: string) => (
    `${fingerprint}|${submitNonce}`
  );

  const findRecentDuplicatePayment = (
    fingerprint: string,
    createdAfterMs: number,
  ) => {
    return accountPayments.find((payment) => {
      const createdAtMs = new Date(payment.createdAt).getTime();
      if (!Number.isFinite(createdAtMs) || createdAtMs < createdAfterMs) {
        return false;
      }
      const paymentFingerprint = buildPaymentFingerprint(
        payment.accountId,
        payment.accountName,
        payment.accountType,
        payment.direction,
        toFiniteNumber(payment.amount, 0),
        payment.date,
        payment.method,
      );
      return paymentFingerprint === fingerprint;
    });
  };

  const toFiniteNumber = (value: unknown, fallback = 0): number => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const toNonEmptyString = (value: unknown, fallback = 'N/A'): string => {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  };

  const toDateLabel = (value: unknown): string => {
    const parsed = new Date(String(value || ''));
    if (Number.isNaN(parsed.getTime())) return 'N/A';
    return parsed.toLocaleDateString('en-GB');
  };

  const filteredCashCollections = cashCollections.filter((entry) => {
    if (cashFilterStart || cashFilterEnd) {
      const date = typeof entry.collectionDate === 'string' ? entry.collectionDate.slice(0, 10) : '';
      if (cashFilterStart && date < cashFilterStart) return false;
      if (cashFilterEnd && date > cashFilterEnd) return false;
    }
    if (cashSearch) {
      const lower = cashSearch.toLowerCase();
      return [entry.bankAccount, entry.depositReference, entry.notes].some((item) =>
        String(item || '').toLowerCase().includes(lower)
      );
    }
    return true;
  });

  const filteredPayments = accountPayments.filter((payment) => {
    if (paymentFilterStart && payment.date.slice(0, 10) < paymentFilterStart) return false;
    if (paymentFilterEnd && payment.date.slice(0, 10) > paymentFilterEnd) return false;
    if (paymentDirectionFilter !== 'all' && payment.direction !== paymentDirectionFilter) return false;
    if (paymentSearch) {
      const lower = paymentSearch.toLowerCase();
      return [payment.accountName, payment.method, payment.notes].some((item) =>
        String(item || '').toLowerCase().includes(lower)
      );
    }
    return true;
  });

  const buildPurchaseStatementRows = (sourcePurchases: PurchaseRecord[]): PurchaseStatementRow[] => {
    const filtered = sourcePurchases
      .filter((purchase) => isDateInRange(purchase.date, filterStartDate, filterEndDate))
      .map((purchase) => {
        const sortDate = normalizeDateString(purchase.date);
        return {
          purchase,
          sortDate,
        };
      })
      .sort((a, b) => {
        if (a.sortDate && b.sortDate) return a.sortDate.localeCompare(b.sortDate);
        if (a.sortDate) return -1;
        if (b.sortDate) return 1;
        return 0;
      });

    let runningBalance = 0;

    return filtered.map(({ purchase, sortDate }) => {
      const debit = toFiniteNumber(purchase.amount, 0);
      const vat = toFiniteNumber(purchase.taxAmount, 0);
      const net = debit - vat;
      const credit = toFiniteNumber(purchase.amountPaid, 0);
      runningBalance += debit - credit;

      return {
        id: purchase.id,
        dateLabel: sortDate ? new Date(`${sortDate}T00:00:00`).toLocaleDateString('en-GB') : 'N/A',
        sortDate,
        ref: toNonEmptyString(purchase.invoiceNumber, '-'),
        description: `${toNonEmptyString(purchase.supplier, 'Unknown Supplier')} - ${Array.isArray(purchase.items) ? purchase.items.length : 0} item(s)`,
        debit,
        net,
        vat,
        credit,
        balance: runningBalance,
        status: toNonEmptyString(purchase.status, 'unknown'),
      };
    });
  };

  useEffect(() => {
    if (user?.storeId) {
      fetchAllData();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.storeId]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchCustomers(),
        fetchSuppliers(),
        fetchProducts(),
        fetchPurchases(),
        fetchExpenses(),
        fetchSales(),
        fetchCashCollections(),
        fetchAccountPaymentsData(),
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const db = getFirestore();
      const ordersQuery = query(
        collection(db, 'orders'),
        where('storeId', '==', user?.storeId)
      );
      const ordersSnapshot = await getDocs(ordersQuery);
      
      const customerMap = new Map<string, CustomerBalance>();
      
      ordersSnapshot.forEach(doc => {
        const order = doc.data();
        if (!isCountedSaleStatus(order.status)) {
          return;
        }
        const customerId = order.customerId || 'Walk-in';
        const customerName = order.customerName || 'Walk-in Customer';
        const total = order.total || 0;
        // Use the actual amount paid (handles partial payments and overpayments)
        const paid = order.paymentStatus === 'paid'
          ? Math.max(total, toFiniteNumber(order.amountPaid, 0))
          : toFiniteNumber(order.amountPaid, 0);
        
        if (!customerMap.has(customerId)) {
          customerMap.set(customerId, {
            id: customerId,
            name: customerName,
            totalPurchases: 0,
            totalPayments: 0,
            balance: 0
          });
        }
        
        const customer = customerMap.get(customerId)!;
        customer.totalPurchases += total;
        customer.totalPayments += paid;
        customer.balance = customer.totalPurchases - customer.totalPayments;
      });
      
      const customersList = Array.from(customerMap.values());
      setCustomers(customersList);
      setCustomerBalances(customersList.reduce((sum, c) => sum + c.balance, 0));
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const db = getFirestore();
      
      // Fetch suppliers first
      const suppliersQuery = query(
        collection(db, 'suppliers'),
        where('storeId', '==', user?.storeId)
      );
      const suppliersSnapshot = await getDocs(suppliersQuery);
      const suppliersData = new Map<string, string>();
      suppliersSnapshot.forEach(doc => {
        const supplier = doc.data();
        suppliersData.set(doc.id, supplier.name || 'Unknown Supplier');
      });
      
      // Then fetch purchases
      const purchasesQuery = query(
        collection(db, 'purchases'),
        where('storeId', '==', user?.storeId)
      );
      const purchasesSnapshot = await getDocs(purchasesQuery);
      
      // Fetch supplier returns
      const returnsQuery = query(
        collection(db, 'supplierReturns'),
        where('storeId', '==', user?.storeId),
        where('status', '==', 'credited')
      );
      const returnsSnapshot = await getDocs(returnsQuery);
      
      const supplierMap = new Map<string, SupplierBalance>();
      const validPurchaseIds = new Set<string>();
      
      purchasesSnapshot.forEach(doc => {
        const purchase = doc.data();
        validPurchaseIds.add(doc.id); // Track valid purchase IDs
        const supplierId = purchase.supplierId || 'unknown';
        const supplierName = suppliersData.get(supplierId) || purchase.supplierName || 'Unknown Supplier';
        const total = purchase.totalCost || purchase.totalAmount || purchase.total || 0;
        const paid = purchase.paymentStatus === 'paid'
          ? Math.max(total, toFiniteNumber(purchase.amountPaid || purchase.paid, 0))
          : toFiniteNumber(purchase.amountPaid || purchase.paid, 0);
        
        if (!supplierMap.has(supplierId)) {
          supplierMap.set(supplierId, {
            id: supplierId,
            name: supplierName,
            totalPurchases: 0,
            totalPayments: 0,
            balance: 0
          });
        }
        
        const supplier = supplierMap.get(supplierId)!;
        supplier.totalPurchases += total;
        supplier.totalPayments += paid;
        supplier.balance = supplier.totalPurchases - supplier.totalPayments;
      });
      
      // Add credited returns to supplier payments (only for returns linked to existing purchases)
      returnsSnapshot.forEach(doc => {
        const returnDoc = doc.data();
        const purchaseId = returnDoc.purchaseId || returnDoc.originalPurchaseId;
        
        // Only count returns that reference valid purchases
        if (!purchaseId || !validPurchaseIds.has(purchaseId)) return;
        
        const supplierId = returnDoc.supplierId || 'unknown';
        const creditAmount = returnDoc.creditIssued || returnDoc.totalClaimAmount || 0;
        
        if (supplierMap.has(supplierId)) {
          const supplier = supplierMap.get(supplierId)!;
          supplier.totalPayments += creditAmount;
          supplier.balance = supplier.totalPurchases - supplier.totalPayments;
        }
      });

      // Add standalone payments recorded via Account Statement payment page
      const supplierPaymentsSnapshot = await getDocs(query(
        collection(db, 'accountPayments'),
        where('storeId', '==', user?.storeId),
        where('accountType', '==', 'supplier'),
        where('direction', '==', 'out')
      ));
      supplierPaymentsSnapshot.forEach(doc => {
        const pmt = doc.data();
        const supplierId = pmt.accountId || 'unknown';
        const amount = toFiniteNumber(pmt.amount, 0);
        if (amount <= 0) return;
        if (supplierMap.has(supplierId)) {
          const supplier = supplierMap.get(supplierId)!;
          supplier.totalPayments += amount;
          supplier.balance = supplier.totalPurchases - supplier.totalPayments;
        }
      });

      setSuppliers(Array.from(supplierMap.values()));
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const db = getFirestore();
      
      // Fetch products
      const productsQuery = query(
        collection(db, 'products'),
        where('storeId', '==', user?.storeId)
      );
      const productsSnapshot = await getDocs(productsQuery);
      
      // Fetch orders to calculate revenue
      const ordersQuery = query(
        collection(db, 'orders'),
        where('storeId', '==', user?.storeId)
      );
      const ordersSnapshot = await getDocs(ordersQuery);
      
      const productMap = new Map<string, ProductSummary>();
      
      // Initialize all products
      productsSnapshot.forEach(doc => {
        const product = doc.data();
        productMap.set(doc.id, {
          id: doc.id,
          name: product.name || 'Unknown Product',
          category: product.category || 'Uncategorized',
          totalSold: 0,
          totalRevenue: 0,
          totalDiscount: 0
        });
      });
      
      // Add orders data (delivered only)
      ordersSnapshot.forEach(doc => {
        const order = doc.data();
        if (!isCountedSaleStatus(order.status)) return;
        const items = order.items || [];
        
        // Calculate discount per item proportionally
        const orderSubtotal = order.subtotal || order.total || 0;
        const orderDiscount = order.discountAmount || 0;
        
        items.forEach((item: StatementLineItem) => {
          const productId = resolveOrderItemProductKey(item);
          if (productId && productMap.has(productId)) {
            const product = productMap.get(productId)!;
            const quantity = item.quantity || 0;
            // Use item price if available, otherwise calculate from order total
            const price = item.price || (order.total / items.length) || 0;
            const itemSubtotal = quantity * price;
            
            // Calculate proportional discount for this item
            const itemDiscount = orderSubtotal > 0 ? (itemSubtotal / orderSubtotal) * orderDiscount : 0;
            const itemTotal = itemSubtotal - itemDiscount;
            
            product.totalSold += quantity;
            product.totalRevenue += itemTotal; // Revenue AFTER discount
            product.totalDiscount += itemDiscount;
          }
        });
      });
      
      setProducts(Array.from(productMap.values()));
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchPurchases = async () => {
    try {
      const db = getFirestore();
      
      // Fetch suppliers first
      const suppliersQuery = query(
        collection(db, 'suppliers'),
        where('storeId', '==', user?.storeId)
      );
      const suppliersSnapshot = await getDocs(suppliersQuery);
      const suppliersData = new Map<string, string>();
      suppliersSnapshot.forEach(doc => {
        const supplier = doc.data();
        suppliersData.set(doc.id, supplier.name || 'Unknown Supplier');
      });
      
      // Then fetch purchases
      const purchasesQuery = query(
        collection(db, 'purchases'),
        where('storeId', '==', user?.storeId)
      );
      const purchasesSnapshot = await getDocs(purchasesQuery);
      
      const purchasesList: PurchaseRecord[] = [];
      let total = 0;
      
      purchasesSnapshot.forEach(doc => {
        const purchase = doc.data();
        let dateStr = normalizeDateString(purchase.date);
        if (!dateStr && purchase.createdAt) {
          dateStr = normalizeDateString(purchase.createdAt);
        }
        if (!dateStr && purchase.receivedDate) {
          dateStr = normalizeDateString(purchase.receivedDate);
        }
        
        const supplierName = suppliersData.get(purchase.supplierId) || purchase.supplierName || 'Unknown';
        
        purchasesList.push({
          id: doc.id,
          supplierId: purchase.supplierId || undefined,
          date: dateStr || '',
          supplier: supplierName,
          amount: purchase.totalCost || purchase.total || 0,
          amountPaid: purchase.amountPaid || purchase.paid || 0,
          status: purchase.status || 'Completed',
          items: purchase.items || purchase.materials || [],
          invoiceNumber: purchase.invoiceNumber || purchase.purchaseNumber
        });
        total += purchase.totalCost || purchase.total || 0;
      });
      
      setPurchases(purchasesList);
      setTotalPurchases(total);
    } catch (error) {
      console.error('Error fetching purchases:', error);
    }
  };

  const fetchExpenses = async () => {
    try {
      const db = getFirestore();
      const expensesQuery = query(
        collection(db, 'expenses'),
        where('storeId', '==', user?.storeId)
      );
      const expensesSnapshot = await getDocs(expensesQuery);
      
      const expensesList: ExpenseRecord[] = [];
      let total = 0;
      
      expensesSnapshot.forEach(doc => {
        const expense = doc.data();
        let dateStr = 'N/A';
        if (expense.date) {
          dateStr = expense.date;
        } else if (expense.createdAt) {
          if (typeof expense.createdAt === 'string') {
            dateStr = expense.createdAt;
          } else if (expense.createdAt.toDate) {
            dateStr = expense.createdAt.toDate().toLocaleDateString();
          }
        }
        
        expensesList.push({
          id: doc.id,
          date: dateStr,
          category: expense.category || 'Other',
          description: expense.description || 'N/A',
          amount: expense.amount || 0,
          paymentMethod: expense.paymentMethod || 'Cash',
          reference: expense.referenceNumber || expense.reference
        });
        total += expense.amount || 0;
      });
      
      setExpenses(expensesList);
      setTotalExpenses(total);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    }
  };

  const fetchSales = async () => {
    try {
      const db = getFirestore();
      const ordersQuery = query(
        collection(db, 'orders'),
        where('storeId', '==', user?.storeId)
      );
      const ordersSnapshot = await getDocs(ordersQuery);
      
      const salesList: SalesRecord[] = [];
      let total = 0;
      let quarantinedCount = 0;
      
      ordersSnapshot.forEach(doc => {
        const order = doc.data();
        
        // Count only delivered sales for consistency across reports
        if (!isCountedSaleStatus(order.status)) {
          return;
        }
        
        let dateStr = 'N/A';
        if (order.createdAt) {
          dateStr = normalizeDateString(order.createdAt) || dateStr;
        }

        const orderTotal = toFiniteNumber(order.total, Number.NaN);
        const orderSubtotal = toFiniteNumber(order.subtotal ?? order.total, Number.NaN);
        const discountAmount = toFiniteNumber(order.discountAmount ?? order.discount ?? 0, Number.NaN);
        const taxAmount = toFiniteNumber(order.taxAmount ?? 0, Number.NaN);

        if (
          !Number.isFinite(orderTotal) ||
          !Number.isFinite(orderSubtotal) ||
          !Number.isFinite(discountAmount) ||
          !Number.isFinite(taxAmount) ||
          orderTotal < 0 ||
          orderSubtotal < 0 ||
          discountAmount < 0 ||
          taxAmount < 0
        ) {
          quarantinedCount += 1;
          return;
        }

        const amountPaid = toFiniteNumber(order.amountPaid, 0);
        
        salesList.push({
          id: doc.id,
          customerId: order.customerId || undefined,
          date: dateStr,
          customer: order.customerName || 'Walk-in Customer',
          invoiceNumber: order.invoiceNumber,
          total: orderTotal,
          subtotal: orderSubtotal,
          discountAmount,
          amountPaid: order.paymentStatus === 'paid' ? Math.max(orderTotal, amountPaid) : amountPaid,
          taxAmount,
          status: order.status || 'pending',
          paymentStatus: order.paymentStatus || 'unpaid',
          items: Array.isArray(order.items) ? order.items : []
        });
        total += orderTotal;
      });
      
      setSales(salesList);
      setTotalSales(total);
      setQuarantinedSalesCount(quarantinedCount);
    } catch (error) {
      console.error('Error fetching sales:', error);
    }
  };

  const fetchCashCollections = async () => {
    try {
      const db = getFirestore();
      const collectionsQuery = query(
        collection(db, 'cashCollections'),
        where('storeId', '==', user?.storeId)
      );
      const collectionsSnapshot = await getDocs(collectionsQuery);

      const list: CashCollectionRecord[] = [];
      let total = 0;

      collectionsSnapshot.forEach(doc => {
        const entry = doc.data();
        // Use 0 as fallback so records with missing amounts are still shown
        const amount = toFiniteNumber(entry.totalAmount, 0);
        const ordersCount = toFiniteNumber(entry.ordersCount, 0);

        const date =
          typeof entry.collectionDate === 'string'
            ? entry.collectionDate.slice(0, 10)
            : normalizeDateString(entry.collectionDate) || '';

        list.push({
          id: doc.id,
          collectionDate: date,
          bankAccount: toNonEmptyString(entry.bankAccount, '-'),
          depositReference: toNonEmptyString(entry.depositReference, '-'),
          totalAmount: Math.max(0, amount),
          ordersCount: Math.max(0, Math.floor(ordersCount)),
          notes: typeof entry.notes === 'string' ? entry.notes : undefined,
        });

        total += Math.max(0, amount);
      });

      list.sort((a, b) => new Date(b.collectionDate).getTime() - new Date(a.collectionDate).getTime());
      setCashCollections(list);
      setTotalCashDeposited(total);
    } catch (error) {
      console.error('Error fetching cash collections:', error);
    }
  };

  const getFilteredProductSummaries = () => {
    const filteredSales = sales.filter(sale => {
      const matchesDate = isDateInRange(sale.date, filterStartDate, filterEndDate);
      return matchesDate;
    });

    const filteredProductMap = new Map<string, ProductSummary>();

    products.forEach(product => {
      filteredProductMap.set(product.id, {
        id: product.id,
        name: product.name,
        category: product.category,
        totalSold: 0,
        totalRevenue: 0,
        totalDiscount: 0
      });
    });

    let quarantinedCount = 0;

    filteredSales.forEach(sale => {
      const items = sale.items || [];
      const orderTotal = toFiniteNumber(sale.total, Number.NaN);
      if (!Number.isFinite(orderTotal) || orderTotal < 0) {
        quarantinedCount += 1;
        return;
      }

      const itemSubtotals = items.map((item: StatementLineItem) => {
        const quantity = Math.max(0, toFiniteNumber(item.quantity, 0));
        const price = Math.max(0, toFiniteNumber(item.price, 0));
        return quantity * price;
      });
      const computedSubtotal = itemSubtotals.reduce((sum: number, value: number) => sum + value, 0);
      const fallbackSubtotal = Math.max(0, toFiniteNumber(sale.subtotal ?? sale.total, 0));
      const baseSubtotal = computedSubtotal > 0 ? computedSubtotal : fallbackSubtotal;

      if (!Number.isFinite(baseSubtotal) || baseSubtotal < 0) {
        quarantinedCount += 1;
        return;
      }

      let allocatedSoFar = 0;

      items.forEach((item: StatementLineItem, index: number) => {
        const productId = resolveOrderItemProductKey(item);
        if (!productId) return;

        if (!filteredProductMap.has(productId)) {
          filteredProductMap.set(productId, {
            id: productId,
            name: item.productName || 'Unknown Product',
            category: item.category || 'Other',
            totalSold: 0,
            totalRevenue: 0,
            totalDiscount: 0
          });
        }

        const product = filteredProductMap.get(productId)!;
        const quantity = Math.max(0, toFiniteNumber(item.quantity, 0));
        const itemSubtotal = Math.max(0, toFiniteNumber(itemSubtotals[index], 0));

        let itemRevenue = 0;
        if (baseSubtotal > 0) {
          itemRevenue = (itemSubtotal / baseSubtotal) * orderTotal;
        } else if (items.length > 0) {
          itemRevenue = orderTotal / items.length;
        }

        // Ensure allocation sums exactly to order total
        if (index === items.length - 1) {
          itemRevenue = orderTotal - allocatedSoFar;
        } else {
          allocatedSoFar += itemRevenue;
        }

        if (!Number.isFinite(itemRevenue)) {
          quarantinedCount += 1;
          return;
        }

        const itemDiscount = itemSubtotal - itemRevenue;

        product.totalSold += quantity;
        product.totalRevenue += itemRevenue;
        product.totalDiscount = (product.totalDiscount || 0) + itemDiscount;
      });
    });

    return {
      summaries: Array.from(filteredProductMap.values()).filter(p => p.totalSold > 0),
      quarantinedSales: quarantinedCount,
    };
  };

  useEffect(() => {
    const supplierBalance = suppliers.reduce((sum, s) => sum + s.balance, 0);
    const net = customerBalances - supplierBalance - totalExpenses;
    setNetBalance(net);
  }, [customerBalances, suppliers, totalExpenses]);

  const fetchAccountPaymentsData = async () => {
    if (!user?.storeId) return;
    try {
      const db = getFirestore();
      const q = query(collection(db, 'accountPayments'), where('storeId', '==', user.storeId));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<(typeof accountPayments)[number], 'id'>),
      }));
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Backfill: older payments may exist without order allocation metadata.
      const pendingAllocations = list.filter((payment) => {
        return payment.accountType === 'customer'
          && payment.direction === 'in'
          && toFiniteNumber(payment.amount, 0) > 0
          && !payment.orderAllocation?.appliedAt;
      });

      for (const payment of pendingAllocations) {
        const allocation = await allocateCustomerPaymentToOrders(
          payment.id,
          payment.accountId,
          payment.accountName,
          toFiniteNumber(payment.amount, 0),
          payment.date,
          payment.method,
          payment.notes,
        );

        const orderAllocation = {
          appliedAmount: allocation.appliedAmount,
          remainingAmount: allocation.remainingAmount,
          appliedOrderIds: allocation.appliedOrderIds,
          appliedAt: new Date().toISOString(),
        };

        await updateDoc(doc(db, 'accountPayments', payment.id), {
          orderAllocation,
        });

        const index = list.findIndex((entry) => entry.id === payment.id);
        if (index >= 0) {
          list[index] = { ...list[index], orderAllocation };
        }
      }

      setAccountPayments(list);

      if (pendingAllocations.length > 0) {
        await Promise.all([fetchCustomers(), fetchSales()]);
      }
    } catch (err) {
      console.error('Error fetching account payments:', err);
    }
  };

  const allocateCustomerPaymentToOrders = async (
    paymentId: string,
    accountId: string,
    accountName: string,
    amount: number,
    paymentDate: string,
    paymentMethod: string,
    paymentNotes: string,
  ): Promise<{ appliedAmount: number; remainingAmount: number; appliedOrderIds: string[] }> => {
    if (!user?.storeId || amount <= 0) {
      return { appliedAmount: 0, remainingAmount: amount, appliedOrderIds: [] };
    }

    const db = getFirestore();
    let remainingToAllocate = Math.round(amount * 100) / 100;
    const appliedOrderIds: string[] = [];

    const processSnapshots = async (snapshots: Awaited<ReturnType<typeof getDocs>>['docs']) => {
      const orders = snapshots
        .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() as Record<string, unknown> }))
        .filter((order) => isCountedSaleStatus(String(order.status || '')))
        .map((order) => {
          const total = toFiniteNumber(order.total, 0);
          const currentPaid = toFiniteNumber(order.amountPaid, 0);
          const due = Math.max(0, Math.round((total - currentPaid) * 100) / 100);
          const createdAtValue = order.createdAt || order.date || '';
          const createdAtMs = new Date(String(createdAtValue)).getTime() || 0;
          return { order, total, currentPaid, due, createdAtMs };
        })
        .filter((entry) => entry.due > 0)
        .sort((a, b) => a.createdAtMs - b.createdAtMs);

      for (const entry of orders) {
        if (remainingToAllocate <= 0) break;

        const allocated = Math.min(entry.due, remainingToAllocate);
        const roundedAllocated = Math.round(allocated * 100) / 100;
        if (roundedAllocated <= 0) continue;

        const newAmountPaid = Math.round((entry.currentPaid + roundedAllocated) * 100) / 100;
        const newRemainingAmount = Math.max(0, Math.round((entry.total - newAmountPaid) * 100) / 100);
        const paymentStatus = newRemainingAmount <= 0 ? 'paid' : 'partial';

        const currentHistory = Array.isArray(entry.order.paymentHistory) ? entry.order.paymentHistory : [];
        const allocationRecord = {
          id: `AP-${paymentId}-${entry.order.id}`,
          amount: roundedAllocated,
          entryType: 'payment' as const,
          date: paymentDate,
          method: paymentMethod,
          notes: paymentNotes || 'Payment In (Customer) from Account Statement',
          recordedBy: user.name || 'System',
          recordedAt: new Date().toISOString(),
        };

        await updateDoc(doc(db, 'orders', entry.order.id as string), {
          amountPaid: newAmountPaid,
          remainingAmount: newRemainingAmount,
          paymentStatus,
          paymentDate,
          paymentMethod,
          paymentNotes,
          paymentHistory: [...currentHistory, allocationRecord],
          updatedAt: new Date().toISOString(),
        });

        remainingToAllocate = Math.round((remainingToAllocate - roundedAllocated) * 100) / 100;
        appliedOrderIds.push(entry.order.id as string);
      }
    };

    const seenOrderIds = new Set<string>();
    const dedupeDocs = (docs: Awaited<ReturnType<typeof getDocs>>['docs']) => {
      return docs.filter((snapshot) => {
        if (seenOrderIds.has(snapshot.id)) return false;
        seenOrderIds.add(snapshot.id);
        return true;
      });
    };

    const byCustomerIdQuery = query(
      collection(db, 'orders'),
      where('storeId', '==', user.storeId),
      where('customerId', '==', accountId)
    );
    const byCustomerIdSnap = await getDocs(byCustomerIdQuery);
    await processSnapshots(dedupeDocs(byCustomerIdSnap.docs));

    if (remainingToAllocate > 0) {
      const byCustomerNameQuery = query(
        collection(db, 'orders'),
        where('storeId', '==', user.storeId),
        where('customerName', '==', accountName)
      );
      const byCustomerNameSnap = await getDocs(byCustomerNameQuery);
      await processSnapshots(dedupeDocs(byCustomerNameSnap.docs));
    }

    return {
      appliedAmount: Math.round((amount - remainingToAllocate) * 100) / 100,
      remainingAmount: remainingToAllocate,
      appliedOrderIds,
    };
  };

  const createAccountPaymentRecord = async (): Promise<{
    id: string;
    paymentDoc: Record<string, unknown>;
    idempotencyKey: string;
  } | null> => {
    if (!paymentModal || !user?.storeId) return null;
    if (paymentSaveInFlightRef.current) return null;

    const amount = parseFloat(newPayment.amount);
    if (!amount || amount <= 0) {
      alert('Enter a valid amount');
      return null;
    }
    if (!newPayment.date) {
      alert('Select a date');
      return null;
    }

    paymentSaveInFlightRef.current = true;
    setSavingPayment(true);

    const submitNonce = paymentSubmitNonceRef.current || crypto.randomUUID();
    paymentSubmitNonceRef.current = submitNonce;

    const fingerprint = buildPaymentFingerprint(
      paymentModal.accountId,
      paymentModal.accountName,
      paymentModal.accountType,
      paymentModal.direction,
      amount,
      newPayment.date,
      newPayment.method,
    );
    const idempotencyKey = buildPaymentIdempotencyKey(fingerprint, submitNonce);

    const duplicateCutoffMs = Date.now() - PAYMENT_DUPLICATE_WINDOW_MS;
    const localDuplicate = findRecentDuplicatePayment(fingerprint, duplicateCutoffMs);
    if (localDuplicate) {
      alert(
        `This payment was already recorded (${localDuplicate.date}, $${toFiniteNumber(localDuplicate.amount, 0).toFixed(2)}). `
        + 'Do not submit again — refresh the page if you do not see it.',
      );
      paymentSaveInFlightRef.current = false;
      setSavingPayment(false);
      return null;
    }

    try {
      const db = getFirestore();
      const idempotencyQuery = query(
        collection(db, 'accountPayments'),
        where('storeId', '==', user.storeId),
        where('idempotencyKey', '==', idempotencyKey),
      );
      const idempotencySnap = await getDocs(idempotencyQuery);
      if (!idempotencySnap.empty) {
        alert(
          'This payment is already being saved (duplicate click). '
          + 'Please refresh — do not save again.',
        );
        paymentSaveInFlightRef.current = false;
        setSavingPayment(false);
        return null;
      }

      const fingerprintQuery = query(
        collection(db, 'accountPayments'),
        where('storeId', '==', user.storeId),
        where('paymentFingerprint', '==', fingerprint),
      );
      const fingerprintSnap = await getDocs(fingerprintQuery);
      const remoteDuplicate = fingerprintSnap.docs.find((snapshot) => {
        const payment = snapshot.data() as { createdAt?: string; storeId?: string };
        if (payment.storeId && payment.storeId !== user.storeId) return false;
        const createdAtMs = new Date(payment.createdAt || 0).getTime();
        return Number.isFinite(createdAtMs) && createdAtMs >= duplicateCutoffMs;
      });

      if (remoteDuplicate) {
        alert(
          'This payment already exists in the system (possible slow connection duplicate). '
          + 'Please refresh — do not save again.',
        );
        paymentSaveInFlightRef.current = false;
        setSavingPayment(false);
        return null;
      }

      const paymentDoc = {
        storeId: user.storeId,
        accountId: paymentModal.accountId,
        accountName: paymentModal.accountName,
        accountType: paymentModal.accountType,
        direction: paymentModal.direction,
        amount,
        date: newPayment.date,
        method: newPayment.method,
        notes: newPayment.notes,
        idempotencyKey,
        paymentFingerprint: fingerprint,
        createdAt: new Date().toISOString(),
        createdBy: user.id,
        createdByName: user.name || '',
      };
      const ref = await addDoc(collection(db, 'accountPayments'), paymentDoc);

      if (paymentModal.accountType === 'customer' && paymentModal.direction === 'in') {
        const allocation = await allocateCustomerPaymentToOrders(
          ref.id,
          paymentModal.accountId,
          paymentModal.accountName,
          amount,
          newPayment.date,
          newPayment.method,
          newPayment.notes,
        );

        await updateDoc(doc(db, 'accountPayments', ref.id), {
          orderAllocation: {
            appliedAmount: allocation.appliedAmount,
            remainingAmount: allocation.remainingAmount,
            appliedOrderIds: allocation.appliedOrderIds,
            appliedAt: new Date().toISOString(),
          },
        });
      }

      setAccountPayments((prev) => [{ id: ref.id, ...paymentDoc } as (typeof accountPayments)[number], ...prev]);
      return { id: ref.id, paymentDoc, idempotencyKey };
    } catch (err) {
      console.error('Error saving payment:', err);
      alert('Failed to save payment. Please try again.');
      return null;
    } finally {
      paymentSaveInFlightRef.current = false;
      setSavingPayment(false);
    }
  };

  const handleSaveAccountPayment = async () => {
    const saved = await createAccountPaymentRecord();
    if (!saved) return;
    setPaymentModal(null);
    setNewPayment({ amount: '', date: new Date().toISOString().slice(0, 10), method: 'cash', notes: '' });
    await Promise.all([fetchSales(), fetchCustomers()]);
  };

  const generatePaymentReceipt = async (payment: {
    id?: string;
    accountName: string;
    accountType: 'customer' | 'supplier';
    direction: 'in' | 'out';
    amount: number;
    date: string;
    method: string;
    notes: string;
  }) => {
    const db = getFirestore();
    let storeName = 'Store';
    try {
      const profileSnap = await getDocs(query(
        collection(db, 'storeProfiles'),
        where('__name__', '==', user?.storeId ?? '')
      ));
      if (!profileSnap.empty) {
        storeName = profileSnap.docs[0].data().storeName || storeName;
      }
    } catch { /* use default */ }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [80, 140] });
    const receiptNo = payment.id
      ? payment.id.slice(-8).toUpperCase()
      : Date.now().toString().slice(-8);

    const isIncoming = payment.direction === 'in';
    const methodLabel: Record<string, string> = {
      cash: 'Cash', bank_transfer: 'Bank Transfer', cheque: 'Cheque', other: 'Other',
    };

    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text(cleanTextForPDF(storeName), 40, 12, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text('PAYMENT RECEIPT', 40, 18, { align: 'center' });

    doc.setLineWidth(0.3);
    doc.line(5, 21, 75, 21);

    let y = 27;
    const col1 = 6;
    const col2 = 40;

    const row = (label: string, value: string) => {
      doc.setFont(undefined, 'bold');
      doc.setFontSize(7);
      doc.text(label, col1, y);
      doc.setFont(undefined, 'normal');
      doc.text(cleanTextForPDF(value), col2, y);
      y += 6;
    };

    row('Receipt No.:', `#${receiptNo}`);
    row('Date:', new Date(payment.date + 'T00:00:00').toLocaleDateString('en-GB'));
    row(isIncoming ? 'Received from:' : 'Paid to:', payment.accountName);
    row('Type:', payment.accountType === 'customer' ? 'Customer' : 'Supplier');
    row('Method:', methodLabel[payment.method] || payment.method);
    if (payment.notes) row('Notes:', payment.notes);

    y += 2;
    doc.line(5, y, 75, y);
    y += 6;

    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text(isIncoming ? 'Amount Received:' : 'Amount Paid:', col1, y);
    doc.text(`$${payment.amount.toFixed(2)}`, 74, y, { align: 'right' });
    y += 5;
    doc.line(5, y, 75, y);
    y += 8;

    doc.setFontSize(7);
    doc.setFont(undefined, 'normal');
    doc.text(isIncoming ? 'Thank you for your payment.' : 'Payment confirmed.', 40, y, { align: 'center' });
    y += 5;
    doc.text(`Recorded by: ${cleanTextForPDF(user?.name || 'System')}`, 40, y, { align: 'center' });

    doc.save(`receipt_${receiptNo}_${payment.accountName.replace(/\s+/g, '_')}.pdf`);
  };

  const handleSaveAndPrint = async () => {
    if (!paymentModal) return;
    const modalSnapshot = { ...paymentModal };
    const paymentSnapshot = { ...newPayment };
    const saved = await createAccountPaymentRecord();
    if (!saved) return;

    const amount = parseFloat(paymentSnapshot.amount);
    setPaymentModal(null);
    setNewPayment({ amount: '', date: new Date().toISOString().slice(0, 10), method: 'cash', notes: '' });
    await Promise.all([fetchSales(), fetchCustomers()]);

    await generatePaymentReceipt({
      id: saved.id,
      accountName: modalSnapshot.accountName,
      accountType: modalSnapshot.accountType,
      direction: modalSnapshot.direction,
      amount,
      date: paymentSnapshot.date,
      method: paymentSnapshot.method,
      notes: paymentSnapshot.notes,
    });
  };

  const openPaymentModal = (accountId: string, accountName: string, accountType: 'customer' | 'supplier') => {
    paymentSaveInFlightRef.current = false;
    paymentSubmitNonceRef.current = crypto.randomUUID();
    setPaymentModal({
      open: true,
      accountId,
      accountName,
      accountType,
      direction: accountType === 'customer' ? 'in' : 'out',
    });
    setNewPayment({ amount: '', date: new Date().toISOString().slice(0, 10), method: 'cash', notes: '' });
  };

  const generateDetailedStatement = async (type: 'supplier' | 'customer', id: string, name: string) => {
    if (!user?.storeId) return;
    
    try {
      const db = getFirestore();
      const transactions: DetailedTransaction[] = [];
      let runningBalance = 0;
      let phone = '';
      
      if (type === 'supplier') {
        // Fetch all purchases for this supplier
        const purchasesQuery = query(
          collection(db, 'purchases'),
          where('storeId', '==', user.storeId),
          where('supplierId', '==', id)
        );
        const purchasesSnap = await getDocs(purchasesQuery);

        // Fetch all returns for this supplier
        const returnsQuery = query(
          collection(db, 'supplierReturns'),
          where('storeId', '==', user.storeId),
          where('supplierId', '==', id),
          where('status', '==', 'credited')
        );
        const returnsSnap = await getDocs(returnsQuery);

        // Fetch standalone payments recorded via Account Statement payment page
        const supplierPaymentsQuery = query(
          collection(db, 'accountPayments'),
          where('storeId', '==', user.storeId),
          where('accountId', '==', id),
          where('accountType', '==', 'supplier')
        );
        const supplierPaymentsSnap = await getDocs(supplierPaymentsQuery);

        // Collect all transactions
        const allTxns: StatementTxn[] = [];
        
        // First collect all valid purchase IDs
        const validPurchaseIds = new Set<string>();
        purchasesSnap.forEach(doc => {
          validPurchaseIds.add(doc.id);
        });
        
        purchasesSnap.forEach(doc => {
          const purchase = doc.data();
          const total = purchase.totalCost || purchase.totalAmount || purchase.total || 0;
          const subtotal = purchase.subtotal || total;
          const vat = purchase.vat || (total - subtotal);
          const paid = purchase.paymentStatus === 'paid'
            ? Math.max(total, toFiniteNumber(purchase.amountPaid || purchase.paid, 0))
            : toFiniteNumber(purchase.amountPaid || purchase.paid, 0);
          const invoiceRef = purchase.invoiceNumber || doc.id.substring(0, 8);

          allTxns.push({
            date: purchase.date || purchase.createdAt || '',
            type: 'purchase',
            ref: invoiceRef,
            description: `Pur.Inv.${invoiceRef}`,
            debit: 0,
            net: subtotal,
            vat: vat,
            credit: total,
            data: purchase
          });

          if (paid > 0) {
            allTxns.push({
              date: purchase.paymentDate || purchase.paidAt || purchase.date || purchase.createdAt || '',
              type: 'purchase_payment',
              ref: `PAY-${invoiceRef}`.substring(0, 20),
              description: `Payment - ${invoiceRef}`,
              debit: paid,
              net: 0,
              vat: 0,
              credit: 0,
              data: purchase
            });
          }
        });

        // Standalone payments (accountPayments direction=out) appear as debit entries
        supplierPaymentsSnap.forEach(doc => {
          const pmt = doc.data();
          if (pmt.direction !== 'out') return;
          const amount = toFiniteNumber(pmt.amount, 0);
          if (amount <= 0) return;
          allTxns.push({
            date: pmt.date || pmt.createdAt || '',
            type: 'payment',
            ref: pmt.reference || doc.id.substring(0, 8),
            description: `Payment - ${pmt.method || 'cash'}`,
            debit: amount,
            net: 0,
            vat: 0,
            credit: 0,
            data: pmt
          });
        });

        returnsSnap.forEach(doc => {
          const returnDoc = doc.data();
          const purchaseId = returnDoc.purchaseId || returnDoc.originalPurchaseId;
          
          // Skip orphaned returns (returns without valid purchase references)
          if (!purchaseId || !validPurchaseIds.has(purchaseId)) return;
          
          const creditAmount = returnDoc.creditIssued || returnDoc.totalClaimAmount || 0;
          
          allTxns.push({
            date: returnDoc.date || returnDoc.createdAt || '',
            type: 'return',
            ref: returnDoc.returnNumber || doc.id.substring(0, 8),
            description: `Return Credit`,
            debit: 0,
            net: 0,
            vat: 0,
            credit: creditAmount,
            data: returnDoc
          });
        });
        
        // Sort by date
        allTxns.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        // Calculate running balance
        allTxns.forEach(txn => {
          runningBalance += txn.debit - txn.credit;
          transactions.push({
            date: toStatementDateLabel(txn.date),
            ref: txn.ref,
            description: txn.description,
            debit: txn.debit,
            netVat: txn.net || 0,
            credit: txn.credit,
            balance: runningBalance,
            vatLL: txn.vat || 0
          });
        });
      } else if (type === 'customer') {
        // Fetch all orders for this customer
        const ordersQuery = query(
          collection(db, 'orders'),
          where('storeId', '==', user.storeId),
          where('customerId', '==', id)
        );
        const ordersSnap = await getDocs(ordersQuery);
        
        // Fetch account payments for this customer (payments recorded outside of orders)
        const acctPaymentsQuery = query(
          collection(db, 'accountPayments'),
          where('storeId', '==', user.storeId),
          where('accountId', '==', id),
          where('accountType', '==', 'customer')
        );
        const acctPaymentsSnap = await getDocs(acctPaymentsQuery);
        
        // Collect all transactions
        const allTxns: StatementTxn[] = [];
        
        ordersSnap.forEach(doc => {
          const order = doc.data();
          
          // Match account statement page rules: count only finalized sale statuses
          if (!isCountedSaleStatus(String(order.status || ''))) {
            return;
          }

          // Capture phone from the first available order
          if (!phone) {
            phone = order.customerPhone || order.deliveryPhone || order.phone || '';
          }
          
          const total = order.totalAmount || order.total || 0;
          const vat = order.taxAmount || order.vat || 0;
          const net = total - vat; // Net = Total - VAT
          
          const orderDate = normalizeDateString(order.createdAt || order.date);
          if (!orderDate) return;

          allTxns.push({
            date: orderDate,
            type: 'order',
            ref: order.invoiceNumber || order.orderNumber || doc.id.substring(0, 8),
            description: `Sales Inv.${order.invoiceNumber || doc.id.substring(0, 6)}`,
            debit: total,
            net: net,
            vat: vat,
            credit: order.paymentStatus === 'paid' ? Math.max(total, toFiniteNumber(order.amountPaid, 0)) : toFiniteNumber(order.amountPaid, 0),
            data: order
          });
        });
        
        // Add account payments as separate credit/debit lines
        acctPaymentsSnap.forEach(doc => {
          const payment = doc.data();
          if (payment.direction !== 'in') return;
          const unapplied = getUnappliedPaymentAmount({
            ...payment,
            id: doc.id,
          } as (typeof accountPayments)[number]);
          if (unapplied <= BALANCE_EPSILON) return;
          const amount = unapplied;
          if (amount <= BALANCE_EPSILON) return;
          const paymentDate = normalizeDateString(payment.date || payment.createdAt);
          if (!paymentDate) return;
          // Match customer page ledger: show only unapplied incoming payments as separate credit rows.
          allTxns.push({
            date: paymentDate,
            type: 'payment',
            ref: doc.id.substring(0, 8),
            description: `Payment - ${payment.method || 'cash'}`,
            debit: 0,
            net: 0,
            vat: 0,
            credit: amount,
            data: payment
          });
        });
        
        // Sort by date
        allTxns.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        // Calculate running balance
        allTxns.forEach(txn => {
          runningBalance += txn.debit - txn.credit;
          transactions.push({
            date: toStatementDateLabel(txn.date),
            ref: txn.ref,
            description: txn.description,
            debit: txn.debit,
            netVat: txn.net || 0,
            credit: txn.credit,
            balance: runningBalance,
            vatLL: txn.vat || 0
          });
        });
      }
      
      setDetailedStatement({
        accountNo: generateNumericAccountNo(id),
        accountName: name,
        currency: 'US',
        asOfDate: new Date().toLocaleDateString('en-GB'),
        phone,
        attn: '',
        openingBalance: 0,
        transactions,
        closingBalance: runningBalance
      });
      
      setViewingDetailedStatement({ type, id, name });
    } catch (error) {
      console.error('Error generating detailed statement:', error);
    }
  };

  // Helper function to generate numeric account number from document ID
  const generateNumericAccountNo = (id: string): string => {
    // Convert string to numeric hash
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      const char = id.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    // Ensure positive and pad to 10 digits
    return Math.abs(hash).toString().padStart(10, '0');
  };

  const numberToWords = (num: number): string => {
    const ones = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
    const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
    const teens = ['TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
    
    if (num === 0) return 'ZERO';
    
    const dollars = Math.floor(num);
    const cents = Math.round((num - dollars) * 100);
    
    let words = 'ONLY ';
    
    if (dollars >= 1000000) {
      const millions = Math.floor(dollars / 1000000);
      words += ones[millions] + ' MILLION ';
    }
    
    const thousands = Math.floor((dollars % 1000000) / 1000);
    if (thousands > 0) {
      if (thousands >= 100) {
        words += ones[Math.floor(thousands / 100)] + ' HUNDRED ';
      }
      const remainderThousands = thousands % 100;
      if (remainderThousands >= 10 && remainderThousands < 20) {
        words += teens[remainderThousands - 10] + ' ';
      } else {
        if (remainderThousands >= 20) words += tens[Math.floor(remainderThousands / 10)] + ' ';
        if (remainderThousands % 10 > 0) words += ones[remainderThousands % 10] + ' ';
      }
      words += 'THOUSAND ';
    }
    
    const hundreds = Math.floor((dollars % 1000) / 100);
    if (hundreds > 0) {
      words += ones[hundreds] + ' HUNDRED ';
    }
    
    const remainder = dollars % 100;
    if (remainder >= 10 && remainder < 20) {
      words += teens[remainder - 10] + ' ';
    } else {
      if (remainder >= 20) words += tens[Math.floor(remainder / 10)] + ' ';
      if (remainder % 10 > 0) words += ones[remainder % 10] + ' ';
    }
    
    words += 'US DOLLAR';
    if (cents > 0) {
      words += ` & ${cents}%`;
    }
    words += ' .';
    
    return words.trim();
  };

  const exportDetailedStatementToPDF = async () => {
    if (!detailedStatement) return;
    
    const doc = new jsPDF();
    await initArabicPDF(doc);
    let currentPage = 1;
    
    // Page number
    doc.setFontSize(10);
    doc.text(`Page   ${currentPage}`, 20, 15);
    
    // Header
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(`STATEMENT OF ACCOUNT AS AT ${detailedStatement.asOfDate}`, 20, 25);
    
    // Account details
    let y = 35;
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text('A/c No.', 20, y);
    doc.text(detailedStatement.accountNo, 50, y);
    y += 5;
    doc.text('A/c name:', 20, y);
    writeText(doc, detailedStatement.accountName, 50, y);
    y += 5;
    doc.text('Attn:', 20, y);
    doc.text(detailedStatement.attn || '', 50, y);
    y += 5;
    doc.text('Phone #', 20, y);
    doc.text(detailedStatement.phone || '', 50, y);
    y += 5;
    doc.text('Currency', 20, y);
    doc.text(detailedStatement.currency, 50, y);
    y += 8;
    
    // Table header
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.text('Date', 20, y);
    doc.text('Ref.', 40, y);
    doc.text('Description', 65, y);
    doc.text('Debit', 105, y, { align: 'right' });
    doc.text('Net', 120, y, { align: 'right' });
    doc.text('VAT', 130, y, { align: 'right' });
    doc.text('Credit', 150, y, { align: 'right' });
    doc.text('Balance', 170, y, { align: 'right' });
    doc.text('VAT LL', 190, y, { align: 'right' });
    y += 2;
    doc.line(20, y, 195, y);
    y += 5;
    
    // Opening balance
    doc.setFont(undefined, 'normal');
    if (detailedStatement.openingBalance !== 0) {
      const firstDate = detailedStatement.transactions[0]?.date || '01/01/2026';
      doc.text(firstDate, 20, y);
      doc.text('JVO00000001', 40, y);
      doc.text('Brought forward year', 65, y);
      doc.text(Math.abs(detailedStatement.openingBalance).toFixed(2), 170, y, { align: 'right' });
      y += 5;
    }
    
    // Transactions
    doc.setFontSize(8);
    detailedStatement.transactions.forEach(txn => {
      if (y > 265) {
        doc.addPage();
        currentPage++;
        doc.text(`Page   ${currentPage}`, 20, 15);
        y = 25;
      }
      
      doc.text(txn.date, 20, y);
      doc.text(txn.ref.substring(0, 12), 40, y);
      writeText(doc, txn.description.substring(0, 20), 65, y);
      if (txn.debit > 0) doc.text(txn.debit.toFixed(2), 105, y, { align: 'right' });
      if (txn.netVat > 0) doc.text(txn.netVat.toFixed(2), 120, y, { align: 'right' });
      if (txn.credit > 0) doc.text(txn.credit.toFixed(2), 150, y, { align: 'right' });
      doc.text(txn.balance.toFixed(2), 170, y, { align: 'right' });
      if (txn.vatLL > 0) doc.text(txn.vatLL.toFixed(2), 190, y, { align: 'right' });
      y += 5;
    });
    
    // Total row
    y += 2;
    doc.line(20, y, 195, y);
    y += 5;
    doc.setFont(undefined, 'bold');
    doc.text('Total', 65, y);
    const totalDebit = detailedStatement.transactions.reduce((sum, t) => sum + t.debit, 0);
    const totalCredit = detailedStatement.transactions.reduce((sum, t) => sum + t.credit, 0);
    if (totalDebit > 0) doc.text(totalDebit.toFixed(2), 105, y, { align: 'right' });
    if (totalCredit > 0) doc.text(totalCredit.toFixed(2), 150, y, { align: 'right' });
    doc.text(Math.abs(detailedStatement.closingBalance).toFixed(2), 170, y, { align: 'right' });
    
    // Balance favour
    y += 7;
    doc.setFont(undefined, 'normal');
    if (detailedStatement.closingBalance > 0) {
      doc.text('Balance in our favour', 20, y);
    } else {
      doc.text('Balance in your favour', 20, y);
    }
    
    // Amount in words
    y += 7;
    const amountInWords = numberToWords(Math.abs(detailedStatement.closingBalance));
    doc.text(amountInWords, 20, y);
    
    // Signature
    y += 10;
    doc.text('Accounts dept. _________________', 20, y);
    
    doc.save(`statement_${detailedStatement.accountName.replace(/\s+/g, '_')}_${detailedStatement.asOfDate.replace(/\//g, '-')}.pdf`);
  };

  const exportSuppliersToExcel = () => {
    const data: CsvRow[] = [];
    let quarantinedExportRows = 0;

    const validSuppliers = suppliers.map((supplier) => {
      const totalPurchases = toFiniteNumber(supplier.totalPurchases, Number.NaN);
      const totalPayments = toFiniteNumber(supplier.totalPayments, Number.NaN);
      const balance = toFiniteNumber(supplier.balance, Number.NaN);
      if (!Number.isFinite(totalPurchases) || !Number.isFinite(totalPayments) || !Number.isFinite(balance)) {
        quarantinedExportRows += 1;
        return null;
      }
      return {
        name: toNonEmptyString(supplier.name, 'Unknown Supplier'),
        totalPurchases,
        totalPayments,
        balance,
      };
    }).filter(Boolean) as Array<{ name: string; totalPurchases: number; totalPayments: number; balance: number }>;
    
    // Add header rows
    data.push({ 'Supplier Name': 'SUPPLIER BALANCES STATEMENT', 'Total Purchases': '', 'Total Payments': '', 'Balance Due': '' });
    if (filterStartDate || filterEndDate) {
      const startDisplay = filterStartDate ? new Date(filterStartDate).toLocaleDateString('en-GB') : 'Beginning';
      const endDisplay = filterEndDate ? new Date(filterEndDate).toLocaleDateString('en-GB') : 'Present';
      data.push({ 'Supplier Name': `Period from ${startDisplay} to ${endDisplay}`, 'Total Purchases': '', 'Total Payments': '', 'Balance Due': '' });
    }
    data.push({ 'Supplier Name': `Generated: ${new Date().toLocaleDateString('en-GB')}`, 'Total Purchases': '', 'Total Payments': '', 'Balance Due': '' });
    data.push({ 'Supplier Name': '', 'Total Purchases': '', 'Total Payments': '', 'Balance Due': '' });
    
    // Add column headers
    data.push({ 'Supplier Name': 'Supplier Name', 'Total Purchases': 'Total Purchases', 'Total Payments': 'Total Payments', 'Balance Due': 'Balance Due' });
    
    // Add supplier data
    validSuppliers.forEach(s => {
      data.push({
        'Supplier Name': s.name,
        'Total Purchases': s.totalPurchases.toFixed(2),
        'Total Payments': s.totalPayments.toFixed(2),
        'Balance Due': s.balance.toFixed(2)
      });
    });
    
    // Add empty row before totals
    data.push({ 'Supplier Name': '', 'Total Purchases': '', 'Total Payments': '', 'Balance Due': '' });
    
    // Add total row
    const totalPurchases = validSuppliers.reduce((sum, s) => sum + s.totalPurchases, 0);
    const totalPayments = validSuppliers.reduce((sum, s) => sum + s.totalPayments, 0);
    const totalBalance = validSuppliers.reduce((sum, s) => sum + s.balance, 0);

    if (quarantinedExportRows > 0) {
      data.push({ 'Supplier Name': `Quarantined invalid rows: ${quarantinedExportRows}`, 'Total Purchases': '', 'Total Payments': '', 'Balance Due': '' });
      data.push({ 'Supplier Name': '', 'Total Purchases': '', 'Total Payments': '', 'Balance Due': '' });
    }

    data.push({
      'Supplier Name': 'TOTAL',
      'Total Purchases': totalPurchases.toFixed(2),
      'Total Payments': totalPayments.toFixed(2),
      'Balance Due': totalBalance.toFixed(2)
    });
    
    exportToCSV(data, 'suppliers_statement.csv');
  };

  const exportProductsToExcel = () => {
    const { summaries: filteredProducts } = getFilteredProductSummaries();
    const data: CsvRow[] = [];
    
    // Add header rows
    data.push({ 'Product Name': 'PRODUCTS SUMMARY REPORT', 'Category': '', 'Total Sold': '', 'Total Revenue': '' });
    if (filterStartDate || filterEndDate) {
      const startDisplay = filterStartDate ? new Date(filterStartDate).toLocaleDateString('en-GB') : 'Beginning';
      const endDisplay = filterEndDate ? new Date(filterEndDate).toLocaleDateString('en-GB') : 'Present';
      data.push({ 'Product Name': `Period from ${startDisplay} to ${endDisplay}`, 'Category': '', 'Total Sold': '', 'Total Revenue': '' });
    }
    data.push({ 'Product Name': `Generated: ${new Date().toLocaleDateString('en-GB')}`, 'Category': '', 'Total Sold': '', 'Total Revenue': '' });
    data.push({ 'Product Name': '', 'Category': '', 'Total Sold': '', 'Total Revenue': '' });
    
    // Group products by category
    const groupedProducts = filteredProducts.reduce((acc, p) => {
      const category = p.category || 'Uncategorized';
      if (!acc[category]) acc[category] = [];
      acc[category].push(p);
      return acc;
    }, {} as Record<string, typeof filteredProducts>);
    
    // Sort categories alphabetically
    const sortedCategories = Object.keys(groupedProducts).sort();
    
    let grandTotalSold = 0;
    let grandTotalRevenue = 0;
    
    // Add data grouped by category
    sortedCategories.forEach(category => {
      // Category header
      data.push({ 'Product Name': '', 'Category': '', 'Total Sold': '', 'Total Revenue': '' });
      data.push({ 'Product Name': `GROUP: ${category.toUpperCase()}`, 'Category': '', 'Total Sold': '', 'Total Revenue': '' });
      data.push({ 'Product Name': 'Product Name', 'Category': 'Category', 'Total Sold': 'Qty Sold', 'Total Revenue': 'Total Sales' });
      
      let categoryTotalSold = 0;
      let categoryTotalRevenue = 0;
      
      // Products in this category
      groupedProducts[category].forEach(p => {
        data.push({
          'Product Name': p.name,
          'Category': p.category,
          'Total Sold': p.totalSold,
          'Total Revenue': p.totalRevenue.toFixed(2)
        });
        categoryTotalSold += p.totalSold;
        categoryTotalRevenue += p.totalRevenue;
      });
      
      // Category subtotal
      data.push({ 'Product Name': '', 'Category': '', 'Total Sold': '', 'Total Revenue': '' });
      data.push({
        'Product Name': `SUBTOTAL - ${category}`,
        'Category': '',
        'Total Sold': categoryTotalSold,
        'Total Revenue': categoryTotalRevenue.toFixed(2)
      });
      
      grandTotalSold += categoryTotalSold;
      grandTotalRevenue += categoryTotalRevenue;
    });
    
    // Grand total
    data.push({ 'Product Name': '', 'Category': '', 'Total Sold': '', 'Total Revenue': '' });
    data.push({ 'Product Name': '', 'Category': '', 'Total Sold': '', 'Total Revenue': '' });
    data.push({
      'Product Name': 'GRAND TOTAL',
      'Category': '',
      'Total Sold': grandTotalSold,
      'Total Revenue': grandTotalRevenue.toFixed(2)
    });
    
    exportToCSV(data, 'products_summary.csv');
  };

  const exportPurchasesToExcel = () => {
    const rows = buildPurchaseStatementRows(purchases);
    const totals = rows.reduce((acc, row) => {
      acc.debit += row.debit;
      acc.net += row.net;
      acc.vat += row.vat;
      acc.credit += row.credit;
      return acc;
    }, { debit: 0, net: 0, vat: 0, credit: 0 });

    const data: CsvRow[] = [];
    data.push({ 'Date': 'PURCHASE HISTORY REPORT', 'Ref.': '', 'Description': '', 'Debit': '', 'Net': '', 'VAT': '', 'Credit': '', 'Balance': '', 'Status': '' });
    if (filterStartDate || filterEndDate) {
      const startDisplay = filterStartDate ? new Date(filterStartDate).toLocaleDateString('en-GB') : 'Beginning';
      const endDisplay = filterEndDate ? new Date(filterEndDate).toLocaleDateString('en-GB') : 'Present';
      data.push({ 'Date': `Period from ${startDisplay} to ${endDisplay}`, 'Ref.': '', 'Description': '', 'Debit': '', 'Net': '', 'VAT': '', 'Credit': '', 'Balance': '', 'Status': '' });
    }
    data.push({ 'Date': `Generated: ${new Date().toLocaleDateString('en-GB')}`, 'Ref.': '', 'Description': '', 'Debit': '', 'Net': '', 'VAT': '', 'Credit': '', 'Balance': '', 'Status': '' });
    data.push({ 'Date': '', 'Ref.': '', 'Description': '', 'Debit': '', 'Net': '', 'VAT': '', 'Credit': '', 'Balance': '', 'Status': '' });
    data.push({ 'Date': 'Date', 'Ref.': 'Ref.', 'Description': 'Description', 'Debit': 'Debit', 'Net': 'Net', 'VAT': 'VAT', 'Credit': 'Credit', 'Balance': 'Balance', 'Status': 'Status' });

    rows.forEach((row) => {
      data.push({
        'Date': row.dateLabel,
        'Ref.': row.ref,
        'Description': row.description,
        'Debit': row.debit.toFixed(2),
        'Net': row.net.toFixed(2),
        'VAT': row.vat.toFixed(2),
        'Credit': row.credit.toFixed(2),
        'Balance': row.balance.toFixed(2),
        'Status': row.status,
      });
    });

    data.push({ 'Date': '', 'Ref.': '', 'Description': '', 'Debit': '', 'Net': '', 'VAT': '', 'Credit': '', 'Balance': '', 'Status': '' });
    data.push({
      'Date': 'TOTAL',
      'Ref.': '',
      'Description': '',
      'Debit': totals.debit.toFixed(2),
      'Net': totals.net.toFixed(2),
      'VAT': totals.vat.toFixed(2),
      'Credit': totals.credit.toFixed(2),
      'Balance': rows.length > 0 ? rows[rows.length - 1].balance.toFixed(2) : '0.00',
      'Status': '',
    });

    exportToCSV(data, 'purchases_history.csv');
  };

  const exportExpensesToExcel = () => {
    const data: CsvRow[] = [];
    let quarantinedExportRows = 0;

    const validExpenses = expenses.map((expense) => {
      const amount = toFiniteNumber(expense.amount, Number.NaN);
      if (!Number.isFinite(amount) || amount < 0) {
        quarantinedExportRows += 1;
        return null;
      }
      return {
        date: toDateLabel(expense.date),
        category: toNonEmptyString(expense.category, 'Uncategorized'),
        description: toNonEmptyString(expense.description, 'N/A'),
        amount,
      };
    }).filter(Boolean) as Array<{ date: string; category: string; description: string; amount: number }>;
    
    // Add header rows
    data.push({ 'Date': 'EXPENSE HISTORY REPORT', 'Category': '', 'Description': '', 'Amount': '' });
    if (filterStartDate || filterEndDate) {
      const startDisplay = filterStartDate ? new Date(filterStartDate).toLocaleDateString('en-GB') : 'Beginning';
      const endDisplay = filterEndDate ? new Date(filterEndDate).toLocaleDateString('en-GB') : 'Present';
      data.push({ 'Date': `Period from ${startDisplay} to ${endDisplay}`, 'Category': '', 'Description': '', 'Amount': '' });
    }
    data.push({ 'Date': `Generated: ${new Date().toLocaleDateString('en-GB')}`, 'Category': '', 'Description': '', 'Amount': '' });
    data.push({ 'Date': '', 'Category': '', 'Description': '', 'Amount': '' });
    
    // Group expenses by category
    const groupedExpenses = validExpenses.reduce((acc, e) => {
      const category = e.category || 'Uncategorized';
      if (!acc[category]) acc[category] = [];
      acc[category].push(e);
      return acc;
    }, {} as Record<string, typeof validExpenses>);
    
    const sortedCategories = Object.keys(groupedExpenses).sort();
    
    let grandTotal = 0;
    
    sortedCategories.forEach(category => {
      // Category header
      data.push({ 'Date': '', 'Category': '', 'Description': '', 'Amount': '' });
      data.push({ 'Date': `CATEGORY: ${category.toUpperCase()}`, 'Category': '', 'Description': '', 'Amount': '' });
      data.push({ 'Date': 'Date', 'Category': 'Category', 'Description': 'Description', 'Amount': 'Amount' });
      
      let categoryTotal = 0;
      
      groupedExpenses[category].forEach(e => {
        data.push({
          'Date': e.date,
          'Category': e.category,
          'Description': e.description,
          'Amount': e.amount.toFixed(2)
        });
        categoryTotal += e.amount;
      });
      
      // Category subtotal
      data.push({ 'Date': '', 'Category': '', 'Description': '', 'Amount': '' });
      data.push({
        'Date': '',
        'Category': '',
        'Description': `SUBTOTAL - ${category}`,
        'Amount': categoryTotal.toFixed(2)
      });
      
      grandTotal += categoryTotal;
    });
    
    // Grand total
    data.push({ 'Date': '', 'Category': '', 'Description': '', 'Amount': '' });
    if (quarantinedExportRows > 0) {
      data.push({ 'Date': `Quarantined invalid rows: ${quarantinedExportRows}`, 'Category': '', 'Description': '', 'Amount': '' });
      data.push({ 'Date': '', 'Category': '', 'Description': '', 'Amount': '' });
    }
    data.push({ 'Date': '', 'Category': '', 'Description': '', 'Amount': '' });
    data.push({
      'Date': '',
      'Category': '',
      'Description': 'GRAND TOTAL',
      'Amount': grandTotal.toFixed(2)
    });
    
    exportToCSV(data, 'expenses_statement.csv');
  };

  const exportSalesToExcel = () => {
    const filteredSales = sales.filter(sale => {
      const saleDate = new Date(sale.date).toISOString().split('T')[0];
      const matchesStart = !filterStartDate || saleDate >= filterStartDate;
      const matchesEnd = !filterEndDate || saleDate <= filterEndDate;
      const matchesCustomer = !filterCustomer || sale.customer === filterCustomer;
      const matchesProduct = !filterProduct || (sale.items && sale.items.some((item: StatementLineItem) => item.productId === filterProduct));
      return matchesStart && matchesEnd && matchesCustomer && matchesProduct;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let quarantinedExportRows = 0;

    const processedRows = filteredSales.map((sale) => {
      let subtotal: number;
      let discount: number;
      let debit: number;
      let vat: number;
      let net: number;
      let credit: number;
      let balance: number;

      if (filterProduct && sale.items) {
        const orderSubtotal = toFiniteNumber(sale.subtotal ?? sale.total, Number.NaN);
        const orderDiscount = toFiniteNumber(sale.discountAmount ?? 0, Number.NaN);
        const orderTotal = toFiniteNumber(sale.total, Number.NaN);
        const orderVat = toFiniteNumber(sale.taxAmount ?? 0, Number.NaN);
        const orderPaid = toFiniteNumber(sale.amountPaid, Number.NaN);

        if (!Number.isFinite(orderSubtotal) || !Number.isFinite(orderDiscount) || !Number.isFinite(orderTotal) || !Number.isFinite(orderVat) || !Number.isFinite(orderPaid)) {
          quarantinedExportRows += 1;
          return null;
        }

        subtotal = 0;
        sale.items.forEach((item: StatementLineItem) => {
          if (item.productId === filterProduct) {
            const quantity = Math.max(0, toFiniteNumber(item.quantity, 0));
            const price = Math.max(0, toFiniteNumber(item.price, 0));
            subtotal += quantity * price;
          }
        });

        discount = orderSubtotal > 0 ? (subtotal / orderSubtotal) * orderDiscount : 0;
        debit = subtotal - discount;
        vat = (orderTotal > 0 && orderVat > 0) ? (debit / (orderTotal - orderVat)) * orderVat : 0;
        net = debit - vat;
        credit = orderTotal > 0 ? (debit / orderTotal) * orderPaid : 0;
        balance = debit - credit;
      } else {
        subtotal = toFiniteNumber(sale.subtotal ?? sale.total, Number.NaN);
        discount = toFiniteNumber(sale.discountAmount ?? 0, Number.NaN);
        debit = toFiniteNumber(sale.total, Number.NaN);
        vat = toFiniteNumber(sale.taxAmount ?? 0, Number.NaN);
        credit = toFiniteNumber(sale.amountPaid, Number.NaN);
        net = debit - vat;
        balance = debit - credit;

        if (!Number.isFinite(subtotal) || !Number.isFinite(discount) || !Number.isFinite(debit) || !Number.isFinite(vat) || !Number.isFinite(credit)) {
          quarantinedExportRows += 1;
          return null;
        }
      }

      return {
        date: new Date(sale.date).toLocaleDateString('en-GB'),
        ref: sale.invoiceNumber || '-',
        description: sale.customer,
        subtotal,
        discount,
        debit,
        net,
        vat,
        credit,
        balance,
        status: sale.paymentStatus || 'unpaid',
      };
    }).filter(Boolean) as Array<{
      date: string;
      ref: string;
      description: string;
      subtotal: number;
      discount: number;
      debit: number;
      net: number;
      vat: number;
      credit: number;
      balance: number;
      status: string;
    }>;

    const totals = processedRows.reduce((acc, row) => {
      acc.subtotal += row.subtotal;
      acc.discount += row.discount;
      acc.debit += row.debit;
      acc.net += row.net;
      acc.vat += row.vat;
      acc.credit += row.credit;
      acc.balance += row.balance;
      return acc;
    }, { subtotal: 0, discount: 0, debit: 0, net: 0, vat: 0, credit: 0, balance: 0 });

    const data: CsvRow[] = [];
    data.push({ 'Date': 'SALES HISTORY REPORT', 'Ref.': '', 'Description': '', 'Subtotal': '', 'Discount': '', 'Debit': '', 'Net': '', 'VAT': '', 'Credit': '', 'Balance': '', 'Status': '' });
    if (filterStartDate || filterEndDate) {
      const startDisplay = filterStartDate ? new Date(filterStartDate).toLocaleDateString('en-GB') : 'Beginning';
      const endDisplay = filterEndDate ? new Date(filterEndDate).toLocaleDateString('en-GB') : 'Present';
      data.push({ 'Date': `Period from ${startDisplay} to ${endDisplay}`, 'Ref.': '', 'Description': '', 'Subtotal': '', 'Discount': '', 'Debit': '', 'Net': '', 'VAT': '', 'Credit': '', 'Balance': '', 'Status': '' });
    }
    if (filterCustomer) {
      data.push({ 'Date': `Customer: ${filterCustomer}`, 'Ref.': '', 'Description': '', 'Subtotal': '', 'Discount': '', 'Debit': '', 'Net': '', 'VAT': '', 'Credit': '', 'Balance': '', 'Status': '' });
    }
    if (filterProduct) {
      const productName = products.find((p) => p.id === filterProduct)?.name || filterProduct;
      data.push({ 'Date': `Product: ${productName}`, 'Ref.': '', 'Description': '', 'Subtotal': '', 'Discount': '', 'Debit': '', 'Net': '', 'VAT': '', 'Credit': '', 'Balance': '', 'Status': '' });
    }
    data.push({ 'Date': `Generated: ${new Date().toLocaleDateString('en-GB')}`, 'Ref.': '', 'Description': '', 'Subtotal': '', 'Discount': '', 'Debit': '', 'Net': '', 'VAT': '', 'Credit': '', 'Balance': '', 'Status': '' });
    data.push({ 'Date': '', 'Ref.': '', 'Description': '', 'Subtotal': '', 'Discount': '', 'Debit': '', 'Net': '', 'VAT': '', 'Credit': '', 'Balance': '', 'Status': '' });

    data.push({
      'Date': 'Date',
      'Ref.': 'Ref.',
      'Description': 'Description',
      'Subtotal': 'Subtotal',
      'Discount': 'Discount',
      'Debit': 'Debit',
      'Net': 'Net',
      'VAT': 'VAT',
      'Credit': 'Credit',
      'Balance': 'Balance',
      'Status': 'Status',
    });

    processedRows.forEach((row) => {
      data.push({
        'Date': row.date,
        'Ref.': row.ref,
        'Description': row.description,
        'Subtotal': row.subtotal.toFixed(2),
        'Discount': row.discount > 0 ? `-${row.discount.toFixed(2)}` : '0.00',
        'Debit': row.debit.toFixed(2),
        'Net': row.net.toFixed(2),
        'VAT': row.vat.toFixed(2),
        'Credit': row.credit.toFixed(2),
        'Balance': row.balance.toFixed(2),
        'Status': row.status,
      });
    });

    data.push({ 'Date': '', 'Ref.': '', 'Description': '', 'Subtotal': '', 'Discount': '', 'Debit': '', 'Net': '', 'VAT': '', 'Credit': '', 'Balance': '', 'Status': '' });
    data.push({
      'Date': 'TOTAL',
      'Ref.': '',
      'Description': '',
      'Subtotal': totals.subtotal.toFixed(2),
      'Discount': totals.discount.toFixed(2),
      'Debit': totals.debit.toFixed(2),
      'Net': totals.net.toFixed(2),
      'VAT': totals.vat.toFixed(2),
      'Credit': totals.credit.toFixed(2),
      'Balance': totals.balance.toFixed(2),
      'Status': '',
    });

    if (quarantinedExportRows > 0) {
      data.push({ 'Date': '', 'Ref.': '', 'Description': '', 'Subtotal': '', 'Discount': '', 'Debit': '', 'Net': '', 'VAT': '', 'Credit': '', 'Balance': '', 'Status': '' });
      data.push({ 'Date': `Quarantined invalid rows: ${quarantinedExportRows}`, 'Ref.': '', 'Description': '', 'Subtotal': '', 'Discount': '', 'Debit': '', 'Net': '', 'VAT': '', 'Credit': '', 'Balance': '', 'Status': '' });
    }

    exportToCSV(data, 'sales_history.csv');
  };

  const exportSalesToPDF = async () => {
    const filteredSales = sales.filter(sale => {
      const saleDate = new Date(sale.date).toISOString().split('T')[0];
      const matchesStart = !filterStartDate || saleDate >= filterStartDate;
      const matchesEnd = !filterEndDate || saleDate <= filterEndDate;
      const matchesCustomer = !filterCustomer || sale.customer === filterCustomer;
      const matchesProduct = !filterProduct || (sale.items && sale.items.some((item: StatementLineItem) => item.productId === filterProduct));
      return matchesStart && matchesEnd && matchesCustomer && matchesProduct;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let quarantinedExportRows = 0;

    const processedRows = filteredSales.map((sale) => {
      let subtotal: number;
      let discount: number;
      let debit: number;
      let vat: number;
      let net: number;
      let credit: number;
      let balance: number;

      if (filterProduct && sale.items) {
        const orderSubtotal = toFiniteNumber(sale.subtotal ?? sale.total, Number.NaN);
        const orderDiscount = toFiniteNumber(sale.discountAmount ?? 0, Number.NaN);
        const orderTotal = toFiniteNumber(sale.total, Number.NaN);
        const orderVat = toFiniteNumber(sale.taxAmount ?? 0, Number.NaN);
        const orderPaid = toFiniteNumber(sale.amountPaid, Number.NaN);

        if (!Number.isFinite(orderSubtotal) || !Number.isFinite(orderDiscount) || !Number.isFinite(orderTotal) || !Number.isFinite(orderVat) || !Number.isFinite(orderPaid)) {
          quarantinedExportRows += 1;
          return null;
        }

        subtotal = 0;
        sale.items.forEach((item: StatementLineItem) => {
          if (item.productId === filterProduct) {
            const quantity = Math.max(0, toFiniteNumber(item.quantity, 0));
            const price = Math.max(0, toFiniteNumber(item.price, 0));
            subtotal += quantity * price;
          }
        });

        discount = orderSubtotal > 0 ? (subtotal / orderSubtotal) * orderDiscount : 0;
        debit = subtotal - discount;
        vat = (orderTotal > 0 && orderVat > 0) ? (debit / (orderTotal - orderVat)) * orderVat : 0;
        net = debit - vat;
        credit = orderTotal > 0 ? (debit / orderTotal) * orderPaid : 0;
        balance = debit - credit;
      } else {
        subtotal = toFiniteNumber(sale.subtotal ?? sale.total, Number.NaN);
        discount = toFiniteNumber(sale.discountAmount ?? 0, Number.NaN);
        debit = toFiniteNumber(sale.total, Number.NaN);
        vat = toFiniteNumber(sale.taxAmount ?? 0, Number.NaN);
        credit = toFiniteNumber(sale.amountPaid, Number.NaN);
        net = debit - vat;
        balance = debit - credit;

        if (!Number.isFinite(subtotal) || !Number.isFinite(discount) || !Number.isFinite(debit) || !Number.isFinite(vat) || !Number.isFinite(credit)) {
          quarantinedExportRows += 1;
          return null;
        }
      }

      return {
        date: toDateLabel(sale.date),
        ref: sale.invoiceNumber || '-',
        description: toNonEmptyString(sale.customer, 'Walk-in Customer'),
        subtotal,
        discount,
        debit,
        net,
        vat,
        credit,
        balance,
        status: sale.paymentStatus || 'unpaid',
      };
    }).filter(Boolean) as Array<{
      date: string;
      ref: string;
      description: string;
      subtotal: number;
      discount: number;
      debit: number;
      net: number;
      vat: number;
      credit: number;
      balance: number;
      status: string;
    }>;

    const totals = processedRows.reduce((acc, row) => {
      acc.subtotal += row.subtotal;
      acc.discount += row.discount;
      acc.debit += row.debit;
      acc.net += row.net;
      acc.vat += row.vat;
      acc.credit += row.credit;
      acc.balance += row.balance;
      return acc;
    }, { subtotal: 0, discount: 0, debit: 0, net: 0, vat: 0, credit: 0, balance: 0 });

    const doc = new jsPDF('l', 'mm', 'a4');
    await initArabicPDF(doc);
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 14;

    doc.setFontSize(15);
    doc.setFont(undefined, 'bold');
    doc.text('SALES HISTORY REPORT', pageWidth / 2, y, { align: 'center' });
    y += 6;

    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    if (filterStartDate || filterEndDate) {
      const startDisplay = filterStartDate ? new Date(filterStartDate).toLocaleDateString('en-GB') : 'Beginning';
      const endDisplay = filterEndDate ? new Date(filterEndDate).toLocaleDateString('en-GB') : 'Present';
      doc.text(`Period from ${startDisplay} to ${endDisplay}`, pageWidth / 2, y, { align: 'center' });
      y += 4;
    }
    if (filterCustomer) {
      writeText(doc, `Customer: ${filterCustomer}`, pageWidth / 2, y, { align: 'center' });
      y += 4;
    }
    if (filterProduct) {
      const productName = products.find((p) => p.id === filterProduct)?.name || filterProduct;
      writeText(doc, `Product: ${productName}`, pageWidth / 2, y, { align: 'center' });
      y += 4;
    }
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`, pageWidth / 2, y, { align: 'center' });
    y += 8;

    const col = {
      date: 8,
      ref: 26,
      desc: 43,
      subtotal: 120,
      discount: 138,
      debit: 156,
      net: 174,
      vat: 190,
      credit: 209,
      balance: 228,
      status: 250,
    };

    const drawHeader = () => {
      doc.setFontSize(7.5);
      doc.setFont(undefined, 'bold');
      doc.text('Date', col.date, y);
      doc.text('Ref.', col.ref, y);
      doc.text('Description', col.desc, y);
      doc.text('Subtotal', col.subtotal, y, { align: 'right' });
      doc.text('Discount', col.discount, y, { align: 'right' });
      doc.text('Debit', col.debit, y, { align: 'right' });
      doc.text('Net', col.net, y, { align: 'right' });
      doc.text('VAT', col.vat, y, { align: 'right' });
      doc.text('Credit', col.credit, y, { align: 'right' });
      doc.text('Balance', col.balance, y, { align: 'right' });
      doc.text('Status', col.status, y, { align: 'right' });
      y += 2;
      doc.line(8, y, 288, y);
      y += 4;
      doc.setFont(undefined, 'normal');
      doc.setFontSize(7);
    };

    drawHeader();

    processedRows.forEach((row) => {
      if (y > 195) {
        doc.addPage();
        y = 14;
        drawHeader();
      }

      doc.text(row.date, col.date, y);
      writeText(doc, row.ref.substring(0, 12), col.ref, y);
      writeText(doc, row.description.substring(0, 32), col.desc, y);
      doc.text(row.subtotal.toFixed(2), col.subtotal, y, { align: 'right' });
      doc.text(row.discount > 0 ? `-${row.discount.toFixed(2)}` : '0.00', col.discount, y, { align: 'right' });
      doc.text(row.debit.toFixed(2), col.debit, y, { align: 'right' });
      doc.text(row.net.toFixed(2), col.net, y, { align: 'right' });
      doc.text(row.vat.toFixed(2), col.vat, y, { align: 'right' });
      doc.text(row.credit.toFixed(2), col.credit, y, { align: 'right' });
      doc.text(row.balance.toFixed(2), col.balance, y, { align: 'right' });
      doc.text(row.status.substring(0, 10), col.status, y, { align: 'right' });
      y += 4.5;
    });

    if (y > 195) {
      doc.addPage();
      y = 14;
      drawHeader();
    }

    y += 1;
    doc.line(8, y, 288, y);
    y += 4;
    doc.setFont(undefined, 'bold');
    doc.setFontSize(8);
    doc.text('TOTAL', col.date, y);
    doc.text(totals.subtotal.toFixed(2), col.subtotal, y, { align: 'right' });
    doc.text(totals.discount.toFixed(2), col.discount, y, { align: 'right' });
    doc.text(totals.debit.toFixed(2), col.debit, y, { align: 'right' });
    doc.text(totals.net.toFixed(2), col.net, y, { align: 'right' });
    doc.text(totals.vat.toFixed(2), col.vat, y, { align: 'right' });
    doc.text(totals.credit.toFixed(2), col.credit, y, { align: 'right' });
    doc.text(totals.balance.toFixed(2), col.balance, y, { align: 'right' });

    if (quarantinedExportRows > 0) {
      y += 6;
      doc.setFont(undefined, 'normal');
      doc.setFontSize(7.5);
      doc.text(`Quarantined invalid rows: ${quarantinedExportRows}`, col.date, y);
    }

    doc.save('sales_history.pdf');
  };

  const exportSuppliersToPDF = async () => {
    const doc = new jsPDF();
    let quarantinedExportRows = 0;

    const validSuppliers = suppliers.map((supplier) => {
      const totalPurchases = toFiniteNumber(supplier.totalPurchases, Number.NaN);
      const totalPayments = toFiniteNumber(supplier.totalPayments, Number.NaN);
      const balance = toFiniteNumber(supplier.balance, Number.NaN);
      if (!Number.isFinite(totalPurchases) || !Number.isFinite(totalPayments) || !Number.isFinite(balance)) {
        quarantinedExportRows += 1;
        return null;
      }
      return {
        name: toNonEmptyString(supplier.name, 'Unknown Supplier'),
        totalPurchases,
        totalPayments,
        balance,
      };
    }).filter(Boolean) as Array<{ name: string; totalPurchases: number; totalPayments: number; balance: number }>;
    await initArabicPDF(doc);
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('SUPPLIER BALANCES STATEMENT', 105, 15, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    if (filterStartDate || filterEndDate) {
      const startDisplay = filterStartDate ? new Date(filterStartDate).toLocaleDateString('en-GB') : 'Beginning';
      const endDisplay = filterEndDate ? new Date(filterEndDate).toLocaleDateString('en-GB') : 'Present';
      doc.text(`Period from ${startDisplay} to ${endDisplay}`, 105, 22, { align: 'center' });
    }
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`, 105, 27, { align: 'center' });
    
    let y = 45;
    doc.setFontSize(12);
    doc.text('Supplier Name', 20, y);
    doc.text('Purchases', 90, y);
    doc.text('Payments', 130, y);
    doc.text('Balance', 170, y);
    y += 5;
    doc.line(20, y, 190, y);
    y += 7;
    
    doc.setFontSize(10);
    validSuppliers.forEach(supplier => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      writeText(doc, supplier.name.substring(0, 30), 20, y);
      doc.text(`$${supplier.totalPurchases.toFixed(2)}`, 90, y);
      doc.text(`$${supplier.totalPayments.toFixed(2)}`, 130, y);
      doc.text(`$${supplier.balance.toFixed(2)}`, 170, y);
      y += 7;
    });
    
    // Add total row
    y += 3;
    doc.line(20, y, 190, y);
    y += 7;
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('TOTAL', 20, y);
    const totalPurchases = validSuppliers.reduce((sum, s) => sum + s.totalPurchases, 0);
    const totalPayments = validSuppliers.reduce((sum, s) => sum + s.totalPayments, 0);
    const totalBalance = validSuppliers.reduce((sum, s) => sum + s.balance, 0);
    doc.text(`$${totalPurchases.toFixed(2)}`, 90, y);
    doc.text(`$${totalPayments.toFixed(2)}`, 130, y);
    doc.text(`$${totalBalance.toFixed(2)}`, 170, y);

    if (quarantinedExportRows > 0) {
      y += 7;
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.text(`Quarantined invalid rows: ${quarantinedExportRows}`, 20, y);
    }
    
    doc.save('suppliers_statement.pdf');
  };

  const exportProductsToPDF = async () => {
    const { summaries: filteredProducts } = getFilteredProductSummaries();
    const doc = new jsPDF();
    await initArabicPDF(doc);
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('PRODUCTS SUMMARY REPORT', 105, 15, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    if (filterStartDate || filterEndDate) {
      const startDisplay = filterStartDate ? new Date(filterStartDate).toLocaleDateString('en-GB') : 'Beginning';
      const endDisplay = filterEndDate ? new Date(filterEndDate).toLocaleDateString('en-GB') : 'Present';
      doc.text(`Period from ${startDisplay} to ${endDisplay}`, 105, 22, { align: 'center' });
    }
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`, 105, 27, { align: 'center' });
    
    // Group products by category
    const groupedProducts = filteredProducts.reduce((acc, p) => {
      const category = p.category || 'Uncategorized';
      if (!acc[category]) acc[category] = [];
      acc[category].push(p);
      return acc;
    }, {} as Record<string, typeof filteredProducts>);
    
    const sortedCategories = Object.keys(groupedProducts).sort();
    
    let y = 35;
    let grandTotalSold = 0;
    let grandTotalRevenue = 0;
    
    sortedCategories.forEach((category, idx) => {
      if (idx > 0 && y > 250) {
        doc.addPage();
        y = 20;
      }
      
      // Category header
      if (y > 35) y += 5;
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      writeText(doc, `GROUP: ${category.toUpperCase()}`, 20, y);
      y += 5;
      
      // Column headers
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.text('Product Name', 20, y);
      doc.text('Category', 90, y);
      doc.text('Qty Sold', 130, y, { align: 'right' });
      doc.text('Total Sales', 170, y, { align: 'right' });
      y += 2;
      doc.line(20, y, 170, y);
      y += 5;
      
      let categoryTotalSold = 0;
      let categoryTotalRevenue = 0;
      
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      groupedProducts[category].forEach(product => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        writeText(doc, product.name.substring(0, 30), 20, y);
        writeText(doc, product.category.substring(0, 15), 90, y);
        doc.text(product.totalSold.toString(), 130, y, { align: 'right' });
        doc.text(`$${product.totalRevenue.toFixed(2)}`, 170, y, { align: 'right' });
        y += 6;
        
        categoryTotalSold += product.totalSold;
        categoryTotalRevenue += product.totalRevenue;
      });
      
      // Category subtotal
      y += 2;
      doc.line(20, y, 170, y);
      y += 5;
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      writeText(doc, `SUBTOTAL - ${category}`, 20, y);
      doc.text(categoryTotalSold.toString(), 130, y, { align: 'right' });
      doc.text(`$${categoryTotalRevenue.toFixed(2)}`, 170, y, { align: 'right' });
      y += 8;
      
      grandTotalSold += categoryTotalSold;
      grandTotalRevenue += categoryTotalRevenue;
    });
    
    // Grand total
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    y += 3;
    doc.line(20, y, 170, y);
    doc.line(20, y + 1, 170, y + 1);
    y += 6;
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('GRAND TOTAL', 20, y);
    doc.text(grandTotalSold.toString(), 130, y, { align: 'right' });
    doc.text(`$${grandTotalRevenue.toFixed(2)}`, 170, y, { align: 'right' });
    
    doc.save('products_summary.pdf');
  };

  const exportPurchasesToPDF = async () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    await initArabicPDF(doc);
    const rows = buildPurchaseStatementRows(purchases);

    const totalDebit = rows.reduce((sum, row) => sum + row.debit, 0);
    const totalNet = rows.reduce((sum, row) => sum + row.net, 0);
    const totalVat = rows.reduce((sum, row) => sum + row.vat, 0);
    const totalCredit = rows.reduce((sum, row) => sum + row.credit, 0);
    const closingBalance = rows.length > 0 ? rows[rows.length - 1].balance : 0;

    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('PURCHASE HISTORY REPORT', 148, 14, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    if (filterStartDate || filterEndDate) {
      const startDisplay = filterStartDate ? new Date(filterStartDate).toLocaleDateString('en-GB') : 'Beginning';
      const endDisplay = filterEndDate ? new Date(filterEndDate).toLocaleDateString('en-GB') : 'Present';
      doc.text(`Period from ${startDisplay} to ${endDisplay}`, 148, 20, { align: 'center' });
    }
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`, 148, 25, { align: 'center' });

    autoTable(doc, {
      startY: 30,
      head: [['Date', 'Ref.', 'Description', 'Debit', 'Net', 'VAT', 'Credit', 'Balance', 'Status']],
      body: rows.map((row) => [
        row.dateLabel,
        row.ref,
        row.description,
        row.debit.toFixed(2),
        row.net.toFixed(2),
        row.vat.toFixed(2),
        row.credit.toFixed(2),
        row.balance.toFixed(2),
        row.status,
      ]),
      foot: [[
        'TOTAL',
        '',
        '',
        totalDebit.toFixed(2),
        totalNet.toFixed(2),
        totalVat.toFixed(2),
        totalCredit.toFixed(2),
        closingBalance.toFixed(2),
        '',
      ]],
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [229, 231, 235], textColor: 0, fontStyle: 'bold' },
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' },
      },
      didDrawPage: (data) => {
        const pageNumber = doc.getNumberOfPages();
        const pageSize = doc.internal.pageSize;
        doc.setFontSize(8);
        doc.text(`Page ${pageNumber}`, pageSize.getWidth() - 20, pageSize.getHeight() - 8, { align: 'right' });
      },
    });

    doc.save('purchases_history.pdf');
  };

  const exportExpensesToPDF = async () => {
    const doc = new jsPDF();
    await initArabicPDF(doc);
    let quarantinedExportRows = 0;

    const validExpenses = expenses.map((expense) => {
      const amount = toFiniteNumber(expense.amount, Number.NaN);
      if (!Number.isFinite(amount) || amount < 0) {
        quarantinedExportRows += 1;
        return null;
      }
      return {
        date: toDateLabel(expense.date),
        category: toNonEmptyString(expense.category, 'Uncategorized'),
        description: toNonEmptyString(expense.description, 'N/A'),
        amount,
      };
    }).filter(Boolean) as Array<{ date: string; category: string; description: string; amount: number }>;
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('EXPENSE HISTORY REPORT', 105, 15, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    if (filterStartDate || filterEndDate) {
      const startDisplay = filterStartDate ? new Date(filterStartDate).toLocaleDateString('en-GB') : 'Beginning';
      const endDisplay = filterEndDate ? new Date(filterEndDate).toLocaleDateString('en-GB') : 'Present';
      doc.text(`Period from ${startDisplay} to ${endDisplay}`, 105, 22, { align: 'center' });
    }
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`, 105, 27, { align: 'center' });
    
    // Group expenses by category
    const groupedExpenses = validExpenses.reduce((acc, e) => {
      const category = e.category || 'Uncategorized';
      if (!acc[category]) acc[category] = [];
      acc[category].push(e);
      return acc;
    }, {} as Record<string, typeof validExpenses>);
    
    const sortedCategories = Object.keys(groupedExpenses).sort();
    
    let y = 35;
    let grandTotal = 0;
    
    sortedCategories.forEach((category, idx) => {
      if (idx > 0 && y > 250) {
        doc.addPage();
        y = 20;
      }
      
      // Category header
      if (y > 35) y += 5;
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      writeText(doc, `CATEGORY: ${category.toUpperCase()}`, 20, y);
      y += 5;
      
      // Column headers
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.text('Date', 20, y);
      doc.text('Category', 50, y);
      doc.text('Description', 90, y);
      doc.text('Amount', 170, y, { align: 'right' });
      y += 2;
      doc.line(20, y, 170, y);
      y += 5;
      
      let categoryTotal = 0;
      
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      groupedExpenses[category].forEach(expense => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(expense.date, 20, y);
        writeText(doc, expense.category.substring(0, 12), 50, y);
        writeText(doc, expense.description.substring(0, 28), 90, y);
        doc.text(`$${expense.amount.toFixed(2)}`, 170, y, { align: 'right' });
        y += 5;
        
        categoryTotal += expense.amount;
      });
      
      // Category subtotal
      y += 1;
      doc.line(20, y, 170, y);
      y += 4;
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      writeText(doc, `SUBTOTAL - ${category}`, 90, y);
      doc.text(`$${categoryTotal.toFixed(2)}`, 170, y, { align: 'right' });
      y += 7;
      
      grandTotal += categoryTotal;
    });
    
    // Grand total
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    y += 2;
    doc.line(20, y, 170, y);
    doc.line(20, y + 1, 170, y + 1);
    y += 5;
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('GRAND TOTAL', 90, y);
    doc.text(`$${grandTotal.toFixed(2)}`, 170, y, { align: 'right' });

    if (quarantinedExportRows > 0) {
      y += 7;
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      doc.text(`Quarantined invalid rows: ${quarantinedExportRows}`, 20, y);
    }
    
    doc.save('expenses_statement.pdf');
  };

  const exportCashCollectionsToExcel = () => {
    const data: CsvRow[] = [
      {
        'Collection Date': 'Collection Date',
        'Bank Account': 'Bank Account',
        'Deposit Ref.': 'Deposit Ref.',
        'Orders': 'Orders',
        'Amount': 'Amount',
        'Notes': 'Notes',
      },
      ...filteredCashCollections.map((entry) => ({
        'Collection Date': toDateLabel(entry.collectionDate),
        'Bank Account': toNonEmptyString(entry.bankAccount, '-'),
        'Deposit Ref.': toNonEmptyString(entry.depositReference, '-'),
        'Orders': Math.floor(toFiniteNumber(entry.ordersCount, 0)),
        'Amount': toFiniteNumber(entry.totalAmount, 0).toFixed(2),
        'Notes': toNonEmptyString(entry.notes, '-'),
      })),
      {
        'Collection Date': 'TOTAL',
        'Bank Account': '',
        'Deposit Ref.': '',
        'Orders': filteredCashCollections.reduce((sum, e) => sum + toFiniteNumber(e.ordersCount, 0), 0),
        'Amount': filteredCashCollections.reduce((sum, e) => sum + toFiniteNumber(e.totalAmount, 0), 0).toFixed(2),
        'Notes': '',
      },
    ];

    exportToCSV(data, 'cash_collections_statement.csv');
  };

  const exportCashCollectionsToPDF = async () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    await initArabicPDF(doc);

    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('CASH COLLECTION HISTORY', 148, 12, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`, 148, 18, { align: 'center' });

    autoTable(doc, {
      startY: 24,
      head: [['Collection Date', 'Bank Account', 'Deposit Ref.', 'Orders', 'Amount', 'Notes']],
      body: filteredCashCollections.map((entry) => [
        toDateLabel(entry.collectionDate),
        toNonEmptyString(entry.bankAccount, '-'),
        toNonEmptyString(entry.depositReference, '-'),
        Math.floor(toFiniteNumber(entry.ordersCount, 0)).toString(),
        toFiniteNumber(entry.totalAmount, 0).toFixed(2),
        toNonEmptyString(entry.notes, '-'),
      ]),
      foot: [[
        'TOTAL',
        '',
        '',
        filteredCashCollections.reduce((sum, e) => sum + toFiniteNumber(e.ordersCount, 0), 0).toString(),
        filteredCashCollections.reduce((sum, e) => sum + toFiniteNumber(e.totalAmount, 0), 0).toFixed(2),
        '',
      ]],
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
      footStyles: { fillColor: [243, 244, 246], textColor: [17, 24, 39], fontStyle: 'bold' },
    });

    doc.save('cash_collections_statement.pdf');
  };

  const exportPaymentsToExcel = () => {
    const data: CsvRow[] = [
      {
        'Date': 'Date',
        'Account': 'Account',
        'Type': 'Type',
        'Direction': 'Direction',
        'Method': 'Method',
        'Amount': 'Amount',
        'Notes': 'Notes',
      },
      ...filteredPayments.map((payment) => ({
        'Date': toDateLabel(payment.date),
        'Account': toNonEmptyString(payment.accountName, '-'),
        'Type': payment.accountType,
        'Direction': payment.direction === 'in' ? 'Received' : 'Paid Out',
        'Method': toNonEmptyString(payment.method, '-'),
        'Amount': toFiniteNumber(payment.amount, 0).toFixed(2),
        'Notes': toNonEmptyString(payment.notes, '-'),
      })),
      {
        'Date': 'TOTAL',
        'Account': '',
        'Type': '',
        'Direction': '',
        'Method': '',
        'Amount': filteredPayments.reduce((sum, p) => sum + toFiniteNumber(p.amount, 0), 0).toFixed(2),
        'Notes': '',
      },
    ];

    exportToCSV(data, 'account_payments_statement.csv');
  };

  const exportPaymentsToPDF = async () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    await initArabicPDF(doc);

    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('ACCOUNT PAYMENTS', 148, 12, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`, 148, 18, { align: 'center' });

    autoTable(doc, {
      startY: 24,
      head: [['Date', 'Account', 'Type', 'Direction', 'Method', 'Amount', 'Notes']],
      body: filteredPayments.map((payment) => [
        toDateLabel(payment.date),
        toNonEmptyString(payment.accountName, '-'),
        payment.accountType,
        payment.direction === 'in' ? 'Received' : 'Paid Out',
        toNonEmptyString(payment.method, '-'),
        toFiniteNumber(payment.amount, 0).toFixed(2),
        toNonEmptyString(payment.notes, '-'),
      ]),
      foot: [[
        'TOTAL',
        '',
        '',
        '',
        '',
        filteredPayments.reduce((sum, p) => sum + toFiniteNumber(p.amount, 0), 0).toFixed(2),
        '',
      ]],
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
      footStyles: { fillColor: [243, 244, 246], textColor: [17, 24, 39], fontStyle: 'bold' },
    });

    doc.save('account_payments_statement.pdf');
  };

  const exportAllToExcel = () => {
    let quarantinedExportRows = 0;

    const validCashCollections = cashCollections.map((entry) => {
      const amount = toFiniteNumber(entry.totalAmount, Number.NaN);
      const ordersCount = toFiniteNumber(entry.ordersCount, Number.NaN);

      if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(ordersCount) || ordersCount < 0) {
        quarantinedExportRows += 1;
        return null;
      }

      return {
        date: toDateLabel(entry.collectionDate),
        bankAccount: toNonEmptyString(entry.bankAccount, 'N/A'),
        reference: toNonEmptyString(entry.depositReference, 'N/A'),
        ordersCount: Math.floor(ordersCount),
        amount,
      };
    }).filter(Boolean) as Array<{ date: string; bankAccount: string; reference: string; ordersCount: number; amount: number }>;

    const data: CsvRow[] = [
      { Section: 'Summary', Item: 'Total Expenses', Value: `$${totalExpenses.toFixed(2)}` },
      { Section: 'Summary', Item: 'Total Purchases', Value: `$${totalPurchases.toFixed(2)}` },
      { Section: 'Summary', Item: 'Customer Balances', Value: `$${customerBalances.toFixed(2)}` },
      { Section: 'Summary', Item: 'Supplier Balances', Value: `$${suppliers.reduce((sum, s) => sum + s.balance, 0).toFixed(2)}` },
      { Section: 'Summary', Item: 'Cash Deposited', Value: `$${totalCashDeposited.toFixed(2)}` },
      { Section: 'Summary', Item: 'Net Balance', Value: `$${netBalance.toFixed(2)}` },
      { Section: '', Item: '', Value: '' },
      { Section: 'Customers', Item: 'Name', Value: 'Balance' },
      ...customers.map(c => ({ Section: 'Customers', Item: c.name, Value: `$${c.balance.toFixed(2)}` })),
      { Section: '', Item: '', Value: '' },
      { Section: 'Suppliers', Item: 'Name', Value: 'Balance Due' },
      ...suppliers.map(s => ({ Section: 'Suppliers', Item: s.name, Value: `$${s.balance.toFixed(2)}` })),
      { Section: '', Item: '', Value: '' },
      { Section: 'Products', Item: 'Name', Value: 'Revenue' },
      ...products.map(p => ({ Section: 'Products', Item: p.name, Value: `$${p.totalRevenue.toFixed(2)}` })),
      { Section: '', Item: '', Value: '' },
      { Section: 'Purchases', Item: 'Supplier', Value: 'Amount' },
      ...purchases.map(p => ({ Section: 'Purchases', Item: p.supplier, Value: `$${p.amount.toFixed(2)}` })),
      { Section: '', Item: '', Value: '' },
      { Section: 'Expenses', Item: 'Category', Value: 'Amount' },
      ...expenses.map(e => ({ Section: 'Expenses', Item: e.category, Value: `$${e.amount.toFixed(2)}` })),
      { Section: '', Item: '', Value: '' },
      { Section: 'Cash Collections', Item: 'Bank / Ref', Value: 'Amount' },
      ...validCashCollections.map(c => ({
        Section: 'Cash Collections',
        Item: `${c.date} • ${c.bankAccount} • ${c.reference} (${c.ordersCount} orders)`,
        Value: `$${c.amount.toFixed(2)}`,
      })),
    ];

    if (quarantinedExportRows > 0) {
      data.push({ Section: 'Notes', Item: `Quarantined invalid rows: ${quarantinedExportRows}`, Value: '' });
    }

    exportToCSV(data, 'complete_account_statement.csv');
  };

  const exportAllToPDF = () => {
    let quarantinedExportRows = 0;

    const validCashCollections = cashCollections.map((entry) => {
      const amount = toFiniteNumber(entry.totalAmount, Number.NaN);
      const ordersCount = toFiniteNumber(entry.ordersCount, Number.NaN);

      if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(ordersCount) || ordersCount < 0) {
        quarantinedExportRows += 1;
        return null;
      }

      return {
        date: toDateLabel(entry.collectionDate),
        bankAccount: toNonEmptyString(entry.bankAccount, 'N/A'),
        reference: toNonEmptyString(entry.depositReference, 'N/A'),
        ordersCount: Math.floor(ordersCount),
        amount,
      };
    }).filter(Boolean) as Array<{ date: string; bankAccount: string; reference: string; ordersCount: number; amount: number }>;

    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('Account Statement', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 105, 30, { align: 'center' });
    
    doc.setFontSize(16);
    doc.text('Financial Summary', 20, 45);
    
    doc.setFontSize(11);
    let y = 55;
    doc.text(`Total Expenses: $${totalExpenses.toFixed(2)}`, 20, y);
    y += 8;
    doc.text(`Total Purchases: $${totalPurchases.toFixed(2)}`, 20, y);
    y += 8;
    doc.text(`Customer Balances: $${customerBalances.toFixed(2)}`, 20, y);
    y += 8;
    doc.text(`Supplier Balances: $${suppliers.reduce((sum, s) => sum + s.balance, 0).toFixed(2)}`, 20, y);
    y += 8;
    doc.text(`Cash Deposited: $${totalCashDeposited.toFixed(2)}`, 20, y);
    y += 8;
    doc.text(`Net Balance: $${netBalance.toFixed(2)}`, 20, y);
    
    y += 15;
    doc.setFontSize(14);
    doc.text('Top Customers', 20, y);
    y += 8;
    doc.setFontSize(10);
    customers.slice(0, 5).forEach(customer => {
      const cleanName = cleanTextForPDF(customer.name);
      doc.text(`${cleanName}: $${customer.balance.toFixed(2)}`, 25, y);
      y += 6;
    });
    
    y += 10;
    doc.setFontSize(14);
    doc.text('Top Suppliers', 20, y);
    y += 8;
    doc.setFontSize(10);
    suppliers.slice(0, 5).forEach(supplier => {
      const cleanName = cleanTextForPDF(supplier.name);
      doc.text(`${cleanName}: $${supplier.balance.toFixed(2)}`, 25, y);
      y += 6;
    });
    
    if (y > 230) {
      doc.addPage();
      y = 20;
    }
    y += 10;
    doc.setFontSize(14);
    doc.text('Top Products', 20, y);
    y += 8;
    doc.setFontSize(10);
    products.slice(0, 5).forEach(product => {
      const cleanName = cleanTextForPDF(product.name);
      doc.text(`${cleanName}: $${product.totalRevenue.toFixed(2)}`, 25, y);
      y += 6;
    });

    y += 8;
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(14);
    doc.text('Recent Cash Collections', 20, y);
    y += 8;
    doc.setFontSize(10);
    validCashCollections.slice(0, 5).forEach(entry => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      const line = `${entry.date} • ${cleanTextForPDF(entry.bankAccount)} • ${cleanTextForPDF(entry.reference)} (${entry.ordersCount} orders): $${entry.amount.toFixed(2)}`;
      doc.text(line, 25, y);
      y += 6;
    });

    if (quarantinedExportRows > 0) {
      y += 4;
      doc.setFontSize(9);
      doc.text(`Quarantined invalid rows: ${quarantinedExportRows}`, 20, y);
    }
    
    doc.save('account_statement.pdf');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="container mx-auto p-4">
          <div className="flex justify-center items-center h-64">
            <div className="text-lg">Loading account statement...</div>
          </div>
        </div>
      </div>
    );
  }

  const accountStatementTabs: Array<{
    id: typeof activeTab;
    label: string;
    count: number;
  }> = [
    { id: 'customers', label: 'Customers', count: customers.length },
    { id: 'suppliers', label: 'Suppliers', count: suppliers.length },
    { id: 'products', label: 'Products', count: products.length },
    { id: 'purchases', label: 'Purchases', count: purchases.length },
    { id: 'expenses', label: 'Expenses', count: expenses.length },
    { id: 'sales', label: 'Sales', count: sales.length },
    { id: 'cashCollections', label: 'Cash Collections', count: cashCollections.length },
    { id: 'payments', label: 'Payments', count: accountPayments.length },
  ];

  const { summaries: filteredProductSummaries, quarantinedSales: quarantinedProductSalesCount } = getFilteredProductSummaries();
  const productSummaryTotals = filteredProductSummaries.reduce((acc, product) => {
    const discount = product.totalDiscount || 0;
    const subtotal = product.totalRevenue + discount;

    acc.quantity += product.totalSold;
    acc.subtotal += subtotal;
    acc.discount += discount;
    acc.revenue += product.totalRevenue;
    return acc;
  }, { quantity: 0, subtotal: 0, discount: 0, revenue: 0 });

  const BALANCE_EPSILON = 0.005;

  const isZeroBalance = (value: number) => Math.abs(value) < BALANCE_EPSILON;

  const inRangeSales = sales.filter((sale) => isDateInRange(sale.date, filterStartDate, filterEndDate));
  const inRangeCustomerSalesMap = inRangeSales.reduce((map, sale) => {
    const current = map.get(sale.customer) || [];
    current.push(sale);
    map.set(sale.customer, current);
    return map;
  }, new Map<string, SalesRecord[]>());

  const inRangeCustomerPaymentsMap = accountPayments
    .filter((payment) => payment.direction === 'in' && isDateInRange(payment.date, filterStartDate, filterEndDate))
    .reduce((map, payment) => {
      const current = map.get(payment.accountId) || [];
      current.push(payment);
      map.set(payment.accountId, current);
      return map;
    }, new Map<string, (typeof accountPayments)[number][]>());

  const getUnappliedPaymentAmount = (payment: (typeof accountPayments)[number]) => {
    const total = toFiniteNumber(payment.amount, 0);
    if (total <= 0) return 0;

    const alloc = payment.orderAllocation;
    if (alloc) {
      if (typeof alloc.remainingAmount === 'number') {
        return Math.max(0, alloc.remainingAmount);
      }
      const applied = toFiniteNumber(alloc.appliedAmount, 0);
      return Math.max(0, total - applied);
    }

    // No allocation metadata: payment was applied to orders (credit is already in amountPaid).
    return 0;
  };

  const toStatementDateLabel = (value: unknown): string => {
    const normalized = normalizeDateString(value as string | number | Date | { toDate?: () => Date } | null | undefined);
    if (!normalized) return 'N/A';
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) return 'N/A';
    return parsed.toLocaleDateString('en-GB');
  };

  const getSupplierMetrics = (supplier: SupplierBalance) => {
    // fetchSuppliers already includes PO payments + standalone accountPayments.
    // Do not add accountPayments again (was causing 2x standalone payments on the tab).
    return {
      totalPurchases: toFiniteNumber(supplier.totalPurchases, 0),
      totalPayments: toFiniteNumber(supplier.totalPayments, 0),
      balance: toFiniteNumber(supplier.balance, 0),
      invoicesCount: purchases.filter((p) => p.supplierId === supplier.id || p.supplier === supplier.name).length,
    };
  };

  const getCustomerMetrics = (customer: CustomerBalance) => {
    const invoices = inRangeCustomerSalesMap.get(customer.name) || [];
    const paymentsInRange = inRangeCustomerPaymentsMap.get(customer.id) || [];

    const invoicePaid = invoices.reduce((sum, invoice) => sum + toFiniteNumber(invoice.amountPaid, 0), 0);
    const allocatedFromPayments = paymentsInRange
      .filter((payment) => payment.direction === 'in')
      .reduce((sum, payment) => {
        const alloc = payment.orderAllocation;
        if (alloc && typeof alloc.appliedAmount === 'number') {
          return sum + toFiniteNumber(alloc.appliedAmount, 0);
        }
        return sum + toFiniteNumber(payment.amount, 0);
      }, 0);
    const unappliedPayments = paymentsInRange
      .filter((payment) => payment.direction === 'in')
      .map((payment) => ({
        ...payment,
        unappliedAmount: getUnappliedPaymentAmount(payment),
      }))
      .filter((payment) => payment.unappliedAmount > BALANCE_EPSILON);
    const unappliedCredit = unappliedPayments.reduce((sum, payment) => sum + payment.unappliedAmount, 0);

    const totalInvoiced = invoices.reduce((sum, invoice) => sum + toFiniteNumber(invoice.total, 0), 0);
    const totalPaid = Math.max(invoicePaid, allocatedFromPayments) + unappliedCredit;
    const balance = totalInvoiced - totalPaid;

    return {
      invoices,
      payments: unappliedPayments,
      invoicesCount: invoices.length,
      totalInvoiced,
      totalPaid,
      balance,
      hasActivity: invoices.length > 0 || unappliedPayments.length > 0,
    };
  };

  const filteredCustomers = customers.filter((customer) => {
    if (customerSearch && !customer.name.toLowerCase().includes(customerSearch.toLowerCase())) return false;
    const metrics = getCustomerMetrics(customer);
    const displayBalance = metrics.balance;

    if ((filterStartDate || filterEndDate) && !metrics.hasActivity) return false;
    if (customerBalanceFilter === 'active') return displayBalance > BALANCE_EPSILON;
    if (customerBalanceFilter === 'zero') return isZeroBalance(displayBalance);
    return true;
  });

  const filteredCustomerTotals = filteredCustomers.reduce((acc, customer) => {
    const metrics = getCustomerMetrics(customer);

    acc.invoiced += metrics.totalInvoiced;
    acc.paid += metrics.totalPaid;
    acc.balance += metrics.balance;
    return acc;
  }, { invoiced: 0, paid: 0, balance: 0 });

  const sortedFilteredCustomers = [...filteredCustomers].sort((a, b) => {
    const balanceDiff = getCustomerMetrics(b).balance - getCustomerMetrics(a).balance;
    if (Math.abs(balanceDiff) >= BALANCE_EPSILON) return balanceDiff;
    return a.name.localeCompare(b.name);
  });

  const buildCustomerExportRows = () => {
    let quarantinedExportRows = 0;
    const rows = sortedFilteredCustomers.map((customer) => {
      const metrics = getCustomerMetrics(customer);
      const totalPurchases = toFiniteNumber(metrics.totalInvoiced, Number.NaN);
      const totalPayments = toFiniteNumber(metrics.totalPaid, Number.NaN);
      const balance = toFiniteNumber(metrics.balance, Number.NaN);
      if (!Number.isFinite(totalPurchases) || !Number.isFinite(totalPayments) || !Number.isFinite(balance)) {
        quarantinedExportRows += 1;
        return null;
      }
      return {
        name: toNonEmptyString(customer.name, 'Unknown Customer'),
        totalPurchases,
        totalPayments,
        balance,
      };
    }).filter(Boolean) as Array<{ name: string; totalPurchases: number; totalPayments: number; balance: number }>;
    return { rows, quarantinedExportRows };
  };

  const getCustomerExportFilterNote = () => {
    const parts: string[] = [];
    if (customerBalanceFilter === 'active') parts.push('Active balance only');
    if (customerBalanceFilter === 'zero') parts.push('Zero balance only');
    if (filterStartDate || filterEndDate) {
      const startDisplay = filterStartDate ? new Date(filterStartDate).toLocaleDateString('en-GB') : 'Beginning';
      const endDisplay = filterEndDate ? new Date(filterEndDate).toLocaleDateString('en-GB') : 'Present';
      parts.push(`Period ${startDisplay} to ${endDisplay}`);
    }
    if (customerSearch.trim()) parts.push(`Search: ${customerSearch.trim()}`);
    return parts.join(' • ');
  };

  const exportCustomersToExcel = () => {
    const data: CsvRow[] = [];
    const { rows: validCustomers, quarantinedExportRows } = buildCustomerExportRows();
    const filterNote = getCustomerExportFilterNote();

    data.push({ 'Customer Name': 'CUSTOMER BALANCES STATEMENT', 'Total Invoiced': '', 'Total Paid': '', 'Balance': '' });
    if (filterNote) {
      data.push({ 'Customer Name': filterNote, 'Total Invoiced': '', 'Total Paid': '', 'Balance': '' });
    }
    data.push({ 'Customer Name': `Generated: ${new Date().toLocaleDateString('en-GB')}`, 'Total Invoiced': '', 'Total Paid': '', 'Balance': '' });
    data.push({ 'Customer Name': '', 'Total Invoiced': '', 'Total Paid': '', 'Balance': '' });
    data.push({ 'Customer Name': 'Customer Name', 'Total Invoiced': 'Total Invoiced', 'Total Paid': 'Total Paid', 'Balance': 'Balance' });

    validCustomers.forEach((c) => {
      data.push({
        'Customer Name': c.name,
        'Total Invoiced': c.totalPurchases.toFixed(2),
        'Total Paid': c.totalPayments.toFixed(2),
        'Balance': c.balance.toFixed(2),
      });
    });

    data.push({ 'Customer Name': '', 'Total Invoiced': '', 'Total Paid': '', 'Balance': '' });
    const totalInvoiced = validCustomers.reduce((sum, c) => sum + c.totalPurchases, 0);
    const totalPaid = validCustomers.reduce((sum, c) => sum + c.totalPayments, 0);
    const totalBalance = validCustomers.reduce((sum, c) => sum + c.balance, 0);
    if (quarantinedExportRows > 0) {
      data.push({ 'Customer Name': `Quarantined invalid rows: ${quarantinedExportRows}`, 'Total Invoiced': '', 'Total Paid': '', 'Balance': '' });
    }
    data.push({
      'Customer Name': 'TOTAL',
      'Total Invoiced': totalInvoiced.toFixed(2),
      'Total Paid': totalPaid.toFixed(2),
      'Balance': totalBalance.toFixed(2),
    });

    exportToCSV(data, 'customers_statement.csv');
  };

  const exportCustomersToPDF = async () => {
    const doc = new jsPDF();
    const { rows: validCustomers, quarantinedExportRows } = buildCustomerExportRows();
    const filterNote = getCustomerExportFilterNote();

    await initArabicPDF(doc);

    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('CUSTOMER BALANCES STATEMENT', 105, 15, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    let headerY = 22;
    if (filterNote) {
      doc.text(filterNote, 105, headerY, { align: 'center' });
      headerY += 5;
    }
    doc.text(
      `Generated: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`,
      105,
      headerY,
      { align: 'center' },
    );

    let y = headerY + 18;
    doc.setFontSize(12);
    doc.text('Customer Name', 20, y);
    doc.text('Invoiced', 90, y);
    doc.text('Paid', 130, y);
    doc.text('Balance', 170, y);
    y += 5;
    doc.line(20, y, 190, y);
    y += 7;

    doc.setFontSize(10);
    validCustomers.forEach((customer) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      writeText(doc, customer.name.substring(0, 30), 20, y);
      doc.text(`$${customer.totalPurchases.toFixed(2)}`, 90, y);
      doc.text(`$${customer.totalPayments.toFixed(2)}`, 130, y);
      doc.text(`$${customer.balance.toFixed(2)}`, 170, y);
      y += 7;
    });

    y += 3;
    doc.line(20, y, 190, y);
    y += 7;
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('TOTAL', 20, y);
    const totalInvoiced = validCustomers.reduce((sum, c) => sum + c.totalPurchases, 0);
    const totalPaid = validCustomers.reduce((sum, c) => sum + c.totalPayments, 0);
    const totalBalance = validCustomers.reduce((sum, c) => sum + c.balance, 0);
    doc.text(`$${totalInvoiced.toFixed(2)}`, 90, y);
    doc.text(`$${totalPaid.toFixed(2)}`, 130, y);
    doc.text(`$${totalBalance.toFixed(2)}`, 170, y);

    if (quarantinedExportRows > 0) {
      y += 7;
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.text(`Quarantined invalid rows: ${quarantinedExportRows}`, 20, y);
    }

    doc.save('customers_statement.pdf');
  };

  return (
    <AdminPageShell
      title="Account Statement"
      description="Detailed overview of financial transactions and balances"
      eyebrow="Business Tools"
      backTo="/admin/finance"
      backLabel="Finance Suite"
      actions={(
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportAllToExcel}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm"
          >
            <Download size={18} />
            Export Excel
          </button>
          <button
            type="button"
            onClick={exportAllToPDF}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 text-sm"
          >
            <FileDown size={18} />
            Export PDF
          </button>
        </div>
      )}
    >

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-gray-600">Total Sales</div>
          <div className="text-2xl font-bold text-blue-600">${totalSales.toFixed(2)}</div>
          {quarantinedSalesCount > 0 && (
            <div className="text-xs text-orange-600 mt-1">
              Quarantined invalid sales: {quarantinedSalesCount}
            </div>
          )}
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-gray-600">Total Purchases</div>
          <div className="text-2xl font-bold text-orange-600">${totalPurchases.toFixed(2)}</div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-gray-600">Total Expenses</div>
          <div className="text-2xl font-bold text-red-600">${totalExpenses.toFixed(2)}</div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-gray-600">Customer Balances</div>
          <div className="text-2xl font-bold text-green-600">${customerBalances.toFixed(2)}</div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-gray-600">Net Balance</div>
          <div className={`text-2xl font-bold ${netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${netBalance.toFixed(2)}
          </div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-gray-600">Cash Deposited</div>
          <div className="text-2xl font-bold text-emerald-600">${totalCashDeposited.toFixed(2)}</div>
        </div>
      </div>

      <div className="bg-white rounded shadow">
        <div className="border-b px-4 py-3 sm:px-6">
          <label htmlFor="account-statement-section" className="block text-sm font-medium text-gray-600 mb-2">
            Section
          </label>
          <select
            id="account-statement-section"
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value as typeof activeTab)}
            className="w-full max-w-md border border-gray-300 rounded-md px-3 py-2 text-sm font-medium text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {accountStatementTabs.map((tab) => (
              <option key={tab.id} value={tab.id}>
                {tab.label} ({tab.count})
              </option>
            ))}
          </select>
        </div>

        <div className="p-6">
          {activeTab === 'customers' && (
            <div>
              <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
                <h2 className="text-xl font-semibold">Customer Balances</h2>
                <div className="flex gap-2 flex-wrap items-center">
                  <div className="flex gap-2 items-center">
                    <label className="text-sm text-gray-600">From:</label>
                    <input
                      type="date"
                      value={filterStartDate}
                      onChange={(e) => setFilterStartDate(e.target.value)}
                      className="border rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="flex gap-2 items-center">
                    <label className="text-sm text-gray-600">To:</label>
                    <input
                      type="date"
                      value={filterEndDate}
                      onChange={(e) => setFilterEndDate(e.target.value)}
                      className="border rounded px-2 py-1 text-sm"
                    />
                  </div>
                  {(filterStartDate || filterEndDate) && (
                    <button
                      onClick={() => { setFilterStartDate(''); setFilterEndDate(''); }}
                      className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
                    >
                      Clear Dates
                    </button>
                  )}
                  <button
                    onClick={exportCustomersToExcel}
                    className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 text-sm"
                  >
                    <Download size={16} />
                    {!isMobile && 'Export Excel'}
                  </button>
                  <button
                    onClick={exportCustomersToPDF}
                    className="flex items-center gap-2 bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 text-sm"
                  >
                    <FileDown size={16} />
                    {!isMobile && 'Export PDF'}
                  </button>
                </div>
              </div>
              {/* Search and balance filter */}
              <div className="flex gap-2 flex-wrap items-center mb-3">
                <input
                  type="text"
                  placeholder="Search by name..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="border rounded px-3 py-1.5 text-sm w-48"
                />
                <div className="flex gap-1">
                  {(['all', 'active', 'zero'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setCustomerBalanceFilter(f)}
                      className={`px-3 py-1 text-sm rounded border ${
                        customerBalanceFilter === f
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {f === 'all' ? 'All' : f === 'active' ? 'Active Balance' : 'Zero Balance'}
                    </button>
                  ))}
                </div>
                {(customerSearch || customerBalanceFilter !== 'all') && (
                  <button
                    onClick={() => { setCustomerSearch(''); setCustomerBalanceFilter('all'); }}
                    className="px-2 py-1 text-sm text-gray-500 hover:text-gray-700 underline"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="min-w-full border-collapse">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border px-3 py-2 text-left text-xs whitespace-nowrap">Customer Name</th>
                      <th className="border px-3 py-2 text-right text-xs whitespace-nowrap">Invoices</th>
                      <th className="border px-3 py-2 text-right text-xs whitespace-nowrap">Total Invoiced (Dr)</th>
                      <th className="border px-3 py-2 text-right text-xs whitespace-nowrap">Total Paid (Cr)</th>
                      <th className="border px-3 py-2 text-right text-xs whitespace-nowrap">Balance</th>
                      <th className="border px-3 py-2 text-center text-xs whitespace-nowrap">Ledger</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedFilteredCustomers.map(customer => {
                      const metrics = getCustomerMetrics(customer);
                      const displayBalance = metrics.balance;
                      const isExpanded = expandedCustomerLedger === customer.id;
                      return (
                        <React.Fragment key={customer.id}>
                          <tr className={`border-b hover:bg-gray-50 ${isExpanded ? 'bg-blue-50' : ''}`}>
                            <td className="border px-3 py-2 font-medium">{customer.name}</td>
                            <td className="border px-3 py-2 text-right">{metrics.invoicesCount}</td>
                            <td className="border px-3 py-2 text-right font-semibold text-blue-700">{metrics.totalInvoiced.toFixed(2)}</td>
                            <td className="border px-3 py-2 text-right text-green-600">{metrics.totalPaid.toFixed(2)}</td>
                            <td className={`border px-3 py-2 text-right font-bold ${displayBalance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                              {displayBalance.toFixed(2)}
                              {displayBalance > 0 && <span className="ml-1 text-xs font-normal">(due)</span>}
                            </td>
                            <td className="border px-3 py-2 text-center">
                              <div className="flex gap-1 justify-center flex-wrap">
                                <button
                                  onClick={() => generateDetailedStatement('customer', customer.id, customer.name)}
                                  className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded font-medium"
                                >
                                  Ledger
                                </button>
                                <button
                                  onClick={() => openPaymentModal(customer.id, customer.name, 'customer')}
                                  className="px-2 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded font-medium flex items-center gap-1"
                                >
                                  <PlusCircle size={11} /> Payment
                                </button>
                              </div>
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-100 font-bold">
                    <tr>
                      <td className="border px-3 py-3">TOTAL</td>
                      <td className="border px-3 py-3 text-right">{filteredCustomers.length}</td>
                      <td className="border px-3 py-3 text-right text-blue-600">{filteredCustomerTotals.invoiced.toFixed(2)}</td>
                      <td className="border px-3 py-3 text-right text-green-600">{filteredCustomerTotals.paid.toFixed(2)}</td>
                      <td className="border px-3 py-3 text-right text-blue-600">{filteredCustomerTotals.balance.toFixed(2)}</td>
                      <td className="border px-3 py-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'suppliers' && (() => {
            const filteredSuppliers = suppliers.filter((supplier) => {
              if (supplierSearch && !supplier.name.toLowerCase().includes(supplierSearch.toLowerCase())) return false;
              const metrics = getSupplierMetrics(supplier);
              if (supplierBalanceFilter === 'active') return metrics.balance > BALANCE_EPSILON;
              if (supplierBalanceFilter === 'zero') return isZeroBalance(metrics.balance);
              return true;
            });

            const filteredSupplierTotals = filteredSuppliers.reduce((acc, supplier) => {
              const metrics = getSupplierMetrics(supplier);
              acc.purchased += metrics.totalPurchases;
              acc.paid += metrics.totalPayments;
              acc.balance += metrics.balance;
              return acc;
            }, { purchased: 0, paid: 0, balance: 0 });

            const sortedFilteredSuppliers = [...filteredSuppliers].sort((a, b) => {
              const balanceDiff = getSupplierMetrics(b).balance - getSupplierMetrics(a).balance;
              if (Math.abs(balanceDiff) >= BALANCE_EPSILON) return balanceDiff;
              return a.name.localeCompare(b.name);
            });

            return (
              <div>
                {/* Filters */}
                <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
                  <h2 className="text-xl font-semibold">Supplier Balances</h2>
                  <div className="flex gap-2 flex-wrap items-center">
                    <div className="flex gap-2 items-center">
                      <label className="text-sm text-gray-600">From:</label>
                      <input type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} className="border rounded px-2 py-1 text-sm" />
                    </div>
                    <div className="flex gap-2 items-center">
                      <label className="text-sm text-gray-600">To:</label>
                      <input type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} className="border rounded px-2 py-1 text-sm" />
                    </div>
                    {(filterStartDate || filterEndDate) && (
                      <button onClick={() => { setFilterStartDate(''); setFilterEndDate(''); }} className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded">Clear Dates</button>
                    )}
                    <button onClick={exportSuppliersToExcel} className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 text-sm">
                      <Download size={16} />{!isMobile && 'Export Excel'}
                    </button>
                    <button onClick={exportSuppliersToPDF} className="flex items-center gap-2 bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 text-sm">
                      <FileDown size={16} />{!isMobile && 'Export PDF'}
                    </button>
                  </div>
                </div>

                {/* Search and balance filter */}
                <div className="flex gap-2 flex-wrap items-center mb-3">
                  <input
                    type="text"
                    placeholder="Search by name..."
                    value={supplierSearch}
                    onChange={(e) => setSupplierSearch(e.target.value)}
                    className="border rounded px-3 py-1.5 text-sm w-48"
                  />
                  <div className="flex gap-1">
                    {(['all', 'active', 'zero'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setSupplierBalanceFilter(f)}
                        className={`px-3 py-1 text-sm rounded border ${
                          supplierBalanceFilter === f
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {f === 'all' ? 'All' : f === 'active' ? 'Active Balance' : 'Zero Balance'}
                      </button>
                    ))}
                  </div>
                  {(supplierSearch || supplierBalanceFilter !== 'all') && (
                    <button
                      onClick={() => { setSupplierSearch(''); setSupplierBalanceFilter('all'); }}
                      className="px-2 py-1 text-sm text-gray-500 hover:text-gray-700 underline"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-orange-50 border border-orange-200 rounded p-4">
                    <div className="text-sm text-orange-600 font-medium">Total Purchased (Dr)</div>
                    <div className="text-2xl font-bold text-orange-700">${filteredSupplierTotals.purchased.toFixed(2)}</div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded p-4">
                    <div className="text-sm text-green-600 font-medium">Total Paid (Cr)</div>
                    <div className="text-2xl font-bold text-green-700">${filteredSupplierTotals.paid.toFixed(2)}</div>
                  </div>
                  <div className={`border rounded p-4 ${filteredSupplierTotals.balance > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                    <div className={`text-sm font-medium ${filteredSupplierTotals.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>Outstanding (Owed to Suppliers)</div>
                    <div className={`text-2xl font-bold ${filteredSupplierTotals.balance > 0 ? 'text-red-700' : 'text-green-700'}`}>${filteredSupplierTotals.balance.toFixed(2)}</div>
                  </div>
                </div>

                {/* Supplier Table */}
                <div className="overflow-x-auto -mx-6 px-6">
                  <table className="min-w-full border-collapse">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="border px-3 py-2 text-left text-xs">Supplier Name</th>
                        <th className="border px-3 py-2 text-right text-xs">Invoices</th>
                        <th className="border px-3 py-2 text-right text-xs">Total Purchased (Dr)</th>
                        <th className="border px-3 py-2 text-right text-xs">Total Paid (Cr)</th>
                        <th className="border px-3 py-2 text-right text-xs">Outstanding</th>
                        <th className="border px-3 py-2 text-center text-xs">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedFilteredSuppliers.map(supplier => {
                        const metrics = getSupplierMetrics(supplier);
                        return (
                          <tr key={supplier.id} className="border-b hover:bg-gray-50">
                            <td className="border px-3 py-2 font-medium">{supplier.name}</td>
                            <td className="border px-3 py-2 text-right">{metrics.invoicesCount}</td>
                            <td className="border px-3 py-2 text-right font-semibold text-orange-700">{metrics.totalPurchases.toFixed(2)}</td>
                            <td className="border px-3 py-2 text-right text-green-600">{metrics.totalPayments.toFixed(2)}</td>
                            <td className={`border px-3 py-2 text-right font-bold ${metrics.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {metrics.balance.toFixed(2)}
                              {metrics.balance > 0 && <span className="ml-1 text-xs font-normal">(owed)</span>}
                              {metrics.balance < -BALANCE_EPSILON && (
                                <span className="ml-1 text-xs font-normal">(in your favour)</span>
                              )}
                            </td>
                            <td className="border px-3 py-2 text-center">
                              <div className="flex gap-1 justify-center">
                                <button
                                  onClick={() => generateDetailedStatement('supplier', supplier.id, supplier.name)}
                                  className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded"
                                >
                                  Ledger
                                </button>
                                <button
                                  onClick={() => openPaymentModal(supplier.id, supplier.name, 'supplier')}
                                  className="px-2 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded font-medium flex items-center gap-1"
                                >
                                  <PlusCircle size={11} /> Payment
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-100 font-bold">
                      <tr>
                        <td className="border px-3 py-3">TOTAL</td>
                        <td className="border px-3 py-3 text-right">{sortedFilteredSuppliers.reduce((sum, s) => sum + purchases.filter(p => p.supplier === s.name).length, 0)}</td>
                        <td className="border px-3 py-3 text-right text-orange-700">{filteredSupplierTotals.purchased.toFixed(2)}</td>
                        <td className="border px-3 py-3 text-right text-green-600">{filteredSupplierTotals.paid.toFixed(2)}</td>
                        <td className={`border px-3 py-3 text-right ${filteredSupplierTotals.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>{filteredSupplierTotals.balance.toFixed(2)}</td>
                        <td className="border px-3 py-3"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })()}

          {activeTab === 'products' && (() => {
            const filteredProducts = filteredProductSummaries.filter((product) => {
              if (productSearch && !product.name.toLowerCase().includes(productSearch.toLowerCase())) return false;
              if (productCategoryFilter !== 'all') {
                if (productCategoryFilter === 'active') return product.totalRevenue > BALANCE_EPSILON;
                if (productCategoryFilter === 'zero') return isZeroBalance(product.totalRevenue);
              }
              return true;
            });

            const productTotals = filteredProducts.reduce((acc, product) => {
              const discount = product.totalDiscount || 0;
              const subtotal = product.totalRevenue + discount;
              acc.quantity += product.totalSold;
              acc.subtotal += subtotal;
              acc.discount += discount;
              acc.revenue += product.totalRevenue;
              return acc;
            }, { quantity: 0, subtotal: 0, discount: 0, revenue: 0 });

            return (
              <div>
                {/* Filters */}
                <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
                  <h2 className="text-xl font-semibold">Product Summary</h2>
                  {quarantinedProductSalesCount > 0 && (
                    <div className="text-sm text-orange-600 font-medium">
                      Quarantined rows: {quarantinedProductSalesCount}
                    </div>
                  )}
                  <div className="flex gap-2 flex-wrap items-center">
                    <div className="flex gap-2 items-center">
                      <label className="text-sm text-gray-600">From:</label>
                      <input type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} className="border rounded px-2 py-1 text-sm" />
                    </div>
                    <div className="flex gap-2 items-center">
                      <label className="text-sm text-gray-600">To:</label>
                      <input type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} className="border rounded px-2 py-1 text-sm" />
                    </div>
                    {(filterStartDate || filterEndDate) && (
                      <button onClick={() => { setFilterStartDate(''); setFilterEndDate(''); }} className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded">Clear Dates</button>
                    )}
                    <button onClick={exportProductsToExcel} className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 text-sm">
                      <Download size={16} />{!isMobile && 'Export Excel'}
                    </button>
                    <button onClick={exportProductsToPDF} className="flex items-center gap-2 bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 text-sm">
                      <FileDown size={16} />{!isMobile && 'Export PDF'}
                    </button>
                  </div>
                </div>

                {/* Search and category filter */}
                <div className="flex gap-2 flex-wrap items-center mb-3">
                  <input
                    type="text"
                    placeholder="Search by name..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="border rounded px-3 py-1.5 text-sm w-48"
                  />
                  <div className="flex gap-1">
                    {(['all', 'active', 'zero'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setProductCategoryFilter(f)}
                        className={`px-3 py-1 text-sm rounded border ${
                          productCategoryFilter === f
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {f === 'all' ? 'All' : f === 'active' ? 'Active Sales' : 'Zero Sales'}
                      </button>
                    ))}
                  </div>
                  {(productSearch || productCategoryFilter !== 'all') && (
                    <button
                      onClick={() => { setProductSearch(''); setProductCategoryFilter('all'); }}
                      className="px-2 py-1 text-sm text-gray-500 hover:text-gray-700 underline"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-purple-50 border border-purple-200 rounded p-4">
                    <div className="text-sm text-purple-600 font-medium">Quantity Sold</div>
                    <div className="text-2xl font-bold text-purple-700">{productTotals.quantity}</div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded p-4">
                    <div className="text-sm text-blue-600 font-medium">Subtotal</div>
                    <div className="text-2xl font-bold text-blue-700">${productTotals.subtotal.toFixed(2)}</div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded p-4">
                    <div className="text-sm text-red-600 font-medium">Discount</div>
                    <div className="text-2xl font-bold text-red-700">${productTotals.discount.toFixed(2)}</div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded p-4">
                    <div className="text-sm text-green-600 font-medium">Total Revenue</div>
                    <div className="text-2xl font-bold text-green-700">${productTotals.revenue.toFixed(2)}</div>
                  </div>
                </div>

                {/* Product Table */}
                <div className="overflow-x-auto -mx-6 px-6">
                  <table className="min-w-full border-collapse">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="border px-3 py-2 text-left text-xs">Product Name</th>
                        <th className="border px-3 py-2 text-left text-xs">Category</th>
                        <th className="border px-3 py-2 text-right text-xs">Quantity Sold</th>
                        <th className="border px-3 py-2 text-right text-xs">Subtotal</th>
                        <th className="border px-3 py-2 text-right text-xs">Discount</th>
                        <th className="border px-3 py-2 text-right text-xs">Total Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map(product => {
                        const discount = product.totalDiscount || 0;
                        const subtotal = product.totalRevenue + discount;
                        return (
                          <tr key={product.id} className="border-b hover:bg-gray-50">
                            <td className="border px-3 py-2 font-medium">{product.name}</td>
                            <td className="border px-3 py-2">{product.category}</td>
                            <td className="border px-3 py-2 text-right">{product.totalSold}</td>
                            <td className="border px-3 py-2 text-right">${subtotal.toFixed(2)}</td>
                            <td className="border px-3 py-2 text-right text-red-600">{discount > 0 ? `-$${discount.toFixed(2)}` : '$0.00'}</td>
                            <td className="border px-3 py-2 text-right font-semibold text-green-700">${product.totalRevenue.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-100 font-bold">
                      <tr>
                        <td className="border px-3 py-3" colSpan={2}>TOTAL</td>
                        <td className="border px-3 py-3 text-right">{productTotals.quantity}</td>
                        <td className="border px-3 py-3 text-right">${productTotals.subtotal.toFixed(2)}</td>
                        <td className="border px-3 py-3 text-right text-red-600">-${productTotals.discount.toFixed(2)}</td>
                        <td className="border px-3 py-3 text-right text-green-700">${productTotals.revenue.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })()}

          {activeTab === 'purchases' && (() => {
            const filteredPurchases = purchases.filter(p => {
              if (!isDateInRange(p.date, filterStartDate, filterEndDate)) return false;
              if (purchaseSearch) {
                const lowerSearch = purchaseSearch.toLowerCase();
                const matchesSupplier = p.supplier.toLowerCase().includes(lowerSearch);
                const matchesInvoice = (p.invoiceNumber || '').toLowerCase().includes(lowerSearch);
                if (!matchesSupplier && !matchesInvoice) return false;
              }
              return true;
            });

            // Group by supplier
            const supplierMap = new Map<string, {
              name: string;
              supplierId: string;
              invoices: PurchaseRecord[];
              totalDebit: number;
              totalCredit: number;
              balance: number;
            }>();
            filteredPurchases.forEach(p => {
              if (!supplierMap.has(p.supplier)) {
                supplierMap.set(p.supplier, { name: p.supplier, supplierId: p.supplierId || '', invoices: [], totalDebit: 0, totalCredit: 0, balance: 0 });
              }
              const entry = supplierMap.get(p.supplier)!;
              if (!entry.supplierId && p.supplierId) entry.supplierId = p.supplierId;
              entry.invoices.push(p);
              entry.totalDebit += p.amount;
              entry.totalCredit += p.amountPaid;
              entry.balance += (p.amount - p.amountPaid);
            });

            // Add standalone payments from accountPayments (direction=out, accountType=supplier)
            accountPayments
              .filter(pmt =>
                pmt.accountType === 'supplier' &&
                pmt.direction === 'out' &&
                isDateInRange(pmt.date, filterStartDate, filterEndDate)
              )
              .forEach(pmt => {
                const amount = toFiniteNumber(pmt.amount, 0);
                if (amount <= 0) return;
                // Match by accountId first, fall back to accountName
                let entry = pmt.accountId
                  ? Array.from(supplierMap.values()).find(e => e.supplierId === pmt.accountId)
                  : undefined;
                if (!entry) entry = supplierMap.get(pmt.accountName);
                if (!entry) {
                  // Supplier may have no purchases in this date range — create entry
                  supplierMap.set(pmt.accountName, {
                    name: pmt.accountName,
                    supplierId: pmt.accountId || '',
                    invoices: [],
                    totalDebit: 0,
                    totalCredit: 0,
                    balance: 0,
                  });
                  entry = supplierMap.get(pmt.accountName)!;
                }
                entry.totalCredit += amount;
                entry.balance = entry.totalDebit - entry.totalCredit;
              });
            const supplierAccounts = Array.from(supplierMap.values()).sort((a, b) => b.balance - a.balance);
            const filteredSupplierAccounts = supplierAccounts.filter(account => {
              if (purchaseBalanceFilter === 'active') return account.balance > BALANCE_EPSILON;
              if (purchaseBalanceFilter === 'zero') return isZeroBalance(account.balance);
              return true;
            });
            const totalDebit = filteredSupplierAccounts.reduce((s, c) => s + c.totalDebit, 0);
            const totalCredit = filteredSupplierAccounts.reduce((s, c) => s + c.totalCredit, 0);
            const totalBalance = totalDebit - totalCredit;

            return (
              <div>
                {/* Filters */}
                <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
                  <h2 className="text-xl font-semibold">Purchase Accounts</h2>
                  <div className="flex gap-2 flex-wrap items-center">
                    <div className="flex gap-2 items-center">
                      <label className="text-sm text-gray-600">From:</label>
                      <input type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} className="border rounded px-2 py-1 text-sm" />
                    </div>
                    <div className="flex gap-2 items-center">
                      <label className="text-sm text-gray-600">To:</label>
                      <input type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} className="border rounded px-2 py-1 text-sm" />
                    </div>
                    {(filterStartDate || filterEndDate) && (
                      <button onClick={() => { setFilterStartDate(''); setFilterEndDate(''); }} className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded">Clear Dates</button>
                    )}
                    <button onClick={exportPurchasesToExcel} className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 text-sm">
                      <Download size={16} />{!isMobile && 'Export Excel'}
                    </button>
                    <button onClick={exportPurchasesToPDF} className="flex items-center gap-2 bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 text-sm">
                      <FileDown size={16} />{!isMobile && 'Export PDF'}
                    </button>
                  </div>
                </div>

                {/* Search and balance filter */}
                <div className="flex gap-2 flex-wrap items-center mb-3">
                  <input
                    type="text"
                    placeholder="Search by supplier or invoice..."
                    value={purchaseSearch}
                    onChange={(e) => setPurchaseSearch(e.target.value)}
                    className="border rounded px-3 py-1.5 text-sm w-56"
                  />
                  <div className="flex gap-1">
                    {(['all', 'active', 'zero'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setPurchaseBalanceFilter(f)}
                        className={`px-3 py-1 text-sm rounded border ${
                          purchaseBalanceFilter === f
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {f === 'all' ? 'All' : f === 'active' ? 'Active Balance' : 'Zero Balance'}
                      </button>
                    ))}
                  </div>
                  {(purchaseSearch || purchaseBalanceFilter !== 'all') && (
                    <button
                      onClick={() => { setPurchaseSearch(''); setPurchaseBalanceFilter('all'); }}
                      className="px-2 py-1 text-sm text-gray-500 hover:text-gray-700 underline"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-orange-50 border border-orange-200 rounded p-4">
                    <div className="text-sm text-orange-600 font-medium">Total Purchased (Dr)</div>
                    <div className="text-2xl font-bold text-orange-700">${totalDebit.toFixed(2)}</div>
                    <div className="text-xs text-gray-500 mt-1">{filteredPurchases.length} invoice(s)</div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded p-4">
                    <div className="text-sm text-green-600 font-medium">Total Paid (Cr)</div>
                    <div className="text-2xl font-bold text-green-700">${totalCredit.toFixed(2)}</div>
                  </div>
                  <div className={`border rounded p-4 ${totalBalance > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                    <div className={`text-sm font-medium ${totalBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>Outstanding (Owed to Suppliers)</div>
                    <div className={`text-2xl font-bold ${totalBalance > 0 ? 'text-red-700' : 'text-green-700'}`}>${totalBalance.toFixed(2)}</div>
                  </div>
                </div>

                {/* Supplier Account Table */}
                <div className="overflow-x-auto -mx-6 px-6">
                  <table className="min-w-full border-collapse">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="border px-3 py-2 text-left text-xs">Supplier</th>
                        <th className="border px-3 py-2 text-right text-xs">Invoices</th>
                        <th className="border px-3 py-2 text-right text-xs">Total Purchased (Dr)</th>
                        <th className="border px-3 py-2 text-right text-xs">Total Paid (Cr)</th>
                        <th className="border px-3 py-2 text-right text-xs">Outstanding</th>
                        <th className="border px-3 py-2 text-center text-xs">Ledger</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSupplierAccounts.length === 0 && (
                        <tr><td colSpan={6} className="border px-4 py-6 text-center text-gray-500">No purchases found{(filterStartDate || filterEndDate || purchaseSearch || purchaseBalanceFilter !== 'all') ? ' for the selected filters' : ''}.</td></tr>
                      )}
                      {filteredSupplierAccounts.map(supplier => (
                        <tr key={supplier.name} className="border-b hover:bg-gray-50">
                            <td className="border px-3 py-2 font-medium">{supplier.name}</td>
                            <td className="border px-3 py-2 text-right">{supplier.invoices.length}</td>
                            <td className="border px-3 py-2 text-right font-semibold text-orange-700">{supplier.totalDebit.toFixed(2)}</td>
                            <td className="border px-3 py-2 text-right text-green-600">{supplier.totalCredit.toFixed(2)}</td>
                            <td className={`border px-3 py-2 text-right font-bold ${supplier.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {supplier.balance.toFixed(2)}
                              {supplier.balance > 0 && <span className="ml-1 text-xs font-normal">(owed)</span>}
                            </td>
                            <td className="border px-3 py-2 text-center">
                              <button
                                onClick={() => {
                                  const found = supplier.invoices.find((p) => p.supplierId);
                                  const supplierId = found?.supplierId || suppliers.find(s => s.name === supplier.name)?.id;
                                  if (!supplierId) return;
                                  generateDetailedStatement('supplier', supplierId, supplier.name);
                                }}
                                className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded font-medium"
                              >
                                Ledger
                              </button>
                            </td>
                          </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-100 font-bold">
                      <tr>
                        <td className="border px-3 py-3">TOTAL</td>
                        <td className="border px-3 py-3 text-right">{filteredSupplierAccounts.length}</td>
                        <td className="border px-3 py-3 text-right text-orange-700">{totalDebit.toFixed(2)}</td>
                        <td className="border px-3 py-3 text-right text-green-600">{totalCredit.toFixed(2)}</td>
                        <td className={`border px-3 py-3 text-right ${totalBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>{totalBalance.toFixed(2)}</td>
                        <td className="border px-3 py-3"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })()}

          {activeTab === 'expenses' && (() => {
            const filteredExpenses = expenses.filter(e => {
              if (!isDateInRange(e.date, filterStartDate, filterEndDate)) return false;
              if (expenseCategory && e.category !== expenseCategory) return false;
              if (expenseSearch) {
                const lowerSearch = expenseSearch.toLowerCase();
                const matchesCategory = (e.category || '').toLowerCase().includes(lowerSearch);
                const matchesDescription = (e.description || '').toLowerCase().includes(lowerSearch);
                const matchesMethod = (e.paymentMethod || '').toLowerCase().includes(lowerSearch);
                if (!matchesCategory && !matchesDescription && !matchesMethod) return false;
              }
              return true;
            });

            const expenseTotals = filteredExpenses.reduce((acc, e) => {
              acc.total += e.amount;
              acc.vat += e.taxAmount || 0;
              return acc;
            }, { total: 0, vat: 0 });

            const categories = Array.from(new Set(expenses.map(e => e.category)));

            return (
              <div>
                {/* Filters */}
                <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
                  <h2 className="text-xl font-semibold">Expense History</h2>
                  <div className="flex gap-2 flex-wrap items-center">
                    <div className="flex gap-2 items-center">
                      <label className="text-sm text-gray-600">From:</label>
                      <input type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} className="border rounded px-2 py-1 text-sm" />
                    </div>
                    <div className="flex gap-2 items-center">
                      <label className="text-sm text-gray-600">To:</label>
                      <input type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} className="border rounded px-2 py-1 text-sm" />
                    </div>
                    {(filterStartDate || filterEndDate) && (
                      <button onClick={() => { setFilterStartDate(''); setFilterEndDate(''); }} className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded">Clear Dates</button>
                    )}
                    <button onClick={exportExpensesToExcel} className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 text-sm">
                      <Download size={16} />{!isMobile && 'Export Excel'}
                    </button>
                    <button onClick={exportExpensesToPDF} className="flex items-center gap-2 bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 text-sm">
                      <FileDown size={16} />{!isMobile && 'Export PDF'}
                    </button>
                  </div>
                </div>

                {/* Category filter */}
                <div className="flex gap-2 flex-wrap items-center mb-3">
                  <input
                    type="text"
                    placeholder="Search by category, description or method..."
                    value={expenseSearch}
                    onChange={(e) => setExpenseSearch(e.target.value)}
                    className="border rounded px-3 py-1.5 text-sm w-72"
                  />
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                    className="border rounded px-3 py-1.5 text-sm"
                  >
                    <option value="">All Categories</option>
                    {categories.sort().map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  {(expenseCategory || expenseSearch) && (
                    <button
                      onClick={() => { setExpenseCategory(''); setExpenseSearch(''); }}
                      className="px-2 py-1 text-sm text-gray-500 hover:text-gray-700 underline"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Summary Card */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-red-50 border border-red-200 rounded p-4">
                    <div className="text-sm text-red-600 font-medium">Total Expenses</div>
                    <div className="text-2xl font-bold text-red-700">${expenseTotals.total.toFixed(2)}</div>
                    <div className="text-xs text-gray-500 mt-1">{filteredExpenses.length} record(s)</div>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                    <div className="text-sm text-yellow-600 font-medium">Net</div>
                    <div className="text-2xl font-bold text-yellow-700">${(expenseTotals.total - expenseTotals.vat).toFixed(2)}</div>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded p-4">
                    <div className="text-sm text-purple-600 font-medium">VAT</div>
                    <div className="text-2xl font-bold text-purple-700">${expenseTotals.vat.toFixed(2)}</div>
                  </div>
                </div>

                {/* Expenses Table */}
                <div className="overflow-x-auto -mx-6 px-6">
                  <table className="min-w-full border-collapse">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="border px-3 py-2 text-left text-xs">Date</th>
                        <th className="border px-3 py-2 text-left text-xs">Category</th>
                        <th className="border px-3 py-2 text-left text-xs">Description</th>
                        <th className="border px-3 py-2 text-right text-xs">Amount</th>
                        <th className="border px-3 py-2 text-right text-xs">Net</th>
                        <th className="border px-3 py-2 text-right text-xs">VAT</th>
                        <th className="border px-3 py-2 text-left text-xs">Payment Method</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExpenses.length === 0 ? (
                        <tr><td colSpan={7} className="border px-4 py-6 text-center text-gray-500">No expenses found{(filterStartDate || filterEndDate || expenseCategory || expenseSearch) ? ' for the selected filters' : ''}.</td></tr>
                      ) : (
                        filteredExpenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(expense => {
                          const vat = expense.taxAmount || 0;
                          const net = expense.amount - vat;
                          return (
                            <tr key={expense.id} className="border-b hover:bg-gray-50 text-sm">
                              <td className="border px-3 py-2">{toDateLabel(expense.date)}</td>
                              <td className="border px-3 py-2">{expense.category}</td>
                              <td className="border px-3 py-2">{expense.description}</td>
                              <td className="border px-3 py-2 text-right font-semibold text-red-600">${expense.amount.toFixed(2)}</td>
                              <td className="border px-3 py-2 text-right">${net.toFixed(2)}</td>
                              <td className="border px-3 py-2 text-right">${vat.toFixed(2)}</td>
                              <td className="border px-3 py-2 text-xs">{expense.paymentMethod || '-'}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    <tfoot className="bg-gray-100 font-bold">
                      <tr>
                        <td className="border px-3 py-3" colSpan={3}>TOTAL</td>
                        <td className="border px-3 py-3 text-right text-red-700">${expenseTotals.total.toFixed(2)}</td>
                        <td className="border px-3 py-3 text-right">${(expenseTotals.total - expenseTotals.vat).toFixed(2)}</td>
                        <td className="border px-3 py-3 text-right">${expenseTotals.vat.toFixed(2)}</td>
                        <td className="border px-3 py-3"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })()}

          {activeTab === 'sales' && (() => {
            const uniqueSalesCustomers = Array.from(new Set(sales.map(s => s.customer))).sort();
            const dropdownSalesCustomers = uniqueSalesCustomers.filter((customerName) =>
              !filterCustomer || customerName.toLowerCase().includes(filterCustomer.toLowerCase())
            );

            const filteredSales = sales.filter(s => {
              if (!isDateInRange(s.date, filterStartDate, filterEndDate)) return false;
              if (filterCustomer && !s.customer.toLowerCase().includes(filterCustomer.toLowerCase())) return false;
              if (salesSearch) {
                const lowerSearch = salesSearch.toLowerCase();
                const matchesInvoice = (s.invoiceNumber || '').toLowerCase().includes(lowerSearch);
                if (!matchesInvoice) return false;
              }
              return true;
            });

            // Group by customer
            const customerMap = new Map<string, {
              name: string;
              invoices: SalesRecord[];
              totalDebit: number;
              totalCredit: number;
              balance: number;
              customerId?: string;
            }>();
            filteredSales.forEach(s => {
              if (!customerMap.has(s.customer)) {
                customerMap.set(s.customer, { name: s.customer, invoices: [], totalDebit: 0, totalCredit: 0, balance: 0, customerId: s.customerId });
              }
              const entry = customerMap.get(s.customer)!;
              entry.invoices.push(s);
              entry.totalDebit += s.total;
              entry.totalCredit += s.amountPaid;
              entry.balance += (s.total - s.amountPaid);
              if (!entry.customerId && s.customerId) {
                entry.customerId = s.customerId;
              }
            });
            const customerAccounts = Array.from(customerMap.values()).sort((a, b) => b.balance - a.balance);
            const filteredCustomerAccounts = customerAccounts.filter(account => {
              if (salesBalanceFilter === 'active') return account.balance > BALANCE_EPSILON;
              if (salesBalanceFilter === 'zero') return isZeroBalance(account.balance);
              return true;
            });
            const totalDebit = filteredCustomerAccounts.reduce((sum, c) => sum + c.totalDebit, 0);
            const totalCredit = filteredCustomerAccounts.reduce((sum, c) => sum + c.totalCredit, 0);
            const totalBalance = totalDebit - totalCredit;

            return (
              <div>
                {/* Filters */}
                <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
                  <h2 className="text-xl font-semibold">Sales Accounts</h2>
                  <div className="flex gap-2 items-center flex-wrap">
                    <div className="flex gap-2 items-center">
                      <label className="text-sm text-gray-600">From:</label>
                      <input type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} className="border rounded px-2 py-1 text-sm" />
                    </div>
                    <div className="flex gap-2 items-center">
                      <label className="text-sm text-gray-600">To:</label>
                      <input type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} className="border rounded px-2 py-1 text-sm" />
                    </div>
                    <div className="flex gap-2 items-center">
                      <label className="text-sm text-gray-600">Customer:</label>
                      <div className="flex gap-2 items-center flex-wrap">
                        <input
                          list="sales-customer-options"
                          type="text"
                          placeholder="All Customers"
                          value={filterCustomer}
                          onChange={(e) => setFilterCustomer(e.target.value)}
                          className="border rounded px-2 py-1 text-sm w-56"
                        />
                        <datalist id="sales-customer-options">
                          {dropdownSalesCustomers.map(c => (
                            <option key={c} value={c} />
                          ))}
                        </datalist>
                      </div>
                    </div>
                    {(filterStartDate || filterEndDate || filterCustomer) && (
                      <button onClick={() => { setFilterStartDate(''); setFilterEndDate(''); setFilterCustomer(''); }} className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm">Clear Filters</button>
                    )}
                    <button onClick={exportSalesToExcel} className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 text-sm">
                      <Download size={16} />{!isMobile && 'Export Excel'}
                    </button>
                    <button onClick={exportSalesToPDF} className="flex items-center gap-2 bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 text-sm">
                      <FileDown size={16} />{!isMobile && 'Export PDF'}
                    </button>
                  </div>
                </div>

                {/* Search and balance filter */}
                <div className="flex gap-2 flex-wrap items-center mb-3">
                  <input
                    type="text"
                    placeholder="Search by invoice..."
                    value={salesSearch}
                    onChange={(e) => setSalesSearch(e.target.value)}
                    className="border rounded px-3 py-1.5 text-sm w-56"
                  />
                  <div className="flex gap-1">
                    {(['all', 'active', 'zero'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setSalesBalanceFilter(f)}
                        className={`px-3 py-1 text-sm rounded border ${
                          salesBalanceFilter === f
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {f === 'all' ? 'All' : f === 'active' ? 'Active Balance' : 'Zero Balance'}
                      </button>
                    ))}
                  </div>
                  {(salesSearch || salesBalanceFilter !== 'all') && (
                    <button
                      onClick={() => { setSalesSearch(''); setSalesBalanceFilter('all'); }}
                      className="px-2 py-1 text-sm text-gray-500 hover:text-gray-700 underline"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-blue-50 border border-blue-200 rounded p-4">
                    <div className="text-sm text-blue-600 font-medium">Total Invoiced (Dr)</div>
                    <div className="text-2xl font-bold text-blue-700">${totalDebit.toFixed(2)}</div>
                    <div className="text-xs text-gray-500 mt-1">{filteredSales.length} invoice(s) across {customerAccounts.length} customer(s)</div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded p-4">
                    <div className="text-sm text-green-600 font-medium">Total Paid (Cr)</div>
                    <div className="text-2xl font-bold text-green-700">${totalCredit.toFixed(2)}</div>
                  </div>
                  <div className={`border rounded p-4 ${totalBalance > 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
                    <div className={`text-sm font-medium ${totalBalance > 0 ? 'text-orange-600' : 'text-green-600'}`}>Outstanding (Receivable)</div>
                    <div className={`text-2xl font-bold ${totalBalance > 0 ? 'text-orange-700' : 'text-green-700'}`}>${totalBalance.toFixed(2)}</div>
                  </div>
                </div>

                {/* Customer Account Table */}
                <div className="overflow-x-auto -mx-6 px-6">
                  <table className="min-w-full border-collapse">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="border px-3 py-2 text-left text-xs">Customer</th>
                        <th className="border px-3 py-2 text-right text-xs">Invoices</th>
                        <th className="border px-3 py-2 text-right text-xs">Total Invoiced (Dr)</th>
                        <th className="border px-3 py-2 text-right text-xs">Total Paid (Cr)</th>
                        <th className="border px-3 py-2 text-right text-xs">Outstanding</th>
                        <th className="border px-3 py-2 text-center text-xs">Ledger</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCustomerAccounts.length === 0 && (
                        <tr><td colSpan={6} className="border px-4 py-6 text-center text-gray-500">No sales found{(filterStartDate || filterEndDate || filterCustomer || salesSearch || salesBalanceFilter !== 'all') ? ' for the selected filters' : ''}.</td></tr>
                      )}
                      {filteredCustomerAccounts.map(customer => (
                          <tr key={customer.name} className="border-b hover:bg-gray-50">
                            <td className="border px-3 py-2 font-medium">{customer.name}</td>
                            <td className="border px-3 py-2 text-right">{customer.invoices.length}</td>
                            <td className="border px-3 py-2 text-right font-semibold text-blue-700">{customer.totalDebit.toFixed(2)}</td>
                            <td className="border px-3 py-2 text-right text-green-600">{customer.totalCredit.toFixed(2)}</td>
                            <td className={`border px-3 py-2 text-right font-bold ${customer.balance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                              {customer.balance.toFixed(2)}
                              {customer.balance > 0 && <span className="ml-1 text-xs font-normal">(due)</span>}
                            </td>
                            <td className="border px-3 py-2 text-center">
                              <button
                                onClick={() => {
                                  const customerId = customer.customerId || customers.find(c => c.name === customer.name)?.id;
                                  if (!customerId) return;
                                  generateDetailedStatement('customer', customerId, customer.name);
                                }}
                                className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded font-medium"
                              >
                                Ledger
                              </button>
                            </td>
                          </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-100 font-bold">
                      <tr>
                        <td className="border px-3 py-3">TOTAL</td>
                        <td className="border px-3 py-3 text-right">{filteredCustomerAccounts.length}</td>
                        <td className="border px-3 py-3 text-right text-blue-700">{totalDebit.toFixed(2)}</td>
                        <td className="border px-3 py-3 text-right text-green-600">{totalCredit.toFixed(2)}</td>
                        <td className={`border px-3 py-3 text-right ${totalBalance > 0 ? 'text-orange-600' : 'text-green-600'}`}>{totalBalance.toFixed(2)}</td>
                        <td className="border px-3 py-3"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })()}


          {activeTab === 'cashCollections' && (
            <div>
              <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
                <h2 className="text-xl font-semibold">Cash Collection History</h2>
                <div className="flex gap-2 flex-wrap items-center">
                  <div className="flex gap-2 items-center">
                    <label className="text-sm text-gray-600">From:</label>
                    <input
                      type="date"
                      value={cashFilterStart}
                      onChange={(e) => setCashFilterStart(e.target.value)}
                      className="border rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="flex gap-2 items-center">
                    <label className="text-sm text-gray-600">To:</label>
                    <input
                      type="date"
                      value={cashFilterEnd}
                      onChange={(e) => setCashFilterEnd(e.target.value)}
                      className="border rounded px-2 py-1 text-sm"
                    />
                  </div>
                  {(cashFilterStart || cashFilterEnd) && (
                    <button
                      onClick={() => { setCashFilterStart(''); setCashFilterEnd(''); }}
                      className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
                    >
                      Clear Dates
                    </button>
                  )}
                  <button
                    onClick={exportCashCollectionsToExcel}
                    className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 text-sm"
                  >
                    <Download size={16} /> {!isMobile && 'Export Excel'}
                  </button>
                  <button
                    onClick={exportCashCollectionsToPDF}
                    className="flex items-center gap-2 bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 text-sm"
                  >
                    <FileDown size={16} /> {!isMobile && 'Export PDF'}
                  </button>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap items-center mb-3">
                <input
                  type="text"
                  placeholder="Search by bank, reference or notes..."
                  value={cashSearch}
                  onChange={(e) => setCashSearch(e.target.value)}
                  className="border rounded px-3 py-1.5 text-sm w-56"
                />
                {(cashSearch) && (
                  <button
                    onClick={() => setCashSearch('')}
                    className="px-2 py-1 text-sm text-gray-500 hover:text-gray-700 underline"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="overflow-x-auto -mx-6 px-6">
                <table className="min-w-full border-collapse">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border px-4 py-2 text-left whitespace-nowrap">Collection Date</th>
                      <th className="border px-4 py-2 text-left whitespace-nowrap">Bank Account</th>
                      <th className="border px-4 py-2 text-left whitespace-nowrap">Deposit Ref.</th>
                      <th className="border px-4 py-2 text-right whitespace-nowrap">Orders</th>
                      <th className="border px-4 py-2 text-right whitespace-nowrap">Amount</th>
                      <th className="border px-4 py-2 text-left whitespace-nowrap">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCashCollections.map((entry) => (
                      <tr key={entry.id} className="border-b hover:bg-gray-50">
                        <td className="border px-4 py-2">{toDateLabel(entry.collectionDate)}</td>
                        <td className="border px-4 py-2">{entry.bankAccount}</td>
                        <td className="border px-4 py-2">{entry.depositReference}</td>
                        <td className="border px-4 py-2 text-right">{entry.ordersCount}</td>
                        <td className="border px-4 py-2 text-right font-semibold text-emerald-600">{entry.totalAmount.toFixed(2)}</td>
                        <td className="border px-4 py-2">{entry.notes || '-'}</td>
                      </tr>
                    ))}
                    {filteredCashCollections.length === 0 && (
                      <tr>
                        <td colSpan={6} className="border px-4 py-6 text-center text-gray-500">
                          {cashCollections.length === 0
                            ? 'No cash collections found. Create collections from the Cash Collection page.'
                            : 'No records match the selected filters.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-gray-100 font-bold">
                    <tr>
                      <td className="border px-4 py-3" colSpan={3}>TOTAL</td>
                      <td className="border px-4 py-3 text-right">
                        {filteredCashCollections.reduce((sum, e) => sum + e.ordersCount, 0)}
                      </td>
                      <td className="border px-4 py-3 text-right text-emerald-600">
                        {filteredCashCollections.reduce((sum, e) => sum + e.totalAmount, 0).toFixed(2)}
                      </td>
                      <td className="border px-4 py-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'payments' && (
            <div>
              <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
                <h2 className="text-xl font-semibold">Account Payments</h2>
                <div className="flex gap-2 flex-wrap items-center">
                  <div className="flex gap-2 items-center">
                    <label className="text-sm text-gray-600">From:</label>
                    <input
                      type="date"
                      value={paymentFilterStart}
                      onChange={(e) => setPaymentFilterStart(e.target.value)}
                      className="border rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="flex gap-2 items-center">
                    <label className="text-sm text-gray-600">To:</label>
                    <input
                      type="date"
                      value={paymentFilterEnd}
                      onChange={(e) => setPaymentFilterEnd(e.target.value)}
                      className="border rounded px-2 py-1 text-sm"
                    />
                  </div>
                  {(paymentFilterStart || paymentFilterEnd) && (
                    <button
                      onClick={() => { setPaymentFilterStart(''); setPaymentFilterEnd(''); }}
                      className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
                    >
                      Clear Dates
                    </button>
                  )}
                  <button
                    onClick={exportPaymentsToExcel}
                    className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 text-sm"
                  >
                    <Download size={16} /> {!isMobile && 'Export Excel'}
                  </button>
                  <button
                    onClick={exportPaymentsToPDF}
                    className="flex items-center gap-2 bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 text-sm"
                  >
                    <FileDown size={16} /> {!isMobile && 'Export PDF'}
                  </button>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap items-center mb-3">
                <input
                  type="text"
                  placeholder="Search by account, method or notes..."
                  value={paymentSearch}
                  onChange={(e) => setPaymentSearch(e.target.value)}
                  className="border rounded px-3 py-1.5 text-sm w-56"
                />
                <div className="flex gap-1">
                  {(['all', 'in', 'out'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setPaymentDirectionFilter(f)}
                      className={`px-3 py-1 text-sm rounded border ${
                        paymentDirectionFilter === f
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {f === 'all' ? 'All' : f === 'in' ? 'Received' : 'Paid'}
                    </button>
                  ))}
                </div>
                {(paymentSearch || paymentDirectionFilter !== 'all') && (
                  <button
                    onClick={() => { setPaymentSearch(''); setPaymentDirectionFilter('all'); }}
                    className="px-2 py-1 text-sm text-gray-500 hover:text-gray-700 underline"
                  >
                    Clear
                  </button>
                )}
              </div>
              {filteredPayments.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-lg">No payments recorded yet.</p>
                  <p className="text-sm mt-1">Use the buttons above or the "+ Payment" button on any customer/supplier row.</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-6 px-6">
                  <table className="min-w-full border-collapse">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="border px-3 py-2 text-left text-xs">Date</th>
                        <th className="border px-3 py-2 text-left text-xs">Account</th>
                        <th className="border px-3 py-2 text-left text-xs">Type</th>
                        <th className="border px-3 py-2 text-left text-xs">Direction</th>
                        <th className="border px-3 py-2 text-left text-xs">Method</th>
                        <th className="border px-3 py-2 text-right text-xs">Amount</th>
                        <th className="border px-3 py-2 text-left text-xs">Notes</th>
                        <th className="border px-3 py-2 text-center text-xs">Receipt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPayments.map(p => (
                        <tr key={p.id} className="border-b hover:bg-gray-50">
                          <td className="border px-3 py-2 text-sm">{p.date}</td>
                          <td className="border px-3 py-2 text-sm font-medium">{p.accountName}</td>
                          <td className="border px-3 py-2 text-sm">
                            <span className={`px-2 py-0.5 rounded text-xs ${p.accountType === 'customer' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                              {p.accountType}
                            </span>
                          </td>
                          <td className="border px-3 py-2 text-sm">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${p.direction === 'in' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                              {p.direction === 'in' ? '↓ Received' : '↑ Paid Out'}
                            </span>
                          </td>
                          <td className="border px-3 py-2 text-sm capitalize">{p.method}</td>
                          <td className="border px-3 py-2 text-right font-bold text-green-700">{p.amount.toFixed(2)}</td>
                          <td className="border px-3 py-2 text-sm text-gray-500">{p.notes || '-'}</td>
                          <td className="border px-3 py-2 text-center">
                            <button
                              onClick={() => generatePaymentReceipt({
                                id: p.id,
                                accountName: p.accountName,
                                accountType: p.accountType,
                                direction: p.direction,
                                amount: p.amount,
                                date: p.date,
                                method: p.method,
                                notes: p.notes,
                              })}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                            >
                              <FileDown size={12} /> PDF
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-100 font-bold">
                      <tr>
                        <td colSpan={5} className="border px-3 py-3">TOTAL</td>
                        <td className="border px-3 py-3 text-right text-green-700">{filteredPayments.reduce((s, p) => s + p.amount, 0).toFixed(2)}</td>
                        <td className="border px-3 py-3"></td>
                        <td className="border px-3 py-3"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Payment Entry Modal */}
      {paymentModal && (
        <Dialog open={!!paymentModal} onOpenChange={() => setPaymentModal(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {paymentModal.direction === 'in' ? 'Payment In — Received from Customer' : 'Payment Out — Paid to Supplier'}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              {/* Account picker (show when opened from Payments tab with no pre-selected account) */}
              {paymentModal.accountId === '' ? (
                <div>
                  <label className="text-sm font-medium block mb-1">
                    {paymentModal.accountType === 'customer' ? 'Select Customer' : 'Select Supplier'}
                  </label>
                  <select
                    className="w-full border rounded px-3 py-2 text-sm"
                    onChange={e => {
                      const name = e.target.options[e.target.selectedIndex].text;
                      setPaymentModal(m => m ? { ...m, accountId: e.target.value, accountName: name } : m);
                    }}
                  >
                    <option value="">-- Select --</option>
                    {paymentModal.accountType === 'customer'
                      ? customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                      : suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                    }
                  </select>
                </div>
              ) : (
                <div className="p-3 bg-gray-50 rounded">
                  <span className="text-sm text-gray-500">Account: </span>
                  <span className="font-semibold">{paymentModal.accountName}</span>
                </div>
              )}
              <div>
                <label className="text-sm font-medium block mb-1">Amount *</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={newPayment.amount}
                  onChange={e => setNewPayment(p => ({ ...p, amount: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Date *</label>
                <input
                  type="date"
                  value={newPayment.date}
                  onChange={e => setNewPayment(p => ({ ...p, date: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Method</label>
                <select
                  value={newPayment.method}
                  onChange={e => setNewPayment(p => ({ ...p, method: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Notes</label>
                <input
                  type="text"
                  placeholder="Optional..."
                  value={newPayment.notes}
                  onChange={e => setNewPayment(p => ({ ...p, notes: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
            </div>
            <DialogFooter>
              <button
                onClick={() => setPaymentModal(null)}
                disabled={savingPayment}
                className="px-4 py-2 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAccountPayment}
                disabled={savingPayment}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {savingPayment ? 'Saving...' : 'Save Payment'}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Detailed Statement Modal */}
      {viewingDetailedStatement && detailedStatement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">Statement of Account</h2>
              <div className="flex gap-2">
                <button
                  onClick={exportDetailedStatementToPDF}
                  className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                >
                  <FileDown size={16} />
                  Export PDF
                </button>
                <button
                  onClick={() => {
                    setViewingDetailedStatement(null);
                    setDetailedStatement(null);
                  }}
                  className="text-gray-600 hover:text-gray-800 px-4 py-2"
                >
                  Close
                </button>
              </div>
            </div>
            
            <div className="p-8 bg-white">
              {/* Page Number */}
              <div className="text-sm mb-2">Page   1</div>
              
              {/* Statement Header */}
              <div className="mb-6">
                <h3 className="text-lg font-bold">STATEMENT OF ACCOUNT AS AT {detailedStatement.asOfDate}</h3>
              </div>
              
              {/* Account Details */}
              <div className="mb-6 space-y-1 text-sm">
                <div className="flex">
                  <span className="w-24">A/c No.</span>
                  <span className="font-medium">{detailedStatement.accountNo}</span>
                </div>
                <div className="flex">
                  <span className="w-24">A/c name:</span>
                  <span className="font-medium">{detailedStatement.accountName}</span>
                </div>
                <div className="flex">
                  <span className="w-24">Attn:</span>
                  <span className="font-medium">{detailedStatement.attn || ''}</span>
                </div>
                <div className="flex">
                  <span className="w-24">Phone #</span>
                  <span className="font-medium">{detailedStatement.phone || ''}</span>
                </div>
                <div className="flex">
                  <span className="w-24">Currency</span>
                  <span className="font-medium">{detailedStatement.currency}</span>
                </div>
              </div>
              
              {/* Transactions Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b-2 border-black">
                      <th className="px-2 py-1 text-left text-xs font-bold">Date</th>
                      <th className="px-2 py-1 text-left text-xs font-bold">Ref.</th>
                      <th className="px-2 py-1 text-left text-xs font-bold">Description</th>
                      <th className="px-2 py-1 text-right text-xs font-bold">Debit</th>
                      <th className="px-2 py-1 text-right text-xs font-bold">Net</th>
                      <th className="px-2 py-1 text-right text-xs font-bold">VAT</th>
                      <th className="px-2 py-1 text-right text-xs font-bold">Credit</th>
                      <th className="px-2 py-1 text-right text-xs font-bold">Balance</th>
                      <th className="px-2 py-1 text-right text-xs font-bold">VAT LL</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {detailedStatement.openingBalance !== 0 && (
                      <tr>
                        <td className="px-2 py-1">{detailedStatement.transactions[0]?.date || '01/01/2026'}</td>
                        <td className="px-2 py-1">JVO00000001</td>
                        <td className="px-2 py-1">Brought forward year</td>
                        <td className="px-2 py-1 text-right"></td>
                        <td className="px-2 py-1 text-right"></td>
                        <td className="px-2 py-1 text-right"></td>
                        <td className="px-2 py-1 text-right"></td>
                        <td className="px-2 py-1 text-right font-semibold">{Math.abs(detailedStatement.openingBalance).toFixed(2)}</td>
                        <td className="px-2 py-1 text-right"></td>
                      </tr>
                    )}
                    {detailedStatement.transactions.map((txn, idx) => (
                      <tr key={idx}>
                        <td className="px-2 py-1 whitespace-nowrap">{txn.date}</td>
                        <td className="px-2 py-1">{txn.ref}</td>
                        <td className="px-2 py-1">{txn.description}</td>
                        <td className="px-2 py-1 text-right">{txn.debit > 0 ? txn.debit.toFixed(2) : ''}</td>
                        <td className="px-2 py-1 text-right">{txn.netVat > 0 ? txn.netVat.toFixed(2) : ''}</td>
                        <td className="px-2 py-1 text-right"></td>
                        <td className="px-2 py-1 text-right">{txn.credit > 0 ? txn.credit.toFixed(2) : ''}</td>
                        <td className="px-2 py-1 text-right font-semibold">{txn.balance.toFixed(2)}</td>
                        <td className="px-2 py-1 text-right">{txn.vatLL > 0 ? txn.vatLL.toFixed(2) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-black font-bold">
                      <td colSpan={3} className="px-2 py-2">Total</td>
                      <td className="px-2 py-2 text-right">
                        {detailedStatement.transactions.reduce((sum, t) => sum + t.debit, 0).toFixed(2)}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {detailedStatement.transactions.reduce((sum, t) => sum + t.netVat, 0).toFixed(2)}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {detailedStatement.transactions.reduce((sum, t) => sum + t.vatLL, 0).toFixed(2)}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {detailedStatement.transactions.reduce((sum, t) => sum + t.credit, 0).toFixed(2)}
                      </td>
                      <td className="px-2 py-2 text-right">{Math.abs(detailedStatement.closingBalance).toFixed(2)}</td>
                      <td className="px-2 py-2 text-right"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              
              {/* Footer */}
              <div className="mt-6 space-y-3 text-sm">
                <p className="font-medium">
                  {detailedStatement.closingBalance > 0 
                    ? 'Balance in our favour'
                    : 'Balance in your favour'
                  }
                </p>
                <p className="text-xs uppercase">
                  ONLY {Math.abs(detailedStatement.closingBalance).toFixed(2)} US DOLLAR .
                </p>
                <div className="mt-6 pt-4">
                  <p className="text-xs">Accounts dept. _________________</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminPageShell>
  );
};

export default AdminAccountStatement;
