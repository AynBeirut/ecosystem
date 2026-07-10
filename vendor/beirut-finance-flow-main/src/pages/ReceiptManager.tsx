
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FinancePageShell from "@/components/FinancePageShell";
import { Plus, Eye, FileDown, Share2, Mail, Phone } from "lucide-react";
import { useAppContext } from "@/context/AppContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableCombobox } from "@/components/SearchableCombobox";
import { CURRENCIES } from "@/services/mockData";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ShareSheet from "@/components/ShareSheet";

const receiptSchema = z.object({
  clientName: z.string().min(1, "Client name is required"),
  clientId: z.string().optional(),
  amount: z.coerce.number().min(0.01, "Amount is required"),
  paymentDate: z.string().min(1, "Payment date is required"),
  paymentMethod: z.string().min(1, "Payment method is required"),
  currency: z.string().min(1, "Currency is required"),
  notes: z.string().optional(),
});

const paymentOrderSchema = z.object({
  supplierName: z.string().min(1, "Supplier name is required"),
  supplierId: z.string().optional(),
  amount: z.coerce.number().min(0.01, "Amount is required"),
  paymentDate: z.string().min(1, "Payment date is required"),
  paymentMethod: z.string().min(1, "Payment method is required"),
  currency: z.string().min(1, "Currency is required"),
  notes: z.string().optional(),
});

