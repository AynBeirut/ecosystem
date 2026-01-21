import React, { useEffect, useState } from 'react';
import { getFirestore, collection, query, where, getDocs, updateDoc, doc, getDoc, addDoc } from 'firebase/firestore';
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
import { useToast } from '@/hooks/use-toast';
import { Order, OrderItem } from '@/types/order';
import { ComposedProduct } from '@/types/product';
import { Customer } from '@/types/customer';
import { StaffMember } from '@/types/staff';
import { StoreProfile } from '@/types/storeProfile';
import { ShoppingCart, Plus, Printer, FileText, Download, Eye, Trash2, User, Share2 } from 'lucide-react';
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
      if (!user?.storeId) return;
      setLoading(true);
      const db = getFirestore();

      const fetchCollection = async (collectionName: string) => {
        const ref = collection(db, collectionName);
        const q = query(ref, where('storeId', '==', user.storeId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      };

      // Fetch store profile
      const profileRef = doc(db, 'storeProfiles', user.storeId);
      const profileSnap = await getDoc(profileRef);
      if (profileSnap.exists()) {
        setStoreProfile(profileSnap.data() as StoreProfile);
      }

      const [ordersData, productsData, customersData, staffData] = await Promise.all([
        fetchCollection('orders'),
        fetchCollection('products'),
        fetchCollection('customers'),
        fetchCollection('staff'),
      ]);

      setOrders(ordersData as (Order & { id: string })[]);
      setProducts(productsData);
      setCustomers(customersData as Customer[]);
      setSalesStaff((staffData as StaffMember[]).filter(s => s.role === 'sales_person' && s.status === 'active'));
      setLoading(false);
    };
    fetchData();
  }, [user?.storeId]);

  const calculateOrderTotals = (items: OrderItem[], taxType: string, taxRate: number, discountType: string, discountValue: number) => {
    const subtotal = items.reduce((sum, item) => {
      const product = products.find(p => p.id === item.productId);
      return sum + ((product?.sellingPrice || product?.price || 0) * item.quantity);
    }, 0);

    let discountAmount = 0;
    if (discountType === 'percentage') {
      discountAmount = (subtotal * discountValue) / 100;
    } else {
      discountAmount = discountValue;
    }

    const afterDiscount = subtotal - discountAmount;
    
    let taxAmount = 0;
    if (taxType !== 'none') {
      taxAmount = (afterDiscount * taxRate) / 100;
    }

    const total = afterDiscount + taxAmount;

    return { subtotal, discountAmount, taxAmount, total };
  };

  const generateInvoiceNumber = async (): Promise<string> => {
    if (!user?.storeId || !storeProfile) return 'INV-001';
    
    const db = getFirestore();
    const profileRef = doc(db, 'storeProfiles', user.storeId);
    
    const prefix = storeProfile.invoiceNumberPrefix || 'INV';
    const lastNumber = storeProfile.lastInvoiceNumber || 0;
    const newNumber = lastNumber + 1;
    const invoiceNumber = `${prefix}-${String(newNumber).padStart(3, '0')}`;
    
    // Update last invoice number in store profile
    await updateDoc(profileRef, { lastInvoiceNumber: newNumber });
    
    return invoiceNumber;
  };

  const formatCurrency = (amount: number, showDual: boolean = true): string => {
    const usd = `$${amount.toFixed(2)}`;
    
    if (showDual && storeProfile?.customExchangeRate && storeProfile.customExchangeRate > 0) {
      const lbp = (amount * storeProfile.customExchangeRate).toFixed(0);
      return `${usd} (${Number(lbp).toLocaleString()} LBP)`;
    }
    
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

      const orderData = {
        storeId: user.storeId,
        customerId: newOrder.customerId,
        customerName: customer?.name || '',
        customerPhone: customer?.phone || '',
        customerEmail: customer?.email || '',
        invoiceNumber,
        items: newOrder.items,
        subtotal,
        taxType: newOrder.taxType,
        taxRate: newOrder.taxRate,
        taxAmount,
        discountType: newOrder.discountType,
        discountValue: newOrder.discountValue,
        discountAmount,
        total,
        status: 'pending',
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
      await updateDoc(orderRef, { status: newStatus });
      setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      toast({ title: "Success", description: "Order status updated!" });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
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
    const html = generateInvoiceHTML(order);
    const invoiceText = `Invoice #${order.id}\nCustomer: ${order.customerName}\nTotal: $${(order.total || 0).toFixed(2)}\n\nThank you for your business!`;
    
    if (navigator.share && isMobile) {
      try {
        const blob = new Blob([html], { type: 'text/html' });
        const file = new File([blob], `invoice-${order.id}.html`, { type: 'text/html' });
        
        await navigator.share({
          title: `Invoice #${order.id}`,
          text: invoiceText,
          files: [file]
        });
        toast({ title: "Success", description: "Invoice shared successfully" });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Error sharing:', error);
          // Fallback to WhatsApp
          const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(invoiceText)}`;
          window.open(whatsappUrl, '_blank');
        }
      }
    } else {
      // Desktop fallback - copy to clipboard
      navigator.clipboard.writeText(invoiceText);
      toast({ title: "Copied", description: "Invoice details copied to clipboard" });
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
      items: [...newOrder.items, { productId: products[0].id, quantity: 1 }]
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
                    {isCreatingNewSalesPerson ? (
                      <div className="space-y-2 p-3 border rounded-md">
                        <Input
                          placeholder="Sales Person Name"
                          value={newOrder.salesPersonName}
                          onChange={(e) => setNewOrder({ ...newOrder, salesPersonName: e.target.value })}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleCreateInlineSalesPerson}>Save</Button>
                          <Button size="sm" variant="outline" onClick={() => setIsCreatingNewSalesPerson(false)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Select value={newOrder.assignedSalesPerson} onValueChange={(value) => setNewOrder({ ...newOrder, assignedSalesPerson: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select sales person" />
                          </SelectTrigger>
                          <SelectContent>
                            {salesStaff.map(staff => (
                              <SelectItem key={staff.id} value={staff.id}>
                                {staff.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => setIsCreatingNewSalesPerson(true)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add New Sales Person
                        </Button>
                      </div>
                    )}
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
                      return (
                        <div key={index} className="flex gap-2 items-center p-2 bg-gray-50 rounded">
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
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateOrderItem(index, 'quantity', parseInt(e.target.value) || 1)}
                            className="w-24"
                            placeholder="Qty"
                          />
                          <div className="w-32 text-right font-medium">
                            ${((product?.sellingPrice || product?.price || 0) * item.quantity).toFixed(2)}
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
                        value={newOrder.taxRate}
                        onChange={(e) => setNewOrder({ ...newOrder, taxRate: parseFloat(e.target.value) || 0 })}
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
                      placeholder={newOrder.discountType === 'percentage' ? "Enter %" : "Enter amount"}
                      value={newOrder.discountValue || ''}
                      onChange={(e) => setNewOrder({ ...newOrder, discountValue: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Subtotal:</div>
                    <div className="text-right font-medium">${totals.subtotal.toFixed(2)}</div>
                    {totals.discountAmount > 0 && (
                      <>
                        <div>Discount:</div>
                        <div className="text-right font-medium text-red-600">-${totals.discountAmount.toFixed(2)}</div>
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
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Items</p>
                      <p className="font-medium">{order.items?.length || 0}</p>
                    </div>
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

                <div>
                  <Label>Items</Label>
                  <div className="mt-2 space-y-2">
                    {viewingOrder.items?.map((item, index) => {
                      const product = products.find(p => p.id === item.productId);
                      return (
                        <div key={index} className="flex justify-between p-2 bg-gray-50 rounded">
                          <span>{product?.name || 'Product'}</span>
                          <span className="font-medium">
                            {item.quantity} × ${(product?.sellingPrice || 0).toFixed(2)} = ${((product?.sellingPrice || 0) * item.quantity).toFixed(2)}
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
      </main>
    </div>
  );
};

export default AdminOrders;
