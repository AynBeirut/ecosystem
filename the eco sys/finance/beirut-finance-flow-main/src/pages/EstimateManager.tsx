import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AppLayout from "@/components/AppLayout";
import { Plus, Trash, Mail, FileDown, Send, Phone, Eye } from "lucide-react";
import { useAppContext } from "@/context/AppContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CURRENCIES } from "@/services/mockData";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import EstimateList from "@/components/EstimateList";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Define schema for estimate form
const estimateSchema = z.object({
  customer: z.string().optional(),
  clientId: z.string().optional(),
  currency: z.string().min(1, "Currency is required"),
  tax: z.coerce.number().default(0),
  discount: z.coerce.number().default(0),
  notes: z.string().optional(),
  expiryDate: z.string().optional(),
});

const EstimateManager = () => {
  const { user, clients, products, estimates, createEstimate, previewEstimate, sendEstimate, exportEstimateAsPdf, logout, checkLimit } = useAppContext();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>("list");
  const [lineItems, setLineItems] = useState<Array<{ id: string, description: string, quantity: number, unitPrice: number, subtotal: number }>>([]);
  const [selectedEstimateId, setSelectedEstimateId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [sendMethod, setSendMethod] = useState<"email" | "whatsapp">("email");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [previewEstimateData, setPreviewEstimateData] = useState<any>(null);

  const form = useForm<z.infer<typeof estimateSchema>>({
    resolver: zodResolver(estimateSchema),
    defaultValues: {
      customer: "",
      clientId: "",
      currency: "USD",
      tax: 0,
      discount: 0,
      notes: "",
      expiryDate: "",
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

  const handleClientSelect = (clientId: string) => {
    const selectedClient = clients.find(client => client.id === clientId);
    if (selectedClient) {
      form.setValue('customer', selectedClient.name);
      form.setValue('clientId', clientId);
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
    }
  };

  const onSubmit = async () => {
    const values = form.getValues();
    console.log("Estimate form submitted with values:", values);

    if (lineItems.length === 0) {
      toast({
        title: "No Line Items",
        description: "Please add at least one line item to create an estimate.",
        variant: "destructive",
      });
      return;
    }

    if (!values.customer) {
      toast({
        title: "Customer Required",
        description: "Please enter a customer name.",
        variant: "destructive",
      });
      return;
    }

    const totals = calculateTotals();
    console.log("Calculated totals:", totals);

    // Check limit before attempting to create
    const limitCheck = checkLimit("estimates");
    if (!limitCheck.allowed) {
      toast({
        title: "Limit Reached",
        description: limitCheck.message || "You've reached your monthly estimate limit.",
        variant: "destructive",
      });
      return;
    }

    try {
      const estimateId = await createEstimate({
        clientId: values.clientId || "",
        clientName: values.customer,
        amount: totals.total,
        currency: values.currency,
        items: lineItems,
        expiryDate: values.expiryDate,
      });

      if (estimateId) {
        toast({
          title: "Estimate Created",
          description: "Your estimate has been created successfully",
        });
        form.reset();
        setLineItems([]);
        setActiveTab("list");
      }
      // On failure the context already surfaced a specific toast (auth/org/limit/RLS/network).
    } catch (error) {
      console.error("Error creating estimate:", error);
      toast({
        title: "Error",
        description: (error as any)?.message || "An unexpected error occurred while creating the estimate",
        variant: "destructive",
      });
    }
  };


  const handlePreviewEstimate = (estimateData: any = null) => {
    if (estimateData) {
      setSelectedEstimateId(estimateData.id);
      setPreviewEstimateData(estimateData);
    } else {
      const values = form.getValues();
      const totals = calculateTotals();
      
      setPreviewEstimateData({
        customer: values.customer,
        items: lineItems,
        tax: values.tax,
        taxAmount: totals.taxAmount,
        discount: values.discount,
        subtotal: totals.subtotal,
        total: totals.total,
        currency: values.currency,
        date: new Date().toLocaleDateString(),
        expiryDate: values.expiryDate,
        notes: values.notes,
        company: user?.company,
      });
    }
    
    setIsPreviewOpen(true);
  };

  const handleSendEstimate = (estimateId: string) => {
    setSelectedEstimateId(estimateId);
    setIsSendDialogOpen(true);
  };

  const confirmSendEstimate = () => {
    if (!selectedEstimateId) return;
    
    let success = false;
    
    if (sendMethod === "email" && recipientEmail) {
      success = sendEstimate(selectedEstimateId, recipientEmail);
      if (success) {
        toast({
          title: "Estimate Sent",
          description: `Your estimate has been sent to ${recipientEmail}`,
        });
      }
    } else if (sendMethod === "whatsapp" && recipientPhone) {
      success = true;
      toast({
        title: "WhatsApp Message Prepared",
        description: `Estimate details ready to send via WhatsApp to ${recipientPhone}`,
      });
      
      const whatsappText = `Hello! I'm sending you estimate ${selectedEstimateId}. Total amount: ${calculateTotals().total.toFixed(2)} ${form.getValues().currency}.`;
      const whatsappUrl = `https://wa.me/${recipientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(whatsappText)}`;
      window.open(whatsappUrl, '_blank');
    }
    
    setIsSendDialogOpen(false);
    setRecipientEmail("");
    setRecipientPhone("");
  };

  const handleExportEstimate = (estimateId: string) => {
    const success = exportEstimateAsPdf(estimateId);
    if (success) {
      toast({
        title: "Estimate Exported",
        description: "Your estimate has been exported to PDF",
      });
    } else {
      toast({
        title: "Export Failed",
        description: "Failed to export estimate. Please make sure the estimate is saved.",
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
            <h1 className="text-2xl font-bold tracking-tight">Estimate Manager</h1>
            <p className="text-gray-500 dark:text-gray-400">Create and manage your estimates</p>
          </div>
          <Button 
            className="mt-4 sm:mt-0 bg-indigo-600 hover:bg-indigo-700"
            onClick={() => setActiveTab("create")}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Estimate
          </Button>
        </div>

        <Card>
          <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab}>
            <CardHeader>
              <TabsList>
                <TabsTrigger value="list">Estimate List</TabsTrigger>
                <TabsTrigger value="create">Create Estimate</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent>
              <TabsContent value="list">
              <div className="space-y-4">
                <EstimateList 
                  onPreview={handlePreviewEstimate}
                  onSend={handleSendEstimate}
                  onExport={handleExportEstimate}
                />
              </div>
            </TabsContent>
            <TabsContent value="create">
              <Form {...form}>
                <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Client Information</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {clients.length > 0 && (
                        <div>
                          <label className="text-sm font-medium mb-1 block">Select Existing Client</label>
                          <Select onValueChange={handleClientSelect}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select client" />
                            </SelectTrigger>
                            <SelectContent>
                              {clients.map(client => (
                                <SelectItem key={client.id} value={client.id}>
                                  {client.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      
                      <FormField
                        control={form.control}
                        name="customer"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Customer Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Customer name or company" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
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
                                  <Select onValueChange={(value) => handleProductSelect(value, item.id)}>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select product" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {products.map(product => (
                                        <SelectItem key={product.id} value={product.id}>
                                          {product.name} - ${product.salePrice.toFixed(2)}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
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
                            <Input placeholder="Any additional notes for this estimate" {...field} />
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="expiryDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Expiry Date (Optional)</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
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
                      Create Estimate
                    </Button>

                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => handlePreviewEstimate()}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Preview Estimate
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
            <DialogTitle>Estimate Preview</DialogTitle>
            <DialogDescription>
              Preview how your estimate will look to your clients
            </DialogDescription>
          </DialogHeader>

          {previewEstimateData && (
            <div className="p-4 border rounded-md overflow-y-auto max-h-[70vh] bg-white">
              <div className="estimate-template">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    {previewEstimateData.company?.logo && (
                      <div className="mb-2">
                        <img 
                          src={previewEstimateData.company.logo} 
                          alt="Company Logo" 
                          className="h-16 object-contain"
                        />
                      </div>
                    )}
                    <h2 className="text-xl font-bold">{previewEstimateData.company?.name}</h2>
                    <p className="text-gray-500">{previewEstimateData.company?.address}</p>
                    {previewEstimateData.company?.email && (
                      <p className="text-gray-500">{previewEstimateData.company.email}</p>
                    )}
                    {previewEstimateData.company?.website && (
                      <p className="text-gray-500">{previewEstimateData.company.website}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <h1 className="text-2xl font-bold text-indigo-600">ESTIMATE</h1>
                    <p className="text-gray-500">
                      Date: {previewEstimateData.date}
                    </p>
                    <p className="text-gray-500">
                      Estimate #: {previewEstimateData.id || "Draft"}
                    </p>
                    {previewEstimateData.expiryDate && (
                      <p className="text-gray-500">
                        Valid until: {previewEstimateData.expiryDate}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mb-8">
                  <h3 className="font-medium text-gray-700 mb-2">For:</h3>
                  <p className="font-medium">{previewEstimateData.customer}</p>
                  {previewEstimateData.client && (
                    <>
                      <p>{previewEstimateData.client.address}</p>
                      <p>{previewEstimateData.client.email}</p>
                      <p>{previewEstimateData.client.phone}</p>
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
                      {previewEstimateData.items?.map((item: any, i: number) => (
                        <tr key={i} className="border-b border-gray-200">
                          <td className="py-3 px-3">{item.description}</td>
                          <td className="py-3 px-3 text-right">{item.quantity}</td>
                          <td className="py-3 px-3 text-right">
                            {previewEstimateData.currency} {item.unitPrice.toFixed(2)}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {previewEstimateData.currency} {(item.quantity * item.unitPrice).toFixed(2)}
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
                      <span>{previewEstimateData.currency} {previewEstimateData.subtotal?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span>Tax ({previewEstimateData.tax}%):</span>
                      <span>{previewEstimateData.currency} {previewEstimateData.taxAmount?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span>Discount:</span>
                      <span>{previewEstimateData.currency} {previewEstimateData.discount?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-2 font-bold border-t">
                      <span>Total:</span>
                      <span>{previewEstimateData.currency} {previewEstimateData.total?.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {previewEstimateData.notes && (
                  <div className="mt-8 pt-4 border-t">
                    <h4 className="font-medium text-gray-700 mb-2">Notes:</h4>
                    <p className="text-gray-600">{previewEstimateData.notes}</p>
                  </div>
                )}

                {previewEstimateData.company?.signature && (
                  <div className="mt-8 pt-4 border-t">
                    <div className="flex justify-end">
                      <div className="text-center">
                        <img 
                          src={previewEstimateData.company.signature} 
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
                  if (selectedEstimateId) {
                    handleSendEstimate(selectedEstimateId);
                  }
                }}
              >
                <Mail className="mr-2 h-4 w-4" />
                Send
              </Button>
              <Button 
                onClick={() => {
                  setIsPreviewOpen(false);
                  if (selectedEstimateId) {
                    handleExportEstimate(selectedEstimateId);
                  } else {
                    toast({
                      title: "Info",
                      description: "Save the estimate first to export it as PDF",
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

      <Dialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Estimate</DialogTitle>
            <DialogDescription>
              Choose how you want to send this estimate to your client.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex space-x-2">
              <Button
                variant={sendMethod === "email" ? "default" : "outline"}
                className={sendMethod === "email" ? "bg-indigo-600" : ""}
                onClick={() => setSendMethod("email")}
              >
                <Mail className="mr-2 h-4 w-4" />
                Email
              </Button>
              <Button
                variant={sendMethod === "whatsapp" ? "default" : "outline"}
                className={sendMethod === "whatsapp" ? "bg-green-600" : ""}
                onClick={() => setSendMethod("whatsapp")}
              >
                <Phone className="mr-2 h-4 w-4" />
                WhatsApp
              </Button>
            </div>
            
            {sendMethod === "email" && (
              <div>
                <label className="text-sm font-medium mb-1 block">Recipient Email</label>
                <Input
                  type="email"
                  placeholder="client@example.com"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                />
              </div>
            )}
            
            {sendMethod === "whatsapp" && (
              <div>
                <label className="text-sm font-medium mb-1 block">Recipient Phone Number (with country code)</label>
                <Input
                  type="tel"
                  placeholder="+1234567890"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                />
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSendDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={confirmSendEstimate}
              className="bg-indigo-600"
              disabled={(sendMethod === "email" && !recipientEmail) || (sendMethod === "whatsapp" && !recipientPhone)}
            >
              <Send className="mr-2 h-4 w-4" />
              Send Estimate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default EstimateManager;
