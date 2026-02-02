import React, { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { FileDown, Download, ArrowLeft } from 'lucide-react';
import { exportToCSV } from '@/lib/exportUtils';
import jsPDF from 'jspdf';
import { useNavigate } from 'react-router-dom';
import MobileHeader from '@/components/MobileHeader';
import BackButton from '@/components/BackButton';
import { useIsMobile } from '@/hooks/use-mobile';

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
  date: string;
  supplier: string;
  amount: number;
  amountPaid: number;
  status: string;
  items: any[];
  invoiceNumber?: string;
}

interface ExpenseRecord {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod?: string;
  reference?: string;
}

interface SalesRecord {
  id: string;
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
  const [activeTab, setActiveTab] = useState<'customers' | 'suppliers' | 'products' | 'purchases' | 'expenses' | 'sales'>('customers');
  const [loading, setLoading] = useState(true);
  
  const [customers, setCustomers] = useState<CustomerBalance[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierBalance[]>([]);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [sales, setSales] = useState<SalesRecord[]>([]);
  
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalPurchases, setTotalPurchases] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [customerBalances, setCustomerBalances] = useState(0);
  const [netBalance, setNetBalance] = useState(0);
  
  const [viewingDetailedStatement, setViewingDetailedStatement] = useState<{ type: 'supplier' | 'customer', id: string, name: string } | null>(null);
  const [detailedStatement, setDetailedStatement] = useState<DetailedStatement | null>(null);
  