const ReceiptManager = () => {
  const { 
    user, clients, suppliers, receipts, paymentOrders, purchaseOrders,
    createReceipt, createPaymentOrder, markPaymentOrderPaid,
    previewReceipt, previewPaymentOrder, 
    sendReceipt, sendPaymentOrder, 
    exportReceiptAsPdf, exportPaymentOrderAsPdf, 
    logout
  } = useAppContext();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState("receipts-list");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewType, setPreviewType] = useState<"receipt" | "payment">("receipt");
  const [shareRecipientEmail, setShareRecipientEmail] = useState("");
  const [shareRecipientPhone, setShareRecipientPhone] = useState("");
  const [shareClientName, setShareClientName] = useState("");
  const [shareDocType, setShareDocType] = useState<"receipt" | "paymentOrder">("receipt");

  const receiptForm = useForm<z.infer<typeof receiptSchema>>({
    resolver: zodResolver(receiptSchema),
    defaultValues: {
      clientName: "",
      clientId: "",
      amount: 0,
      paymentDate: new Date().toISOString().split("T")[0],
      paymentMethod: "cash",
      currency: "USD",
      notes: "",
    },
  });

  const paymentOrderForm = useForm<z.infer<typeof paymentOrderSchema>>({
    resolver: zodResolver(paymentOrderSchema),
    defaultValues: {
      supplierName: "",
      supplierId: "",
      amount: 0,
      paymentDate: new Date().toISOString().split("T")[0],
      paymentMethod: "cash",
      currency: "USD",
      notes: "",
    },
  });

  const handleClientSelect = (clientId: string) => {
    const selectedClient = clients.find(client => client.id === clientId);
    if (selectedClient) {
      receiptForm.setValue('clientName', selectedClient.name);
      receiptForm.setValue('clientId', clientId);
    }
  };

  const handleSupplierSelect = (supplierId: string) => {
    const selectedSupplier = suppliers.find(supplier => supplier.id === supplierId);
    if (selectedSupplier) {
      paymentOrderForm.setValue('supplierName', selectedSupplier.name);
      paymentOrderForm.setValue('supplierId', supplierId);
    }
  };

  const clientOptions = useMemo(
    () => clients.map((client) => ({
      value: client.id,
      label: client.name,
      keywords: [client.email, client.phone].filter(Boolean).join(' '),
    })),
    [clients],
  );

  const supplierOptions = useMemo(
    () => suppliers.map((supplier) => ({
      value: supplier.id,
      label: supplier.name,
      keywords: [supplier.email, supplier.phone].filter(Boolean).join(' '),
    })),
    [suppliers],
  );

  const onReceiptSubmit = async (values: z.infer<typeof receiptSchema>) => {
    const success = await createReceipt({
      clientName: values.clientName,
      amount: values.amount,
      currency: values.currency,
      paymentDate: values.paymentDate,
      paymentMethod: values.paymentMethod,
      notes: values.notes,
      clientId: values.clientId,
      vendor: values.clientName,
      category: "payment receipt",
    });

    if (success) {
      toast({
        title: "Receipt Created",
        description: "Your receipt has been created successfully",
      });
      receiptForm.reset();
      setActiveTab("receipts-list");
    }
    // On failure the context already surfaced a readable toast.error;
    // preserve form state so the user can retry.
  };

  const onPaymentOrderSubmit = (values: z.infer<typeof paymentOrderSchema>) => {
    const success = createPaymentOrder({
      supplierName: values.supplierName,
      amount: values.amount,
      currency: values.currency,
      paymentMethod: values.paymentMethod,
      notes: values.notes,
      supplierId: values.supplierId,
    });

    if (success) {
      toast({
        title: "Payment Order Created",
        description: "Your payment order has been created successfully",
      });
      paymentOrderForm.reset();
      setActiveTab("payments-list");
    } else {
      toast({
        title: "Error",
        description: "Failed to create payment order",
        variant: "destructive",
      });
    }
  };

  const handlePreviewReceipt = (receiptData: any = null) => {
    if (receiptData) {
      setSelectedItemId(receiptData.id);
      setPreviewData(receiptData);
    } else {
      const values = receiptForm.getValues();
      
      setPreviewData({
        id: "DRAFT",
        clientName: values.clientName,
        amount: values.amount,
        currency: values.currency,
        paymentDate: values.paymentDate,
        paymentMethod: values.paymentMethod,
        notes: values.notes,
        date: new Date().toLocaleDateString(),
        company: user?.company,
        client: values.clientId ? clients.find(client => client.id === values.clientId) : undefined,
      });
    }
    
    setPreviewType("receipt");
    setIsPreviewOpen(true);
  };

  const handlePreviewPaymentOrder = (paymentOrderData: any = null) => {
    if (paymentOrderData) {
      setSelectedItemId(paymentOrderData.id);
      setPreviewData(paymentOrderData);
    } else {
      const values = paymentOrderForm.getValues();
      
      setPreviewData({
        id: "DRAFT",
        supplierName: values.supplierName,
        amount: values.amount,
        currency: values.currency,
        paymentDate: values.paymentDate,
        paymentMethod: values.paymentMethod,
        notes: values.notes,
        date: new Date().toLocaleDateString(),
        company: user?.company,
        supplier: values.supplierId ? suppliers.find(supplier => supplier.id === values.supplierId) : undefined,
      });
    }
    
    setPreviewType("payment");
    setIsPreviewOpen(true);
  };

  const handleSendItem = (itemId: string, type: "receipt" | "payment") => {
    setSelectedItemId(itemId);
    setPreviewType(type);
    setShareDocType(type === "receipt" ? "receipt" : "paymentOrder");
    if (type === "receipt") {
      const receipt = receipts.find((r) => r.id === itemId);
      const client = receipt?.clientId ? clients.find((c) => c.id === receipt.clientId) : null;
      setShareRecipientEmail(client?.email || "");
      setShareRecipientPhone(client?.phone || "");
      setShareClientName(receipt?.clientName || client?.name || "");
    } else {
      const payment = paymentOrders.find((p) => p.id === itemId);
      const supplier = payment?.supplierId ? suppliers.find((s) => s.id === payment.supplierId) : null;
      setShareRecipientEmail(supplier?.email || "");
      setShareRecipientPhone(supplier?.phone || "");
      setShareClientName(payment?.supplierName || supplier?.name || "");
    }
    setIsShareSheetOpen(true);
  };

  const handleExportItem = async (itemId: string, type: "receipt" | "payment") => {
    let success = false;
    
    if (type === "receipt") {
      success = await exportReceiptAsPdf(itemId);
      if (success) {
        toast({
          title: "Receipt Exported",
          description: "Your receipt has been exported to PDF",
        });
      } else {
        toast({
          title: "Export Failed",
          description: "Failed to export receipt. Please make sure it is saved.",
          variant: "destructive",
        });
      }
    } else {
      success = await exportPaymentOrderAsPdf(itemId);
      if (success) {
        toast({
          title: "Payment Order Exported",
          description: "Your payment order has been exported to PDF",
        });
      } else {
        toast({
          title: "Export Failed",
          description: "Failed to export payment order. Please make sure it is saved.",
          variant: "destructive",
        });
      }
    }
  };

  const handleLogout = () => {
    logout();
    toast({
      title: "Logged out",
      description: "You've been successfully logged out",
    });
  };

  return (
    <FinancePageShell onLogout={handleLogout}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Receipts & Payment Orders</h1>
            <p className="text-gray-500 dark:text-gray-400">Create and manage your receipts and payment orders</p>
          </div>
        </div>

        <Card>
          <Tabs defaultValue="receipts-list" value={activeTab} onValueChange={setActiveTab}>
            <CardHeader>
              <TabsList className="grid grid-cols-2 md:grid-cols-4">
                <TabsTrigger value="receipts-list">Receipts List</TabsTrigger>
                <TabsTrigger value="create-receipt">New Receipt</TabsTrigger>
                <TabsTrigger value="payments-list">Payment Orders List</TabsTrigger>
                <TabsTrigger value="create-payment">New Payment Order</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent>
              <TabsContent value="receipts-list">
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button 
                    onClick={() => setActiveTab("create-receipt")}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    New Receipt
                  </Button>
                </div>
                
                {receipts.length === 0 ? (
                  <div className="text-center py-8 border rounded-md text-gray-500">
                    No receipts yet. Click "New Receipt" to create your first receipt.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-md border">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-100 dark:bg-gray-800">
                              <th className="py-3 px-4 text-left font-medium">Receipt #</th>
                              <th className="py-3 px-4 text-left font-medium">Date</th>
                              <th className="py-3 px-4 text-left font-medium">Client</th>
                              <th className="py-3 px-4 text-right font-medium">Amount</th>
                              <th className="py-3 px-4 text-left font-medium">Payment Method</th>
                              <th className="py-3 px-4 text-right font-medium">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {receipts
                              .map(receipt => {
                                const client = receipt.clientId ? clients.find(c => c.id === receipt.clientId) : undefined;
                                return (
                                <tr key={receipt.id} className="border-t">
                                  <td className="py-3 px-4">{receipt.id}</td>
                                  <td className="py-3 px-4">{receipt.paymentDate || receipt.date}</td>
                                  <td className="py-3 px-4">{receipt.clientName || client?.name}</td>
                                  <td className="py-3 px-4 text-right">
                                    {receipt.currency} {receipt.amount.toFixed(2)}
                                  </td>
                                  <td className="py-3 px-4">{receipt.paymentMethod || "Cash"}</td>
                                  <td className="py-3 px-4 text-right">
                                    <div className="flex justify-end items-center space-x-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handlePreviewReceipt(receipt)}
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleSendItem(receipt.id, "receipt")}
                                      >
                                        <Share2 className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleExportItem(receipt.id, "receipt")}
                                      >
                                        <FileDown className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="create-receipt">
              <div className="space-y-4">
                <Form {...receiptForm}>
                  <form onSubmit={receiptForm.handleSubmit(onReceiptSubmit)} className="space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Client Information</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {clients.length > 0 && (
                          <div>
                            <label className="text-sm font-medium mb-1 block">Find client</label>
                            <SearchableCombobox
                              options={clientOptions}
                              value={receiptForm.watch('clientId')}
                              onValueChange={handleClientSelect}
                              placeholder="Type to search clients…"
                              searchPlaceholder="Search by name, email, phone…"
                            />
                          </div>
                        )}
                        
                        <FormField
                          control={receiptForm.control}
                          name="clientName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Client Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Client name or company" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Payment Details</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={receiptForm.control}
                          name="amount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Amount</FormLabel>
                              <FormControl>
                                <NumericInput
                                  placeholder="0.00"
                                  value={field.value as number | null | undefined}
                                  onValueChange={(n) => field.onChange(n ?? 0)}
                                  onBlur={field.onBlur}
                                  name={field.name}
                                  ref={field.ref}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={receiptForm.control}
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
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={receiptForm.control}
                          name="paymentDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Payment Date</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={receiptForm.control}
                          name="paymentMethod"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Payment Method</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select payment method" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="cash">Cash</SelectItem>
                                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                  <SelectItem value="check">Check</SelectItem>
                                  <SelectItem value="credit_card">Credit Card</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <FormField
                        control={receiptForm.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Notes (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="Any additional notes for this receipt" {...field} />
                            </FormControl>
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
                        Create Receipt
                      </Button>

                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={() => handlePreviewReceipt()}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Preview Receipt
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
            </TabsContent>

            <TabsContent value="payments-list">
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button 
                    onClick={() => setActiveTab("create-payment")}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    New Payment Order
                  </Button>
                </div>
                
                {paymentOrders.length === 0 ? (
                  <div className="text-center py-8 border rounded-md text-gray-500">
                    No payment orders yet. Click "New Payment Order" to create your first payment order.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-md border">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-100 dark:bg-gray-800">
                              <th className="py-3 px-4 text-left font-medium">Payment Order #</th>
                              <th className="py-3 px-4 text-left font-medium">Date</th>
                              <th className="py-3 px-4 text-left font-medium">Supplier</th>
                              <th className="py-3 px-4 text-right font-medium">Amount</th>
                              <th className="py-3 px-4 text-left font-medium">Payment Method</th>
                              <th className="py-3 px-4 text-left font-medium">Status</th>
                              <th className="py-3 px-4 text-right font-medium">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paymentOrders.map(payment => {
                              const supplier = payment.supplierId ? suppliers.find(s => s.id === payment.supplierId) : undefined;
                              return (
                              <tr key={payment.id} className="border-t">
                                <td className="py-3 px-4">{payment.id}</td>
                                <td className="py-3 px-4">{payment.date}</td>
                                <td className="py-3 px-4">{payment.supplierName || supplier?.name}</td>
                                <td className="py-3 px-4 text-right">
                                  {payment.currency} {payment.amount.toFixed(2)}
                                </td>
                                <td className="py-3 px-4">{payment.paymentMethod || "Cash"}</td>
                                <td className="py-3 px-4">
                                  <span className={`px-2 py-1 rounded-full text-xs ${
                                    payment.status === 'paid'
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                                  }`}>
                                    {payment.status}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <div className="flex justify-end items-center space-x-2">
                                    {payment.status !== 'paid' && (
                                      <Button
                                        variant="default"
                                        size="sm"
                                        onClick={() => {
                                          markPaymentOrderPaid(payment.id, payment.paymentMethod || 'bank');
                                          toast({
                                            title: "Payment recorded",
                                            description: `Payment order ${payment.id} marked as paid`,
                                          });
                                        }}
                                      >
                                        Mark Paid
                                      </Button>
                                    )}
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handlePreviewPaymentOrder(payment)}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleSendItem(payment.id, "payment")}
                                    >
                                      <Share2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleExportItem(payment.id, "payment")}
                                    >
                                      <FileDown className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="create-payment">
              <div className="space-y-4">
                <Form {...paymentOrderForm}>
                  <form onSubmit={paymentOrderForm.handleSubmit(onPaymentOrderSubmit)} className="space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Supplier Information</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {suppliers.length > 0 && (
                          <div>
                            <label className="text-sm font-medium mb-1 block">Find supplier</label>
                            <SearchableCombobox
                              options={supplierOptions}
                              value={paymentOrderForm.watch('supplierId')}
                              onValueChange={handleSupplierSelect}
                              placeholder="Type to search suppliers…"
                              searchPlaceholder="Search by name, email, phone…"
                            />
                          </div>
                        )}
                        
                        <FormField
                          control={paymentOrderForm.control}
                          name="supplierName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Supplier Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Supplier name or company" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Payment Details</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={paymentOrderForm.control}
                          name="amount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Amount</FormLabel>
                              <FormControl>
                                <NumericInput
                                  placeholder="0.00"
                                  value={field.value as number | null | undefined}
                                  onValueChange={(n) => field.onChange(n ?? 0)}
                                  onBlur={field.onBlur}
                                  name={field.name}
                                  ref={field.ref}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={paymentOrderForm.control}
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
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={paymentOrderForm.control}
                          name="paymentDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Payment Date</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={paymentOrderForm.control}
                          name="paymentMethod"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Payment Method</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select payment method" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="cash">Cash</SelectItem>
                                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                  <SelectItem value="check">Check</SelectItem>
                                  <SelectItem value="credit_card">Credit Card</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <FormField
                        control={paymentOrderForm.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Notes (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="Any additional notes for this payment order" {...field} />
                            </FormControl>
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
                        Create Payment Order
                      </Button>

                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={() => handlePreviewPaymentOrder()}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Preview Payment Order
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
      </div>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {previewType === "receipt" ? "Receipt Preview" : "Payment Order Preview"}
            </DialogTitle>
            <DialogDescription>
              Preview how your {previewType === "receipt" ? "receipt" : "payment order"} will look
            </DialogDescription>
          </DialogHeader>

          {previewData && (
            <div className="p-4 border rounded-md overflow-y-auto max-h-[70vh] bg-white">
              <div className="invoice-template-basic">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    {previewData.company?.logo && (
                      <div className="mb-2">
                        <img 
                          src={previewData.company.logo} 
                          alt="Company Logo" 
                          className="h-16 object-contain"
                        />
                      </div>
                    )}
                    <h2 className="text-xl font-bold">{previewData.company?.name}</h2>
                    <p className="text-gray-500">{previewData.company?.address}</p>
                    {previewData.company?.email && (
                      <p className="text-gray-500">{previewData.company.email}</p>
                    )}
                    {previewData.company?.website && (
                      <p className="text-gray-500">{previewData.company.website}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <h1 className="text-2xl font-bold text-indigo-600">
                      {previewType === "receipt" ? "RECEIPT" : "PAYMENT ORDER"}
                    </h1>
                    <p className="text-gray-500">
                      Date: {previewData.date}
                    </p>
                    <p className="text-gray-500">
                      {previewType === "receipt" ? "Receipt" : "Payment Order"} #: {previewData.id}
                    </p>
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="font-medium text-gray-700 mb-2">
                    {previewType === "receipt" ? "Received From:" : "Paid To:"}
                  </h3>
                  <p className="font-medium">
                    {previewType === "receipt" 
                      ? previewData.clientName || previewData.client?.name
                      : previewData.supplierName || previewData.supplier?.name}
                  </p>
                  {previewType === "receipt" && previewData.client && (
                    <>
                      <p>{previewData.client.address}</p>
                      <p>{previewData.client.email}</p>
                      <p>{previewData.client.phone}</p>
                    </>
                  )}
                  {previewType === "payment" && previewData.supplier && (
                    <>
                      <p>{previewData.supplier.address}</p>
                      <p>{previewData.supplier.email}</p>
                      <p>{previewData.supplier.phone}</p>
                    </>
                  )}
                </div>

                <div className="mb-6">
                  <h3 className="font-medium text-gray-700 mb-2">Payment Details:</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <p className="text-gray-600">Amount:</p>
                    <p className="font-medium">{previewData.currency} {previewData.amount?.toFixed(2)}</p>
                    
                    <p className="text-gray-600">Payment Date:</p>
                    <p>{previewData.paymentDate}</p>
                    
                    <p className="text-gray-600">Payment Method:</p>
                    <p>{previewData.paymentMethod}</p>
                  </div>
                </div>

                {previewData.notes && (
                  <div className="mb-6">
                    <h3 className="font-medium text-gray-700 mb-2">Notes:</h3>
                    <p className="text-gray-600">{previewData.notes}</p>
                  </div>
                )}

                {previewData.company?.signature && (
                  <div className="mt-8 pt-4 border-t">
                    <div className="flex justify-end">
                      <div className="text-center">
                        <img 
                          src={previewData.company.signature} 
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
                  if (selectedItemId) {
                    handleSendItem(selectedItemId, previewType);
                  }
                }}
              >
                <Mail className="mr-2 h-4 w-4" />
                Share
              </Button>
              <Button 
                onClick={() => {
                  setIsPreviewOpen(false);
                  if (selectedItemId) {
                    handleExportItem(selectedItemId, previewType);
                  } else {
                    toast({
                      title: "Info",
                      description: `Save the ${previewType} first to export it as PDF`,
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
        documentId={selectedItemId || ""}
        documentType={shareDocType}
        recipientEmail={shareRecipientEmail}
        recipientPhone={shareRecipientPhone}
        clientName={shareClientName}
      />
    </FinancePageShell>
  );
};

export default ReceiptManager;
