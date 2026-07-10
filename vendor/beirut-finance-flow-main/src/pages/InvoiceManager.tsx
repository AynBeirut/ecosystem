
import { useState, useEffect, useMemo } from "react";
import { listPaymentMethods } from "@/lib/firestore/paymentMethodsService";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FinancePageShell from "@/components/FinancePageShell";
import InvoiceList from "@/components/InvoiceList";
import { Plus, Trash, Share2, FileDown, Phone, Eye, X, User } from "lucide-react";
import { useAppContext } from "@/context/AppContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableCombobox } from "@/components/SearchableCombobox";
import { CURRENCIES } from "@/services/mockData";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ShareSheet from "@/components/ShareSheet";

const invoiceSchema = z.object({
  customer: z.string().optional(),
  clientId: z.string().optional(),
  currency: z.string().min(1, "Currency is required"),
  tax: z.coerce.number().default(0),
  discount: z.coerce.number().default(0),
  notes: z.string().optional(),
  template: z.string().default("basic"),
  paymentMethod: z.string().optional(),
});

const PAYMENT_METHOD_OPTIONS = [
  { value: 'stripe', label: 'Stripe' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'wish',   label: 'Wish' },
  { value: 'omt',    label: 'OMT' },
  { value: 'bank',   label: 'Bank' },
  { value: 'card',   label: 'Card' },
];
const OFFLINE_METHODS = ['omt','wish','bank'];

