import { useMemo, useState } from "react";
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
import { Plus, Truck, Package, Wallet, ArrowDownToLine, User, Clock, CheckCircle2, Trash2, Lock } from "lucide-react";
import { DeliveryPerson, DeliveryOrder, DeliveryOrderStatus } from "@/types/accounting";

const DeliveryManager = () => {
  const { logout, invoices } = useAppContext();
  const { 
    deliveryPersons, 
    deliveryOrders,
    cashCollections,
    cashBalance,
    addDeliveryPerson,
    deleteDeliveryPerson,
    assignOrderToDelivery,
    updateDeliveryOrderStatus,
    collectCashFromDelivery,
    getDeliveryStats
  } = useAccounting();
  const { toast } = useToast();

  const [isAddPersonOpen, setIsAddPersonOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isSettleOpen, setIsSettleOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<DeliveryPerson | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [settleDestination, setSettleDestination] = useState<'cash' | 'bank'>('cash');
  const [settleNotes, setSettleNotes] = useState("");
  const [settleLoading, setSettleLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("wallets");

  const [personForm, setPersonForm] = useState({ name: "", phone: "", email: "" });
  const [assignForm, setAssignForm] = useState({ invoiceId: "", deliveryPersonId: "" });

  const stats = getDeliveryStats();
  const totalOutstanding = stats.pendingCash;

  const unsettledOrdersForPerson = (personId: string) =>
    deliveryOrders.filter(
      (o) => o.deliveryPersonId === personId && o.status === "paid" && !o.returnedAt,
    );

  const pendingCodOrders = useMemo(
    () => deliveryOrders.filter((o) => o.status === "delivered_unpaid" || o.status === "pending_delivery"),
    [deliveryOrders],
  );

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
      isActive: true,
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
    const invoice = invoices.find((i) => i.id === assignForm.invoiceId);
    if (!invoice) {
      toast({ title: "Error", description: "Invoice not found", variant: "destructive" });
      return;
    }
    try {
      assignOrderToDelivery(
        invoice.id,
        invoice.id,
        assignForm.deliveryPersonId,
        invoice.clientName,
        invoice.amount,
      );
      toast({ title: "Success", description: "COD order assigned to delivery" });
      setAssignForm({ invoiceId: "", deliveryPersonId: "" });
      setIsAssignOpen(false);
    } catch (error) {
      toast({ title: "Error", description: String(error), variant: "destructive" });
    }
  };

  const handleStatusChange = async (orderId: string, status: DeliveryOrderStatus) => {
    try {
      await updateDeliveryOrderStatus(orderId, status);
      toast({
        title: "Status Updated",
        description:
          status === "paid"
            ? "COD collected — added to courier wallet"
            : status === "delivered_unpaid"
              ? "Marked delivered (awaiting customer payment)"
              : `Order marked as ${status}`,
      });
    } catch (error) {
      toast({ title: "Error", description: String(error), variant: "destructive" });
    }
  };

  const handleSettle = async () => {
    if (!selectedPerson || selectedOrders.length === 0) {
      toast({ title: "Error", description: "Select orders to settle", variant: "destructive" });
      return;
    }
    setSettleLoading(true);
    try {
      const settlementId = await collectCashFromDelivery(
        selectedPerson.id,
        selectedOrders,
        settleDestination,
        settleNotes || undefined,
      );
      toast({
        title: "Wallet settled",
        description: `Settlement ${settlementId} posted to GL (${settleDestination})`,
      });
      setIsSettleOpen(false);
      setSelectedPerson(null);
      setSelectedOrders([]);
      setSettleNotes("");
      setSettleDestination("cash");
    } catch (error) {
      toast({ title: "Settlement failed", description: String(error), variant: "destructive" });
    } finally {
      setSettleLoading(false);
    }
  };

  const handleDeletePerson = (id: string) => {
    const person = deliveryPersons.find((p) => p.id === id);
    if (person && person.walletBalance > 0) {
      toast({ title: "Error", description: "Cannot delete — outstanding wallet balance", variant: "destructive" });
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
      cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    };
    const labels: Record<DeliveryOrderStatus, string> = {
      pending_delivery: "Out for delivery",
      delivered_unpaid: "Delivered · COD pending",
      paid: "COD collected",
      returned: "Settled",
      cancelled: "Cancelled",
    };
    return <Badge className={styles[status]}>{labels[status]}</Badge>;
  };

  const unassignedInvoices = invoices.filter(
    (inv) =>
      inv.status !== "paid" &&
      !deliveryOrders.some((o) => o.invoiceId === inv.id && o.status !== "cancelled"),
  );

  const settleTotal = deliveryOrders
    .filter((o) => selectedOrders.includes(o.id))
    .reduce((sum, o) => sum + o.amount, 0);

  return (
    <AppLayout onLogout={handleLogout}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Delivery Wallets</h1>
            <p className="text-muted-foreground">
              Platform COD orders are settled from <strong>Grabio Admin → Delivery Wallets</strong> after marking delivered in Orders.
              Invoice-only COD assignments below are legacy.
            </p>
          </div>

          <div className="flex gap-2">
            <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Package className="mr-2 h-4 w-4" /> Assign COD
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Assign COD order to delivery</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAssignOrder} className="space-y-4">
                  <div>
                    <Label>Invoice / COD order</Label>
                    <Select value={assignForm.invoiceId} onValueChange={(v) => setAssignForm((p) => ({ ...p, invoiceId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Choose invoice..." /></SelectTrigger>
                      <SelectContent>
                        {unassignedInvoices.map((inv) => (
                          <SelectItem key={inv.id} value={inv.id}>
                            {inv.id} — {inv.clientName} ({formatCurrency(inv.amount, inv.currency)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Delivery person</Label>
                    <Select value={assignForm.deliveryPersonId} onValueChange={(v) => setAssignForm((p) => ({ ...p, deliveryPersonId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Choose courier..." /></SelectTrigger>
                      <SelectContent>
                        {deliveryPersons.filter((p) => p.isActive).map((person) => (
                          <SelectItem key={person.id} value={person.id}>
                            {person.name} · wallet {formatCurrency(person.walletBalance, "USD")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                    <Button type="submit">Assign</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={isAddPersonOpen} onOpenChange={setIsAddPersonOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> Add courier</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add delivery person</DialogTitle></DialogHeader>
                <form onSubmit={handleAddPerson} className="space-y-4">
                  <div><Label>Name *</Label><Input value={personForm.name} onChange={(e) => setPersonForm((p) => ({ ...p, name: e.target.value }))} /></div>
                  <div><Label>Phone *</Label><Input value={personForm.phone} onChange={(e) => setPersonForm((p) => ({ ...p, phone: e.target.value }))} /></div>
                  <div><Label>Email</Label><Input type="email" value={personForm.email} onChange={(e) => setPersonForm((p) => ({ ...p, email: e.target.value }))} /></div>
                  <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                    <Button type="submit">Add</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="md:col-span-2 border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-amber-800 dark:text-amber-300">Total outstanding delivery cash</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-amber-700 dark:text-amber-400">{formatCurrency(totalOutstanding, "USD")}</p>
              <p className="text-xs text-muted-foreground mt-1">Sum of all courier wallets · GL subledger held: {formatCurrency(cashBalance.deliveryHeldCash, "USD")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Couriers</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{deliveryPersons.filter((p) => p.isActive).length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">COD in transit</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{pendingCodOrders.length}</p></CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="wallets">Courier wallets</TabsTrigger>
            <TabsTrigger value="orders">COD orders</TabsTrigger>
            <TabsTrigger value="settlements">Settlement history</TabsTrigger>
          </TabsList>

          <TabsContent value="wallets" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Cash in hand by courier</CardTitle>
                <CardDescription>Settle when the courier hands collected COD cash to the office</CardDescription>
              </CardHeader>
              <CardContent>
                {deliveryPersons.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No delivery personnel yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {deliveryPersons.map((person) => {
                      const toSettle = unsettledOrdersForPerson(person.id);
                      return (
                        <div key={person.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border rounded-lg">
                          <div className="flex items-center gap-4">
                            <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                              <User className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <h3 className="font-medium">{person.name}</h3>
                              <p className="text-sm text-muted-foreground">{person.phone}</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="text-right">
                              <div className="flex items-center gap-2 justify-end">
                                <Wallet className="h-4 w-4 text-muted-foreground" />
                                <span className={`text-lg font-bold ${person.walletBalance > 0 ? "text-amber-600" : ""}`}>
                                  {formatCurrency(person.walletBalance, "USD")}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">{toSettle.length} COD awaiting settlement</p>
                            </div>
                            {toSettle.length > 0 && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedPerson(person);
                                  setSelectedOrders(toSettle.map((o) => o.id));
                                  setIsSettleOpen(true);
                                }}
                              >
                                <ArrowDownToLine className="h-4 w-4 mr-1" /> Settle
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

          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>COD delivery orders</CardTitle>
                <CardDescription>Mark delivered → mark COD collected → settle wallet</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {deliveryOrders.length === 0 ? (
                  <p className="text-center py-12 text-muted-foreground">No delivery orders</p>
                ) : (
                  deliveryOrders.map((order) => (
                    <div key={order.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-lg">
                      <div>
                        <h3 className="font-medium">{order.clientName}</h3>
                        <p className="text-sm text-muted-foreground">
                          {order.invoiceNumber || order.invoiceId} · {order.deliveryPersonName}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-bold">{formatCurrency(order.amount, "USD")}</p>
                        {getStatusBadge(order.status)}
                        {order.status === "pending_delivery" && (
                          <Button size="sm" variant="outline" onClick={() => void handleStatusChange(order.id, "delivered_unpaid")}>
                            Delivered
                          </Button>
                        )}
                        {order.status === "delivered_unpaid" && (
                          <Button size="sm" onClick={() => void handleStatusChange(order.id, "paid")}>
                            COD collected
                          </Button>
                        )}
                        {order.returnedAt && (
                          <Badge variant="outline"><Lock className="h-3 w-3 mr-1" />Settled</Badge>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settlements">
            <Card>
              <CardHeader>
                <CardTitle>Settlement history</CardTitle>
                <CardDescription>GL-posted wallet settlements (Dr Cash/Bank · Cr Delivery Wallet)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {cashCollections.length === 0 ? (
                  <p className="text-center py-12 text-muted-foreground">No settlements yet</p>
                ) : (
                  [...cashCollections].reverse().map((collection) => (
                    <div key={collection.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h3 className="font-medium">{collection.deliveryPersonName}</h3>
                        <p className="text-sm text-muted-foreground">
                          {new Date(collection.collectedAt).toLocaleString()} · {collection.orderIds.length} orders · {collection.id}
                        </p>
                        {collection.destination && (
                          <Badge variant="outline" className="mt-1 capitalize">{collection.destination}</Badge>
                        )}
                      </div>
                      <p className="text-xl font-bold text-green-600">+{formatCurrency(collection.totalAmount, "USD")}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={isSettleOpen} onOpenChange={setIsSettleOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Settle wallet — {selectedPerson?.name}</DialogTitle>
            </DialogHeader>
            {selectedPerson && (
              <div className="space-y-4">
                <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">Current wallet balance</p>
                  <p className="text-2xl font-bold text-amber-600">{formatCurrency(selectedPerson.walletBalance, "USD")}</p>
                </div>

                <div>
                  <Label>Deposit to</Label>
                  <Select value={settleDestination} onValueChange={(v) => setSettleDestination(v as 'cash' | 'bank')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash on hand (1000)</SelectItem>
                      <SelectItem value="bank">Bank (1010)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>COD orders to settle</Label>
                  <div className="space-y-2 mt-2 max-h-48 overflow-y-auto">
                    {unsettledOrdersForPerson(selectedPerson.id).map((order) => (
                      <div key={order.id} className="flex items-center gap-3 p-3 border rounded-lg">
                        <Checkbox
                          id={order.id}
                          checked={selectedOrders.includes(order.id)}
                          onCheckedChange={(checked) => {
                            setSelectedOrders((prev) =>
                              checked ? [...prev, order.id] : prev.filter((id) => id !== order.id),
                            );
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

                <div>
                  <Label>Notes (optional)</Label>
                  <Input value={settleNotes} onChange={(e) => setSettleNotes(e.target.value)} placeholder="e.g. End of shift handover" />
                </div>

                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-sm text-muted-foreground">Settlement total · posts to GL</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(settleTotal, "USD")}</p>
                </div>

                <DialogFooter>
                  <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                  <Button onClick={() => void handleSettle()} disabled={settleLoading || selectedOrders.length === 0}>
                    {settleLoading ? "Settling…" : "Settle & post GL"}
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
