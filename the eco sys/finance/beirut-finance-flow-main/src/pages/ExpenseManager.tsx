import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useAppContext } from "@/context/AppContext";
import { useAccounting } from "@/context/AccountingContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Plus, Receipt, Calendar, CreditCard, Wallet, Building2, Repeat, AlertCircle, Trash2, Edit, DollarSign } from "lucide-react";
import { 
  Expense, 
  ExpenseCategory, 
  RecurrenceType, 
  RecurrenceInterval, 
  PaymentMethod, 
  PaymentStatus,
  EXPENSE_CATEGORY_LABELS 
} from "@/types/accounting";

const ExpenseManager = () => {
  const { logout } = useAppContext();
  const { 
    expenses, 
    createExpense, 
    updateExpense, 
    deleteExpense,
    payExpense,
    getTotalExpensesByCategory 
  } = useAccounting();
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "other" as ExpenseCategory,
    type: "one-time" as RecurrenceType,
    recurrenceInterval: "monthly" as RecurrenceInterval,
    amount: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    paymentMethod: "cash" as PaymentMethod,
    notes: ""
  });

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");

  const handleLogout = () => {
    logout();
    toast({ title: "Logged out" });
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      category: "other",
      type: "one-time",
      recurrenceInterval: "monthly",
      amount: "",
      startDate: new Date().toISOString().split("T")[0],
      endDate: "",
      paymentMethod: "cash",
      notes: ""
    });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.amount) {
      toast({ title: "Error", description: "Name and amount are required", variant: "destructive" });
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Error", description: "Invalid amount", variant: "destructive" });
      return;
    }

    const id = createExpense({
      name: formData.name,
      description: formData.description || undefined,
      category: formData.category,
      type: formData.type,
      recurrenceInterval: formData.type === "recurring" ? formData.recurrenceInterval : undefined,
      amount,
      startDate: formData.startDate,
      endDate: formData.endDate || undefined,
      paymentMethod: formData.paymentMethod,
      status: "unpaid",
      notes: formData.notes || undefined
    });

    toast({ title: "Success", description: "Expense created successfully" });
    resetForm();
    setIsCreateOpen(false);
  };

  const handlePay = () => {
    if (!selectedExpense) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Error", description: "Invalid amount", variant: "destructive" });
      return;
    }

    const remaining = selectedExpense.amount - (selectedExpense.paidAmount || 0);
    if (amount > remaining) {
      toast({ title: "Error", description: "Amount exceeds remaining balance", variant: "destructive" });
      return;
    }

    payExpense(selectedExpense.id, amount, paymentMethod);
    toast({ title: "Success", description: "Payment recorded" });
    setIsPayOpen(false);
    setSelectedExpense(null);
    setPaymentAmount("");
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this expense?")) {
      deleteExpense(id);
      toast({ title: "Deleted", description: "Expense removed" });
    }
  };

  const getStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case "paid": return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">Paid</Badge>;
      case "partial": return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300">Partial</Badge>;
      default: return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">Unpaid</Badge>;
    }
  };

  const filteredExpenses = expenses.filter(e => {
    if (activeTab === "all") return true;
    if (activeTab === "unpaid") return e.status !== "paid";
    if (activeTab === "recurring") return e.type === "recurring";
    return e.category === activeTab;
  });

  const totals = getTotalExpensesByCategory();
  const totalPaid = Object.values(totals).reduce((a, b) => a + b, 0);
  const totalUnpaid = expenses.filter(e => e.status !== "paid").reduce((sum, e) => sum + e.amount - (e.paidAmount || 0), 0);

  return (
    <AppLayout onLogout={handleLogout}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Expense Management</h1>
            <p className="text-muted-foreground">Track and manage all business expenses</p>
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Add Expense
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create New Expense</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="name">Expense Name *</Label>
                    <Input 
                      id="name" 
                      value={formData.name}
                      onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g. Office Rent"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select value={formData.category} onValueChange={(v: ExpenseCategory) => setFormData(prev => ({ ...prev, category: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(EXPENSE_CATEGORY_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="amount">Amount *</Label>
                    <Input 
                      id="amount" 
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={e => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="type">Type</Label>
                    <Select value={formData.type} onValueChange={(v: RecurrenceType) => setFormData(prev => ({ ...prev, type: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="one-time">One-time</SelectItem>
                        <SelectItem value="recurring">Recurring</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {formData.type === "recurring" && (
                    <div>
                      <Label htmlFor="interval">Recurrence</Label>
                      <Select value={formData.recurrenceInterval} onValueChange={(v: RecurrenceInterval) => setFormData(prev => ({ ...prev, recurrenceInterval: v }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hourly">Hourly</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  <div>
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input 
                      id="startDate" 
                      type="date"
                      value={formData.startDate}
                      onChange={e => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                    />
                  </div>
                  
                  {formData.type === "recurring" && (
                    <div>
                      <Label htmlFor="endDate">End Date (Optional)</Label>
                      <Input 
                        id="endDate" 
                        type="date"
                        value={formData.endDate}
                        onChange={e => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                      />
                    </div>
                  )}
                  
                  <div>
                    <Label htmlFor="payment">Payment Method</Label>
                    <Select value={formData.paymentMethod} onValueChange={(v: PaymentMethod) => setFormData(prev => ({ ...prev, paymentMethod: v }))}>
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
                  
                  <div className="col-span-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea 
                      id="notes"
                      value={formData.notes}
                      onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Additional notes..."
                      rows={2}
                    />
                  </div>
                </div>
                
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button type="submit">Create Expense</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Paid</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid, "USD")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Unpaid Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(totalUnpaid, "USD")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{expenses.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Recurring</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{expenses.filter(e => e.type === "recurring").length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Expense List */}
        <Card>
          <CardHeader>
            <CardTitle>Expenses</CardTitle>
            <CardDescription>All recorded business expenses</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4 flex-wrap">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="unpaid">Unpaid</TabsTrigger>
                <TabsTrigger value="recurring">Recurring</TabsTrigger>
                <TabsTrigger value="rent">Rent</TabsTrigger>
                <TabsTrigger value="utilities">Utilities</TabsTrigger>
                <TabsTrigger value="payroll">Payroll</TabsTrigger>
              </TabsList>

              <div className="space-y-3">
                {filteredExpenses.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No expenses found</p>
                  </div>
                ) : (
                  filteredExpenses.map(expense => (
                    <div 
                      key={expense.id} 
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full ${
                          expense.type === "recurring" ? "bg-purple-100 dark:bg-purple-900/30" : "bg-blue-100 dark:bg-blue-900/30"
                        }`}>
                          {expense.type === "recurring" ? (
                            <Repeat className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                          ) : (
                            <Receipt className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-medium">{expense.name}</h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{EXPENSE_CATEGORY_LABELS[expense.category]}</span>
                            <span>•</span>
                            <span>{new Date(expense.startDate).toLocaleDateString()}</span>
                            {expense.type === "recurring" && (
                              <>
                                <span>•</span>
                                <span className="capitalize">{expense.recurrenceInterval}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold">{formatCurrency(expense.amount, "USD")}</p>
                          {expense.paidAmount && expense.paidAmount > 0 && expense.paidAmount < expense.amount && (
                            <p className="text-sm text-muted-foreground">
                              Paid: {formatCurrency(expense.paidAmount, "USD")}
                            </p>
                          )}
                        </div>
                        {getStatusBadge(expense.status)}
                        
                        <div className="flex gap-1">
                          {expense.status !== "paid" && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                setSelectedExpense(expense);
                                setPaymentAmount(String(expense.amount - (expense.paidAmount || 0)));
                                setIsPayOpen(true);
                              }}
                            >
                              <DollarSign className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(expense.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Tabs>
          </CardContent>
        </Card>

        {/* Pay Dialog */}
        <Dialog open={isPayOpen} onOpenChange={setIsPayOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
            </DialogHeader>
            {selectedExpense && (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="font-medium">{selectedExpense.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Total: {formatCurrency(selectedExpense.amount, "USD")} • 
                    Remaining: {formatCurrency(selectedExpense.amount - (selectedExpense.paidAmount || 0), "USD")}
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="payAmount">Payment Amount</Label>
                  <Input 
                    id="payAmount"
                    type="number"
                    step="0.01"
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)}
                  />
                </div>
                
                <div>
                  <Label htmlFor="payMethod">Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={(v: PaymentMethod) => setPaymentMethod(v)}>
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
                
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button onClick={handlePay}>Confirm Payment</Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default ExpenseManager;
