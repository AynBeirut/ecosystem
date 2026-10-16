
import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FinancePageShell from "@/components/FinancePageShell";
import { Plus, Trash, Mail, FileDown, Share2, Phone, Eye, X, Building } from "lucide-react";
import { useAppContext } from "@/context/AppContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableCombobox } from "@/components/SearchableCombobox";
import { StoreCurrencyField, useStoreDocumentCurrencies, clampStoreCurrency } from "@/components/StoreCurrencyField";
import { usePartyCurrencyAccounts } from "@/hooks/usePartyCurrencyAccounts";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDualCurrency } from "@/lib/utils";
import { useReportExchangeRate } from "@/hooks/useReportExchangeRate";
import { useNavigate } from "react-router-dom";
import AccountingSideSheet from "@/components/AccountingSideSheet";
import ShareSheet from "@/components/ShareSheet";
import { useInvoiceManagerDateFilterOptional } from "@/context/InvoiceManagerDateFilterContext";

// Define schema for purchase order form (without items - handled separately)
const purchaseOrderSchema = z.object({
  supplierName: z.string().optional(),
  supplierId: z.string().optional(),
  currency: z.string().min(1, "Currency is required"),
  notes: z.string().optional(),
});

type LineItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  currency?: string;
  accountCode?: string;
};

