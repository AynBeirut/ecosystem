
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AppLayout from "@/components/AppLayout";
import { Plus, Trash, Mail, FileDown, Share2, Phone, Eye, X, Building } from "lucide-react";
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
};

const PurchaseOrders = () => {
  const { user, suppliers, products, createPurchaseOrder, previewPurchaseOrder, sendPurchaseOrder, exportPurchaseOrderAsPdf, purchaseOrders, logout, checkLimit } = useAppContext();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>("list");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false);
  const [shareRecipientEmail, setShareRecipientEmail] = useState("");
  const [shareRecipientPhone, setShareRecipientPhone] = useState("");
  const [shareClientName, setShareClientName] = useState("");
  const [previewPurchaseOrderData, setPreviewPurchaseOrderData] = useState<any>(null);

  const form = useForm<z.infer<typeof purchaseOrderSchema>>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: {
      supplierName: "",
      supplierId: "",
      currency: "USD",
      notes: "",
    },
  });

  // lineItems are managed separately from form

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
      label: `${product.name} — $${product.salePrice.toFixed(2)}`,
      keywords: product.sku || product.category || '',
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

    const totals = calculateTotals();
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
      console.log("Creating purchase order with data:", {
        supplierName: values.supplierName,
        amount: totals.total,
        currency: values.currency,
        items: lineItems,
        notes: values.notes,
      });
      
      const purchaseOrderId = await createPurchaseOrder({
        supplierName: values.supplierName,
        amount: totals.total,
        currency: values.currency,
        items: lineItems,
        supplierId: values.supplierId,
        notes: values.notes,
      });
      
      console.log("Purchase Order creation result:", purchaseOrderId);

      if (purchaseOrderId) {
        toast({
          title: "Purchase Order Created",
          description: "Your purchase order has been created successfully",
        });
        form.reset();
        setLineItems([]);
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
    <AppLayout onLogout={handleLogout}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Purchase Orders</h1>
            <p className="text-gray-500 dark:text-gray-400">Create and manage your purchase orders</p>
          </div>
          <Button 
            className="mt-4 sm:mt-0 bg-indigo-600 hover:bg-indigo-700"
            onClick={() => setActiveTab("create")}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Purchase Order
          </Button>
        </div>

        <Card>
          <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab}>
            <CardHeader>
              <TabsList>
                <TabsTrigger value="list">Purchase Order List</TabsTrigger>
                <TabsTrigger value="create">Create Purchase Order</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent>
              <TabsContent value="list">
              <div className="space-y-4">
                {purchaseOrders && purchaseOrders.length > 0 ? (
                  purchaseOrders.map((purchaseOrder) => (
                    <Card key={purchaseOrder.id}>
                      <CardHeader>
                        <h3 className="text-lg font-semibold">{purchaseOrder.supplierName}</h3>
                        <p className="text-sm text-gray-500">Date: {purchaseOrder.date}</p>
                      </CardHeader>
                      <CardContent className="flex justify-between items-center">
                        <div>
                          <p>Amount: {purchaseOrder.amount} {purchaseOrder.currency}</p>
                          <p>Status: {purchaseOrder.status}</p>
                        </div>
                        <div className="flex space-x-2">
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
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <p>No purchase orders found.</p>
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
                            <Input placeholder="Any additional notes for this purchase order" {...field} />
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
                  </div>

                  <div className="pt-4 flex flex-wrap gap-3">
                    <Button 
                      type="submit" 
                      className="bg-indigo-600 hover:bg-indigo-700"
                    >
                      Create Purchase Order
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

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Purchase Order Preview</DialogTitle>
            <DialogDescription>
              Preview how your purchase order will look.
            </DialogDescription>
          </DialogHeader>

          {previewPurchaseOrderData && (
            <div className="p-4 border rounded-md overflow-y-auto max-h-[70vh] bg-white">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-bold">PURCHASE ORDER</h2>
                  {selectedPurchaseOrderId && (
                    <p className="text-gray-600">#{selectedPurchaseOrderId}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-medium">Date: {previewPurchaseOrderData.date}</p>
                </div>
              </div>
              
              <div className="mb-6">
                <h3 className="font-medium text-gray-700 mb-1">Supplier</h3>
                <p>{previewPurchaseOrderData.supplierName}</p>
              </div>
              
              <div className="mb-6">
                <h3 className="font-medium text-gray-700 mb-2">Items</h3>
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
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
                      ${previewPurchaseOrderData.amount.toFixed(2)} {previewPurchaseOrderData.currency}
                    </span>
                  </div>
                </div>
              </div>
              
              {previewPurchaseOrderData.notes && (
                <div className="mt-6 pt-4 border-t">
                  <h3 className="font-medium text-gray-700 mb-2">Notes</h3>
                  <p className="text-sm">{previewPurchaseOrderData.notes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex justify-between items-center">
            <div>
              <Button 
                variant="outline" 
                onClick={() => setIsPreviewOpen(false)}
              >
                Close
              </Button>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={() => {
                  setIsPreviewOpen(false);
                  if (selectedPurchaseOrderId) {
                    handleSendPurchaseOrder(selectedPurchaseOrderId);
                  }
                }}
              >
                <Mail className="mr-2 h-4 w-4" />
                Share
              </Button>
              <Button 
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
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ShareSheet
        open={isShareSheetOpen}
        onOpenChange={setIsShareSheetOpen}
        documentId={selectedPurchaseOrderId || ""}
        documentType="purchaseOrder"
        recipientEmail={shareRecipientEmail}
        recipientPhone={shareRecipientPhone}
        clientName={shareClientName}
      />
    </AppLayout>
  );
};

export default PurchaseOrders;
