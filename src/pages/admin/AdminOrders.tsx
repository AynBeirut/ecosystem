import React, { useEffect, useState } from 'react';
import { getFirestore, collection, query, where, getDocs, updateDoc, doc, getDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Order, OrderItem } from '@/types/order';
import { ComposedProduct } from '@/types/product';
import { Customer } from '@/types/customer';
import { StaffMember } from '@/types/staff';
import { StoreProfile } from '@/types/storeProfile';
import { ShoppingCart, Plus, Printer, FileText, Download, Eye, Trash2, User, Share2, DollarSign } from 'lucide-react';
import { logAction } from '@/lib/auditLog';
import { generateInvoiceHTML as generateInvoiceHTMLTemplate } from '@/lib/invoiceTemplates';
import MobileHeader from '@/components/MobileHeader';
import BackButton from '@/components/BackButton';
import { useIsMobile } from '@/hooks/use-mobile';

const ORDER_STATUSES = [
  { value: 'pending', label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'confirmed', label: 'Confirmed', color: 'bg-blue-100 text-blue-800' },
  { value: 'processing', label: 'Processing', color: 'bg-purple-100 text-purple-800' },
  { value: 'ready', label: 'Ready', color: 'bg-green-100 text-green-800' },
  { value: 'delivered', label: 'Delivered', color: 'bg-gray-100 text-gray-800' },
  { value: 'returned', label: 'Returned', color: 'bg-orange-100 text-orange-800' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-800' },
];

const AdminOrders: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  const [orders, setOrders] = useState<(Order & { id: string })[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [salesStaff, setSalesStaff] = useState<StaffMember[]>([]);
  const [storeProfile, setStoreProfile] = useState<StoreProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [viewingOrder, setViewingOrder] = useState<(Order & { id: string }) | null>(null);
  const [payingOrder, setPayingOrder] = useState<(Order & { id: string }) | null>(null);
  const [viewingPaymentVoucher, setViewingPaymentVoucher] = useState<{ order: Order & { id: string }; payment: any } | null>(null);
  const [paymentData, setPaymentData] = useState({
    amountPaid: 0,
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'cash',
    paymentNotes: '',
  });
  
  const [newOrder, setNewOrder] = useState({
    customerId: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    assignedSalesPerson: '',
    salesPersonName: '',
    items: [] as OrderItem[],
    taxType: 'none' as 'none' | 'VAT' | 'TTC',
    taxRate: 0,
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: 0,
  });
  
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [salesPersonSearchOpen, setSalesPersonSearchOpen] = useState(false);
  const [isCreatingNewCustomer, setIsCreatingNewCustomer] = useState(false);
  const [isCreatingNewSalesPerson, setIsCreatingNewSalesPerson] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.storeId) {
        console.log('AdminOrders: No storeId found for user', user);
        setLoading(false);
        return;
      }
      console.log('AdminOrders: Fetching orders for storeId:', user.storeId);
      setLoading(true);
      const db = getFirestore();

      const fetchCollection = async (collectionName: string) => {
        const ref = collection(db, collectionName);
        const q = query(ref, where('storeId', '==', user.storeId));
        const snapshot = await getDocs(q);
        console.log(`AdminOrders: Found ${snapshot.docs.length} ${collectionName} for storeId:`, user.storeId);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      };

      try {
        // Fetch store profile
        const profileRef = doc(db, 'storeProfiles', user.storeId);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          setStoreProfile(profileSnap.data() as StoreProfile);
        }

        const [ordersData, productsData, customersData, staffData, subAccountsData] = await Promise.all([
          fetchCollection('orders'),
          fetchCollection('products'),
          fetchCollection('customers'),
          fetchCollection('staff'),
          fetchCollection('subAccounts'),
        ]);

        console.log('AdminOrders: Orders fetched:', ordersData);
        
        // Convert Firestore Timestamps and sort orders
        const ordersWithDates = (ordersData as (Order & { id: string })[]).map(order => {
          let createdAt = order.createdAt;
          if (createdAt && typeof createdAt === 'object' && 'toDate' in createdAt) {
            createdAt = (createdAt as any).toDate();
          } else if (createdAt && typeof createdAt === 'object' && 'seconds' in createdAt) {
            createdAt = new Date((createdAt as any).seconds * 1000);
          }
          return { ...order, createdAt };
        });
        
        // Sort orders: Active first (pending, confirmed, processing, ready), then delivered, then cancelled - all by newest date
        const sortedOrders = ordersWithDates.sort((a, b) => {
          // Define priority groups
          const getPriority = (status?: string) => {
            if (status === 'cancelled') return 3; // Cancelled at bottom
            if (status === 'delivered') return 2; // Delivered in middle
            return 1; // Active orders (pending, confirmed, processing, ready) at top
          };
          
          const priorityA = getPriority(a.status);
          const priorityB = getPriority(b.status);
          
          // First sort by priority group
          if (priorityA !== priorityB) {
            return priorityA - priorityB;
          }
          
          // Within same priority group, sort by date - newest first
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        
        setOrders(sortedOrders);
        setProducts(productsData);
        setCustomers(customersData as Customer[]);
        
        // Combine staff members with role 'sales_person' and sub-accounts with role 'sales'
        const staffSalesPeople = (staffData as StaffMember[]).filter(s => s.role === 'sales_person' && s.status === 'active');
        const subAccountSalesPeople = (subAccountsData as any[])
          .filter(s => s.role === 'sales' && s.status === 'active')
          .map(s => ({
            id: s.id,
            name: s.name,
            email: s.email,
            role: 'sales_person', // Normalize role for compatibility
            status: s.status,
          } as StaffMember));
        
        setSalesStaff([...staffSalesPeople, ...subAccountSalesPeople]);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({ 
          title: "Error", 
          description: "Failed to load orders. Please refresh the page.", 
          variant: "destructive" 
        });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user?.storeId, toast]);

  const calculateOrderTotals = (items: OrderItem[], taxType: string, taxRate: number, discountType: string, discountValue: number) => {
    // Calculate raw subtotal (before any discounts)
    let rawSubtotal = 0;
    let itemDiscounts = 0;
    
    items.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      const itemPrice = (product?.sellingPrice || product?.price || 0) * item.quantity;
      rawSubtotal += itemPrice;
      
      // Calculate item discount
      let itemDiscount = 0;
      if (item.discountType === 'percentage' && item.discountValue !== undefined) {
        itemDiscount = (itemPrice * item.discountValue) / 100;
      } else if (item.discountType === 'fixed' && item.discountValue !== undefined) {
        itemDiscount = item.discountValue;
      }
      
      itemDiscounts += itemDiscount;
    });

    // Subtotal after item discounts
    const subtotalAfterItemDiscounts = rawSubtotal - itemDiscounts;

    // Calculate order-level discount (applied after item discounts)
    let orderDiscountAmount = 0;
    if (discountType === 'percentage') {
      orderDiscountAmount = (subtotalAfterItemDiscounts * discountValue) / 100;
    } else {
      orderDiscountAmount = discountValue;
    }

    const afterAllDiscounts = subtotalAfterItemDiscounts - orderDiscountAmount;
    
    let taxAmount = 0;
    if (taxType !== 'none') {
      taxAmount = (afterAllDiscounts * taxRate) / 100;
    }

    const total = afterAllDiscounts + taxAmount;
    const totalDiscountAmount = itemDiscounts + orderDiscountAmount;

    return { 
      subtotal: rawSubtotal, 
      itemDiscounts,
      orderDiscount: orderDiscountAmount,
      discountAmount: totalDiscountAmount, 
      taxAmount, 
      total 
    };
  };

  const generateInvoiceNumber = async (): Promise<string> => {
    if (!user?.storeId) return 'INV-001';
    
    const db = getFirestore();
    const profileRef = doc(db, 'storeProfiles', user.storeId);
    
    // Fetch the latest store profile to ensure we have current data
    const profileSnap = await getDoc(profileRef);
    const currentProfile = profileSnap.exists() ? (profileSnap.data() as StoreProfile) : null;
    
    const prefix = currentProfile?.invoiceNumberPrefix || 'INV';
    const lastNumber = currentProfile?.lastInvoiceNumber || 0;
    const newNumber = lastNumber + 1;
    const invoiceNumber = `${prefix}-${String(newNumber).padStart(3, '0')}`;
    
    // Update last invoice number in store profile
    await updateDoc(profileRef, { lastInvoiceNumber: newNumber });
    
    // Update local state to keep UI in sync
    if (currentProfile) {
      setStoreProfile({ ...currentProfile, lastInvoiceNumber: newNumber });
    }
    
    return invoiceNumber;
  };

  const formatCurrency = (amount: number, showDual: boolean = true): string => {
    const usd = `$${amount.toFixed(2)}`;
    
    console.log('formatCurrency called:', { amount, showDual, hasProfile: !!storeProfile, rate: storeProfile?.customExchangeRate });
    
    if (showDual && storeProfile?.customExchangeRate && storeProfile.customExchangeRate > 0) {
      const lbp = (amount * storeProfile.customExchangeRate).toFixed(0);
      console.log('Showing dual currency:', { usd, lbp });
      return `${usd}<br/><span style="font-size: 12px; color: #666;">${Number(lbp).toLocaleString()} LBP</span>`;
    }
    
    console.log('Showing USD only');
    return usd;
  };

  const handleCreateInlineCustomer = async () => {
    if (!newOrder.customerName || !newOrder.customerPhone || !user?.storeId) {
      toast({ title: "Error", description: "Customer name and phone are required", variant: "destructive" });
      return;
    }

    try {
      const db = getFirestore();
      const customerData = {
        storeId: user.storeId,
        name: newOrder.customerName,
        phone: newOrder.customerPhone,
        email: newOrder.customerEmail || '',
        totalOrders: 0,
        lifetimeValue: 0,
        createdAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, 'customers'), customerData);
      const newCustomer = { id: docRef.id, ...customerData };
      setCustomers([...customers, newCustomer]);
      setNewOrder({ ...newOrder, customerId: docRef.id });
      setIsCreatingNewCustomer(false);
      toast({ title: "Success", description: "Customer created successfully" });
    } catch (error) {
      console.error('Error creating customer:', error);
      toast({ title: "Error", description: "Failed to create customer", variant: "destructive" });
    }
  };

  const handleCreateInlineSalesPerson = async () => {
    if (!newOrder.salesPersonName || !user?.storeId) {
      toast({ title: "Error", description: "Sales person name is required", variant: "destructive" });
      return;
    }

    try {
      const db = getFirestore();
      const salesPersonData = {
        storeId: user.storeId,
        name: newOrder.salesPersonName,
        role: 'sales_person',
        status: 'active',
        createdAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, 'staff'), salesPersonData);
      const newSalesPerson = { id: docRef.id, ...salesPersonData };
      setSalesStaff([...salesStaff, newSalesPerson]);
      setNewOrder({ ...newOrder, assignedSalesPerson: docRef.id });
      setIsCreatingNewSalesPerson(false);
      toast({ title: "Success", description: "Sales person created successfully" });
    } catch (error) {
      console.error('Error creating sales person:', error);
      toast({ title: "Error", description: "Failed to create sales person", variant: "destructive" });
    }
  };

  const handleCreateOrder = async () => {
    if (!newOrder.customerId || newOrder.items.length === 0 || !user?.storeId) {
      toast({ title: "Error", description: "Please select customer and add items", variant: "destructive" });
      return;
    }

    // Validate all items have valid quantity
    const invalidItems = newOrder.items.filter(item => {
      const qty = typeof item.quantity === 'string' ? parseFloat(item.quantity) : item.quantity;
      return !qty || qty <= 0 || isNaN(qty);
    });
    if (invalidItems.length > 0) {
      toast({ 
        title: "Invalid Quantity", 
        description: "Please enter a valid quantity (minimum 1) for all items", 
        variant: "destructive" 
      });
      return;
    }

    try {
      const db = getFirestore();
      const customer = customers.find(c => c.id === newOrder.customerId);
      const salesPerson = salesStaff.find(s => s.id === newOrder.assignedSalesPerson);
      const { subtotal, discountAmount, taxAmount, total } = calculateOrderTotals(
        newOrder.items,
        newOrder.taxType,
        newOrder.taxRate,
        newOrder.discountType,
        newOrder.discountValue
      );

      // Generate custom invoice number
      const invoiceNumber = await generateInvoiceNumber();

      // Add prices to items
      const itemsWithPrices = newOrder.items.map(item => {
        const product = products.find(p => p.id === item.productId);
        return {
          ...item,
          price: product?.sellingPrice || product?.price || 0
        };
      });

      const orderData = {
        storeId: user.storeId,
        customerId: newOrder.customerId,
        customerName: customer?.name || '',
        customerPhone: customer?.phone || '',
        customerEmail: customer?.email || '',
        invoiceNumber,
        items: itemsWithPrices,
        subtotal,
        taxType: newOrder.taxType,
        taxRate: newOrder.taxRate,
        taxAmount,
        discountType: newOrder.discountType,
        discountValue: newOrder.discountValue,
        discountAmount,
        total,
        status: 'pending',
        paymentStatus: 'unpaid' as const,
        amountPaid: 0,
        assignedSalesPerson: newOrder.assignedSalesPerson,
        assignedSalesPersonName: salesPerson?.name || '',
        createdAt: new Date().toISOString(),
        createdBy: user.id,
      };

      const docRef = await addDoc(collection(db, 'orders'), orderData);
      setOrders([{ id: docRef.id, ...orderData }, ...orders]);

      // Update customer stats
      if (customer) {
        const customerRef = doc(db, 'customers', customer.id);
        await updateDoc(customerRef, {
          totalOrders: (customer.totalOrders || 0) + 1,
          lifetimeValue: (customer.lifetimeValue || 0) + total,
          lastOrderDate: new Date().toISOString(),
        });
      }

      await logAction(user.id, user.name, user.role, 'create', 'order', docRef.id, { newValue: orderData }, user.storeId);

      setNewOrder({
        customerId: '',
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        assignedSalesPerson: '',
        salesPersonName: '',
        items: [],
        taxType: 'none',
        taxRate: 0,
        discountType: 'percentage',
        discountValue: 0,
      });
      setIsCreatingOrder(false);
      toast({ title: "Success", description: `Order created! Invoice: ${invoiceNumber}` });
    } catch (error) {
      console.error('Error creating order:', error);
      toast({ title: "Error", description: "Failed to create order", variant: "destructive" });
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    if (!user?.storeId) return;
    try {
      const db = getFirestore();
      const orderRef = doc(db, 'orders', orderId);
      const order = orders.find(o => o.id === orderId);
      
      if (!order) {
        toast({ title: "Error", description: "Order not found", variant: "destructive" });
        return;
      }
      
      // If marking as delivered/completed, deduct from finished goods inventory
      if ((newStatus === 'delivered' || newStatus === 'completed') && order.status !== 'delivered' && order.status !== 'completed') {
        for (const item of order.items) {
          // Check if this product is a composed product (has finished goods entry)
          // Try both productId and composedProductId since they might be stored differently
          const fgQuery = query(
            collection(db, 'finishedGoodsInventory'),
            where('storeId', '==', user.storeId)
          );
          const fgSnapshot = await getDocs(fgQuery);
          
          // Find matching finished goods by productId or composedProductId
          const matchingFG = fgSnapshot.docs.find(doc => {
            const data = doc.data();
            return data.productId === item.productId || data.composedProductId === item.productId;
          });
          
          if (matchingFG) {
            const fgData = matchingFG.data();
            
            const newBalance = Math.max(0, (fgData.currentBalance || 0) - item.quantity);
            const newQuantitySold = (fgData.quantitySold || 0) + item.quantity;
            const newTotalValue = newBalance * (fgData.costPrice || 0);
            
            // Create transaction record
            const transaction = {
              id: `TXN-${Date.now()}-${item.productId}`,
              date: new Date().toISOString(),
              actionType: 'sold' as const,
              quantity: -item.quantity,
              unitCost: fgData.costPrice || 0,
              totalCost: (fgData.costPrice || 0) * item.quantity,
              reason: `Sale from order ${order.invoiceNumber || order.id}`,
              referenceId: orderId,
              referenceNumber: order.invoiceNumber || order.id,
              userId: user.id,
              userName: user.name,
            };
            
            await updateDoc(doc(db, 'finishedGoodsInventory', matchingFG.id), {
              currentBalance: newBalance,
              quantitySold: newQuantitySold,
              totalValue: newTotalValue,
              transactions: [...(fgData.transactions || []), transaction],
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }
      
      await updateDoc(orderRef, { status: newStatus, updatedAt: new Date().toISOString() });
      setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      
      await logAction(user.id, user.name, user.role, 'update', 'order', orderId, {
        oldValue: { status: order.status },
        newValue: { status: newStatus }
      }, user.storeId);
      
      toast({ title: "Success", description: "Order status updated!" });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!user?.storeId) return;
    
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    try {
      const db = getFirestore();
      await deleteDoc(doc(db, 'orders', orderId));
      setOrders(orders.filter(o => o.id !== orderId));

      await logAction(
        user.id,
        user.name,
        user.role,
        'delete',
        'order',
        orderId,
        { oldValue: order },
        user.storeId
      );

      toast({ title: "Success", description: "Order deleted successfully!" });
    } catch (error) {
      console.error('Error deleting order:', error);
      toast({ title: "Error", description: "Failed to delete order", variant: "destructive" });
    }
  };

  const handlePayOrder = async () => {
    if (!payingOrder || !user?.storeId) return;

    try {
      const db = getFirestore();
      const orderRef = doc(db, 'orders', payingOrder.id);

      const currentPaid = payingOrder.amountPaid || 0;
      const newAmountPaid = currentPaid + paymentData.amountPaid;
      const totalAmount = payingOrder.total || 0;

      let paymentStatus: 'unpaid' | 'partial' | 'paid' = 'unpaid';
      if (newAmountPaid >= totalAmount) {
        paymentStatus = 'paid';
      } else if (newAmountPaid > 0) {
        paymentStatus = 'partial';
      }

      // Create payment record
      const paymentRecord = {
        id: `PMT-${Date.now()}`,
        amount: paymentData.amountPaid,
        date: paymentData.paymentDate,
        method: paymentData.paymentMethod,
        notes: paymentData.paymentNotes,
        recordedBy: user.name,
        recordedAt: new Date().toISOString(),
      };

      const existingHistory = payingOrder.paymentHistory || [];
      const updatedHistory = [...existingHistory, paymentRecord];

      await updateDoc(orderRef, {
        paymentStatus,
        amountPaid: newAmountPaid,
        paymentDate: paymentData.paymentDate,
        paymentMethod: paymentData.paymentMethod,
        paymentNotes: paymentData.paymentNotes,
        paymentHistory: updatedHistory,
      });

      const updatedOrder = { 
        ...payingOrder, 
        paymentStatus, 
        amountPaid: newAmountPaid,
        paymentDate: paymentData.paymentDate,
        paymentMethod: paymentData.paymentMethod,
        paymentNotes: paymentData.paymentNotes,
        paymentHistory: updatedHistory,
      };

      setOrders(orders.map(o => o.id === payingOrder.id ? updatedOrder : o));

      await logAction(
        user.id,
        user.name,
        user.role,
        'update',
        'order_payment',
        payingOrder.id,
        { 
          oldValue: { amountPaid: currentPaid, paymentStatus: payingOrder.paymentStatus },
          newValue: { amountPaid: newAmountPaid, paymentStatus, ...paymentData }
        },
        user.storeId
      );

      setPayingOrder(null);
      setPaymentData({
        amountPaid: 0,
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'cash',
        paymentNotes: '',
      });

      toast({ 
        title: "Success", 
        description: `Payment recorded! Status: ${paymentStatus === 'paid' ? 'Fully Paid' : paymentStatus === 'partial' ? 'Partially Paid' : 'Unpaid'}` 
      });

      // Show voucher after successful payment
      setViewingPaymentVoucher({ order: updatedOrder, payment: paymentRecord });
    } catch (error) {
      console.error('Error recording payment:', error);
      toast({ title: "Error", description: "Failed to record payment", variant: "destructive" });
    }
  };

  const generatePaymentVoucherHTML = (order: Order & { id: string }, payment: any) => {
    return `
      <div class="voucher-container" style="padding: 40px; font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="margin: 0; color: #1a1a1a; font-size: 28px;">PAYMENT RECEIPT</h1>
          <p style="margin: 5px 0; color: #666; font-size: 14px;">Receipt #${payment.id}</p>
        </div>

        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div>
              <p style="margin: 0; color: #666; font-size: 12px;">Date</p>
              <p style="margin: 5px 0 15px; font-weight: 600;">${new Date(payment.date).toLocaleDateString()}</p>
              <p style="margin: 0; color: #666; font-size: 12px;">Invoice Number</p>
              <p style="margin: 5px 0 15px; font-weight: 600;">${order.invoiceNumber || order.orderNumber || order.id.slice(0, 8)}</p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; color: #666; font-size: 12px;">Payment Method</p>
              <p style="margin: 5px 0 15px; font-weight: 600; text-transform: capitalize;">${payment.method}</p>
              <p style="margin: 0; color: #666; font-size: 12px;">Recorded By</p>
              <p style="margin: 5px 0 15px; font-weight: 600;">${payment.recordedBy}</p>
            </div>
          </div>
        </div>

        <div style="margin-bottom: 25px;">
          <h3 style="margin: 0 0 15px; color: #1a1a1a; font-size: 16px;">Customer Information</h3>
          <p style="margin: 5px 0;"><strong>Name:</strong> ${order.customerName || 'N/A'}</p>
          ${order.customerPhone ? `<p style="margin: 5px 0;"><strong>Phone:</strong> ${order.customerPhone}</p>` : ''}
        </div>

        <div style="border: 2px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
            <div>
              <p style="margin: 0; color: #666; font-size: 12px;">Invoice Total</p>
              <p style="margin: 5px 0; font-size: 18px; font-weight: 600;">$${(order.total || 0).toFixed(2)}</p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; color: #666; font-size: 12px;">Previous Payments</p>
              <p style="margin: 5px 0; font-size: 18px; font-weight: 600;">$${((order.amountPaid || 0) - payment.amount).toFixed(2)}</p>
            </div>
          </div>
          <div style="border-top: 2px dashed #e5e7eb; padding-top: 15px; text-align: center;">
            <p style="margin: 0; color: #666; font-size: 14px;">PAYMENT AMOUNT</p>
            <p style="margin: 10px 0; font-size: 32px; font-weight: bold; color: #10b981;">$${payment.amount.toFixed(2)}</p>
          </div>
          <div style="border-top: 2px dashed #e5e7eb; padding-top: 15px; margin-top: 15px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 16px; font-weight: 600;">Total Paid:</span>
              <span style="font-size: 18px; font-weight: bold;">$${(order.amountPaid || 0).toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
              <span style="font-size: 16px; font-weight: 600;">Balance Due:</span>
              <span style="font-size: 18px; font-weight: bold; color: #ef4444;">$${((order.total || 0) - (order.amountPaid || 0)).toFixed(2)}</span>
            </div>
          </div>
        </div>

        ${payment.notes ? `
          <div style="margin-bottom: 25px;">
            <h3 style="margin: 0 0 10px; color: #1a1a1a; font-size: 14px;">Notes</h3>
            <p style="margin: 0; color: #666; background: #f9fafb; padding: 15px; border-radius: 6px;">${payment.notes}</p>
          </div>
        ` : ''}

        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; color: #999; font-size: 11px; text-align: center;">
            Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
          </p>
        </div>
      </div>
    `;
  };

  const downloadPaymentVoucher = async (order: Order & { id: string }, payment: any) => {
    try {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = generatePaymentVoucherHTML(order, payment);
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      document.body.appendChild(tempDiv);
      
      const canvas = await html2canvas(tempDiv.querySelector('.voucher-container') as HTMLElement);
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Payment-Receipt-${payment.id}.pdf`);
      
      document.body.removeChild(tempDiv);
      toast({ title: "Success", description: "Payment receipt downloaded" });
    } catch (error) {
      console.error('Error generating receipt:', error);
      toast({ title: "Error", description: "Failed to generate receipt", variant: "destructive" });
    }
  };

  const printPaymentVoucher = (order: Order & { id: string }, payment: any) => {
    const printWindow = window.open('', '', 'height=600,width=800');
    if (printWindow) {
      printWindow.document.write('<html><head><title>Payment Receipt</title></head><body>');
      printWindow.document.write(generatePaymentVoucherHTML(order, payment));
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  };

  const sharePaymentVoucher = async (order: Order & { id: string }, payment: any) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Payment Receipt ${payment.id}`,
          text: `Payment of $${payment.amount.toFixed(2)} received for Invoice ${order.invoiceNumber || order.orderNumber}`,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      toast({ title: "Info", description: "Sharing not supported on this browser", variant: "default" });
    }
  };

  const handlePrintInvoice = (order: Order & { id: string }) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = generateInvoiceHTMLTemplate(order, products, storeProfile, formatCurrency);
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  const generateInvoiceHTML = (order: Order & { id: string }) => {
    return generateInvoiceHTMLTemplate(order, products, storeProfile, formatCurrency);
  };

  const handleDownloadPDF = async (order: Order & { id: string }) => {
    try {
      const html = generateInvoiceHTML(order);
      const container = document.createElement('div');
      container.innerHTML = html;
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      document.body.appendChild(container);

      const canvas = await html2canvas(container, { scale: 2 });
      document.body.removeChild(container);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`invoice-${order.id}.pdf`);
      toast({ title: "Success", description: "Invoice downloaded as PDF" });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({ title: "Error", description: "Failed to generate PDF", variant: "destructive" });
    }
  };

  const handleShareInvoice = async (order: Order & { id: string }) => {
    try {
      // Generate PDF
      const html = generateInvoiceHTML(order);
      const container = document.createElement('div');
      container.innerHTML = html;
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      document.body.appendChild(container);

      const canvas = await html2canvas(container, { scale: 2 });
      document.body.removeChild(container);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      
      // Get PDF as blob
      const pdfBlob = pdf.output('blob');
      const pdfFile = new File([pdfBlob], `invoice-${order.id}.pdf`, { type: 'application/pdf' });
      
      if (navigator.share && isMobile) {
        try {
          await navigator.share({
            title: `Invoice #${order.id}`,
            text: `Invoice for ${order.customerName}`,
            files: [pdfFile]
          });
          toast({ title: "Success", description: "Invoice PDF shared successfully" });
        } catch (error) {
          if ((error as Error).name !== 'AbortError') {
            console.error('Error sharing:', error);
            // Fallback to download
            pdf.save(`invoice-${order.id}.pdf`);
            toast({ title: "Downloaded", description: "Invoice PDF downloaded" });
          }
        }
      } else {
        // Desktop fallback - download PDF
        pdf.save(`invoice-${order.id}.pdf`);
        toast({ title: "Downloaded", description: "Invoice PDF downloaded" });
      }
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({ title: "Error", description: "Failed to generate PDF", variant: "destructive" });
    }
  };

  const addItemToOrder = () => {
    if (products.length === 0) {
      toast({ 
        title: "No Products", 
        description: "Please add products first before creating orders", 
        variant: "destructive" 
      });
      return;
    }
    setNewOrder({
      ...newOrder,
      items: [...newOrder.items, { 
        productId: products[0].id, 
        quantity: 1,
        discountType: 'percentage',
        discountValue: 0
      }]
    });
  };

  const updateOrderItem = (index: number, field: keyof OrderItem, value: any) => {
    const updatedItems = [...newOrder.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setNewOrder({ ...newOrder, items: updatedItems });
  };

  const removeOrderItem = (index: number) => {
    setNewOrder({
      ...newOrder,
      items: newOrder.items.filter((_, i) => i !== index)
    });
  };

  const getStatusBadge = (status?: string) => {
    const statusConfig = ORDER_STATUSES.find(s => s.value === status) || ORDER_STATUSES[0];
    return <Badge className={statusConfig.color}>{statusConfig.label}</Badge>;
  };

  const getPaymentBadge = (order: Order & { id: string }) => {
    const paymentStatus = order.paymentStatus || 'unpaid';
    const variants: Record<string, { color: string; label: string }> = {
      paid: { color: 'bg-green-100 text-green-800', label: 'Paid' },
      partial: { color: 'bg-yellow-100 text-yellow-800', label: 'Partial' },
      unpaid: { color: 'bg-red-100 text-red-800', label: 'Unpaid' },
    };
    
    if (order.status === 'cancelled') {
      return null;
    }
    
    return (
      <Badge className={variants[paymentStatus].color}>
        {variants[paymentStatus].label}
      </Badge>
    );
  };

  const totals = calculateOrderTotals(newOrder.items, newOrder.taxType, newOrder.taxRate, newOrder.discountType, newOrder.discountValue);

  return (
    <div className="min-h-screen bg-gray-50">
      {isMobile ? <MobileHeader title="Sales Orders" /> : null}
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {!isMobile && <BackButton />}
            <h1 className="text-2xl font-bold">Sales Orders</h1>
          </div>
          <Dialog open={isCreatingOrder} onOpenChange={setIsCreatingOrder}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Order
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Order</DialogTitle>
                <DialogDescription>Create a sales order for a customer</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="customer">Customer *</Label>
                    {isCreatingNewCustomer ? (
                      <div className="space-y-2 p-3 border rounded-md">
                        <Input
                          placeholder="Customer Name"
                          value={newOrder.customerName}
                          onChange={(e) => setNewOrder({ ...newOrder, customerName: e.target.value })}
                        />
                        <Input
                          placeholder="Phone"
                          value={newOrder.customerPhone}
                          onChange={(e) => setNewOrder({ ...newOrder, customerPhone: e.target.value })}
                        />
                        <Input
                          placeholder="Email (optional)"
                          type="email"
                          value={newOrder.customerEmail}
                          onChange={(e) => setNewOrder({ ...newOrder, customerEmail: e.target.value })}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleCreateInlineCustomer}>Save</Button>
                          <Button size="sm" variant="outline" onClick={() => setIsCreatingNewCustomer(false)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Select value={newOrder.customerId} onValueChange={(value) => setNewOrder({ ...newOrder, customerId: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select customer" />
                          </SelectTrigger>
                          <SelectContent>
                            {customers.map(customer => (
                              <SelectItem key={customer.id} value={customer.id}>
                                {customer.name} - {customer.phone}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => setIsCreatingNewCustomer(true)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add New Customer
                        </Button>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="salesPerson">Sales Person</Label>
                    <div className="space-y-2">
                      <Select value={newOrder.assignedSalesPerson} onValueChange={(value) => setNewOrder({ ...newOrder, assignedSalesPerson: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select sales person" />
                        </SelectTrigger>
                        <SelectContent>
                          {salesStaff.length === 0 ? (
                            <div className="p-2 text-sm text-gray-500">No sales people available</div>
                          ) : (
                            salesStaff.map(staff => (
                              <SelectItem key={staff.id} value={staff.id}>
                                {staff.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500">
                        To add sales people, go to Sub-Accounts menu and create a new sales account
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label>Order Items *</Label>
                    <Button type="button" size="sm" onClick={addItemToOrder}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Item
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {newOrder.items.map((item, index) => {
                      const product = products.find(p => p.id === item.productId);
                      const itemPrice = (product?.sellingPrice || product?.price || 0) * item.quantity;
                      let itemDiscount = 0;
                      if (item.discountType === 'percentage' && item.discountValue !== undefined) {
                        itemDiscount = (itemPrice * item.discountValue) / 100;
                      } else if (item.discountType === 'fixed' && item.discountValue !== undefined) {
                        itemDiscount = item.discountValue;
                      }
                      const itemTotal = itemPrice - itemDiscount;
                      
                      return (
                        <div key={index} className="p-3 bg-gray-50 rounded-lg space-y-2">
                          <div className="flex gap-2 items-center">
                            <Select
                              value={item.productId}
                              onValueChange={(value) => updateOrderItem(index, 'productId', value)}
                            >
                              <SelectTrigger className="flex-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {products.map(p => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name} - ${(p.sellingPrice || p.price || 0).toFixed(2)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={item.quantity || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateOrderItem(index, 'quantity', val === '' ? '' : parseFloat(val) || 0);
                              }}
                              className="w-20"
                              placeholder="Qty"
                            />
                            <div className="w-28 text-right font-medium">
                              ${itemTotal.toFixed(2)}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeOrderItem(index)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                          
                          {/* Item discount controls */}
                          <div className="flex gap-2 items-center pl-2">
                            <Label className="text-xs text-gray-600 w-16">Discount:</Label>
                            <Select
                              value={item.discountType || 'percentage'}
                              onValueChange={(value: 'percentage' | 'fixed') => updateOrderItem(index, 'discountType', value)}
                            >
                              <SelectTrigger className="w-32 h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="percentage">%</SelectItem>
                                <SelectItem value="fixed">$</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.discountValue === 0 ? '' : item.discountValue}
                              onChange={(e) => updateOrderItem(index, 'discountValue', e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0))}
                              className="w-24 h-8 text-xs"
                              placeholder="0"
                            />
                            {itemDiscount > 0 && (
                              <span className="text-xs text-green-600 font-medium">-${itemDiscount.toFixed(2)}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tax Type</Label>
                    <Select value={newOrder.taxType} onValueChange={(value: any) => setNewOrder({ ...newOrder, taxType: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Tax</SelectItem>
                        <SelectItem value="VAT">VAT</SelectItem>
                        <SelectItem value="TTC">TTC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {newOrder.taxType !== 'none' && (
                    <div>
                      <Label>Tax Rate (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={newOrder.taxRate === 0 ? '' : newOrder.taxRate}
                        onChange={(e) => setNewOrder({ ...newOrder, taxRate: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0) })}
                        placeholder="0.0"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Discount Type</Label>
                    <Select value={newOrder.discountType} onValueChange={(value: any) => setNewOrder({ ...newOrder, discountType: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage</SelectItem>
                        <SelectItem value="fixed">Fixed Amount</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Discount Value</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder={newOrder.discountType === 'percentage' ? "0%" : "0.00"}
                      value={newOrder.discountValue === 0 ? '' : newOrder.discountValue}
                      onChange={(e) => setNewOrder({ ...newOrder, discountValue: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0) })}
                    />
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Subtotal:</div>
                    <div className="text-right font-medium">${totals.subtotal.toFixed(2)}</div>
                    {totals.itemDiscounts > 0 && (
                      <>
                        <div className="text-xs text-gray-600">Item Discounts:</div>
                        <div className="text-right text-xs font-medium text-green-600">-${totals.itemDiscounts.toFixed(2)}</div>
                      </>
                    )}
                    {totals.orderDiscount > 0 && (
                      <>
                        <div className="text-xs text-gray-600">Order Discount:</div>
                        <div className="text-right text-xs font-medium text-green-600">-${totals.orderDiscount.toFixed(2)}</div>
                      </>
                    )}
                    {totals.taxAmount > 0 && (
                      <>
                        <div>Tax ({newOrder.taxRate}%):</div>
                        <div className="text-right font-medium">${totals.taxAmount.toFixed(2)}</div>
                      </>
                    )}
                    <div className="text-lg font-bold">Total:</div>
                    <div className="text-right text-lg font-bold text-blue-600">${totals.total.toFixed(2)}</div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreatingOrder(false)}>Cancel</Button>
                <Button onClick={handleCreateOrder}>Create Order</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4">
          {loading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-500">Loading orders...</p>
              </CardContent>
            </Card>
          ) : orders.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ShoppingCart className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500">No orders yet. Create your first order!</p>
              </CardContent>
            </Card>
          ) : (
            orders.map((order) => (
              <Card key={order.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {order.invoiceNumber ? order.invoiceNumber : `Order #${order.id.slice(0, 8)}`}
                        {getStatusBadge(order.status)}
                        {getPaymentBadge(order)}
                      </CardTitle>
                      <CardDescription>
                        {new Date(order.createdAt || '').toLocaleDateString()} | {order.customerName}
                        {order.assignedSalesPersonName && ` | Sales: ${order.assignedSalesPersonName}`}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={order.status}
                        onValueChange={(value) => handleStatusChange(order.id, value)}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ORDER_STATUSES.map(status => (
                            <SelectItem key={status.value} value={status.value}>
                              {status.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setViewingOrder(order)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handlePrintInvoice(order)}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleDownloadPDF(order)}
                        title="Download Invoice"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleShareInvoice(order)}
                        title="Share Invoice"
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                      {order.status !== 'cancelled' && (!order.paymentStatus || order.paymentStatus !== 'paid') && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            const remaining = (order.total || 0) - (order.amountPaid || 0);
                            setPayingOrder(order);
                            setPaymentData({
                              amountPaid: remaining,
                              paymentDate: new Date().toISOString().split('T')[0],
                              paymentMethod: 'cash',
                              paymentNotes: '',
                            });
                          }}
                        >
                          <DollarSign className="h-4 w-4 mr-1" />
                          Record Payment
                        </Button>
                      )}
                      {order.status === 'cancelled' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteOrder(order.id)}
                          title="Delete cancelled order"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Items</p>
                        <p className="font-medium">{order.items?.length || 0}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Total Amount</p>
                        <p className="font-bold text-lg">${(order.total || 0).toFixed(2)}</p>
                      </div>
                      {order.status !== 'cancelled' && (
                        <>
                          <div>
                            <p className="text-sm text-gray-500">Amount Paid</p>
                            <p className="font-bold text-lg text-green-600">${(order.amountPaid || 0).toFixed(2)}</p>
                          </div>
                          {order.paymentStatus !== 'paid' && (
                            <div>
                              <p className="text-sm text-gray-500">Amount Due</p>
                              <p className="font-bold text-lg text-red-600">
                                ${((order.total || 0) - (order.amountPaid || 0)).toFixed(2)}
                              </p>
                            </div>
                          )}
                        </>
                      )}
                      {order.paymentDate && (
                        <div>
                          <p className="text-sm text-gray-500">Payment Date</p>
                          <p className="font-medium">{new Date(order.paymentDate).toLocaleDateString()}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-sm text-gray-500">Subtotal</p>
                        <p className="font-medium">${(order.subtotal || 0).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Tax</p>
                        <p className="font-medium">${(order.taxAmount || 0).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Total</p>
                        <p className="font-bold text-green-600">${(order.total || 0).toFixed(2)}</p>
                      </div>
                    </div>
                    
                    {/* Delivery Information Preview */}
                    {(order.customerPhone || order.deliveryAddress) && (
                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                        <p className="text-xs font-semibold text-blue-900 mb-2">📦 Delivery Info</p>
                        <div className="space-y-1">
                          {order.customerPhone && (
                            <p className="text-sm text-blue-900">
                              <strong>📞 Phone:</strong> {order.customerPhone}
                            </p>
                          )}
                          {order.deliveryAddress && (
                            <p className="text-sm text-blue-900">
                              <strong>📍 Address:</strong> {order.deliveryAddress}
                              {order.deliveryCity && `, ${order.deliveryCity}`}
                            </p>
                          )}
                          {order.deliveryNotes && (
                            <p className="text-sm text-blue-900">
                              <strong>📝 Notes:</strong> {order.deliveryNotes}
                            </p>
                          )}
                          {order.deliveryCoordinates && order.deliveryCoordinates.lat !== 0 && (
                            <a 
                              href={`https://www.google.com/maps?q=${order.deliveryCoordinates.lat},${order.deliveryCoordinates.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
                            >
                              🗺️ Open Location in Maps →
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Payment History */}
                  {order.paymentHistory && order.paymentHistory.length > 0 && (
                    <div className="mt-3 border-t pt-3">
                      <p className="text-sm font-semibold mb-2">Payment History:</p>
                      <div className="space-y-2">
                        {order.paymentHistory.map((payment, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-green-50 rounded border border-green-200">
                            <div className="flex-1">
                              <p className="text-sm font-medium">${payment.amount.toFixed(2)} - {payment.method}</p>
                              <p className="text-xs text-gray-600">
                                {new Date(payment.date).toLocaleDateString()} by {payment.recordedBy}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setViewingPaymentVoucher({ order, payment })}
                                title="View Receipt"
                              >
                                <Download className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {viewingOrder && (
          <Dialog open={!!viewingOrder} onOpenChange={() => setViewingOrder(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{viewingOrder.invoiceNumber ? viewingOrder.invoiceNumber : `Order #${viewingOrder.id.slice(0, 8)}`}</DialogTitle>
                <DialogDescription>Complete order information</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Customer</Label>
                    <p className="font-medium">{viewingOrder.customerName}</p>
                    <p className="text-sm text-gray-500">{viewingOrder.customerPhone}</p>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <div className="mt-1">{getStatusBadge(viewingOrder.status)}</div>
                  </div>
                </div>

                {/* Delivery Information */}
                {(viewingOrder.deliveryAddress || viewingOrder.deliveryCity || viewingOrder.deliveryNotes || viewingOrder.deliveryCoordinates) && (
                  <div className="bg-blue-50 p-4 rounded">
                    <Label className="text-blue-900">Delivery Information</Label>
                    <div className="mt-2 space-y-1">
                      {viewingOrder.deliveryAddress && (
                        <p className="text-sm"><strong>Address:</strong> {viewingOrder.deliveryAddress}</p>
                      )}
                      {viewingOrder.deliveryCity && (
                        <p className="text-sm"><strong>City:</strong> {viewingOrder.deliveryCity}</p>
                      )}
                      {viewingOrder.deliveryNotes && (
                        <p className="text-sm"><strong>Notes:</strong> {viewingOrder.deliveryNotes}</p>
                      )}
                      {viewingOrder.deliveryCoordinates && viewingOrder.deliveryCoordinates.lat !== 0 && (
                        <p className="text-sm">
                          <strong>Location:</strong>{' '}
                          <a 
                            href={`https://www.google.com/maps?q=${viewingOrder.deliveryCoordinates.lat},${viewingOrder.deliveryCoordinates.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 underline"
                          >
                            {viewingOrder.deliveryCoordinates.lat.toFixed(4)}, {viewingOrder.deliveryCoordinates.lng.toFixed(4)} (Open in Maps)
                          </a>
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <Label>Items</Label>
                  <div className="mt-2 space-y-2">
                    {viewingOrder.items?.map((item, index) => {
                      const product = products.find(p => p.id === item.productId);
                      const itemPrice = item.price || product?.sellingPrice || product?.price || 0;
                      return (
                        <div key={index} className="flex justify-between p-2 bg-gray-50 rounded">
                          <span>{product?.name || 'Product'}</span>
                          <span className="font-medium">
                            {item.quantity} × ${itemPrice.toFixed(2)} = ${(itemPrice * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span className="font-medium">${(viewingOrder.subtotal || 0).toFixed(2)}</span>
                    </div>
                    {viewingOrder.discountAmount ? (
                      <div className="flex justify-between text-red-600">
                        <span>Discount:</span>
                        <span className="font-medium">-${viewingOrder.discountAmount.toFixed(2)}</span>
                      </div>
                    ) : null}
                    {viewingOrder.taxAmount ? (
                      <div className="flex justify-between">
                        <span>Tax ({viewingOrder.taxRate}%):</span>
                        <span className="font-medium">${viewingOrder.taxAmount.toFixed(2)}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between text-lg font-bold pt-2 border-t">
                      <span>Total:</span>
                      <span className="text-blue-600">${(viewingOrder.total || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => handlePrintInvoice(viewingOrder)}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print
                </Button>
                <Button variant="outline" onClick={() => handleDownloadPDF(viewingOrder)}>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
                <Button variant="outline" onClick={() => handleShareInvoice(viewingOrder)}>
                  <Share2 className="mr-2 h-4 w-4" />
                  Share
                </Button>
                <Button onClick={() => setViewingOrder(null)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Payment Dialog */}
        {payingOrder && (
          <Dialog open={!!payingOrder} onOpenChange={() => setPayingOrder(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Record Payment</DialogTitle>
                <DialogDescription>
                  Order: {payingOrder.invoiceNumber || `#${payingOrder.id.slice(0, 8)}`}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded">
                  <div>
                    <p className="text-sm text-gray-500">Total Amount</p>
                    <p className="font-bold">${(payingOrder.total || 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Already Paid</p>
                    <p className="font-bold text-green-600">${(payingOrder.amountPaid || 0).toFixed(2)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-gray-500">Amount Due</p>
                    <p className="font-bold text-red-600">
                      ${((payingOrder.total || 0) - (payingOrder.amountPaid || 0)).toFixed(2)}
                    </p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="paymentAmount">Payment Amount *</Label>
                  <Input
                    id="paymentAmount"
                    type="number"
                    min="0"
                    max={(payingOrder.total || 0) - (payingOrder.amountPaid || 0)}
                    step="0.01"
                    value={paymentData.amountPaid || ''}
                    onChange={(e) => setPaymentData({ ...paymentData, amountPaid: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                  />
                </div>

                <div>
                  <Label htmlFor="paymentDate">Payment Date *</Label>
                  <Input
                    id="paymentDate"
                    type="date"
                    value={paymentData.paymentDate}
                    onChange={(e) => setPaymentData({ ...paymentData, paymentDate: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="paymentMethod">Payment Method *</Label>
                  <Select
                    value={paymentData.paymentMethod}
                    onValueChange={(value) => setPaymentData({ ...paymentData, paymentMethod: value })}
                  >
                    <SelectTrigger id="paymentMethod">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                      <SelectItem value="credit_card">Credit Card</SelectItem>
                      <SelectItem value="mobile_payment">Mobile Payment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="paymentNotes">Notes (optional)</Label>
                  <Textarea
                    id="paymentNotes"
                    placeholder="Transaction reference, check number, etc."
                    value={paymentData.paymentNotes}
                    onChange={(e) => setPaymentData({ ...paymentData, paymentNotes: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPayingOrder(null)}>Cancel</Button>
                <Button onClick={handlePayOrder}>Record Payment</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Payment Voucher Dialog */}
        {viewingPaymentVoucher && (
          <Dialog open={!!viewingPaymentVoucher} onOpenChange={() => setViewingPaymentVoucher(null)}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Payment Receipt - {viewingPaymentVoucher.payment.id}</DialogTitle>
                <DialogDescription>Payment receipt and details</DialogDescription>
              </DialogHeader>
              <div dangerouslySetInnerHTML={{ __html: generatePaymentVoucherHTML(viewingPaymentVoucher.order, viewingPaymentVoucher.payment) }} />
              <DialogFooter className="flex gap-2">
                <Button variant="outline" onClick={() => printPaymentVoucher(viewingPaymentVoucher.order, viewingPaymentVoucher.payment)}>
                  <Printer className="h-4 w-4 mr-1" />
                  Print
                </Button>
                <Button variant="outline" onClick={() => downloadPaymentVoucher(viewingPaymentVoucher.order, viewingPaymentVoucher.payment)}>
                  <Download className="h-4 w-4 mr-1" />
                  Download PDF
                </Button>
                <Button variant="outline" onClick={() => sharePaymentVoucher(viewingPaymentVoucher.order, viewingPaymentVoucher.payment)}>
                  <Share2 className="h-4 w-4 mr-1" />
                  Share
                </Button>
                <Button onClick={() => setViewingPaymentVoucher(null)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </main>
    </div>
  );
};

export default AdminOrders;
