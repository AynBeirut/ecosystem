import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useAppContext } from "@/context/AppContext";
import { useAccounting } from "@/context/AccountingContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Plus, Building2, Phone, Mail, MapPin, FileText, TrendingUp, TrendingDown } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const supplierSchema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  email: z
    .string()
    .optional()
    .refine(
      (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      { message: "Invalid email address" }
    ),
});

type SupplierFormData = z.infer<typeof supplierSchema>;

const SuppliersManager = () => {
  const { logout, suppliers, addSupplier, purchaseOrders } = useAppContext();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("list");
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);

  const form = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: "",
      address: "",
      phone: "",
      email: "",
    },
  });

  const handleLogout = () => {
    logout();
    toast({ title: "Logged out" });
  };

  const onSubmit = async (data: SupplierFormData) => {
    const id = await addSupplier({
      name: data.name,
      address: data.address,
      phone: data.phone,
      email: data.email
    });
    if (id) {
      toast({ title: "Success", description: "Supplier added successfully" });
      form.reset();
      setActiveTab("list");
    }
    // Failure already surfaced as a toast from the context helper.
  };

  // Calculate supplier account statement
  const getSupplierStatement = (supplierId: string) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) return null;

    const supplierPOs = purchaseOrders.filter(po => 
      po.supplierId === supplierId || po.supplierName === supplier.name
    );

    const totalPurchases = supplierPOs.reduce((sum, po) => sum + po.amount, 0);
    // Use 'fulfilled' as the paid equivalent for purchase orders
    const paidPOs = supplierPOs.filter(po => po.status === "fulfilled");
    const totalPaid = paidPOs.reduce((sum, po) => sum + po.amount, 0);
    const pendingPOs = supplierPOs.filter(po => po.status === "draft" || po.status === "sent" || po.status === "approved");
    const totalPending = pendingPOs.reduce((sum, po) => sum + po.amount, 0);

    return {
      supplier,
      purchaseOrders: supplierPOs,
      totalPurchases,
      totalPaid,
      totalPending,
      balance: totalPending // Amount owed to supplier
    };
  };

  const selectedStatement = selectedSupplier ? getSupplierStatement(selectedSupplier) : null;

  return (
    <AppLayout onLogout={handleLogout}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Suppliers</h1>
            <p className="text-muted-foreground">Manage suppliers and view account statements</p>
          </div>
          
          <Button onClick={() => setActiveTab("add")}>
            <Plus className="mr-2 h-4 w-4" /> Add Supplier
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Suppliers</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{suppliers.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Purchases</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatCurrency(purchaseOrders.reduce((sum, po) => sum + po.amount, 0), "USD")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-amber-600">
                {formatCurrency(
                  purchaseOrders
                    .filter(po => po.status !== "fulfilled")
                    .reduce((sum, po) => sum + po.amount, 0), 
                  "USD"
                )}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="list">Supplier List</TabsTrigger>
            <TabsTrigger value="add">Add Supplier</TabsTrigger>
            {selectedSupplier && <TabsTrigger value="statement">Account Statement</TabsTrigger>}
          </TabsList>

          {/* Supplier List */}
          <TabsContent value="list">
            <Card>
              <CardHeader>
                <CardTitle>All Suppliers</CardTitle>
                <CardDescription>Click on a supplier to view their account statement</CardDescription>
              </CardHeader>
              <CardContent>
                {suppliers.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No suppliers yet</p>
                    <Button 
                      variant="link" 
                      onClick={() => setActiveTab("add")}
                      className="mt-2"
                    >
                      Add your first supplier
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {suppliers.map(supplier => {
                      const statement = getSupplierStatement(supplier.id);
                      return (
                        <div 
                          key={supplier.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => {
                            setSelectedSupplier(supplier.id);
                            setActiveTab("statement");
                          }}
                        >
                          <div className="flex items-center gap-4">
                            <div className="p-2 rounded-full bg-indigo-100 dark:bg-indigo-900/30">
                              <Building2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div>
                              <h3 className="font-medium">{supplier.name}</h3>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" /> {supplier.phone}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" /> {supplier.email}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Total Purchases</p>
                              <p className="font-bold">{formatCurrency(statement?.totalPurchases || 0, "USD")}</p>
                            </div>
                            {statement && statement.balance > 0 && (
                              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300">
                                Owes {formatCurrency(statement.balance, "USD")}
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Add Supplier Form */}
          <TabsContent value="add">
            <Card>
              <CardHeader>
                <CardTitle>Add New Supplier</CardTitle>
                <CardDescription>Enter supplier details</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Supplier Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Company name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="supplier@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone</FormLabel>
                            <FormControl>
                              <Input placeholder="+1 234 567 890" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Address</FormLabel>
                            <FormControl>
                              <Input placeholder="Street, City, Country" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={() => setActiveTab("list")}>
                        Cancel
                      </Button>
                      <Button type="submit">Add Supplier</Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Account Statement */}
          <TabsContent value="statement">
            {selectedStatement && (
              <div className="space-y-4">
                {/* Supplier Info */}
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{selectedStatement.supplier.name}</CardTitle>
                        <CardDescription>Account Statement</CardDescription>
                      </div>
                      <Button variant="outline" onClick={() => setActiveTab("list")}>
                        Back to List
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedStatement.supplier.address}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedStatement.supplier.phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedStatement.supplier.email}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Statement Summary */}
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Purchases</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{formatCurrency(selectedStatement.totalPurchases, "USD")}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Paid</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-green-600">{formatCurrency(selectedStatement.totalPaid, "USD")}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-amber-600">{formatCurrency(selectedStatement.totalPending, "USD")}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Balance Due</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-red-600">{formatCurrency(selectedStatement.balance, "USD")}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Transaction History */}
                <Card>
                  <CardHeader>
                    <CardTitle>Purchase Orders</CardTitle>
                    <CardDescription>All transactions with this supplier</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {selectedStatement.purchaseOrders.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No purchase orders with this supplier</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedStatement.purchaseOrders.map(po => (
                          <div 
                            key={po.id}
                            className="flex items-center justify-between p-4 border rounded-lg"
                          >
                            <div className="flex items-center gap-4">
                              <div className={`p-2 rounded-full ${
                                po.status === "fulfilled" 
                                  ? "bg-green-100 dark:bg-green-900/30" 
                                  : "bg-amber-100 dark:bg-amber-900/30"
                              }`}>
                                {po.status === "fulfilled" ? (
                                  <TrendingDown className="h-5 w-5 text-green-600 dark:text-green-400" />
                                ) : (
                                  <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                )}
                              </div>
                              <div>
                                <h3 className="font-medium">{po.id}</h3>
                                <p className="text-sm text-muted-foreground">
                                  {new Date(po.date).toLocaleDateString()}
                                  {po.items && ` • ${po.items.length} items`}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-4">
                              <p className="font-bold">{formatCurrency(po.amount, po.currency)}</p>
                              <Badge className={
                                po.status === "fulfilled" 
                                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                                  : po.status === "sent"
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
                                  : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300"
                              }>
                                {po.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default SuppliersManager;