const PurchaseOrders = () => {
  const { user, suppliers, products, createPurchaseOrder, updatePurchaseOrder, previewPurchaseOrder, sendPurchaseOrder, exportPurchaseOrderAsPdf, purchaseOrders, logout, checkLimit } = useAppContext();
  const { toast } = useToast();
  const navigate = useNavigate();
  const dateFilter = useInvoiceManagerDateFilterOptional();
  const visiblePurchaseOrders = useMemo(
    () =>
      (purchaseOrders || []).filter(
        (po) => !dateFilter || dateFilter.matchesDate(po.date ?? po.createdAt),
      ),
    [purchaseOrders, dateFilter],
  );
  const [activeTab, setActiveTab] = useState<string>("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'partial' | 'unpaid'>('unpaid');
  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false);
  const [shareRecipientEmail, setShareRecipientEmail] = useState("");
  const [shareRecipientPhone, setShareRecipientPhone] = useState("");
  const [shareClientName, setShareClientName] = useState("");
  const [previewPurchaseOrderData, setPreviewPurchaseOrderData] = useState<any>(null);
  const { codes: storeCurrencies, main: storeCurrency } = useStoreDocumentCurrencies();
  const { usdToLbp } = useReportExchangeRate();

  const form = useForm<z.infer<typeof purchaseOrderSchema>>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: {
      supplierName: "",
      supplierId: "",
      currency: "USD",
      notes: "",
    },
  });
  const supplierId = form.watch("supplierId");
  const { accountFor } = usePartyCurrencyAccounts("supplier", supplierId);

  const stampLines = (items: LineItem[], docCurrency: string) => {
    const currency = clampStoreCurrency(docCurrency, storeCurrencies, storeCurrency);
    return items.map((item) => ({
      ...item,
      currency,
      accountCode: accountFor(currency)?.code || "",
    }));
  };

  useEffect(() => {
    if (editingId) return;
    const current = String(form.getValues("currency") || "").toUpperCase();
    if (!storeCurrencies.includes(current)) form.setValue("currency", storeCurrency);
  }, [editingId, form, storeCurrency, storeCurrencies]);

  // lineItems are managed separately from form

  const handleAddLineItem = () => {
    const newItem = {
      id: `item-${Date.now()}`,
      description: "",
      quantity: 1,
      unitPrice: 0,
      subtotal: 0,
      currency: clampStoreCurrency(form.getValues("currency"), storeCurrencies, storeCurrency),
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
    return {
      subtotal,
      total: subtotal
    };
  };

  const supplierOptions = useMemo(
    () => suppliers.map((supplier) => ({
      value: supplier.id,
      label: supplier.name,
      keywords: [supplier.email, supplier.phone].filter(Boolean).join(' '),
    })),
    [suppliers],
  );

  const productOptions = useMemo(
    () => products.map((product) => ({
      value: product.id,
      label: product.name,
      keywords: [product.sku, product.category].filter(Boolean).join(' '),
    })),
    [products],
  );

  const handleSupplierSelect = (supplierId: string) => {
    const selectedSupplier = suppliers.find(supplier => supplier.id === supplierId);
    if (selectedSupplier) {
      form.setValue('supplierName', selectedSupplier.name);
      form.setValue('supplierId', supplierId);
      console.log("Supplier selected:", selectedSupplier.name);
    }
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
      console.log("Product selected:", selectedProduct.name);
    }
  };

  const onSubmit = async () => {
    const values = form.getValues();
    console.log("Purchase Order form submitted with values:", values);

    if (lineItems.length === 0) {
      toast({
        title: "No Line Items",
        description: "Please add at least one line item to create a purchase order.",
        variant: "destructive",
      });
      return;
    }
    
    if (!values.supplierName) {
      toast({
        title: "Supplier Required",
        description: "Please enter a supplier name.",
        variant: "destructive",
      });
      return;
    }

    const stamped = stampLines(lineItems, values.currency);
    const headerCurrency = stamped[0]?.currency || storeCurrency;
    const headerAmount = stamped.reduce((sum, item) => sum + item.subtotal, 0);

    if (editingId) {
      updatePurchaseOrder(editingId, {
        supplierName: values.supplierName,
        supplierId: values.supplierId || undefined,
        currency: headerCurrency,
        notes: values.notes,
        items: stamped,
        amount: headerAmount,
        paymentStatus,
        paidAmount: paymentStatus === 'paid' ? headerAmount : paymentStatus === 'unpaid' ? 0 : undefined,
      });
      toast({ title: "Purchase order updated", description: values.supplierName });
      setEditingId(null);
      setPaymentStatus('unpaid');
      form.reset({ supplierName: "", supplierId: "", currency: storeCurrency, notes: "" });
      setLineItems([]);
      setActiveTab("list");
      return;
    }
    console.log("Calculated totals:", totals);

    // Check limit before attempting to create
    const limitCheck = checkLimit("purchaseOrders");
    if (!limitCheck.allowed) {
      toast({
        title: "Limit Reached",
        description: limitCheck.message || "You've reached your monthly purchase order limit.",
        variant: "destructive",
      });
      return;
    }

    try {
      const purchaseOrderId = await createPurchaseOrder({
        supplierName: values.supplierName,
        amount: headerAmount,
        currency: headerCurrency,
        items: stamped,
        supplierId: values.supplierId,
        notes: values.notes,
        paymentStatus,
        paidAmount: paymentStatus === 'paid' ? headerAmount : 0,
      });
      
      console.log("Purchase Order creation result:", purchaseOrderId);

      if (purchaseOrderId) {
        toast({
          title: "Purchase Order Created",
          description: "Your purchase order has been created successfully",
        });
        form.reset();
        setLineItems([]);
        setPaymentStatus('unpaid');
        setActiveTab("list");
      } else {
        toast({
          title: "Error",
          description: "Failed to create purchase order",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating purchase order:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while creating the purchase order",
        variant: "destructive",
      });
    }
  };

  const handlePreviewPurchaseOrder = (purchaseOrderData: any = null) => {
    if (purchaseOrderData) {
      setPreviewPurchaseOrderData(purchaseOrderData);
      setSelectedPurchaseOrderId(purchaseOrderData.id);
    } else {
      // Preview the current form data
      const formData = form.getValues();
      const totals = calculateTotals();
      
      setPreviewPurchaseOrderData({
        supplierName: formData.supplierName,
        date: new Date().toISOString().split('T')[0],
        items: lineItems,
        amount: totals.total,
        currency: formData.currency,
        notes: formData.notes,
      });
      setSelectedPurchaseOrderId(null);
    }
    
    setIsPreviewOpen(true);
  };

  const handleSendPurchaseOrder = (purchaseOrderId: string) => {
    setSelectedPurchaseOrderId(purchaseOrderId);
    const po = purchaseOrders.find((p) => p.id === purchaseOrderId);
    const supplier = po?.supplierId ? suppliers.find((s) => s.id === po.supplierId) : null;
    setShareRecipientEmail(supplier?.email || "");
    setShareRecipientPhone(supplier?.phone || "");
    setShareClientName(po?.supplierName || supplier?.name || "");
    setIsShareSheetOpen(true);
  };

  const handleExportPurchaseOrder = async (purchaseOrderId: string) => {
    const success = await exportPurchaseOrderAsPdf(purchaseOrderId);
    if (success) {
      toast({
        title: "Purchase Order Exported",
        description: "Your purchase order has been exported to PDF",
      });
    } else {
      toast({
        title: "Export Failed",
        description: "Failed to export purchase order. Please make sure it is saved.",
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
            <h1 className="text-2xl font-bold tracking-tight">Purchase Orders</h1>
            <p className="text-muted-foreground">Create and manage your purchase orders</p>
          </div>
          <Button className="mt-4 sm:mt-0" onClick={() => { setEditingId(null); form.reset({ supplierName: "", supplierId: "", currency: storeCurrency, notes: "" }); setLineItems([]); setActiveTab("create"); }}>
            <Plus className="mr-2 h-4 w-4" />
            New Purchase Order
          </Button>
        </div>

        <Card>
          <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab}>
            <CardHeader>
              <TabsList>
                <TabsTrigger value="list">Purchase Order List</TabsTrigger>
                <TabsTrigger value="create">{editingId ? "Edit Purchase Order" : "Create Purchase Order"}</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent>
              <TabsContent value="list">
              <div className="space-y-3">
                {visiblePurchaseOrders.length > 0 ? (
                  visiblePurchaseOrders.map((purchaseOrder) => (
                    <div
                      key={purchaseOrder.id}
                      className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <h3 className="font-medium">{purchaseOrder.supplierName}</h3>
                        <p className="text-sm text-muted-foreground">
                          {purchaseOrder.date} · {formatDualCurrency(Number(purchaseOrder.amount) || 0, purchaseOrder.currency, usdToLbp)} · {purchaseOrder.status}
                        </p>
                        <select
                          className="mt-2 h-9 rounded-md border bg-background px-2 text-sm"
                          value={purchaseOrder.paymentStatus === 'paid' || purchaseOrder.paymentStatus === 'partial' ? purchaseOrder.paymentStatus : 'unpaid'}
                          onChange={(e) => {
                            const next = e.target.value as 'paid' | 'partial' | 'unpaid';
                            const total = Number(purchaseOrder.amount) || 0;
                            updatePurchaseOrder(purchaseOrder.id, {
                              paymentStatus: next,
                              paidAmount: next === 'paid' ? total : next === 'unpaid' ? 0 : purchaseOrder.paidAmount || 0,
                            });
                          }}
                        >
                          <option value="unpaid">Unpaid</option>
                          <option value="partial">Partial</option>
                          <option value="paid">Paid</option>
                        </select>
                        <button
                          type="button"
                          style={{ marginTop: 8, background: "#0f766e", color: "#ffffff", border: 0, borderRadius: 6, padding: "6px 12px", fontWeight: 700 }}
                          onClick={() => {
                            setEditingId(purchaseOrder.id);
                            form.reset({
                              supplierName: purchaseOrder.supplierName || "",
                              supplierId: purchaseOrder.supplierId || "",
                              currency: purchaseOrder.currency || "USD",
                              notes: purchaseOrder.notes || "",
                            });
                            setLineItems((purchaseOrder.items || []).map((item, index) => ({
                              id: item.id || `item-${index}`,
                              description: item.description || "",
                              quantity: Number(item.quantity) || 0,
                              unitPrice: Number(item.unitPrice) || 0,
                              subtotal: Number(item.subtotal) || (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
                              currency: item.currency || purchaseOrder.currency || storeCurrency,
                              accountCode: item.accountCode || "",
                            })));
                            setPaymentStatus(
                              purchaseOrder.paymentStatus === 'paid' || purchaseOrder.paymentStatus === 'partial'
                                ? purchaseOrder.paymentStatus
                                : 'unpaid',
                            );
                            setActiveTab("create");
                          }}
                        >
                          Edit purchase
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => handlePreviewPurchaseOrder(purchaseOrder)}>
                          <Eye className="mr-2 h-4 w-4" />
                          Preview
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleSendPurchaseOrder(purchaseOrder.id)}>
                          <Share2 className="mr-2 h-4 w-4" />
                          Share
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleExportPurchaseOrder(purchaseOrder.id)}>
                          <FileDown className="mr-2 h-4 w-4" />
                          Export
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-8 text-center text-muted-foreground">No purchase orders found.</p>
                )}
              </div>
            </TabsContent>
            <TabsContent value="create">
              <Form {...form}>
                <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Supplier</label>

                    {suppliers.length > 0 && !form.watch('supplierId') && (
                      <SearchableCombobox
                        options={supplierOptions}
                        value={form.watch('supplierId')}
                        onValueChange={handleSupplierSelect}
                        placeholder="Search suppliers…"
                        searchPlaceholder="Search by name, email, phone…"
                        renderOption={(opt) => {
                          const s = suppliers.find((sup) => sup.id === opt.value);
                          return (
                            <div className="flex flex-col">
                              <span className="font-medium">{opt.label}</span>
                              {s && ((s as any).email || (s as any).phone) && (
                                <span className="text-xs text-muted-foreground">
                                  {[(s as any).email, (s as any).phone].filter(Boolean).join(' · ')}
                                </span>
                              )}
                            </div>
                          );
                        }}
                      />
                    )}

                    {(() => {
                      const selId = form.watch('supplierId');
                      const selSupplier = selId ? suppliers.find((s) => s.id === selId) : null;
                      if (!selSupplier) return null;
                      return (
                        <div className="flex items-start gap-3 rounded-lg border border-teal-200 bg-teal-50/50 dark:border-teal-800 dark:bg-teal-950/30 p-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900">
                            <Building className="h-4 w-4 text-teal-700 dark:text-teal-300" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{selSupplier.name}</p>
                            {(selSupplier as any).email && (
                              <p className="text-xs text-muted-foreground truncate">{(selSupplier as any).email}</p>
                            )}
                            {(selSupplier as any).phone && (
                              <p className="text-xs text-muted-foreground">{(selSupplier as any).phone}</p>
                            )}
                            {(selSupplier as any).address && (
                              <p className="text-xs text-muted-foreground truncate">{(selSupplier as any).address}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              form.setValue('supplierId', '');
                              form.setValue('supplierName', '');
                            }}
                            className="shrink-0 rounded-full p-1 hover:bg-teal-200/60 dark:hover:bg-teal-800/60 transition-colors"
                            aria-label="Clear supplier"
                          >
                            <X className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </div>
                      );
                    })()}

                    {!form.watch('supplierId') && (
                      <FormField
                        control={form.control}
                        name="supplierName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-muted-foreground">Or type a name</FormLabel>
                            <FormControl>
                              <Input placeholder="Supplier name or company" {...field} />
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
                      <div className="text-center py-8 border rounded-md text-muted-foreground">
                        No items added yet. Click "Add Item" to add your first item.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {lineItems.map((item, index) => (
                          <div key={item.id} className="grid grid-cols-12 gap-2 items-end border p-3 rounded-md">
                            <div className="col-span-12 md:col-span-5">
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
                            <div className="col-span-3 md:col-span-2 text-right">
                              <label className="text-sm font-medium mb-1 block">Subtotal</label>
                              <div className="py-2 px-1 text-right">
                                {formatCurrency(item.quantity * item.unitPrice, form.watch("currency") || storeCurrency)}
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
                      <div className="text-right text-lg">Total:</div>
                      <div className="text-right text-lg font-bold">
                        {formatDualCurrency(lineItems.reduce((sum, item) => sum + item.subtotal, 0), form.watch("currency") || storeCurrency, usdToLbp)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="currency"
                      render={({ field }) => (
                        <StoreCurrencyField value={field.value} onChange={field.onChange} />
                      )}
                    />
                    <div>
                      <label className="text-sm font-medium mb-1 block">Payment</label>
                      <select
                        className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                        value={paymentStatus}
                        onChange={(e) => setPaymentStatus(e.target.value as 'paid' | 'partial' | 'unpaid')}
                      >
                        <option value="unpaid">Unpaid</option>
                        <option value="partial">Partial</option>
                        <option value="paid">Paid</option>
                      </select>
                    </div>
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Any additional notes for this purchase order" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                  </div>

                  <div className="pt-4 flex flex-wrap gap-3">
                    <Button 
                      type="submit" 
                      className="mt-4"
                    >
                      {editingId ? "Save changes" : "Create Purchase Order"}
                    </Button>

                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => handlePreviewPurchaseOrder()}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Preview Purchase Order
                    </Button>
                  </div>
              </form>
            </Form>
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
      </div>

      <AccountingSideSheet
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        title="Purchase Order Preview"
        description="Preview how your purchase order will look."
        size="form"
        tall
        footer={
          <>
            <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>Close</Button>
            <Button
              variant="outline"
              className="ml-2"
              onClick={() => {
                setIsPreviewOpen(false);
                if (selectedPurchaseOrderId) handleSendPurchaseOrder(selectedPurchaseOrderId);
              }}
            >
              <Mail className="mr-2 h-4 w-4" />
              Share
            </Button>
            <Button
              className="ml-2"
              onClick={() => {
                setIsPreviewOpen(false);
                if (selectedPurchaseOrderId) {
                  handleExportPurchaseOrder(selectedPurchaseOrderId);
                } else {
                  toast({
                    title: "Info",
                    description: "Save the purchase order first to export it as PDF",
                  });
                }
              }}
            >
              <FileDown className="mr-2 h-4 w-4" />
              Save as PDF
            </Button>
          </>
        }
      >

          {previewPurchaseOrderData && (
            <div className="p-4 border rounded-md overflow-y-auto max-h-[70vh] bg-white">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-bold">PURCHASE ORDER</h2>
                  {selectedPurchaseOrderId && (
                    <p className="text-muted-foreground">#{selectedPurchaseOrderId}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-medium">Date: {previewPurchaseOrderData.date}</p>
                </div>
              </div>
              
              <div className="mb-6">
                <h3 className="font-medium mb-1">Supplier</h3>
                <p>{previewPurchaseOrderData.supplierName}</p>
              </div>
              
              <div className="mb-6">
                <h3 className="font-medium mb-2">Items</h3>
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-2">Description</th>
                      <th className="text-right p-2">Qty</th>
                      <th className="text-right p-2">Unit Price</th>
                      <th className="text-right p-2">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewPurchaseOrderData.items && previewPurchaseOrderData.items.map((item: any, index: number) => (
                      <tr key={index} className="border-b">
                        <td className="p-2">{item.description}</td>
                        <td className="text-right p-2">{item.quantity}</td>
                        <td className="text-right p-2">${item.unitPrice.toFixed(2)}</td>
                        <td className="text-right p-2">${(item.quantity * item.unitPrice).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="flex justify-end">
                <div className="w-1/3">
                  <div className="flex justify-between py-2">
                    <span>Total:</span>
                    <span className="font-bold">
                      {formatDualCurrency(Number(previewPurchaseOrderData.amount) || 0, previewPurchaseOrderData.currency, usdToLbp)}
                    </span>
                  </div>
                </div>
              </div>
              
              {previewPurchaseOrderData.notes && (
                <div className="mt-6 pt-4 border-t">
                  <h3 className="font-medium mb-2">Notes</h3>
                  <p className="text-sm">{previewPurchaseOrderData.notes}</p>
                </div>
              )}
            </div>
          )}

      </AccountingSideSheet>

      <ShareSheet
        open={isShareSheetOpen}
        onOpenChange={setIsShareSheetOpen}
        documentId={selectedPurchaseOrderId || ""}
        documentType="purchaseOrder"
        recipientEmail={shareRecipientEmail}
        recipientPhone={shareRecipientPhone}
        clientName={shareClientName}
      />
    </FinancePageShell>
  );
};

export default PurchaseOrders;
