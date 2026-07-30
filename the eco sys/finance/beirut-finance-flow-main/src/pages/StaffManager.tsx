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
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Plus, Users, DollarSign, Calendar, Clock, Trash2, CreditCard, UserCheck } from "lucide-react";
import { Staff, StaffPayment, StaffPaymentType, PaymentMethod, PaymentStatus } from "@/types/accounting";

const StaffManager = () => {
  const { logout } = useAppContext();
  const { 
    staff, 
    staffPayments,
    addStaff, 
    updateStaff, 
    deleteStaff,
    createStaffPayment,
    payStaffPayment,
    getTotalPayroll
  } = useAccounting();
  const { toast } = useToast();

  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [activeTab, setActiveTab] = useState("staff");

  // Staff form
  const [staffForm, setStaffForm] = useState({
    name: "",
    role: "",
    phone: "",
    email: "",
    paymentType: "monthly" as StaffPaymentType,
    rate: "",
    workingHours: ""
  });

  // Payment form
  const [paymentForm, setPaymentForm] = useState({
    periodStart: new Date().toISOString().split("T")[0],
    periodEnd: new Date().toISOString().split("T")[0],
    hoursWorked: "",
    daysWorked: "",
    amount: "",
    paymentMethod: "cash" as PaymentMethod
  });

  const handleLogout = () => {
    logout();
    toast({ title: "Logged out" });
  };

  const resetStaffForm = () => {
    setStaffForm({
      name: "",
      role: "",
      phone: "",
      email: "",
      paymentType: "monthly",
      rate: "",
      workingHours: ""
    });
  };

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!staffForm.name || !staffForm.role || !staffForm.rate) {
      toast({ title: "Error", description: "Name, role, and rate are required", variant: "destructive" });
      return;
    }

    const rate = parseFloat(staffForm.rate);
    if (isNaN(rate) || rate <= 0) {
      toast({ title: "Error", description: "Invalid rate", variant: "destructive" });
      return;
    }

    addStaff({
      name: staffForm.name,
      role: staffForm.role,
      phone: staffForm.phone || undefined,
      email: staffForm.email || undefined,
      paymentType: staffForm.paymentType,
      rate,
      workingHours: staffForm.workingHours ? parseFloat(staffForm.workingHours) : undefined,
      isActive: true
    });

    toast({ title: "Success", description: "Staff member added" });
    resetStaffForm();
    setIsAddStaffOpen(false);
  };

  const handleCreatePayment = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedStaff) return;

    let amount = parseFloat(paymentForm.amount);
    
    // Auto-calculate amount if not provided
    if (!paymentForm.amount || isNaN(amount)) {
      switch (selectedStaff.paymentType) {
        case "hourly":
          const hours = parseFloat(paymentForm.hoursWorked);
          if (!isNaN(hours)) amount = hours * selectedStaff.rate;
          break;
        case "daily":
          const days = parseFloat(paymentForm.daysWorked);
          if (!isNaN(days)) amount = days * selectedStaff.rate;
          break;
        case "monthly":
          amount = selectedStaff.rate;
          break;
      }
    }

    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Error", description: "Could not calculate payment amount", variant: "destructive" });
      return;
    }

    createStaffPayment({
      staffId: selectedStaff.id,
      staffName: selectedStaff.name,
      amount,
      periodStart: paymentForm.periodStart,
      periodEnd: paymentForm.periodEnd,
      hoursWorked: paymentForm.hoursWorked ? parseFloat(paymentForm.hoursWorked) : undefined,
      daysWorked: paymentForm.daysWorked ? parseFloat(paymentForm.daysWorked) : undefined,
      status: "unpaid",
      paymentMethod: paymentForm.paymentMethod
    });

    toast({ title: "Success", description: "Payment created" });
    setIsPaymentOpen(false);
    setSelectedStaff(null);
  };

  const handlePayNow = (paymentId: string, method: PaymentMethod) => {
    payStaffPayment(paymentId, method);
    toast({ title: "Success", description: "Payment marked as paid" });
  };

  const handleDeleteStaff = (id: string) => {
    if (confirm("Delete this staff member?")) {
      deleteStaff(id);
      toast({ title: "Deleted", description: "Staff member removed" });
    }
  };

  const getStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case "paid": return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">Paid</Badge>;
      case "partial": return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300">Partial</Badge>;
      default: return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">Unpaid</Badge>;
    }
  };

  const getPaymentTypeBadge = (type: StaffPaymentType) => {
    const colors = {
      hourly: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
      daily: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
      monthly: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300"
    };
    return <Badge className={colors[type]}>{type}</Badge>;
  };

  const payrollTotals = getTotalPayroll();

  return (
    <AppLayout onLogout={handleLogout}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Staff & Payroll</h1>
            <p className="text-muted-foreground">Manage staff members and payments</p>
          </div>
          
          <Dialog open={isAddStaffOpen} onOpenChange={setIsAddStaffOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Add Staff
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Staff Member</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddStaff} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input 
                      id="name" 
                      value={staffForm.name}
                      onChange={e => setStaffForm(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <Label htmlFor="role">Role *</Label>
                    <Input 
                      id="role" 
                      value={staffForm.role}
                      onChange={e => setStaffForm(prev => ({ ...prev, role: e.target.value }))}
                      placeholder="e.g. Driver, Chef, Manager"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input 
                      id="phone" 
                      value={staffForm.phone}
                      onChange={e => setStaffForm(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input 
                      id="email" 
                      type="email"
                      value={staffForm.email}
                      onChange={e => setStaffForm(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="paymentType">Payment Type *</Label>
                    <Select value={staffForm.paymentType} onValueChange={(v: StaffPaymentType) => setStaffForm(prev => ({ ...prev, paymentType: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="rate">Rate *</Label>
                    <Input 
                      id="rate" 
                      type="number"
                      step="0.01"
                      value={staffForm.rate}
                      onChange={e => setStaffForm(prev => ({ ...prev, rate: e.target.value }))}
                      placeholder={`Per ${staffForm.paymentType === "hourly" ? "hour" : staffForm.paymentType === "daily" ? "day" : "month"}`}
                    />
                  </div>
                  
                  {staffForm.paymentType === "hourly" && (
                    <div className="col-span-2">
                      <Label htmlFor="workingHours">Default Working Hours/Day</Label>
                      <Input 
                        id="workingHours" 
                        type="number"
                        value={staffForm.workingHours}
                        onChange={e => setStaffForm(prev => ({ ...prev, workingHours: e.target.value }))}
                        placeholder="e.g. 8"
                      />
                    </div>
                  )}
                </div>
                
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button type="submit">Add Staff</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Staff</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{staff.filter(s => s.isActive).length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Paid This Period</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(payrollTotals.paid, "USD")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Payments</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(payrollTotals.pending, "USD")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Payments</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{staffPayments.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="staff">Staff Members</TabsTrigger>
            <TabsTrigger value="payments">Payment History</TabsTrigger>
          </TabsList>

          <TabsContent value="staff" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Staff Directory</CardTitle>
                <CardDescription>All registered staff members</CardDescription>
              </CardHeader>
              <CardContent>
                {staff.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No staff members yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {staff.map(member => (
                      <div 
                        key={member.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2 rounded-full bg-indigo-100 dark:bg-indigo-900/30">
                            <UserCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                          </div>
                          <div>
                            <h3 className="font-medium">{member.name}</h3>
                            <p className="text-sm text-muted-foreground">{member.role}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-bold">{formatCurrency(member.rate, "USD")}</p>
                            <p className="text-xs text-muted-foreground">per {member.paymentType === "hourly" ? "hour" : member.paymentType === "daily" ? "day" : "month"}</p>
                          </div>
                          {getPaymentTypeBadge(member.paymentType)}
                          
                          <div className="flex gap-1">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                setSelectedStaff(member);
                                setPaymentForm(prev => ({
                                  ...prev,
                                  amount: member.paymentType === "monthly" ? String(member.rate) : ""
                                }));
                                setIsPaymentOpen(true);
                              }}
                            >
                              <DollarSign className="h-4 w-4 mr-1" /> Pay
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteStaff(member.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Payment History</CardTitle>
                <CardDescription>All staff payments</CardDescription>
              </CardHeader>
              <CardContent>
                {staffPayments.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No payments recorded</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {staffPayments.map(payment => (
                      <div 
                        key={payment.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-full ${
                            payment.status === "paid" 
                              ? "bg-green-100 dark:bg-green-900/30" 
                              : "bg-amber-100 dark:bg-amber-900/30"
                          }`}>
                            <Calendar className={`h-5 w-5 ${
                              payment.status === "paid" 
                                ? "text-green-600 dark:text-green-400" 
                                : "text-amber-600 dark:text-amber-400"
                            }`} />
                          </div>
                          <div>
                            <h3 className="font-medium">{payment.staffName}</h3>
                            <p className="text-sm text-muted-foreground">
                              {new Date(payment.periodStart).toLocaleDateString()} - {new Date(payment.periodEnd).toLocaleDateString()}
                              {payment.hoursWorked && ` • ${payment.hoursWorked}h`}
                              {payment.daysWorked && ` • ${payment.daysWorked}d`}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <p className="font-bold">{formatCurrency(payment.amount, "USD")}</p>
                          {getStatusBadge(payment.status)}
                          
                          {payment.status !== "paid" && (
                            <Button 
                              size="sm" 
                              onClick={() => handlePayNow(payment.id, payment.paymentMethod || "cash")}
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
        </Tabs>

        {/* Create Payment Dialog */}
        <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Payment for {selectedStaff?.name}</DialogTitle>
            </DialogHeader>
            {selectedStaff && (
              <form onSubmit={handleCreatePayment} className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="font-medium">{selectedStaff.name} - {selectedStaff.role}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(selectedStaff.rate, "USD")} per {selectedStaff.paymentType === "hourly" ? "hour" : selectedStaff.paymentType === "daily" ? "day" : "month"}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="periodStart">Period Start</Label>
                    <Input 
                      id="periodStart"
                      type="date"
                      value={paymentForm.periodStart}
                      onChange={e => setPaymentForm(prev => ({ ...prev, periodStart: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="periodEnd">Period End</Label>
                    <Input 
                      id="periodEnd"
                      type="date"
                      value={paymentForm.periodEnd}
                      onChange={e => setPaymentForm(prev => ({ ...prev, periodEnd: e.target.value }))}
                    />
                  </div>
                  
                  {selectedStaff.paymentType === "hourly" && (
                    <div>
                      <Label htmlFor="hoursWorked">Hours Worked</Label>
                      <Input 
                        id="hoursWorked"
                        type="number"
                        value={paymentForm.hoursWorked}
                        onChange={e => setPaymentForm(prev => ({ ...prev, hoursWorked: e.target.value }))}
                      />
                    </div>
                  )}
                  
                  {selectedStaff.paymentType === "daily" && (
                    <div>
                      <Label htmlFor="daysWorked">Days Worked</Label>
                      <Input 
                        id="daysWorked"
                        type="number"
                        value={paymentForm.daysWorked}
                        onChange={e => setPaymentForm(prev => ({ ...prev, daysWorked: e.target.value }))}
                      />
                    </div>
                  )}
                  
                  <div>
                    <Label htmlFor="amount">Amount (Override)</Label>
                    <Input 
                      id="amount"
                      type="number"
                      step="0.01"
                      value={paymentForm.amount}
                      onChange={e => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                      placeholder="Auto-calculated"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="payMethod">Payment Method</Label>
                    <Select value={paymentForm.paymentMethod} onValueChange={(v: PaymentMethod) => setPaymentForm(prev => ({ ...prev, paymentMethod: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="bank">Bank Transfer</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button type="submit">Create Payment</Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default StaffManager;
