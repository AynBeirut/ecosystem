import React, { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { DollarSign, Plus, Edit2, Trash2, Calendar, TrendingUp, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Expense, ExpenseCategory } from '@/types/financial';
import { logAction } from '@/lib/auditLog';
import MobileHeader from '@/components/MobileHeader';
import BackButton from '@/components/BackButton';
import { useIsMobile } from '@/hooks/use-mobile';

const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string; color: string }[] = [
  { value: 'rent', label: 'Rent', color: 'bg-blue-100 text-blue-800' },
  { value: 'utilities', label: 'Utilities', color: 'bg-green-100 text-green-800' },
  { value: 'supplies', label: 'Supplies', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'salaries', label: 'Salaries', color: 'bg-purple-100 text-purple-800' },
  { value: 'marketing', label: 'Marketing', color: 'bg-pink-100 text-pink-800' },
  { value: 'maintenance', label: 'Maintenance', color: 'bg-orange-100 text-orange-800' },
  { value: 'insurance', label: 'Insurance', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'taxes', label: 'Taxes', color: 'bg-red-100 text-red-800' },
  { value: 'transportation', label: 'Transportation', color: 'bg-teal-100 text-teal-800' },
  { value: 'other', label: 'Other', color: 'bg-gray-100 text-gray-800' },
];

