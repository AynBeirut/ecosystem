import React, { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { FileDown, Download, ArrowLeft } from 'lucide-react';
import { exportToCSV } from '@/lib/exportUtils';
import jsPDF from 'jspdf';
import { useNavigate } from 'react-router-dom';

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
}

interface PurchaseRecord {
  id: string;
  date: string;
  supplier: string;
  amount: number;
  status: string;
}

interface ExpenseRecord {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
}

const AdminAccountStatement: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'customers' | 'suppliers' | 'products' | 'purchases' | 'expenses'>('customers');
  const [loading, setLoading] = useState(true);
  
  const [customers, setCustomers] = useState<CustomerBalance[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierBalance[]>([]);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalPurchases, setTotalPurchases] = useState(0);
  const [customerBalances, setCustomerBalances] = useState(0);
  const [netBalance, setNetBalance] = useState(0);

  useEffect(() => {
    if (user?.storeId) {
      fetchAllData();
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
        fetchExpenses()
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
        // Assume full payment for delivered orders, partial for others
        const paid = order.status === 'delivered' ? total : 0;
        
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
      
      const supplierMap = new Map<string, SupplierBalance>();
      
      purchasesSnapshot.forEach(doc => {
        const purchase = doc.data();
        const supplierId = purchase.supplierId || 'unknown';
        const supplierName = suppliersData.get(supplierId) || purchase.supplierName || 'Unknown Supplier';
        const total = purchase.totalCost || purchase.totalAmount || purchase.total || 0;
        const paid = purchase.paid || 0;
        
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
          totalRevenue: 0
        });
      });
      
      // Add orders data
      ordersSnapshot.forEach(doc => {
        const order = doc.data();
        const items = order.items || [];
        
        items.forEach((item: any) => {
          const productId = item.productId || item.id;
          if (productId && productMap.has(productId)) {
            const product = productMap.get(productId)!;
            const quantity = item.quantity || 0;
            // Use item price if available, otherwise calculate from order total
            const price = item.price || (order.total / items.length) || 0;
            product.totalSold += quantity;
            product.totalRevenue += quantity * price;
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
          status: purchase.status || 'Completed'
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
          amount: expense.amount || 0
        });
        total += expense.amount || 0;
      });
      
      setExpenses(expensesList);
      setTotalExpenses(total);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    }
  };

  useEffect(() => {
    const supplierBalance = suppliers.reduce((sum, s) => sum + s.balance, 0);
    const net = customerBalances - supplierBalance - totalExpenses;
    setNetBalance(net);
  }, [customerBalances, suppliers, totalExpenses]);

  const exportCustomersToExcel = () => {
    const data = customers.map(c => ({
      'Customer Name': c.name,
      'Total Purchases': `$${c.totalPurchases.toFixed(2)}`,
      'Total Payments': `$${c.totalPayments.toFixed(2)}`,
      'Balance': `$${c.balance.toFixed(2)}`
    }));
    
    // Add total row
    const totalPurchases = customers.reduce((sum, c) => sum + c.totalPurchases, 0);
    const totalPayments = customers.reduce((sum, c) => sum + c.totalPayments, 0);
    const totalBalance = customers.reduce((sum, c) => sum + c.balance, 0);
    data.push({
      'Customer Name': 'TOTAL',
      'Total Purchases': `$${totalPurchases.toFixed(2)}`,
      'Total Payments': `$${totalPayments.toFixed(2)}`,
      'Balance': `$${totalBalance.toFixed(2)}`
    });
    
    exportToCSV(data, 'customers_statement.csv');
  };

  const exportSuppliersToExcel = () => {
    const data = suppliers.map(s => ({
      'Supplier Name': s.name,
      'Total Purchases': `$${s.totalPurchases.toFixed(2)}`,
      'Total Payments': `$${s.totalPayments.toFixed(2)}`,
      'Balance Due': `$${s.balance.toFixed(2)}`
    }));
    
    // Add total row
    const totalPurchases = suppliers.reduce((sum, s) => sum + s.totalPurchases, 0);
    const totalPayments = suppliers.reduce((sum, s) => sum + s.totalPayments, 0);
    const totalBalance = suppliers.reduce((sum, s) => sum + s.balance, 0);
    data.push({
      'Supplier Name': 'TOTAL',
      'Total Purchases': `$${totalPurchases.toFixed(2)}`,
      'Total Payments': `$${totalPayments.toFixed(2)}`,
      'Balance Due': `$${totalBalance.toFixed(2)}`
    });
    
    exportToCSV(data, 'suppliers_statement.csv');
  };

  const exportProductsToExcel = () => {
    const data = products.map(p => ({
      'Product Name': p.name,
      'Category': p.category,
      'Total Sold': p.totalSold,
      'Total Revenue': `$${p.totalRevenue.toFixed(2)}`
    }));
    
    // Add total row
    const totalSold = products.reduce((sum, p) => sum + p.totalSold, 0);
    const totalRevenue = products.reduce((sum, p) => sum + p.totalRevenue, 0);
    data.push({
      'Product Name': 'TOTAL',
      'Category': '',
      'Total Sold': totalSold,
      'Total Revenue': `$${totalRevenue.toFixed(2)}`
    });
    
    exportToCSV(data, 'products_summary.csv');
  };

  const exportPurchasesToExcel = () => {
    const data = purchases.map(p => ({
      'Date': p.date,
      'Supplier': p.supplier,
      'Amount': `$${p.amount.toFixed(2)}`,
      'Status': p.status
    }));
    
    // Add total row
    const totalAmount = purchases.reduce((sum, p) => sum + p.amount, 0);
    data.push({
      'Date': '',
      'Supplier': 'TOTAL',
      'Amount': `$${totalAmount.toFixed(2)}`,
      'Status': ''
    });
    
    exportToCSV(data, 'purchases_statement.csv');
  };

  const exportExpensesToExcel = () => {
    const data = expenses.map(e => ({
      'Date': e.date,
      'Category': e.category,
      'Description': e.description,
      'Amount': `$${e.amount.toFixed(2)}`
    }));
    
    // Add total row
    const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
    data.push({
      'Date': '',
      'Category': '',
      'Description': 'TOTAL',
      'Amount': `$${totalAmount.toFixed(2)}`
    });
    
    exportToCSV(data, 'expenses_statement.csv');
  };

  const exportCustomersToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Customer Balances Statement', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 105, 28, { align: 'center' });
    
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
    doc.setFontSize(18);
    doc.text('Supplier Balances Statement', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 105, 28, { align: 'center' });
    
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
    doc.setFontSize(18);
    doc.text('Products Summary', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 105, 28, { align: 'center' });
    
    let y = 45;
    doc.setFontSize(12);
    doc.text('Product Name', 20, y);
    doc.text('Category', 90, y);
    doc.text('Sold', 130, y);
    doc.text('Revenue', 160, y);
    y += 5;
    doc.line(20, y, 190, y);
    y += 7;
    
    doc.setFontSize(10);
    products.forEach(product => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(product.name.substring(0, 25), 20, y);
      doc.text(product.category.substring(0, 15), 90, y);
      doc.text(product.totalSold.toString(), 130, y);
      doc.text(`$${product.totalRevenue.toFixed(2)}`, 160, y);
      y += 7;
    });
    
    // Add total row
    y += 3;
    doc.line(20, y, 190, y);
    y += 7;
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('TOTAL', 20, y);
    const totalSold = products.reduce((sum, p) => sum + p.totalSold, 0);
    const totalRevenue = products.reduce((sum, p) => sum + p.totalRevenue, 0);
    doc.text(totalSold.toString(), 130, y);
    doc.text(`$${totalRevenue.toFixed(2)}`, 160, y);
    
    doc.save('products_summary.pdf');
  };

  const exportPurchasesToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Purchase History', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 105, 28, { align: 'center' });
    
    let y = 45;
    doc.setFontSize(12);
    doc.text('Date', 20, y);
    doc.text('Supplier', 70, y);
    doc.text('Amount', 140, y);
    doc.text('Status', 175, y);
    y += 5;
    doc.line(20, y, 190, y);
    y += 7;
    
    doc.setFontSize(9);
    purchases.forEach(purchase => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      // Format date to be shorter
      const dateStr = new Date(purchase.date).toLocaleDateString();
      doc.text(dateStr, 20, y);
      doc.text(purchase.supplier.substring(0, 20), 70, y);
      doc.text(`$${purchase.amount.toFixed(2)}`, 140, y);
      doc.text(purchase.status, 175, y);
      y += 7;
    });
    
    // Add total row
    y += 3;
    doc.line(20, y, 190, y);
    y += 7;
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('TOTAL', 70, y);
    const totalAmount = purchases.reduce((sum, p) => sum + p.amount, 0);
    doc.text(`$${totalAmount.toFixed(2)}`, 140, y);
    
    doc.save('purchases_statement.pdf');
  };

  const exportExpensesToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Expense History', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 105, 28, { align: 'center' });
    
    let y = 45;
    doc.setFontSize(12);
    doc.text('Date', 20, y);
    doc.text('Category', 50, y);
    doc.text('Description', 90, y);
    doc.text('Amount', 160, y);
    y += 5;
    doc.line(20, y, 190, y);
    y += 7;
    
    doc.setFontSize(10);
    expenses.forEach(expense => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(expense.date, 20, y);
      doc.text(expense.category.substring(0, 15), 50, y);
      doc.text(expense.description.substring(0, 25), 90, y);
      doc.text(`$${expense.amount.toFixed(2)}`, 160, y);
      y += 7;
    });
    
    // Add total row
    y += 3;
    doc.line(20, y, 190, y);
    y += 7;
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('TOTAL', 90, y);
    const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
    doc.text(`$${totalAmount.toFixed(2)}`, 160, y);
    
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
      <div className="container mx-auto p-4">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">Loading account statement...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-gray-600">Total Expenses</div>
          <div className="text-2xl font-bold text-red-600">${totalExpenses.toFixed(2)}</div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-gray-600">Total Purchases</div>
          <div className="text-2xl font-bold text-orange-600">${totalPurchases.toFixed(2)}</div>
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
        <div className="border-b">
          <div className="flex">
            <button
              onClick={() => setActiveTab('customers')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'customers'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Customers ({customers.length})
            </button>
            <button
              onClick={() => setActiveTab('suppliers')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'suppliers'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Suppliers ({suppliers.length})
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'products'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Products ({products.length})
            </button>
            <button
              onClick={() => setActiveTab('purchases')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'purchases'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Purchases ({purchases.length})
            </button>
            <button
              onClick={() => setActiveTab('expenses')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'expenses'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Expenses ({expenses.length})
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'customers' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Customer Balances</h2>
                <div className="flex gap-2">
                  <button
                    onClick={exportCustomersToExcel}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                  >
                    <Download size={18} />
                    Export Excel
                  </button>
                  <button
                    onClick={exportCustomersToPDF}
                    className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                  >
                    <FileDown size={18} />
                    Export PDF
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Customer Name</th>
                      <th className="px-4 py-2 text-right">Total Purchases</th>
                      <th className="px-4 py-2 text-right">Total Payments</th>
                      <th className="px-4 py-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map(customer => (
                      <tr key={customer.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2">{customer.name}</td>
                        <td className="px-4 py-2 text-right">${customer.totalPurchases.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right">${customer.totalPayments.toFixed(2)}</td>
                        <td className={`px-4 py-2 text-right font-semibold ${customer.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          ${customer.balance.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-100 font-bold">
                    <tr>
                      <td className="px-4 py-3">TOTAL</td>
                      <td className="px-4 py-3 text-right">${customers.reduce((sum, c) => sum + c.totalPurchases, 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">${customers.reduce((sum, c) => sum + c.totalPayments, 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-blue-600">${customers.reduce((sum, c) => sum + c.balance, 0).toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'suppliers' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Supplier Balances</h2>
                <div className="flex gap-2">
                  <button
                    onClick={exportSuppliersToExcel}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                  >
                    <Download size={18} />
                    Export Excel
                  </button>
                  <button
                    onClick={exportSuppliersToPDF}
                    className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                  >
                    <FileDown size={18} />
                    Export PDF
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Supplier Name</th>
                      <th className="px-4 py-2 text-right">Total Purchases</th>
                      <th className="px-4 py-2 text-right">Total Payments</th>
                      <th className="px-4 py-2 text-right">Balance Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.map(supplier => (
                      <tr key={supplier.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2">{supplier.name}</td>
                        <td className="px-4 py-2 text-right">${supplier.totalPurchases.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right">${supplier.totalPayments.toFixed(2)}</td>
                        <td className={`px-4 py-2 text-right font-semibold ${supplier.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          ${supplier.balance.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-100 font-bold">
                    <tr>
                      <td className="px-4 py-3">TOTAL</td>
                      <td className="px-4 py-3 text-right">${suppliers.reduce((sum, s) => sum + s.totalPurchases, 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">${suppliers.reduce((sum, s) => sum + s.totalPayments, 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-blue-600">${suppliers.reduce((sum, s) => sum + s.balance, 0).toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'products' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Product Summary</h2>
                <div className="flex gap-2">
                  <button
                    onClick={exportProductsToExcel}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                  >
                    <Download size={18} />
                    Export Excel
                  </button>
                  <button
                    onClick={exportProductsToPDF}
                    className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                  >
                    <FileDown size={18} />
                    Export PDF
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Product Name</th>
                      <th className="px-4 py-2 text-left">Category</th>
                      <th className="px-4 py-2 text-right">Total Sold</th>
                      <th className="px-4 py-2 text-right">Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(product => (
                      <tr key={product.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2">{product.name}</td>
                        <td className="px-4 py-2">{product.category}</td>
                        <td className="px-4 py-2 text-right">{product.totalSold}</td>
                        <td className="px-4 py-2 text-right font-semibold text-green-600">
                          ${product.totalRevenue.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-100 font-bold">
                    <tr>
                      <td className="px-4 py-3" colSpan={2}>TOTAL</td>
                      <td className="px-4 py-3 text-right">{products.reduce((sum, p) => sum + p.totalSold, 0)}</td>
                      <td className="px-4 py-3 text-right text-blue-600">${products.reduce((sum, p) => sum + p.totalRevenue, 0).toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'purchases' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Purchase History</h2>
                <div className="flex gap-2">
                  <button
                    onClick={exportPurchasesToExcel}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                  >
                    <Download size={18} />
                    Export Excel
                  </button>
                  <button
                    onClick={exportPurchasesToPDF}
                    className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                  >
                    <FileDown size={18} />
                    Export PDF
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Date</th>
                      <th className="px-4 py-2 text-left">Supplier</th>
                      <th className="px-4 py-2 text-right">Amount</th>
                      <th className="px-4 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.map(purchase => (
                      <tr key={purchase.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2">{purchase.date}</td>
                        <td className="px-4 py-2">{purchase.supplier}</td>
                        <td className="px-4 py-2 text-right font-semibold">${purchase.amount.toFixed(2)}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-1 rounded text-sm ${
                            purchase.status === 'Completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {purchase.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-100 font-bold">
                    <tr>
                      <td className="px-4 py-3" colSpan={2}>TOTAL</td>
                      <td className="px-4 py-3 text-right text-blue-600">${purchases.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}</td>
                      <td className="px-4 py-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'expenses' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Expense History</h2>
                <div className="flex gap-2">
                  <button
                    onClick={exportExpensesToExcel}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                  >
                    <Download size={18} />
                    Export Excel
                  </button>
                  <button
                    onClick={exportExpensesToPDF}
                    className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                  >
                    <FileDown size={18} />
                    Export PDF
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Date</th>
                      <th className="px-4 py-2 text-left">Category</th>
                      <th className="px-4 py-2 text-left">Description</th>
                      <th className="px-4 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map(expense => (
                      <tr key={expense.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2">{expense.date}</td>
                        <td className="px-4 py-2">{expense.category}</td>
                        <td className="px-4 py-2">{expense.description}</td>
                        <td className="px-4 py-2 text-right font-semibold text-red-600">
                          ${expense.amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-100 font-bold">
                    <tr>
                      <td className="px-4 py-3" colSpan={3}>TOTAL</td>
                      <td className="px-4 py-3 text-right text-blue-600">${expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminAccountStatement;