  // Date filters
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  useEffect(() => {
    if (user?.storeId) {
      fetchAllData();
    } else {
      setLoading(false);
    }
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
        fetchSales()
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
        const customerId = order.customerId || 'Walk-in';
        const customerName = order.customerName || 'Walk-in Customer';
        const total = order.total || 0;
        // Use ONLY paymentStatus to determine if order is paid
        const paid = order.paymentStatus === 'paid' ? total : 0;
        
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
        const paid = purchase.amountPaid || purchase.paid || 0;
        
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
      console.log('Processing supplier returns, count:', returnsSnapshot.size);
      returnsSnapshot.forEach(doc => {
        const returnDoc = doc.data();
        const purchaseId = returnDoc.purchaseId || returnDoc.originalPurchaseId;
        
        // Only count returns that reference valid purchases
        if (!purchaseId || !validPurchaseIds.has(purchaseId)) {
          console.log('Skipping orphaned return:', doc.id, 'purchaseId:', purchaseId);
          return;
        }
        
        const supplierId = returnDoc.supplierId || 'unknown';
        const creditAmount = returnDoc.creditIssued || returnDoc.totalClaimAmount || 0;
        
        console.log('Return doc:', {
          id: doc.id,
          supplierId,
          creditAmount,
          purchaseId,
          status: returnDoc.status,
          hasSupplier: supplierMap.has(supplierId)
        });
        
        if (supplierMap.has(supplierId)) {
          const supplier = supplierMap.get(supplierId)!;
          console.log('Before credit:', supplier.name, 'totalPayments:', supplier.totalPayments);
          // Add credit to payments (returns reduce what we owe, like making a payment)
          supplier.totalPayments += creditAmount;
          supplier.balance = supplier.totalPurchases - supplier.totalPayments;
          console.log('After credit:', supplier.name, 'totalPayments:', supplier.totalPayments);
        } else {
          console.warn('Supplier not found in map:', supplierId);
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
      
      // Add orders data
      ordersSnapshot.forEach(doc => {
        const order = doc.data();
        const items = order.items || [];
        
        // Calculate discount per item proportionally
        const orderSubtotal = order.subtotal || order.total || 0;
        const orderDiscount = order.discountAmount || 0;
        
        items.forEach((item: any) => {
          const productId = item.productId || item.id;
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
        let dateStr = 'N/A';
        if (purchase.date) {
          dateStr = purchase.date;
        } else if (purchase.createdAt) {
          if (typeof purchase.createdAt === 'string') {
            dateStr = purchase.createdAt;
          } else if (purchase.createdAt.toDate) {
            dateStr = purchase.createdAt.toDate().toLocaleDateString();
          }
        }
        
        const supplierName = suppliersData.get(purchase.supplierId) || purchase.supplierName || 'Unknown';
        
        purchasesList.push({
          id: doc.id,
          date: dateStr,
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
      
      ordersSnapshot.forEach(doc => {
        const order = doc.data();
        
        // Skip cancelled orders
        if (order.status === 'cancelled') {
          return;
        }
        
        let dateStr = 'N/A';
        if (order.createdAt) {
          if (typeof order.createdAt === 'string') {
            dateStr = order.createdAt.split('T')[0];
          } else if (order.createdAt.toDate) {
            dateStr = order.createdAt.toDate().toLocaleDateString();
          }
        }
        
        salesList.push({
          id: doc.id,
          date: dateStr,
          customer: order.customerName || 'Walk-in Customer',
          invoiceNumber: order.invoiceNumber,
          total: order.total || 0,
          subtotal: order.subtotal || order.total || 0,
          discountAmount: order.discountAmount || 0,
          amountPaid: order.paymentStatus === 'paid' ? (order.total || 0) : (order.amountPaid || 0),
          taxAmount: order.taxAmount || 0,
          status: order.status || 'pending',
          paymentStatus: order.paymentStatus || 'unpaid'
        });
        total += order.total || 0;
      });
      
      setSales(salesList);
      setTotalSales(total);
    } catch (error) {
      console.error('Error fetching sales:', error);
    }
  };

  useEffect(() => {
    const supplierBalance = suppliers.reduce((sum, s) => sum + s.balance, 0);
    const net = customerBalances - supplierBalance - totalExpenses;
    setNetBalance(net);
  }, [customerBalances, suppliers, totalExpenses]);

  const generateDetailedStatement = async (type: 'supplier' | 'customer', id: string, name: string) => {
    if (!user?.storeId) return;
    
    try {
      const db = getFirestore();
      const transactions: DetailedTransaction[] = [];
      let runningBalance = 0;
      
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
        
        // Collect all transactions
        const allTxns: any[] = [];
        
        // First collect all valid purchase IDs
        const validPurchaseIds = new Set<string>();
        purchasesSnap.forEach(doc => {
          validPurchaseIds.add(doc.id);
        });
        
        purchasesSnap.forEach(doc => {
          const purchase = doc.data();
          const total = purchase.totalCost || purchase.total || 0;
          const subtotal = purchase.subtotal || total; // Use total if no subtotal (no VAT applied)
          const vat = purchase.vat || (total - subtotal);
          
          allTxns.push({
            date: purchase.date || purchase.createdAt || '',
            type: 'purchase',
            ref: purchase.invoiceNumber || doc.id.substring(0, 8),
            description: `Pur.Inv.${purchase.invoiceNumber || doc.id.substring(0, 6)}`,
            debit: purchase.amountPaid || 0,  // Payment reduces the balance (debit)
            net: subtotal,
            vat: vat,
            credit: total,  // Purchase increases what we owe (credit)
            data: purchase
          });
        });
        
        returnsSnap.forEach(doc => {
          const returnDoc = doc.data();
          const purchaseId = returnDoc.purchaseId || returnDoc.originalPurchaseId;
          
          // Skip orphaned returns (returns without valid purchase references)
          if (!purchaseId || !validPurchaseIds.has(purchaseId)) {
            console.log('Skipping orphaned return in detailed statement:', doc.id, 'purchaseId:', purchaseId);
            return;
          }
          
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
            date: new Date(txn.date).toLocaleDateString('en-GB'),
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
        
        // Fetch all sales returns for this customer
        const returnsQuery = query(
          collection(db, 'salesReturns'),
          where('storeId', '==', user.storeId),
          where('customerId', '==', id),
          where('status', '==', 'completed')
        );
        const returnsSnap = await getDocs(returnsQuery);
        
        // Collect all transactions
        const allTxns: any[] = [];
        
        ordersSnap.forEach(doc => {
          const order = doc.data();
          
          // Skip cancelled orders
          if (order.status === 'cancelled') {
            return;
          }
          
          const total = order.totalAmount || order.total || 0;
          const subtotal = order.subtotal || total; // Use total if no subtotal (no VAT applied)
          const vat = order.vat || (total - subtotal);
          
          allTxns.push({
            date: order.createdAt || order.date || '',
            type: 'order',
            ref: order.invoiceNumber || order.orderNumber || doc.id.substring(0, 8),
            description: `Sales Inv.${order.invoiceNumber || doc.id.substring(0, 6)}`,
            debit: total,
            net: subtotal,
            vat: vat,
            credit: order.amountPaid || 0,
            data: order
          });
        });
        
        returnsSnap.forEach(doc => {
          const returnDoc = doc.data();
          const creditAmount = returnDoc.refundAmount || returnDoc.subtotal || 0;
          
          allTxns.push({
            date: returnDoc.returnDate || returnDoc.date || returnDoc.createdAt || '',
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
            date: new Date(txn.date).toLocaleDateString('en-GB'),
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
        accountNo: id.substring(0, 8).toUpperCase(),
        accountName: name,
        currency: 'US',
        asOfDate: new Date().toLocaleDateString('en-GB'),
        phone: '',
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

  const exportDetailedStatementToPDF = () => {
    if (!detailedStatement) return;
    
    const doc = new jsPDF();
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
    doc.text(detailedStatement.accountName, 50, y);
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
      doc.text(txn.description.substring(0, 20), 65, y);
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

  const exportCustomersToExcel = () => {
    const data: any[] = [];
    
    // Add header rows
    data.push({ 'Customer Name': 'CUSTOMER BALANCES STATEMENT', 'Total Purchases': '', 'Total Payments': '', 'Balance': '' });
    if (filterStartDate || filterEndDate) {
      const startDisplay = filterStartDate ? new Date(filterStartDate).toLocaleDateString('en-GB') : 'Beginning';
      const endDisplay = filterEndDate ? new Date(filterEndDate).toLocaleDateString('en-GB') : 'Present';
      data.push({ 'Customer Name': `Period from ${startDisplay} to ${endDisplay}`, 'Total Purchases': '', 'Total Payments': '', 'Balance': '' });
    }
    data.push({ 'Customer Name': `Generated: ${new Date().toLocaleDateString('en-GB')}`, 'Total Payments': '', 'Total Purchases': '', 'Balance': '' });
    data.push({ 'Customer Name': '', 'Total Purchases': '', 'Total Payments': '', 'Balance': '' });
    
    // Add column headers
    data.push({ 'Customer Name': 'Customer Name', 'Total Purchases': 'Total Purchases', 'Total Payments': 'Total Payments', 'Balance': 'Balance' });
    
    // Add customer data
    customers.forEach(c => {
      data.push({
        'Customer Name': c.name,
        'Total Purchases': c.totalPurchases.toFixed(2),
        'Total Payments': c.totalPayments.toFixed(2),
        'Balance': c.balance.toFixed(2)
      });
    });
    
    // Add empty row before totals
    data.push({ 'Customer Name': '', 'Total Purchases': '', 'Total Payments': '', 'Balance': '' });
    
    // Add total row
    const totalPurchases = customers.reduce((sum, c) => sum + c.totalPurchases, 0);
    const totalPayments = customers.reduce((sum, c) => sum + c.totalPayments, 0);
    const totalBalance = customers.reduce((sum, c) => sum + c.balance, 0);
    data.push({
      'Customer Name': 'TOTAL',
      'Total Purchases': totalPurchases.toFixed(2),
      'Total Payments': totalPayments.toFixed(2),
      'Balance': totalBalance.toFixed(2)
    });
    
    exportToCSV(data, 'customers_statement.csv');
  };

  const exportSuppliersToExcel = () => {
    const data: any[] = [];
    
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
    suppliers.forEach(s => {
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
    const totalPurchases = suppliers.reduce((sum, s) => sum + s.totalPurchases, 0);
    const totalPayments = suppliers.reduce((sum, s) => sum + s.totalPayments, 0);
    const totalBalance = suppliers.reduce((sum, s) => sum + s.balance, 0);
    data.push({
      'Supplier Name': 'TOTAL',
      'Total Purchases': totalPurchases.toFixed(2),
      'Total Payments': totalPayments.toFixed(2),
      'Balance Due': totalBalance.toFixed(2)
    });
    
    exportToCSV(data, 'suppliers_statement.csv');
  };

  const exportProductsToExcel = () => {
    const data: any[] = [];
    
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
    const groupedProducts = products.reduce((acc, p) => {
      const category = p.category || 'Uncategorized';
      if (!acc[category]) acc[category] = [];
      acc[category].push(p);
      return acc;
    }, {} as Record<string, typeof products>);
    
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
    const data: any[] = [];
    
    // Add header rows
    data.push({ 'Date': 'PURCHASE HISTORY REPORT', 'Supplier': '', 'Amount': '', 'Status': '' });
    if (filterStartDate || filterEndDate) {
      const startDisplay = filterStartDate ? new Date(filterStartDate).toLocaleDateString('en-GB') : 'Beginning';
      const endDisplay = filterEndDate ? new Date(filterEndDate).toLocaleDateString('en-GB') : 'Present';
      data.push({ 'Date': `Period from ${startDisplay} to ${endDisplay}`, 'Supplier': '', 'Amount': '', 'Status': '' });
    }
    data.push({ 'Date': `Generated: ${new Date().toLocaleDateString('en-GB')}`, 'Supplier': '', 'Amount': '', 'Status': '' });
    data.push({ 'Date': '', 'Supplier': '', 'Amount': '', 'Status': '' });
    
    // Group purchases by supplier
    const groupedPurchases = purchases.reduce((acc, p) => {
      const supplier = p.supplier || 'Unknown Supplier';
      if (!acc[supplier]) acc[supplier] = [];
      acc[supplier].push(p);
      return acc;
    }, {} as Record<string, typeof purchases>);
    
    const sortedSuppliers = Object.keys(groupedPurchases).sort();
    
    let grandTotal = 0;
    
    sortedSuppliers.forEach(supplier => {
      // Supplier header
      data.push({ 'Date': '', 'Supplier': '', 'Amount': '', 'Status': '' });
      data.push({ 'Date': `SUPPLIER: ${supplier.toUpperCase()}`, 'Supplier': '', 'Amount': '', 'Status': '' });
      data.push({ 'Date': 'Date', 'Supplier': 'Supplier', 'Amount': 'Amount', 'Status': 'Status' });
      
      let supplierTotal = 0;
      
      groupedPurchases[supplier].forEach(p => {
        data.push({
          'Date': p.date,
          'Supplier': p.supplier,
          'Amount': p.amount.toFixed(2),
          'Status': p.status
        });
        supplierTotal += p.amount;
      });
      
      // Supplier subtotal
      data.push({ 'Date': '', 'Supplier': '', 'Amount': '', 'Status': '' });
      data.push({
        'Date': '',
        'Supplier': `SUBTOTAL - ${supplier}`,
        'Amount': supplierTotal.toFixed(2),
        'Status': ''
      });
      
      grandTotal += supplierTotal;
    });
    
    // Grand total
    data.push({ 'Date': '', 'Supplier': '', 'Amount': '', 'Status': '' });
    data.push({ 'Date': '', 'Supplier': '', 'Amount': '', 'Status': '' });
    data.push({
      'Date': '',
      'Supplier': 'GRAND TOTAL',
      'Amount': grandTotal.toFixed(2),
      'Status': ''
    });
    
    exportToCSV(data, 'purchases_statement.csv');
  };

  const exportExpensesToExcel = () => {
    const data: any[] = [];
    
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
    const groupedExpenses = expenses.reduce((acc, e) => {
      const category = e.category || 'Uncategorized';
      if (!acc[category]) acc[category] = [];
      acc[category].push(e);
      return acc;
    }, {} as Record<string, typeof expenses>);
    
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
      return matchesStart && matchesEnd;
    });

    // Add header rows with title and date range
    const data: any[] = [];
    data.push({ 'Date': 'SALES HISTORY REPORT', 'Invoice': '', 'Customer': '', 'Subtotal': '', 'Discount': '', 'Total': '', 'Paid': '', 'Balance': '', 'Status': '' });
    if (filterStartDate || filterEndDate) {
      const startDisplay = filterStartDate ? new Date(filterStartDate).toLocaleDateString('en-GB') : 'Beginning';
      const endDisplay = filterEndDate ? new Date(filterEndDate).toLocaleDateString('en-GB') : 'Present';
      data.push({ 'Date': `Period from ${startDisplay} to ${endDisplay}`, 'Invoice': '', 'Customer': '', 'Subtotal': '', 'Discount': '', 'Total': '', 'Paid': '', 'Balance': '', 'Status': '' });
    }
    data.push({ 'Date': `Generated: ${new Date().toLocaleDateString('en-GB')}`, 'Invoice': '', 'Customer': '', 'Subtotal': '', 'Discount': '', 'Total': '', 'Paid': '', 'Balance': '', 'Status': '' });
    data.push({ 'Date': '', 'Invoice': '', 'Customer': '', 'Subtotal': '', 'Discount': '', 'Total': '', 'Paid': '', 'Balance': '', 'Status': '' });
    
    // Group sales by customer
    const groupedSales = filteredSales.reduce((acc, s) => {
      const customer = s.customer || 'Unknown Customer';
      if (!acc[customer]) acc[customer] = [];
      acc[customer].push(s);
      return acc;
    }, {} as Record<string, typeof filteredSales>);
    
    const sortedCustomers = Object.keys(groupedSales).sort();
    
    let grandTotalSubtotal = 0;
    let grandTotalDiscount = 0;
    let grandTotalAmount = 0;
    let grandTotalPaid = 0;
    let grandTotalBalance = 0;
    
    sortedCustomers.forEach(customer => {
      // Customer header
      data.push({ 'Date': '', 'Invoice': '', 'Customer': '', 'Subtotal': '', 'Discount': '', 'Total': '', 'Paid': '', 'Balance': '', 'Status': '' });
      data.push({ 'Date': `CLIENT: ${customer.toUpperCase()}`, 'Invoice': '', 'Customer': '', 'Subtotal': '', 'Discount': '', 'Total': '', 'Paid': '', 'Balance': '', 'Status': '' });
      data.push({ 'Date': 'Date', 'Invoice': 'Invoice#', 'Customer': 'Customer', 'Subtotal': 'Subtotal', 'Discount': 'Discount', 'Total': 'Total Sales', 'Paid': 'Paid', 'Balance': 'Balance', 'Status': 'Status' });
      
      let customerSubtotal = 0;
      let customerDiscount = 0;
      let customerTotal = 0;
      let customerPaid = 0;
      let customerBalance = 0;
      
      groupedSales[customer].forEach(s => {
        data.push({
          'Date': new Date(s.date).toLocaleDateString('en-GB'),
          'Invoice': s.invoiceNumber || '-',
          'Customer': s.customer,
          'Subtotal': (s.subtotal || s.total).toFixed(2),
          'Discount': (s.discountAmount || 0).toFixed(2),
          'Total': s.total.toFixed(2),
          'Paid': s.amountPaid.toFixed(2),
          'Balance': (s.total - s.amountPaid).toFixed(2),
          'Status': s.paymentStatus || 'unpaid'
        });
        
        customerSubtotal += (s.subtotal || s.total);
        customerDiscount += (s.discountAmount || 0);
        customerTotal += s.total;
        customerPaid += s.amountPaid;
        customerBalance += (s.total - s.amountPaid);
      });
      
      // Customer subtotal
      data.push({ 'Date': '', 'Invoice': '', 'Customer': '', 'Subtotal': '', 'Discount': '', 'Total': '', 'Paid': '', 'Balance': '', 'Status': '' });
      data.push({
        'Date': '',
        'Invoice': '',
        'Customer': `SUBTOTAL - ${customer}`,
        'Subtotal': customerSubtotal.toFixed(2),
        'Discount': customerDiscount.toFixed(2),
        'Total': customerTotal.toFixed(2),
        'Paid': customerPaid.toFixed(2),
        'Balance': customerBalance.toFixed(2),
        'Status': ''
      });
      
      grandTotalSubtotal += customerSubtotal;
      grandTotalDiscount += customerDiscount;
      grandTotalAmount += customerTotal;
      grandTotalPaid += customerPaid;
      grandTotalBalance += customerBalance;
    });
    
    // Grand total
    data.push({ 'Date': '', 'Invoice': '', 'Customer': '', 'Subtotal': '', 'Discount': '', 'Total': '', 'Paid': '', 'Balance': '', 'Status': '' });
    data.push({ 'Date': '', 'Invoice': '', 'Customer': '', 'Subtotal': '', 'Discount': '', 'Total': '', 'Paid': '', 'Balance': '', 'Status': '' });
    data.push({
      'Date': '',
      'Invoice': '',
      'Customer': 'GRAND TOTAL',
      'Subtotal': grandTotalSubtotal.toFixed(2),
      'Discount': grandTotalDiscount.toFixed(2),
      'Total': grandTotalAmount.toFixed(2),
      'Paid': grandTotalPaid.toFixed(2),
      'Balance': grandTotalBalance.toFixed(2),
      'Status': ''
    });
    
    exportToCSV(data, 'sales_history.csv');
  };

  const exportSalesToPDF = () => {
    const filteredSales = sales.filter(sale => {
      const saleDate = new Date(sale.date).toISOString().split('T')[0];
      const matchesStart = !filterStartDate || saleDate >= filterStartDate;
      const matchesEnd = !filterEndDate || saleDate <= filterEndDate;
      return matchesStart && matchesEnd;
    });

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('SALES HISTORY REPORT', 105, 15, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    if (filterStartDate || filterEndDate) {
      const startDisplay = filterStartDate ? new Date(filterStartDate).toLocaleDateString('en-GB') : 'Beginning';
      const endDisplay = filterEndDate ? new Date(filterEndDate).toLocaleDateString('en-GB') : 'Present';
      doc.text(`Period from ${startDisplay} to ${endDisplay}`, 105, 22, { align: 'center' });
    }
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`, 105, 27, { align: 'center' });
    
    // Group sales by customer
    const groupedSales = filteredSales.reduce((acc, s) => {
      const customer = s.customer || 'Unknown Customer';
      if (!acc[customer]) acc[customer] = [];
      acc[customer].push(s);
      return acc;
    }, {} as Record<string, typeof filteredSales>);
    
    const sortedCustomers = Object.keys(groupedSales).sort();
    
    let y = 35;
    let grandTotalDiscount = 0;
    let grandTotal = 0;
    let grandTotalPaid = 0;
    let grandTotalBalance = 0;
    
    sortedCustomers.forEach((customer, idx) => {
      if (idx > 0 && y > 240) {
        doc.addPage();
        y = 20;
      }
      
      // Customer header
      if (y > 35) y += 5;
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text(`CLIENT: ${customer.toUpperCase()}`, 14, y);
      y += 5;
      
      // Column headers
      doc.setFontSize(8);
      doc.setFont(undefined, 'bold');
      doc.text('Date', 14, y);
      doc.text('Invoice', 35, y);
      doc.text('Discount', 85, y, { align: 'right' });
      doc.text('Total', 115, y, { align: 'right' });
      doc.text('Paid', 145, y, { align: 'right' });
      doc.text('Balance', 175, y, { align: 'right' });
      doc.text('Status', 200, y, { align: 'right' });
      y += 2;
      doc.line(14, y, 200, y);
      y += 4;
      
      let customerDiscount = 0;
      let customerTotal = 0;
      let customerPaid = 0;
      let customerBalance = 0;
      
      doc.setFontSize(7);
      doc.setFont(undefined, 'normal');
      groupedSales[customer].forEach(sale => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(new Date(sale.date).toLocaleDateString('en-GB'), 14, y);
        doc.text(sale.invoiceNumber || '-', 35, y);
        doc.text(`$${(sale.discountAmount || 0).toFixed(2)}`, 85, y, { align: 'right' });
        doc.text(`$${sale.total.toFixed(2)}`, 115, y, { align: 'right' });
        doc.text(`$${sale.amountPaid.toFixed(2)}`, 145, y, { align: 'right' });
        doc.text(`$${(sale.total - sale.amountPaid).toFixed(2)}`, 175, y, { align: 'right' });
        doc.text((sale.paymentStatus || 'unpaid').substring(0, 8), 200, y, { align: 'right' });
        y += 5;
        
        customerDiscount += (sale.discountAmount || 0);
        customerTotal += sale.total;
        customerPaid += sale.amountPaid;
        customerBalance += (sale.total - sale.amountPaid);
      });
      
      // Customer subtotal
      y += 1;
      doc.line(14, y, 200, y);
      y += 4;
      doc.setFontSize(8);
      doc.setFont(undefined, 'bold');
      doc.text(`SUBTOTAL - ${customer}`, 14, y);
      doc.text(`$${customerDiscount.toFixed(2)}`, 85, y, { align: 'right' });
      doc.text(`$${customerTotal.toFixed(2)}`, 115, y, { align: 'right' });
      doc.text(`$${customerPaid.toFixed(2)}`, 145, y, { align: 'right' });
      doc.text(`$${customerBalance.toFixed(2)}`, 175, y, { align: 'right' });
      y += 7;
      
      grandTotalDiscount += customerDiscount;
      grandTotal += customerTotal;
      grandTotalPaid += customerPaid;
      grandTotalBalance += customerBalance;
    });
    
    // Grand total
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    y += 2;
    doc.line(14, y, 200, y);
    doc.line(14, y + 1, 200, y + 1);
    y += 5;
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text('GRAND TOTAL', 14, y);
    doc.text(`$${grandTotalDiscount.toFixed(2)}`, 85, y, { align: 'right' });
    doc.text(`$${grandTotal.toFixed(2)}`, 115, y, { align: 'right' });
    doc.text(`$${grandTotalPaid.toFixed(2)}`, 145, y, { align: 'right' });
    doc.text(`$${grandTotalBalance.toFixed(2)}`, 175, y, { align: 'right' });
    
    doc.save('sales_history.pdf');
  };

  const exportCustomersToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('CUSTOMER BALANCES STATEMENT', 105, 15, { align: 'center' });
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
    doc.text('Customer Name', 20, y);
    doc.text('Purchases', 90, y);
    doc.text('Payments', 130, y);
    doc.text('Balance', 170, y);
    y += 5;
    doc.line(20, y, 190, y);
    y += 7;
    
    doc.setFontSize(10);
    customers.forEach(customer => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(customer.name.substring(0, 30), 20, y);
      doc.text(`$${customer.totalPurchases.toFixed(2)}`, 90, y);
      doc.text(`$${customer.totalPayments.toFixed(2)}`, 130, y);
      doc.text(`$${customer.balance.toFixed(2)}`, 170, y);
      y += 7;
    });
    
    // Add total row
    y += 3;
    doc.line(20, y, 190, y);
    y += 7;
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('TOTAL', 20, y);
    const totalPurchases = customers.reduce((sum, c) => sum + c.totalPurchases, 0);
    const totalPayments = customers.reduce((sum, c) => sum + c.totalPayments, 0);
    const totalBalance = customers.reduce((sum, c) => sum + c.balance, 0);
    doc.text(`$${totalPurchases.toFixed(2)}`, 90, y);
    doc.text(`$${totalPayments.toFixed(2)}`, 130, y);
    doc.text(`$${totalBalance.toFixed(2)}`, 170, y);
    
    doc.save('customers_statement.pdf');
  };

  const exportSuppliersToPDF = () => {
    const doc = new jsPDF();
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
    suppliers.forEach(supplier => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(supplier.name.substring(0, 30), 20, y);
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
    const totalPurchases = suppliers.reduce((sum, s) => sum + s.totalPurchases, 0);
    const totalPayments = suppliers.reduce((sum, s) => sum + s.totalPayments, 0);
    const totalBalance = suppliers.reduce((sum, s) => sum + s.balance, 0);
    doc.text(`$${totalPurchases.toFixed(2)}`, 90, y);
    doc.text(`$${totalPayments.toFixed(2)}`, 130, y);
    doc.text(`$${totalBalance.toFixed(2)}`, 170, y);
    
    doc.save('suppliers_statement.pdf');
  };

  const exportProductsToPDF = () => {
    const doc = new jsPDF();
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
    const groupedProducts = products.reduce((acc, p) => {
      const category = p.category || 'Uncategorized';
      if (!acc[category]) acc[category] = [];
      acc[category].push(p);
      return acc;
    }, {} as Record<string, typeof products>);
    
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
      doc.text(`GROUP: ${category.toUpperCase()}`, 20, y);
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
        doc.text(product.name.substring(0, 30), 20, y);
        doc.text(product.category.substring(0, 15), 90, y);
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
      doc.text(`SUBTOTAL - ${category}`, 20, y);
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

  const exportPurchasesToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('PURCHASE HISTORY REPORT', 105, 15, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    if (filterStartDate || filterEndDate) {
      const startDisplay = filterStartDate ? new Date(filterStartDate).toLocaleDateString('en-GB') : 'Beginning';
      const endDisplay = filterEndDate ? new Date(filterEndDate).toLocaleDateString('en-GB') : 'Present';
      doc.text(`Period from ${startDisplay} to ${endDisplay}`, 105, 22, { align: 'center' });
    }
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`, 105, 27, { align: 'center' });
    
    // Group purchases by supplier
    const groupedPurchases = purchases.reduce((acc, p) => {
      const supplier = p.supplier || 'Unknown Supplier';
      if (!acc[supplier]) acc[supplier] = [];
      acc[supplier].push(p);
      return acc;
    }, {} as Record<string, typeof purchases>);
    
    const sortedSuppliers = Object.keys(groupedPurchases).sort();
    
    let y = 35;
    let grandTotal = 0;
    
    sortedSuppliers.forEach((supplier, idx) => {
      if (idx > 0 && y > 250) {
        doc.addPage();
        y = 20;
      }
      
      // Supplier header
      if (y > 35) y += 5;
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text(`SUPPLIER: ${supplier.toUpperCase()}`, 20, y);
      y += 5;
      
      // Column headers
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.text('Date', 20, y);
      doc.text('Supplier', 60, y);
      doc.text('Amount', 140, y, { align: 'right' });
      doc.text('Status', 180, y);
      y += 2;
      doc.line(20, y, 180, y);
      y += 5;
      
      let supplierTotal = 0;
      
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      groupedPurchases[supplier].forEach(purchase => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(new Date(purchase.date).toLocaleDateString('en-GB'), 20, y);
        doc.text(purchase.supplier.substring(0, 25), 60, y);
        doc.text(`$${purchase.amount.toFixed(2)}`, 140, y, { align: 'right' });
        doc.text(purchase.status.substring(0, 10), 180, y);
        y += 5;
        
        supplierTotal += purchase.amount;
      });
      
      // Supplier subtotal
      y += 1;
      doc.line(20, y, 180, y);
      y += 4;
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.text(`SUBTOTAL - ${supplier}`, 60, y);
      doc.text(`$${supplierTotal.toFixed(2)}`, 140, y, { align: 'right' });
      y += 7;
      
      grandTotal += supplierTotal;
    });
    
    // Grand total
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    y += 2;
    doc.line(20, y, 180, y);
    doc.line(20, y + 1, 180, y + 1);
    y += 5;
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('GRAND TOTAL', 60, y);
    doc.text(`$${grandTotal.toFixed(2)}`, 140, y, { align: 'right' });
    
    doc.save('purchases_statement.pdf');
  };

  const exportExpensesToPDF = () => {
    const doc = new jsPDF();
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
    const groupedExpenses = expenses.reduce((acc, e) => {
      const category = e.category || 'Uncategorized';
      if (!acc[category]) acc[category] = [];
      acc[category].push(e);
      return acc;
    }, {} as Record<string, typeof expenses>);
    
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
      doc.text(`CATEGORY: ${category.toUpperCase()}`, 20, y);
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
        doc.text(expense.category.substring(0, 12), 50, y);
        doc.text(expense.description.substring(0, 28), 90, y);
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
      doc.text(`SUBTOTAL - ${category}`, 90, y);
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
    
    doc.save('expenses_statement.pdf');
  };

  const exportAllToExcel = () => {
    const data = [
      { Section: 'Summary', Item: 'Total Expenses', Value: `$${totalExpenses.toFixed(2)}` },
      { Section: 'Summary', Item: 'Total Purchases', Value: `$${totalPurchases.toFixed(2)}` },
      { Section: 'Summary', Item: 'Customer Balances', Value: `$${customerBalances.toFixed(2)}` },
      { Section: 'Summary', Item: 'Supplier Balances', Value: `$${suppliers.reduce((sum, s) => sum + s.balance, 0).toFixed(2)}` },
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
    ];
    exportToCSV(data, 'complete_account_statement.csv');
  };

  const exportAllToPDF = () => {
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
    doc.text(`Net Balance: $${netBalance.toFixed(2)}`, 20, y);
    
    y += 15;
    doc.setFontSize(14);
    doc.text('Top Customers', 20, y);
    y += 8;
    doc.setFontSize(10);
    customers.slice(0, 5).forEach(customer => {
      doc.text(`${customer.name}: $${customer.balance.toFixed(2)}`, 25, y);
      y += 6;
    });
    
    y += 10;
    doc.setFontSize(14);
    doc.text('Top Suppliers', 20, y);
    y += 8;
    doc.setFontSize(10);
    suppliers.slice(0, 5).forEach(supplier => {
      doc.text(`${supplier.name}: $${supplier.balance.toFixed(2)}`, 25, y);
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
      doc.text(`${product.name}: $${product.totalRevenue.toFixed(2)}`, 25, y);
      y += 6;
    });
    
    doc.save('account_statement.pdf');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        {isMobile && <MobileHeader title="Account Statement" />}
        <div className="container mx-auto p-4">
          <div className="flex justify-center items-center h-64">
            <div className="text-lg">Loading account statement...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {isMobile && <MobileHeader title="Account Statement" />}
      <div className="container mx-auto p-4">
        {!isMobile && (
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft size={20} />
              Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold">Account Statement</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportAllToExcel}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            <Download size={20} />
            Export Excel
          </button>
          <button
            onClick={exportAllToPDF}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            <FileDown size={20} />
            Export PDF
          </button>
        </div>
      </div>
        )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-gray-600">Total Sales</div>
          <div className="text-2xl font-bold text-blue-600">${totalSales.toFixed(2)}</div>
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
      </div>

      <div className="bg-white rounded shadow">
        <div className="border-b overflow-x-auto">
          <div className="flex min-w-max">
            <button
              onClick={() => setActiveTab('customers')}
              className={`px-6 py-3 font-medium whitespace-nowrap ${
                activeTab === 'customers'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Customers ({customers.length})
            </button>
            <button
              onClick={() => setActiveTab('suppliers')}
              className={`px-6 py-3 font-medium whitespace-nowrap ${
                activeTab === 'suppliers'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Suppliers ({suppliers.length})
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`px-6 py-3 font-medium whitespace-nowrap ${
                activeTab === 'products'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Products ({products.length})
            </button>
            <button
              onClick={() => setActiveTab('purchases')}
              className={`px-6 py-3 font-medium whitespace-nowrap ${
                activeTab === 'purchases'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Purchases ({purchases.length})
            </button>
            <button
              onClick={() => setActiveTab('expenses')}
              className={`px-6 py-3 font-medium whitespace-nowrap ${
                activeTab === 'expenses'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Expenses ({expenses.length})
            </button>
            <button
              onClick={() => setActiveTab('sales')}
              className={`px-6 py-3 font-medium whitespace-nowrap ${
                activeTab === 'sales'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Sales ({sales.length})
            </button>
          </div>
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
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="min-w-full border-collapse">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border px-4 py-2 text-left whitespace-nowrap">Customer Name</th>
                      <th className="border px-4 py-2 text-right whitespace-nowrap">Debit</th>
                      <th className="border px-4 py-2 text-right whitespace-nowrap">Net</th>
                      <th className="border px-4 py-2 text-right whitespace-nowrap">VAT</th>
                      <th className="border px-4 py-2 text-right whitespace-nowrap">Credit</th>
                      <th className="border px-4 py-2 text-right whitespace-nowrap">Balance</th>
                      <th className="border px-4 py-2 text-center whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map(customer => {
                      const netAmount = customer.totalPurchases;
                      const vatAmount = 0;
                      return (
                        <tr key={customer.id} className="border-b hover:bg-gray-50">
                          <td className="border px-4 py-2">{customer.name}</td>
                          <td className="border px-4 py-2 text-right">{customer.totalPurchases.toFixed(2)}</td>
                          <td className="border px-4 py-2 text-right">{netAmount.toFixed(2)}</td>
                          <td className="border px-4 py-2 text-right">{vatAmount.toFixed(2)}</td>
                          <td className="border px-4 py-2 text-right text-green-600">{customer.totalPayments.toFixed(2)}</td>
                          <td className={`border px-4 py-2 text-right font-semibold ${customer.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {customer.balance.toFixed(2)}
                          </td>
                          <td className="border px-4 py-2 text-center">
                            <button
                              onClick={() => generateDetailedStatement('customer', customer.id, customer.name)}
                              className="text-blue-600 hover:text-blue-800 text-sm underline"
                            >
                              View Statement
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-100 font-bold">
                    <tr>
                      <td className="border px-4 py-3">TOTAL</td>
                      <td className="border px-4 py-3 text-right text-blue-600">{customers.reduce((sum, c) => sum + c.totalPurchases, 0).toFixed(2)}</td>
                      <td className="border px-4 py-3 text-right">{customers.reduce((sum, c) => sum + c.totalPurchases, 0).toFixed(2)}</td>
                      <td className="border px-4 py-3 text-right">0.00</td>
                      <td className="border px-4 py-3 text-right text-green-600">{customers.reduce((sum, c) => sum + c.totalPayments, 0).toFixed(2)}</td>
                      <td className="border px-4 py-3 text-right text-blue-600">{customers.reduce((sum, c) => sum + c.balance, 0).toFixed(2)}</td>
                      <td className="border px-4 py-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'suppliers' && (
            <div>
              <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
                <h2 className="text-xl font-semibold">Supplier Balances</h2>
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
                    onClick={exportSuppliersToExcel}
                    className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 text-sm"
                  >
                    <Download size={16} />
                    {!isMobile && 'Export Excel'}
                  </button>
                  <button
                    onClick={exportSuppliersToPDF}
                    className="flex items-center gap-2 bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 text-sm"
                  >
                    <FileDown size={16} />
                    {!isMobile && 'Export PDF'}
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="min-w-full border-collapse">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border px-4 py-2 text-left whitespace-nowrap">Supplier Name</th>
                      <th className="border px-4 py-2 text-right whitespace-nowrap">Debit</th>
                      <th className="border px-4 py-2 text-right whitespace-nowrap">Net</th>
                      <th className="border px-4 py-2 text-right whitespace-nowrap">VAT</th>
                      <th className="border px-4 py-2 text-right whitespace-nowrap">Credit</th>
                      <th className="border px-4 py-2 text-right whitespace-nowrap">Balance</th>
                      <th className="border px-4 py-2 text-center whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.map(supplier => {
                      const netAmount = supplier.totalPurchases;
                      const vatAmount = 0;
                      return (
                        <tr key={supplier.id} className="border-b hover:bg-gray-50">
                          <td className="border px-4 py-2">{supplier.name}</td>
                          <td className="border px-4 py-2 text-right text-green-600">{supplier.totalPayments.toFixed(2)}</td>
                          <td className="border px-4 py-2 text-right">{supplier.totalPayments.toFixed(2)}</td>
                          <td className="border px-4 py-2 text-right">0.00</td>
                          <td className="border px-4 py-2 text-right">{supplier.totalPurchases.toFixed(2)}</td>
                          <td className={`border px-4 py-2 text-right font-semibold ${supplier.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {supplier.balance.toFixed(2)}
                          </td>
                          <td className="border px-4 py-2 text-center">
                            <button
                              onClick={() => generateDetailedStatement('supplier', supplier.id, supplier.name)}
                              className="text-blue-600 hover:text-blue-800 text-sm underline"
                            >
                              View Statement
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-100 font-bold">
                    <tr>
                      <td className="border px-4 py-3">TOTAL</td>
                      <td className="border px-4 py-3 text-right text-green-600">{suppliers.reduce((sum, s) => sum + s.totalPayments, 0).toFixed(2)}</td>
                      <td className="border px-4 py-3 text-right">{suppliers.reduce((sum, s) => sum + s.totalPayments, 0).toFixed(2)}</td>
                      <td className="border px-4 py-3 text-right">0.00</td>
                      <td className="border px-4 py-3 text-right text-blue-600">{suppliers.reduce((sum, s) => sum + s.totalPurchases, 0).toFixed(2)}</td>
                      <td className="border px-4 py-3 text-right text-blue-600">{suppliers.reduce((sum, s) => sum + s.balance, 0).toFixed(2)}</td>
                      <td className="border px-4 py-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'products' && (
            <div>
              <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
                <h2 className="text-xl font-semibold">Product Summary</h2>
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
                    onClick={exportProductsToExcel}
                    className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 text-sm"
                  >
                    <Download size={16} />
                    {!isMobile && 'Export Excel'}
                  </button>
                  <button
                    onClick={exportProductsToPDF}
                    className="flex items-center gap-2 bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 text-sm"
                  >
                    <FileDown size={16} />
                    {!isMobile && 'Export PDF'}
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="min-w-full border-collapse">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border px-4 py-2 text-left whitespace-nowrap">Product Name</th>
                      <th className="border px-4 py-2 text-left whitespace-nowrap">Category</th>
                      <th className="border px-4 py-2 text-right whitespace-nowrap">Quantity Sold</th>
                      <th className="border px-4 py-2 text-right whitespace-nowrap">Subtotal</th>
                      <th className="border px-4 py-2 text-right whitespace-nowrap">Discount</th>
                      <th className="border px-4 py-2 text-right whitespace-nowrap">Total Revenue</th>
                      <th className="border px-4 py-2 text-right whitespace-nowrap">Net</th>
                      <th className="border px-4 py-2 text-right whitespace-nowrap">VAT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(product => {
                      // Don't auto-calculate VAT - it should come from actual order tax data
                      const discount = product.totalDiscount || 0;
                      const subtotal = product.totalRevenue + discount;
                      const netRevenue = product.totalRevenue;
                      const vatRevenue = 0; // No automatic VAT calculation
                      return (
                        <tr key={product.id} className="border-b hover:bg-gray-50">
                          <td className="border px-4 py-2">{product.name}</td>
                          <td className="border px-4 py-2">{product.category}</td>
                          <td className="border px-4 py-2 text-right">{product.totalSold}</td>
                          <td className="border px-4 py-2 text-right">{subtotal.toFixed(2)}</td>
                          <td className="border px-4 py-2 text-right text-red-600">{discount > 0 ? `-${discount.toFixed(2)}` : '0.00'}</td>
                          <td className="border px-4 py-2 text-right font-semibold">{product.totalRevenue.toFixed(2)}</td>
                          <td className="border px-4 py-2 text-right">{netRevenue.toFixed(2)}</td>
                          <td className="border px-4 py-2 text-right">{vatRevenue.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-100 font-bold">
                    <tr>
                      <td className="border px-4 py-3" colSpan={2}>TOTAL</td>
                      <td className="border px-4 py-3 text-right">{products.reduce((sum, p) => sum + p.totalSold, 0)}</td>
                      <td className="border px-4 py-3 text-right">{products.reduce((sum, p) => sum + p.totalRevenue + (p.totalDiscount || 0), 0).toFixed(2)}</td>
                      <td className="border px-4 py-3 text-right text-red-600">{products.reduce((sum, p) => sum + (p.totalDiscount || 0), 0).toFixed(2)}</td>
                      <td className="border px-4 py-3 text-right text-blue-600">{products.reduce((sum, p) => sum + p.totalRevenue, 0).toFixed(2)}</td>
                      <td className="border px-4 py-3 text-right">{products.reduce((sum, p) => sum + p.totalRevenue, 0).toFixed(2)}</td>
                      <td className="border px-4 py-3 text-right">0.00</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'purchases' && (
            <div>
              <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
                <h2 className="text-xl font-semibold">Purchase History</h2>
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
                    onClick={exportPurchasesToExcel}
                    className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 text-sm"
                  >
                    <Download size={16} />
                    {!isMobile && 'Export Excel'}
                  </button>
                  <button
                    onClick={exportPurchasesToPDF}
                    className="flex items-center gap-2 bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 text-sm"
                  >
                    <FileDown size={16} />
                    {!isMobile && 'Export PDF'}
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left whitespace-nowrap text-xs">Date</th>
                      <th className="px-3 py-2 text-left whitespace-nowrap text-xs">Ref.</th>
                      <th className="px-3 py-2 text-left whitespace-nowrap text-xs">Description</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap text-xs">Debit</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap text-xs">Net</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap text-xs">VAT</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap text-xs">Credit</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap text-xs">Balance</th>
                      <th className="px-3 py-2 text-left whitespace-nowrap text-xs">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let runningBalance = 0;
                      return purchases.map(purchase => {
                        const total = purchase.amount;
                        const vat = (purchase as any).taxAmount || 0;
                        const net = total - vat;
                        runningBalance += total - purchase.amountPaid;
                        return (
                          <tr key={purchase.id} className="border-b hover:bg-gray-50 text-sm">
                            <td className="px-3 py-2">{new Date(purchase.date).toLocaleDateString('en-GB')}</td>
                            <td className="px-3 py-2">{purchase.invoiceNumber || '-'}</td>
                            <td className="px-3 py-2">{purchase.supplier} - {purchase.items.length} item(s)</td>
                            <td className="px-3 py-2 text-right font-semibold">{total.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right">{net.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right">{vat.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right text-green-600">{purchase.amountPaid.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right font-semibold">{runningBalance.toFixed(2)}</td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-1 rounded text-xs ${
                                purchase.status === 'received' ? 'bg-green-100 text-green-800' : 
                                purchase.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {purchase.status}
                              </span>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                  <tfoot className="bg-gray-100 font-bold">
                    <tr>
                      <td className="px-3 py-3" colSpan={3}>TOTAL</td>
                      <td className="px-3 py-3 text-right text-blue-600">{purchases.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}</td>
                      <td className="px-3 py-3 text-right">{purchases.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}</td>
                      <td className="px-3 py-3 text-right">0.00</td>
                      <td className="px-3 py-3 text-right text-green-600">{purchases.reduce((sum, p) => sum + p.amountPaid, 0).toFixed(2)}</td>
                      <td className="px-3 py-3 text-right">{purchases.reduce((sum, p) => sum + (p.amount - p.amountPaid), 0).toFixed(2)}</td>
                      <td className="px-3 py-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'expenses' && (
            <div>
              <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
                <h2 className="text-xl font-semibold">Expense History</h2>
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
                    onClick={exportExpensesToExcel}
                    className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 text-sm"
                  >
                    <Download size={16} />
                    {!isMobile && 'Export Excel'}
                  </button>
                  <button
                    onClick={exportExpensesToPDF}
                    className="flex items-center gap-2 bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 text-sm"
                  >
                    <FileDown size={16} />
                    {!isMobile && 'Export PDF'}
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left whitespace-nowrap text-xs">Date</th>
                      <th className="px-3 py-2 text-left whitespace-nowrap text-xs">Ref.</th>
                      <th className="px-3 py-2 text-left whitespace-nowrap text-xs">Description</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap text-xs">Debit</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap text-xs">Net</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap text-xs">VAT</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap text-xs">Credit</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap text-xs">Balance</th>
                      <th className="px-3 py-2 text-left whitespace-nowrap text-xs">Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let runningBalance = 0;
                      return expenses.map(expense => {
                        const total = expense.amount;
                        const vat = (expense as any).taxAmount || 0;
                        const net = total - vat;
                        runningBalance += total;
                        return (
                          <tr key={expense.id} className="border-b hover:bg-gray-50 text-sm">
                            <td className="px-3 py-2">{new Date(expense.date).toLocaleDateString('en-GB')}</td>
                            <td className="px-3 py-2">{expense.reference || '-'}</td>
                            <td className="px-3 py-2">{expense.category} - {expense.description}</td>
                            <td className="px-3 py-2 text-right font-semibold text-red-600">{total.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right">{net.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right">{vat.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right text-green-600">{total.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right font-semibold">{runningBalance.toFixed(2)}</td>
                            <td className="px-3 py-2 text-xs">{expense.paymentMethod || '-'}</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                  <tfoot className="bg-gray-100 font-bold">
                    <tr>
                      <td className="px-3 py-3" colSpan={3}>TOTAL</td>
                      <td className="px-3 py-3 text-right text-blue-600">{expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}</td>
                      <td className="px-3 py-3 text-right">{expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}</td>
                      <td className="px-3 py-3 text-right">0.00</td>
                      <td className="px-3 py-3 text-right text-green-600">{expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}</td>
                      <td className="px-3 py-3 text-right">{expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}</td>
                      <td className="px-3 py-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'sales' && (
            <div>
              <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
                <h2 className="text-xl font-semibold">Sales History</h2>
                <div className="flex gap-2 items-center flex-wrap">
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
                      onClick={() => {
                        setFilterStartDate('');
                        setFilterEndDate('');
                      }}
                      className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
                    >
                      Clear Dates
                    </button>
                  )}
                  <button
                    onClick={exportSalesToExcel}
                    className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 text-sm"
                  >
                    <Download size={16} />
                    {!isMobile && 'Export Excel'}
                  </button>
                  <button
                    onClick={exportSalesToPDF}
                    className="flex items-center gap-2 bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 text-sm"
                  >
                    <FileDown size={16} />
                    {!isMobile && 'Export PDF'}
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left whitespace-nowrap text-xs">Date</th>
                      <th className="px-3 py-2 text-left whitespace-nowrap text-xs">Ref.</th>
                      <th className="px-3 py-2 text-left whitespace-nowrap text-xs">Description</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap text-xs">Subtotal</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap text-xs">Discount</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap text-xs">Debit</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap text-xs">Net</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap text-xs">VAT</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap text-xs">Credit</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap text-xs">Balance</th>
                      <th className="px-3 py-2 text-left whitespace-nowrap text-xs">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let runningBalance = 0;
                      // Filter sales by date
                      const filteredSales = sales.filter(sale => {
                        const saleDate = new Date(sale.date).toISOString().split('T')[0];
                        const matchesStart = !filterStartDate || saleDate >= filterStartDate;
                        const matchesEnd = !filterEndDate || saleDate <= filterEndDate;
                        return matchesStart && matchesEnd;
                      }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                      
                      return filteredSales.map(sale => {
                        const subtotal = sale.subtotal || sale.total;
                        const discount = sale.discountAmount || 0;
                        const total = sale.total;
                        // Use actual tax amount if available, don't assume 11%
                        const vat = sale.taxAmount || 0;
                        const net = total - vat;
                        runningBalance += total - sale.amountPaid;
                        return (
                          <tr key={sale.id} className="border-b hover:bg-gray-50 text-sm">
                            <td className="px-3 py-2">{new Date(sale.date).toLocaleDateString('en-GB')}</td>
                            <td className="px-3 py-2">{sale.invoiceNumber || '-'}</td>
                            <td className="px-3 py-2">{sale.customer}</td>
                            <td className="px-3 py-2 text-right">{subtotal.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right text-red-600">{discount > 0 ? `-${discount.toFixed(2)}` : '0.00'}</td>
                            <td className="px-3 py-2 text-right font-semibold">{total.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right">{net.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right">{vat.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right text-green-600">{sale.amountPaid.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right font-semibold">{runningBalance.toFixed(2)}</td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-1 rounded text-xs ${
                                sale.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' : 
                                sale.paymentStatus === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {sale.paymentStatus || 'unpaid'}
                              </span>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                  <tfoot className="bg-gray-100 font-bold">
                    <tr>
                      <td className="px-3 py-3" colSpan={3}>TOTAL</td>
                      <td className="px-3 py-3 text-right">
                        {sales.filter(s => {
                          const saleDate = new Date(s.date).toISOString().split('T')[0];
                          return (!filterStartDate || saleDate >= filterStartDate) && (!filterEndDate || saleDate <= filterEndDate);
                        }).reduce((sum, s) => sum + (s.subtotal || s.total), 0).toFixed(2)}
                      </td>
                      <td className="px-3 py-3 text-right text-red-600">
                        {sales.filter(s => {
                          const saleDate = new Date(s.date).toISOString().split('T')[0];
                          return (!filterStartDate || saleDate >= filterStartDate) && (!filterEndDate || saleDate <= filterEndDate);
                        }).reduce((sum, s) => sum + (s.discountAmount || 0), 0).toFixed(2)}
                      </td>
                      <td className="px-3 py-3 text-right text-blue-600">
                        {sales.filter(s => {
                          const saleDate = new Date(s.date).toISOString().split('T')[0];
                          return (!filterStartDate || saleDate >= filterStartDate) && (!filterEndDate || saleDate <= filterEndDate);
                        }).reduce((sum, s) => sum + s.total, 0).toFixed(2)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {sales.filter(s => {
                          const saleDate = new Date(s.date).toISOString().split('T')[0];
                          return (!filterStartDate || saleDate >= filterStartDate) && (!filterEndDate || saleDate <= filterEndDate);
                        }).reduce((sum, s) => sum + (s.total - (s.taxAmount || 0)), 0).toFixed(2)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {sales.filter(s => {
                          const saleDate = new Date(s.date).toISOString().split('T')[0];
                          return (!filterStartDate || saleDate >= filterStartDate) && (!filterEndDate || saleDate <= filterEndDate);
                        }).reduce((sum, s) => sum + (s.taxAmount || 0), 0).toFixed(2)}
                      </td>
                      <td className="px-3 py-3 text-right text-green-600">
                        {sales.filter(s => {
                          const saleDate = new Date(s.date).toISOString().split('T')[0];
                          return (!filterStartDate || saleDate >= filterStartDate) && (!filterEndDate || saleDate <= filterEndDate);
                        }).reduce((sum, s) => sum + s.amountPaid, 0).toFixed(2)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {sales.filter(s => {
                          const saleDate = new Date(s.date).toISOString().split('T')[0];
                          return (!filterStartDate || saleDate >= filterStartDate) && (!filterEndDate || saleDate <= filterEndDate);
                        }).reduce((sum, s) => sum + (s.total - s.amountPaid), 0).toFixed(2)}
                      </td>
                      <td className="px-3 py-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
      
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
      </div>
    </div>
  );
};

export default AdminAccountStatement;
