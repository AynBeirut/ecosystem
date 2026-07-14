import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useAppContext } from "@/context/AppContext";
import { useAccounting } from "@/context/AccountingContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Plus, Truck, Package, Wallet, ArrowDownToLine, User, MapPin, Clock, CheckCircle2, AlertTriangle, Trash2 } from "lucide-react";
import { DeliveryPerson, DeliveryOrder, DeliveryOrderStatus } from "@/types/accounting";

const DeliveryManager = () => {
  const { logout, invoices } = useAppContext();
  const { 
    deliveryPersons, 
    deliveryOrders,
    cashCollections,
    addDeliveryPerson,
    updateDeliveryPerson,
    deleteDeliveryPerson,
    assignOrderToDelivery,
    updateDeliveryOrderStatus,
    collectCashFromDelivery,
    getDeliveryStats
  } = useAccounting();
  const { toast } = useToast();

  const [isAddPersonOpen, setIsAddPersonOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isCollectOpen, setIsCollectOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<DeliveryPerson | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("persons");

  // Add person form
  const [personForm, setPersonForm] = useState({
    name: "",
    phone: "",
    email: ""
  });

  // Assign form
  const [assignForm, setAssignForm] = useState({
    invoiceId: "",
    deliveryPersonId: ""
  });

  const handleLogout = () => {
    logout();
    toast({ title: "Logged out" });
  };

  const handleAddPerson = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!personForm.name || !personForm.phone) {
      toast({ title: "Error", description: "Name and phone are required", variant: "destructive" });
      return;
    }

    addDeliveryPerson({
      name: personForm.name,
      phone: personForm.phone,
      email: personForm.email || undefined,
      isActive: true
    });

    toast({ title: "Success", description: "Delivery person added" });
    setPersonForm({ name: "", phone: "", email: "" });
    setIsAddPersonOpen(false);
  };

  const handleAssignOrder = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!assignForm.invoiceId || !assignForm.deliveryPersonId) {
      toast({ title: "Error", description: "Select both invoice and delivery person", variant: "destructive" });
      return;
    }

    const invoice = invoices.find(i => i.id === assignForm.invoiceId);
    if (!invoice) {
      toast({ title: "Error", description: "Invoice not found", variant: "destructive" });
      return;
    }

    try {
      assignOrderToDelivery(
        invoice.id,
        invoice.id, // invoiceNumber
        assignForm.deliveryPersonId,
        invoice.clientName,
        invoice.amount
      );
      toast({ title: "Success", description: "Order assigned to delivery" });
      setAssignForm({ invoiceId: "", deliveryPersonId: "" });
      setIsAssignOpen(false);
    } catch (error) {
      toast({ title: "Error", description: String(error), variant: "destructive" });
    }
  };

  const handleStatusChange = (orderId: string, status: DeliveryOrderStatus) => {
    updateDeliveryOrderStatus(orderId, status);
    toast({ 
      title: "Status Updated", 
      description: status === "paid" ? "Payment collected from client" : `Order marked as ${status}`
    });
  };

  const handleCollectCash = () => {
    if (!selectedPerson || selectedOrders.length === 0) {
      toast({ title: "Error", description: "Select orders to collect", variant: "destructive" });
      return;
    }

    try {
      collectCashFromDelivery(selectedPerson.id, selectedOrders);
      toast({ title: "Success", description: "Cash collected and returned to company" });
      setIsCollectOpen(false);
      setSelectedPerson(null);
      setSelectedOrders([]);
    } catch (error) {
      toast({ title: "Error", description: String(error), variant: "destructive" });
    }
  };

  const handleDeletePerson = (id: string) => {
    const person = deliveryPersons.find(p => p.id === id);
    if (person && person.walletBalance > 0) {
      toast({ title: "Error", description: "Cannot delete - outstanding balance exists", variant: "destructive" });
      return;
    }
    if (confirm("Delete this delivery person?")) {
      deleteDeliveryPerson(id);
      toast({ title: "Deleted" });
    }
  };

  const getStatusBadge = (status: DeliveryOrderStatus) => {
    const styles: Record<DeliveryOrderStatus, string> = {
      pending_delivery: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
      delivered_unpaid: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
      paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      returned: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
      cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
    };
    const labels: Record<DeliveryOrderStatus, string> = {
      pending_delivery: "Pending Delivery",
      delivered_unpaid: "Delivered (Unpaid)",
      paid: "Paid",
      returned: "Cash Returned",
      cancelled: "Cancelled"
    };
    return <Badge className={styles[status]}>{labels[status]}</Badge>;
  };

  const stats = getDeliveryStats();
  const unassignedInvoices = invoices.filter(inv => 
    inv.status !== "paid" && 
    !deliveryOrders.some(o => o.invoiceId === inv.id && o.status !== "cancelled")
  );

  const paidOrdersForPerson = (personId: string) => 
    deliveryOrders.filter(o => 
      o.deliveryPersonId === personId && 
      o.status === "paid" && 
      !o.returnedAt
    );

  return (
    <AppLayout onLogout={handleLogout}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Delivery Management</h1>
            <p className="text-muted-foreground">Track deliveries and cash collection</p>
          </div>
          
          <div className="flex gap-2">
            <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Package className="mr-2 h-4 w-4" /> Assign Order
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Assign Order to Delivery</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAssignOrder} className="space-y-4">
                  <div>
                    <Label>Select Invoice</Label>
                    <Select value={assignForm.invoiceId} onValueChange={v => setAssignForm(prev => ({ ...prev, invoiceId: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose invoice..." />
                      </SelectTrigger>
                      <SelectContent>
                        {unassignedInvoices.length === 0 ? (
                          <SelectItem value="" disabled>No unassigned invoices</SelectItem>
                        ) : (
                          unassignedInvoices.map(inv => (
                            <SelectItem key={inv.id} value={inv.id}>
                              {inv.id} - {inv.clientName} ({formatCurrency(inv.amount, inv.currency)})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Delivery Person</Label>
                    <Select value={assignForm.deliveryPersonId} onValueChange={v => setAssignForm(prev => ({ ...prev, deliveryPersonId: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose delivery person..." />
                      </SelectTrigger>
                      <SelectContent>
                        {deliveryPersons.filter(p => p.isActive).map(person => (
                          <SelectItem key={person.id} value={person.id}>
                            {person.name} (Wallet: {formatCurrency(person.walletBalance, "USD")})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button type="submit">Assign</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={isAddPersonOpen} onOpenChange={setIsAddPersonOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> Add Delivery Person
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Delivery Person</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddPerson} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Name *</Label>
                    <Input 
                      id="name" 
                      value={personForm.name}
                      onChange={e => setPersonForm(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone *</Label>
                    <Input 
                      id="phone" 
                      value={personForm.phone}
                      onChange={e => setPersonForm(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input 
                      id="email" 
                      type="email"
                      value={personForm.email}
                      onChange={e => setPersonForm(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button type="submit">Add</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Delivery Personnel</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{deliveryPersons.filter(p => p.isActive).length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.totalOrders}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cash in Delivery</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-amber-600">{formatCurrency(stats.pendingCash, "USD")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cash Collected</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.collectedCash, "USD")}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="persons">Delivery Team</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="collections">Collections</TabsTrigger>
          </TabsList>

          <TabsContent value="persons" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Delivery Team</CardTitle>
                <CardDescription>Manage delivery personnel and their wallets</CardDescription>
              </CardHeader>
              <CardContent>
                {deliveryPersons.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No delivery personnel yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {deliveryPersons.map(person => {
                      const pendingOrders = paidOrdersForPerson(person.id);
                      return (
                        <div 
                          key={person.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                              <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <h3 className="font-medium">{person.name}</h3>
                              <p className="text-sm text-muted-foreground">{person.phone}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="flex items-center gap-2">
                                <Wallet className="h-4 w-4 text-muted-foreground" />
                                <span className={`font-bold ${person.walletBalance > 0 ? "text-amber-600" : ""}`}>
                                  {formatCurrency(person.walletBalance, "USD")}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {pendingOrders.length} orders to collect
                              </p>
                            </div>
                            
                            {pendingOrders.length > 0 && (
                              <Button 
                                size="sm"
                                onClick={() => {
                                  setSelectedPerson(person);
                                  setSelectedOrders(pendingOrders.map(o => o.id));
                                  setIsCollectOpen(true);
                                }}
                              >
                                <ArrowDownToLine className="h-4 w-4 mr-1" /> Collect
                              </Button>
                            )}
                            
                            <Button size="sm" variant="ghost" onClick={() => handleDeletePerson(person.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Delivery Orders</CardTitle>
                <CardDescription>Track order statuses</CardDescription>
              </CardHeader>
              <CardContent>
                {deliveryOrders.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No delivery orders yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {deliveryOrders.map(order => (
                      <div 
                        key={order.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-full ${
                            order.status === "paid" ? "bg-green-100 dark:bg-green-900/30" :
                            order.status === "pending_delivery" ? "bg-blue-100 dark:bg-blue-900/30" :
                            "bg-amber-100 dark:bg-amber-900/30"
                          }`}>
                            {order.status === "paid" ? (
                              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                            ) : order.status === "pending_delivery" ? (
                              <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            ) : (
                              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                            )}
                          </div>
                          <div>
                            <h3 className="font-medium">{order.clientName}</h3>
                            <p className="text-sm text-muted-foreground">
                              {order.invoiceNumber || order.invoiceId} • {order.deliveryPersonName}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <p className="font-bold">{formatCurrency(order.amount, "USD")}</p>
                          {getStatusBadge(order.status)}
                          
                          {order.status === "pending_delivery" && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleStatusChange(order.id, "delivered_unpaid")}
                            >
                              Mark Delivered
                            </Button>
                          )}
                          {order.status === "delivered_unpaid" && (
                            <Button 
                              size="sm"
                              onClick={() => handleStatusChange(order.id, "paid")}
                            >
                              Mark Paid
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="collections" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Cash Collections</CardTitle>
                <CardDescription>History of cash returned to company</CardDescription>
              </CardHeader>
              <CardContent>
                {cashCollections.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No collections recorded</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cashCollections.map(collection => (
                      <div 
                        key={collection.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                            <ArrowDownToLine className="h-5 w-5 text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <h3 className="font-medium">{collection.deliveryPersonName}</h3>
                            <p className="text-sm text-muted-foreground">
                              {new Date(collection.collectedAt).toLocaleString()} • {collection.orderIds.length} orders
                            </p>
                          </div>
                        </div>
                        
                        <p className="text-xl font-bold text-green-600">
                          +{formatCurrency(collection.totalAmount, "USD")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Collect Cash Dialog */}
        <Dialog open={isCollectOpen} onOpenChange={setIsCollectOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Collect Cash from {selectedPerson?.name}</DialogTitle>
            </DialogHeader>
            {selectedPerson && (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Current Wallet Balance</p>
                  <p className="text-2xl font-bold text-amber-600">
                    {formatCurrency(selectedPerson.walletBalance, "USD")}
                  </p>
                </div>
                
                <div>
                  <Label>Select Orders to Collect</Label>
                  <div className="space-y-2 mt-2 max-h-60 overflow-y-auto">
                    {paidOrdersForPerson(selectedPerson.id).map(order => (
                      <div 
                        key={order.id}
                        className="flex items-center gap-3 p-3 border rounded-lg"
                      >
                        <Checkbox 
                          id={order.id}
                          checked={selectedOrders.includes(order.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedOrders(prev => [...prev, order.id]);
                            } else {
                              setSelectedOrders(prev => prev.filter(id => id !== order.id));
                            }
                          }}
                        />
                        <label htmlFor={order.id} className="flex-1 cursor-pointer">
                          <p className="font-medium">{order.clientName}</p>
                          <p className="text-sm text-muted-foreground">{order.invoiceNumber}</p>
                        </label>
                        <p className="font-bold">{formatCurrency(order.amount, "USD")}</p>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-sm text-muted-foreground">Total to Collect</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(
                      deliveryOrders
                        .filter(o => selectedOrders.includes(o.id))
                        .reduce((sum, o) => sum + o.amount, 0),
                      "USD"
                    )}
                  </p>
                </div>
                
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button onClick={handleCollectCash} disabled={selectedOrders.length === 0}>
                    Confirm Collection
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default DeliveryManager;