const InvoiceManager = () => {
  const { user, clients, products, createInvoice, previewInvoice, sendInvoice, exportInvoiceAsPdf, logout, checkLimit } = useAppContext();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>("list");
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<Array<{ id: string, description: string, quantity: number, unitPrice: number, subtotal: number }>>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false);
  const [shareRecipientEmail, setShareRecipientEmail] = useState("");
  const [shareRecipientPhone, setShareRecipientPhone] = useState("");
  const [shareClientName, setShareClientName] = useState("");
  const [previewInvoiceData, setPreviewInvoiceData] = useState<any>(null);
  const { activeOrganizationId, hasPermission, updateInvoice } = useAppContext() as any;
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false);

  useEffect(() => {
    if (!activeOrganizationId) { setPaymentMethods([]); return; }
    let cancelled = false;
    setLoadingPaymentMethods(true);
    (async () => {
      try {
        const rows = await listPaymentMethods(activeOrganizationId, true);
        if (!cancelled) setPaymentMethods(rows);
      } catch {
        if (!cancelled) setPaymentMethods([]);
      } finally {
        if (!cancelled) setLoadingPaymentMethods(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeOrganizationId]);

  const getPmConfig = (type: string) =>
    paymentMethods.find(p => p.type === type)?.config || {};


  const form = useForm<z.infer<typeof invoiceSchema>>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      customer: "",
      clientId: "",
      currency: "USD",
      tax: 0,
      discount: 0,
      notes: "",
      template: "basic",
      paymentMethod: "",
    },
  });

  const handleAddLineItem = () => {
    const newItem = {
      id: `item-${Date.now()}`,
      description: "",
      quantity: 1,
      unitPrice: 0,
      subtotal: 0
    };
    setLineItems([...lineItems, newItem]);
  };

  const handleRemoveLineItem = (itemId: string) => {
    setLineItems(lineItems.filter(item => item.id !== itemId));
  };

  const handleLineItemChange = (itemId: string, field: string, value: string) => {
    const updatedItems = lineItems.map(item => {
      if (item.id === itemId) {
        const updatedItem = { ...item };
        
        if (field === 'description') {
          updatedItem.description = value;
        } else {
          const numericValue = parseFloat(value) || 0;
          if (field === 'quantity') {
            updatedItem.quantity = numericValue;
          } else if (field === 'unitPrice') {
            updatedItem.unitPrice = numericValue;
          }
          
          updatedItem.subtotal = updatedItem.quantity * updatedItem.unitPrice;
        }
        
        return updatedItem;
      }
      return item;
    });
    
    setLineItems(updatedItems);
  };

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.subtotal, 0);
    const taxValue = form.watch('tax');
    const taxRate = typeof taxValue === 'number' ? taxValue / 100 : 0;
    const taxAmount = subtotal * taxRate;
    
    const discountValue = form.watch('discount');
    const discountAmount = typeof discountValue === 'number' ? discountValue : 0;
    
    const total = subtotal + taxAmount - discountAmount;

    return {
      subtotal,
      taxAmount,
      discountAmount,
      total
    };
  };

  const clientOptions = useMemo(
    () => clients.map((client) => ({
      value: client.id,
      label: client.name,
      keywords: [client.email, client.phone].filter(Boolean).join(' '),
    })),
    [clients],
  );

  const productOptions = useMemo(
    () => products.map((product) => ({
      value: product.id,
      label: `${product.name} — $${product.salePrice.toFixed(2)}`,
      keywords: product.sku || product.category || '',
    })),
    [products],
  );

  const handleClientSelect = (clientId: string) => {
    const selectedClient = clients.find(client => client.id === clientId);
    if (selectedClient) {
      form.setValue('customer', selectedClient.name);
      form.setValue('clientId', clientId);
    }
  };

  const resetCreateForm = () => {
    form.reset({
      customer: "",
      clientId: "",
      currency: "USD",
      tax: 0,
      discount: 0,
      notes: "",
      template: "basic",
      paymentMethod: "",
    });
    setLineItems([]);
    setEditingInvoiceId(null);
  };

  const handleEditInvoice = (invoice: {
    id: string;
    clientId?: string;
    clientName?: string;
    currency?: string;
    items?: Array<{ id: string; description: string; quantity: number; unitPrice: number; subtotal: number }>;
    tax?: number;
    discount?: number;
    notes?: string;
    template?: string;
    paymentMethod?: string;
  }) => {
    setEditingInvoiceId(invoice.id);
    form.reset({
      customer: invoice.clientName || "",
      clientId: invoice.clientId || "",
      currency: invoice.currency || "USD",
      tax: invoice.tax || 0,
      discount: invoice.discount || 0,
      notes: invoice.notes || "",
      template: invoice.template || "basic",
      paymentMethod: invoice.paymentMethod || "",
    });
    setLineItems(
      (invoice.items || []).map((item) => ({
        id: item.id || `item-${Date.now()}-${Math.random()}`,
        description: item.description || "",
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || 0,
        subtotal: item.subtotal || (item.quantity || 0) * (item.unitPrice || 0),
      })),
    );
    setActiveTab("create");
  };

  const handleProductSelect = (productId: string, itemId: string) => {
    const selectedProduct = products.find(product => product.id === productId);
    if (selectedProduct) {
      const updatedItems = lineItems.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            description: selectedProduct.name,
            unitPrice: selectedProduct.salePrice,
            subtotal: item.quantity * selectedProduct.salePrice
          };
        }
        return item;
      });
      setLineItems(updatedItems);
    }
  };

  const onSubmit = async () => {
    const values = form.getValues();
    console.log("[InvoiceManager] Form submitted with values:", values);
    console.log("[InvoiceManager] Line items:", lineItems);
    console.log("[InvoiceManager] User logged in:", !!user);
    
    if (lineItems.length === 0) {
      console.log("[InvoiceManager] Error: No line items");
      toast({
        title: "No Line Items",
        description: "Please add at least one line item to create an invoice.",
        variant: "destructive",
      });
      return;
    }
    
    if (!values.customer) {
      console.log("[InvoiceManager] Error: No customer name");
      toast({
        title: "Customer Required",
        description: "Please enter a customer name.",
        variant: "destructive",
      });
      return;
    }

    const totals = calculateTotals();
    console.log("[InvoiceManager] Calculated totals:", totals);

    if (editingInvoiceId) {
      try {
        updateInvoice(editingInvoiceId, {
          clientId: values.clientId || "",
          clientName: values.customer,
          amount: totals.total,
          currency: values.currency,
          items: lineItems,
          tax: values.tax,
          discount: values.discount,
          total: totals.total,
          template: values.template,
          paymentMethod: values.paymentMethod || null,
        });
        toast({
          title: "Invoice Updated",
          description: "Your invoice has been saved.",
        });
        resetCreateForm();
        setActiveTab("list");
      } catch (error) {
        console.error("[InvoiceManager] Error updating invoice:", error);
        toast({
          title: "Error",
          description: "Failed to update invoice.",
          variant: "destructive",
        });
      }
      return;
    }

    // Check limit before attempting to create
    const limitCheck = checkLimit("invoices");
    console.log("[InvoiceManager] Limit check result:", limitCheck);
    
    if (!limitCheck.allowed) {
      toast({
        title: "Limit Reached",
        description: limitCheck.message || "You've reached your monthly invoice limit. Please log in or upgrade.",
        variant: "destructive",
      });
      return;
    }

    try {
      const invoiceData = {
        clientId: values.clientId || "",
        clientName: values.customer,
        amount: totals.total,
        currency: values.currency,
        items: lineItems,
        tax: values.tax,
        discount: values.discount,
        total: totals.total,
        template: values.template,
        paymentMethod: values.paymentMethod || null,
      };
      
      console.log("[InvoiceManager] Creating invoice with data:", invoiceData);
      
      const invoiceId = await createInvoice(invoiceData);
      
      console.log("[InvoiceManager] Create result:", invoiceId);

      if (invoiceId) {
        console.log("[InvoiceManager] SUCCESS - Invoice created:", invoiceId);
        toast({
          title: "Invoice Created",
          description: `Invoice ${invoiceId} has been created successfully`,
        });
        resetCreateForm();
        setActiveTab("list");
      } else {
        console.log("[InvoiceManager] FAILED - createInvoice returned null");
        toast({
          title: "Error",
          description: "Failed to create invoice. Check stock availability or login status.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("[InvoiceManager] Exception during invoice creation:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while creating the invoice",
        variant: "destructive",
      });
    }
  };

  const handlePreviewInvoice = (invoiceData: any = null) => {
    if (invoiceData) {
      setSelectedInvoiceId(invoiceData.id);
      setPreviewInvoiceData(invoiceData);
    } else {
      const values = form.getValues();
      const totals = calculateTotals();
      
      setPreviewInvoiceData({
        customer: values.customer,
        items: lineItems,
        tax: values.tax,
        taxAmount: totals.taxAmount,
        discount: values.discount,
        subtotal: totals.subtotal,
        total: totals.total,
        currency: values.currency,
        date: new Date().toLocaleDateString(),
        notes: values.notes,
        company: user?.company,
      });
    }
    
    setIsPreviewOpen(true);
  };

  const handleSendInvoice = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    const inv = previewInvoice(invoiceId);
    const client = inv?.clientId ? clients.find((c) => c.id === inv.clientId) : null;
    setShareRecipientEmail(client?.email || "");
    setShareRecipientPhone(client?.phone || "");
    setShareClientName(inv?.clientName || client?.name || "");
    setIsShareSheetOpen(true);
  };

  const handleExportInvoice = async (invoiceId: string) => {
    const success = await exportInvoiceAsPdf(invoiceId);
    if (success) {
      toast({
        title: "Invoice Exported",
        description: "Your invoice has been exported to PDF",
      });
    } else {
      toast({
        title: "Export Failed",
        description: "Failed to export invoice. Please make sure the invoice is saved.",
        variant: "destructive",
      });
    }
  };

  const handleLogout = () => {
    logout();
    toast({
      title: "Logged out",
      description: "You've been successfully logged out",
    });
  };

  const totals = calculateTotals();

  return (
    <FinancePageShell onLogout={handleLogout}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Invoice Manager</h1>
            <p className="text-gray-500 dark:text-gray-400">Create and manage your invoices</p>
          </div>
          <Button 
            className="mt-4 sm:mt-0 bg-indigo-600 hover:bg-indigo-700"
            onClick={() => setActiveTab("create")}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Invoice
          </Button>
        </div>

        <Card>
          <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab}>
            <CardHeader>
              <TabsList>
                <TabsTrigger value="list">Invoice List</TabsTrigger>
                <TabsTrigger value="create">{editingInvoiceId ? "Edit Invoice" : "Create Invoice"}</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent>
              <TabsContent value="list">
              <div className="space-y-4">
                <InvoiceList 
                  onPreview={handlePreviewInvoice}
                  onSend={handleSendInvoice}
                  onEdit={handleEditInvoice}
                />
              </div>
            </TabsContent>
            <TabsContent value="create">
              <Form {...form}>
                <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Client</label>

                    {clients.length > 0 && !form.watch('clientId') && (
                      <SearchableCombobox
                        options={clientOptions}
                        value={form.watch('clientId')}
                        onValueChange={handleClientSelect}
                        placeholder="Search clients…"
                        searchPlaceholder="Search by name, email, phone…"
                        renderOption={(opt) => {
                          const c = clients.find((cl) => cl.id === opt.value);
                          return (
                            <div className="flex flex-col">
                              <span className="font-medium">{opt.label}</span>
                              {c && (c.email || c.phone) && (
                                <span className="text-xs text-muted-foreground">
                                  {[c.email, c.phone].filter(Boolean).join(' · ')}
                                </span>
                              )}
                            </div>
                          );
                        }}
                      />
                    )}

                    {(() => {
                      const selId = form.watch('clientId');
                      const selClient = selId ? clients.find((c) => c.id === selId) : null;
                      if (!selClient) return null;
                      return (
                        <div className="flex items-start gap-3 rounded-lg border border-teal-200 bg-teal-50/50 dark:border-teal-800 dark:bg-teal-950/30 p-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900">
                            <User className="h-4 w-4 text-teal-700 dark:text-teal-300" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{selClient.name}</p>
                            {selClient.email && (
                              <p className="text-xs text-muted-foreground truncate">{selClient.email}</p>
                            )}
                            {selClient.phone && (
                              <p className="text-xs text-muted-foreground">{selClient.phone}</p>
                            )}
                            {(selClient as any).address && (
                              <p className="text-xs text-muted-foreground truncate">{(selClient as any).address}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              form.setValue('clientId', '');
                              form.setValue('customer', '');
                            }}
                            className="shrink-0 rounded-full p-1 hover:bg-teal-200/60 dark:hover:bg-teal-800/60 transition-colors"
                            aria-label="Clear client"
                          >
                            <X className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </div>
                      );
                    })()}

                    {!form.watch('clientId') && (
                      <FormField
                        control={form.control}
                        name="customer"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-muted-foreground">Or type a name</FormLabel>
                            <FormControl>
                              <Input placeholder="Customer name or company" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium">Line Items</h3>
                      <Button 
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddLineItem}
                      >
                        <Plus className="mr-2 h-4 w-4" /> Add Item
                      </Button>
                    </div>

                    {lineItems.length === 0 ? (
                      <div className="text-center py-8 border rounded-md text-gray-500">
                        No items added yet. Click "Add Item" to add your first item.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {lineItems.map((item, index) => (
                          <div key={item.id} className="grid grid-cols-12 gap-2 items-end border p-3 rounded-md">
                            <div className="col-span-12 md:col-span-6">
                              <label className="text-sm font-medium mb-1 block">Description</label>
                              <div className="flex flex-col space-y-2">
                                {products.length > 0 && (
                                  <SearchableCombobox
                                    options={productOptions}
                                    onValueChange={(value) => handleProductSelect(value, item.id)}
                                    placeholder="Search products…"
                                    searchPlaceholder="Type product name or SKU…"
                                  />
                                )}
                                <Input
                                  placeholder="Item description"
                                  value={item.description}
                                  onChange={(e) => handleLineItemChange(item.id, 'description', e.target.value)}
                                />
                              </div>
                            </div>
                            <div className="col-span-3 md:col-span-2">
                              <label className="text-sm font-medium mb-1 block">Qty</label>
                              <NumericInput
                                value={item.quantity}
                                onValueChange={(n) => handleLineItemChange(item.id, 'quantity', n === null ? '' : String(n))}
                                placeholder="0"
                              />
                            </div>
                            <div className="col-span-4 md:col-span-2">
                              <label className="text-sm font-medium mb-1 block">Unit Price</label>
                              <NumericInput
                                value={item.unitPrice}
                                onValueChange={(n) => handleLineItemChange(item.id, 'unitPrice', n === null ? '' : String(n))}
                                placeholder="0.00"
                              />
                            </div>
                            <div className="col-span-3 md:col-span-1 text-right">
                              <label className="text-sm font-medium mb-1 block">Subtotal</label>
                              <div className="py-2 px-1 text-right">
                                ${(item.quantity * item.unitPrice).toFixed(2)}
                              </div>
                            </div>
                            <div className="col-span-2 md:col-span-1 flex justify-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-9 w-9 p-0 text-red-500"
                                onClick={() => handleRemoveLineItem(item.id)}
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 md:pl-[50%]">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-right">Subtotal:</div>
                      <div className="text-right font-medium">${totals.subtotal.toFixed(2)}</div>
                      
                      <div className="text-right flex justify-end items-center">
                        <FormField
                          control={form.control}
                          name="tax"
                          render={({ field }) => (
                            <div className="flex items-center">
                              <span className="mr-2">Tax:</span>
                              <NumericInput
                                className="w-20 text-right"
                                placeholder="0"
                                value={field.value as number | null | undefined}
                                onValueChange={(n) => field.onChange(n ?? 0)}
                                onBlur={field.onBlur}
                                name={field.name}
                                ref={field.ref}
                              />
                              <span className="ml-1">%</span>
                            </div>
                          )}
                        />
                      </div>
                      <div className="text-right font-medium">
                        ${totals.taxAmount.toFixed(2)}
                      </div>
                      
                      <div className="text-right flex justify-end items-center">
                        <FormField
                          control={form.control}
                          name="discount"
                          render={({ field }) => (
                            <div className="flex items-center">
                              <span className="mr-2">Discount:</span>
                              <NumericInput
                                className="w-20 text-right"
                                placeholder="0.00"
                                value={field.value as number | null | undefined}
                                onValueChange={(n) => field.onChange(n ?? 0)}
                                onBlur={field.onBlur}
                                name={field.name}
                                ref={field.ref}
                              />
                            </div>
                          )}
                        />
                      </div>
                      <div className="text-right font-medium">
                        ${totals.discountAmount.toFixed(2)}
                      </div>
                      
                      <div className="text-right text-lg">Total:</div>
                      <div className="text-right text-lg font-bold">${totals.total.toFixed(2)}</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Any additional notes for this invoice" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="currency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Currency</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select currency" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {CURRENCIES.map(currency => (
                                <SelectItem key={currency.code} value={currency.code}>
                                  {currency.code} - {currency.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="paymentMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Method</FormLabel>
                          <Select
                            onValueChange={(v) => field.onChange(v === 'none' ? '' : v)}
                            value={field.value || 'none'}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={loadingPaymentMethods ? "Loading…" : "Select payment method"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {PAYMENT_METHOD_OPTIONS
                                .filter(opt => paymentMethods.some(pm => pm.type === opt.value))
                                .map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>


                  <div className="pt-4 flex flex-wrap gap-3">
                    <Button 
                      type="submit" 
                      className="bg-indigo-600 hover:bg-indigo-700"
                    >
                      {editingInvoiceId ? "Save Invoice" : "Create Invoice"}
                    </Button>

                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => handlePreviewInvoice()}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Preview Invoice
                    </Button>
                  </div>
              </form>
            </Form>
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
      </div>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Invoice Preview</DialogTitle>
            <DialogDescription>
              Preview how your invoice will look to your clients
            </DialogDescription>
          </DialogHeader>

          {previewInvoiceData && (
            <div className="p-4 border rounded-md overflow-y-auto max-h-[70vh] bg-white">
              <div className="invoice-template-basic">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    {previewInvoiceData.company?.logo && (
                      <div className="mb-2">
                        <img 
                          src={previewInvoiceData.company.logo} 
                          alt="Company Logo" 
                          className="h-16 object-contain"
                        />
                      </div>
                    )}
                    <h2 className="text-xl font-bold">{previewInvoiceData.company?.name}</h2>
                    <p className="text-gray-500">{previewInvoiceData.company?.address}</p>
                    {previewInvoiceData.company?.email && (
                      <p className="text-gray-500">{previewInvoiceData.company.email}</p>
                    )}
                    {previewInvoiceData.company?.website && (
                      <p className="text-gray-500">{previewInvoiceData.company.website}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <h1 className="text-2xl font-bold text-indigo-600">INVOICE</h1>
                    <p className="text-gray-500">
                      Date: {previewInvoiceData.date}
                    </p>
                    <p className="text-gray-500">
                      Invoice #: {previewInvoiceData.id || "Draft"}
                    </p>
                  </div>
                </div>

                <div className="mb-8">
                  <h3 className="font-medium text-gray-700 mb-2">Bill To:</h3>
                  <p className="font-medium">{previewInvoiceData.customer}</p>
                  {previewInvoiceData.client && (
                    <>
                      <p>{previewInvoiceData.client.address}</p>
                      <p>{previewInvoiceData.client.email}</p>
                      <p>{previewInvoiceData.client.phone}</p>
                    </>
                  )}
                </div>

                <div className="mb-8">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="py-2 px-3 text-left">Description</th>
                        <th className="py-2 px-3 text-right">Quantity</th>
                        <th className="py-2 px-3 text-right">Unit Price</th>
                        <th className="py-2 px-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewInvoiceData.items?.map((item: any, i: number) => (
                        <tr key={i} className="border-b border-gray-200">
                          <td className="py-3 px-3">{item.description}</td>
                          <td className="py-3 px-3 text-right">{item.quantity}</td>
                          <td className="py-3 px-3 text-right">
                            {previewInvoiceData.currency} {item.unitPrice.toFixed(2)}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {previewInvoiceData.currency} {(item.quantity * item.unitPrice).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end">
                  <div className="w-64">
                    <div className="flex justify-between py-2">
                      <span>Subtotal:</span>
                      <span>{previewInvoiceData.currency} {previewInvoiceData.subtotal?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span>Tax ({previewInvoiceData.tax}%):</span>
                      <span>{previewInvoiceData.currency} {previewInvoiceData.taxAmount?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span>Discount:</span>
                      <span>{previewInvoiceData.currency} {previewInvoiceData.discount?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-2 font-bold border-t">
                      <span>Total:</span>
                      <span>{previewInvoiceData.currency} {previewInvoiceData.total?.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {previewInvoiceData.notes && (
                  <div className="mt-8 pt-4 border-t">
                    <h4 className="font-medium text-gray-700 mb-2">Notes:</h4>
                    <p className="text-gray-600">{previewInvoiceData.notes}</p>
                  </div>
                )}

                {previewInvoiceData.company?.signature && (
                  <div className="mt-8 pt-4 border-t">
                    <div className="flex justify-end">
                      <div className="text-center">
                        <img 
                          src={previewInvoiceData.company.signature} 
                          alt="Signature" 
                          className="h-16 object-contain mb-2"
                        />
                        <p className="text-gray-500">Authorized Signature</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedInvoiceId && (() => {
            const inv: any = previewInvoice(selectedInvoiceId);
            if (!inv) return null;
            const pm = inv.paymentMethod || inv.payment_method;
            if (!pm) return null;
            const cfg = getPmConfig(pm) || {};
            const isPaid = inv.status === 'paid';
            const isFailed = inv.status === 'payment_failed';
            const isPending = inv.status === 'pending_manual_payment';
            const amount = Number(inv.total ?? inv.amount ?? 0);
            const canConfirm = !!(hasPermission && (hasPermission('manage_billing') || hasPermission('manage_members')));
            const [busy, setBusy] = [
              (window as any).__payBusy?.[inv.id] === true,
              (v: boolean) => {
                (window as any).__payBusy = (window as any).__payBusy || {};
                (window as any).__payBusy[inv.id] = v;
              },
            ] as const;

            const payStripe = async () => {
              if ((window as any).__payBusy?.[inv.id]) return;
              if (!isSupabaseConfigured) {
                toast({ title: "Online payment unavailable", description: "Stripe checkout is not enabled in Grabio embed.", variant: "destructive" });
                return;
              }
              if (isPaid) { toast({ title: "Already paid" }); return; }
              if (!amount || amount <= 0) { toast({ title: "Invalid amount", description: "Invoice total must be greater than 0", variant: "destructive" }); return; }
              setBusy(true);
              try {
                const { data, error } = await supabase.functions.invoke('create-stripe-checkout', {
                  body: {
                    invoice_id: inv.id,
                    success_url: `${window.location.origin}/payment-success?invoice_id=${inv.id}`,
                    cancel_url: window.location.href,
                  },
                });
                if (error || !(data as any)?.url) {
                  toast({ title: "Stripe error", description: (error as any)?.message || "Could not start checkout", variant: "destructive" });
                  setBusy(false);
                  return;
                }
                window.location.href = (data as any).url;
              } catch (e: any) {
                toast({ title: "Stripe error", description: e?.message || String(e), variant: "destructive" });
                setBusy(false);
              }
            };

            const payPaypal = () => {
              if ((window as any).__payBusy?.[inv.id]) return;
              if (isPaid) { toast({ title: "Already paid" }); return; }
              if (!amount || amount <= 0) { toast({ title: "Invalid amount", variant: "destructive" }); return; }
              const url = (cfg as any)?.checkout_url;
              if (!url) { toast({ title: "PayPal not configured", description: "Missing checkout_url in payment method config", variant: "destructive" }); return; }
              setBusy(true);
              window.location.href = url;
            };

            const confirmManual = () => {
              if ((window as any).__payBusy?.[inv.id]) return;
              if (isPaid) { toast({ title: "Already paid" }); return; }
              if (!canConfirm) { toast({ title: "Not allowed", description: "Only owners/admins can confirm offline payments", variant: "destructive" }); return; }
              setBusy(true);
              try {
                updateInvoice(inv.id, {
                  status: 'paid' as any,
                  paidAt: new Date().toISOString(),
                  payment_verified: true,
                  payment_provider: pm,
                } as any);
                toast({ title: "Payment confirmed", description: `Invoice ${inv.id} marked as paid` });
              } finally {
                setTimeout(() => setBusy(false), 1500);
              }
            };

            return (
              <div className="mx-6 mb-2 p-4 border rounded-md bg-muted/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Payment — {String(pm).toUpperCase()}</div>
                  <div className="text-xs text-muted-foreground">Status: {inv.status}</div>
                </div>

                {!isPaid && (pm === 'stripe' || pm === 'card') && (
                  <Button disabled={busy || amount <= 0} onClick={payStripe}>
                    {busy ? "Starting checkout…" : "Pay with card"}
                  </Button>
                )}
                {!isPaid && pm === 'paypal' && (
                  <Button disabled={busy || amount <= 0} onClick={payPaypal}>
                    {busy ? "Redirecting…" : "Pay with PayPal"}
                  </Button>
                )}

                {OFFLINE_METHODS.includes(pm) && (
                  <div className="text-sm space-y-1">
                    {(cfg as any)?.instructions && <p className="whitespace-pre-wrap">{(cfg as any).instructions}</p>}
                    {(cfg as any)?.account_name && <p><b>Account name:</b> {(cfg as any).account_name}</p>}
                    {(cfg as any)?.account_number && <p><b>Account #:</b> {(cfg as any).account_number}</p>}
                    {(cfg as any)?.iban && <p><b>IBAN:</b> {(cfg as any).iban}</p>}
                    {(cfg as any)?.phone_number && <p><b>Phone:</b> {(cfg as any).phone_number}</p>}
                    {!isPaid && isPending && canConfirm && (
                      <Button size="sm" className="mt-2" disabled={busy} onClick={confirmManual}>
                        {busy ? "Confirming…" : "Confirm payment manually"}
                      </Button>
                    )}
                    {!isPaid && isPending && !canConfirm && (
                      <p className="text-xs text-muted-foreground mt-2">Awaiting owner/admin confirmation.</p>
                    )}
                  </div>
                )}

                {isFailed && (
                  <div className="text-xs text-red-700">Payment failed. Please retry.</div>
                )}
                {isPaid && inv.paidAt && (
                  <div className="text-xs text-green-700">Paid at {new Date(inv.paidAt).toLocaleString()}</div>
                )}
              </div>
            );
          })()}



          <DialogFooter className="flex justify-between items-center">
            <div>
              <Button 
                variant="outline" 
                onClick={() => setIsPreviewOpen(false)}
              >
                Close
              </Button>
            </div>
            <Button 
              onClick={() => {
                setIsPreviewOpen(false);
                if (selectedInvoiceId) {
                  handleSendInvoice(selectedInvoiceId);
                }
              }}
            >
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ShareSheet
        open={isShareSheetOpen}
        onOpenChange={setIsShareSheetOpen}
        documentId={selectedInvoiceId || ""}
        documentType="invoice"
        recipientEmail={shareRecipientEmail}
        recipientPhone={shareRecipientPhone}
        clientName={shareClientName}
      />
    </FinancePageShell>
  );
};

export default InvoiceManager;