const AdminExpenses: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | 'all'>('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: 0,
    category: 'other' as ExpenseCategory,
    date: new Date().toISOString().split('T')[0],
    vendor: '',
    paymentMethod: 'cash' as 'cash' | 'card' | 'bank_transfer' | 'other',
    recurring: false,
    recurringFrequency: 'monthly' as 'weekly' | 'monthly' | 'quarterly' | 'yearly',
    receiptNumber: '',
    notes: '',
  });

  useEffect(() => {
    const fetchExpenses = async () => {
      if (!user?.storeId) return;
      const db = getFirestore();
      const expensesRef = collection(db, 'expenses');
      const q = query(expensesRef, where('storeId', '==', user.storeId));
      const snapshot = await getDocs(q);
      const expensesList: Expense[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Expense));
      setExpenses(expensesList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    };
    fetchExpenses();
  }, [user?.storeId]);

  const handleAddExpense = async () => {
    if (!newExpense.description || newExpense.amount <= 0 || !user?.storeId) {
      toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }

    try {
      const db = getFirestore();
      const expenseData = {
        ...newExpense,
        storeId: user.storeId,
        createdAt: new Date().toISOString(),
        createdBy: user.id,
      };

      const docRef = await addDoc(collection(db, 'expenses'), expenseData);
      const newExpenseObj = { id: docRef.id, ...expenseData };
      setExpenses([newExpenseObj, ...expenses]);

      await logAction(
        user.id,
        user.name,
        user.role,
        'create',
        'expense',
        docRef.id,
        { newValue: expenseData },
        user.storeId
      );

      setNewExpense({
        description: '',
        amount: 0,
        category: 'other',
        date: new Date().toISOString().split('T')[0],
        vendor: '',
        paymentMethod: 'cash',
        recurring: false,
        recurringFrequency: 'monthly',
        receiptNumber: '',
        notes: '',
      });
      setIsAddingExpense(false);
      toast({ title: "Success", description: "Expense added successfully!" });
    } catch (error) {
      console.error('Error adding expense:', error);
      toast({ title: "Error", description: "Failed to add expense", variant: "destructive" });
    }
  };

  const handleUpdateExpense = async () => {
    if (!editingExpense || !user?.storeId) return;

    try {
      const db = getFirestore();
      const expenseRef = doc(db, 'expenses', editingExpense.id);
      const updateData = {
        description: editingExpense.description,
        amount: editingExpense.amount,
        category: editingExpense.category,
        date: editingExpense.date,
        vendor: editingExpense.vendor,
        paymentMethod: editingExpense.paymentMethod,
        recurring: editingExpense.recurring,
        recurringFrequency: editingExpense.recurringFrequency,
        receiptNumber: editingExpense.receiptNumber,
        notes: editingExpense.notes,
      };

      await updateDoc(expenseRef, updateData);
      setExpenses(expenses.map(exp => exp.id === editingExpense.id ? editingExpense : exp));

      await logAction(
        user.id,
        user.name,
        user.role,
        'update',
        'expense',
        editingExpense.id,
        { 
          oldValue: expenses.find(e => e.id === editingExpense.id),
          newValue: editingExpense 
        },
        user.storeId
      );

      setEditingExpense(null);
      toast({ title: "Success", description: "Expense updated successfully!" });
    } catch (error) {
      console.error('Error updating expense:', error);
      toast({ title: "Error", description: "Failed to update expense", variant: "destructive" });
    }
  };

  const handleDeleteExpense = async (expense: Expense) => {
    if (!confirm(`Delete expense "${expense.description}"?`)) return;
    if (!user?.storeId) return;

    try {
      const db = getFirestore();
      await deleteDoc(doc(db, 'expenses', expense.id));
      setExpenses(expenses.filter(e => e.id !== expense.id));

      await logAction(
        user.id,
        user.name,
        user.role,
        'delete',
        'expense',
        expense.id,
        { oldValue: expense },
        user.storeId
      );

      toast({ title: "Success", description: "Expense deleted successfully!" });
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast({ title: "Error", description: "Failed to delete expense", variant: "destructive" });
    }
  };

  const getFilteredExpenses = () => {
    return expenses.filter(exp => {
      const categoryMatch = selectedCategory === 'all' || exp.category === selectedCategory;
      const monthMatch = exp.date.startsWith(selectedMonth);
      return categoryMatch && monthMatch;
    });
  };

  const filteredExpenses = getFilteredExpenses();
  const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  const recurringExpenses = filteredExpenses.filter(exp => exp.recurring);
  const categoryBreakdown = EXPENSE_CATEGORIES.map(cat => ({
    ...cat,
    total: filteredExpenses.filter(exp => exp.category === cat.value).reduce((sum, exp) => sum + exp.amount, 0),
  })).filter(cat => cat.total > 0);

  const getCategoryBadge = (category: ExpenseCategory) => {
    const cat = EXPENSE_CATEGORIES.find(c => c.value === category);
    return <Badge className={cat?.color}>{cat?.label}</Badge>;
  };

  const ExpenseForm = ({ expense, onChange, isEdit = false }: { 
    expense: typeof newExpense, 
    onChange: (updates: Partial<typeof newExpense>) => void,
    isEdit?: boolean 
  }) => (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="description">Description *</Label>
          <Input
            id="description"
            value={expense.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="e.g., Monthly rent payment"
          />
        </div>
        <div>
          <Label htmlFor="amount">Amount *</Label>
          <Input
            id="amount"
            type="number"
            min="0"
            step="0.01"
            value={expense.amount}
            onChange={(e) => onChange({ amount: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div>
          <Label htmlFor="category">Category *</Label>
          <Select
            value={expense.category}
            onValueChange={(value: ExpenseCategory) => onChange({ category: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXPENSE_CATEGORIES.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="date">Date *</Label>
          <Input
            id="date"
            type="date"
            value={expense.date}
            onChange={(e) => onChange({ date: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="paymentMethod">Payment Method</Label>
          <Select
            value={expense.paymentMethod}
            onValueChange={(value: typeof expense.paymentMethod) => onChange({ paymentMethod: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="card">Card</SelectItem>
              <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="vendor">Vendor</Label>
          <Input
            id="vendor"
            value={expense.vendor}
            onChange={(e) => onChange({ vendor: e.target.value })}
            placeholder="Vendor name"
          />
        </div>
        <div>
          <Label htmlFor="receiptNumber">Receipt Number</Label>
          <Input
            id="receiptNumber"
            value={expense.receiptNumber}
            onChange={(e) => onChange({ receiptNumber: e.target.value })}
            placeholder="Receipt #"
          />
        </div>
        <div className="col-span-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="recurring"
              checked={expense.recurring}
              onChange={(e) => onChange({ recurring: e.target.checked })}
              className="rounded"
            />
            <Label htmlFor="recurring">Recurring Expense</Label>
          </div>
        </div>
        {expense.recurring && (
          <div className="col-span-2">
            <Label htmlFor="recurringFrequency">Frequency</Label>
            <Select
              value={expense.recurringFrequency}
              onValueChange={(value: typeof expense.recurringFrequency) => onChange({ recurringFrequency: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={expense.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder="Additional notes..."
            rows={3}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {isMobile ? <MobileHeader title="Expense Tracking" /> : null}
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {!isMobile && <BackButton to="/admin/inventory" label="Back to Inventory" />}
            <h1 className="text-2xl font-bold">Expense Tracking</h1>
          </div>
          <div className="flex gap-2">
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-48"
            />
            <Dialog open={isAddingExpense} onOpenChange={setIsAddingExpense}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Expense
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add Expense</DialogTitle>
                  <DialogDescription>Record a new business expense</DialogDescription>
                </DialogHeader>
                <ExpenseForm
                  expense={newExpense}
                  onChange={(updates) => setNewExpense({ ...newExpense, ...updates })}
                />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddingExpense(false)}>Cancel</Button>
                  <Button onClick={handleAddExpense}>Add Expense</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-gray-500" />
                <div>
                  <div className="text-2xl font-bold">${totalExpenses.toFixed(2)}</div>
                  <p className="text-xs text-gray-500">Total Expenses</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-gray-500" />
                <div>
                  <div className="text-2xl font-bold">{filteredExpenses.length}</div>
                  <p className="text-xs text-gray-500">Transactions</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-gray-500" />
                <div>
                  <div className="text-2xl font-bold">{recurringExpenses.length}</div>
                  <p className="text-xs text-gray-500">Recurring</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-gray-500" />
                <div>
                  <div className="text-2xl font-bold">{categoryBreakdown.length}</div>
                  <p className="text-xs text-gray-500">Categories Used</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {categoryBreakdown.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Category Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {categoryBreakdown.map(cat => (
                  <div key={cat.value} className="text-center">
                    <Badge className={cat.color}>{cat.label}</Badge>
                    <div className="text-lg font-bold mt-2">${cat.total.toFixed(2)}</div>
                    <div className="text-xs text-gray-500">
                      {((cat.total / totalExpenses) * 100).toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mb-4">
          <Select value={selectedCategory} onValueChange={(value: ExpenseCategory | 'all') => setSelectedCategory(value)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {EXPENSE_CATEGORIES.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4">
          {filteredExpenses.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <DollarSign className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500">No expenses recorded for this period.</p>
              </CardContent>
            </Card>
          ) : (
            filteredExpenses.map((expense) => (
              <Card key={expense.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        {expense.description}
                        {getCategoryBadge(expense.category)}
                        {expense.recurring && <Badge variant="outline">Recurring</Badge>}
                      </CardTitle>
                      <CardDescription>
                        {new Date(expense.date).toLocaleDateString()} | {expense.vendor || 'No vendor'} | {expense.paymentMethod}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right mr-4">
                        <div className="text-2xl font-bold">${expense.amount.toFixed(2)}</div>
                        {expense.receiptNumber && (
                          <div className="text-xs text-gray-500">Receipt: {expense.receiptNumber}</div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingExpense(expense)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteExpense(expense)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {expense.notes && (
                  <CardContent>
                    <p className="text-sm text-gray-600">{expense.notes}</p>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </div>

        {editingExpense && (
          <Dialog open={!!editingExpense} onOpenChange={() => setEditingExpense(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit Expense</DialogTitle>
                <DialogDescription>Update expense details</DialogDescription>
              </DialogHeader>
              <ExpenseForm
                expense={editingExpense}
                onChange={(updates) => setEditingExpense({ ...editingExpense, ...updates })}
                isEdit
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingExpense(null)}>Cancel</Button>
                <Button onClick={handleUpdateExpense}>Update Expense</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </main>
    </div>
  );
};

export default AdminExpenses;
