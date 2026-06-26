import React, { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { DollarSign, Plus, Edit2, Trash2, Calendar, TrendingUp, AlertCircle, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Expense, ExpenseCategory } from '@/types/financial';
import { StoreProfile } from '@/types/storeProfile';
import { logAction } from '@/lib/auditLog';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminStatCard from '@/components/admin/AdminStatCard';
import AdminPanel from '@/components/admin/AdminPanel';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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

// Move ExpenseForm outside to prevent re-creation on every render
const ExpenseForm = ({ expense, onChange, isEdit = false }: { 
  expense: {
    description: string;
    amount: number;
    category: ExpenseCategory;
    date: string;
    paymentMethod: 'cash' | 'card' | 'bank_transfer' | 'other';
    vendor: string;
    receiptNumber: string;
    recurring: boolean;
    recurringFrequency?: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    notes: string;
  }, 
  onChange: (updates: Partial<typeof expense>) => void,
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
          value={expense.amount === 0 ? '' : expense.amount}
          onChange={(e) => onChange({ amount: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
          placeholder="0.00"
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

const AdminExpenses: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [storeProfile, setStoreProfile] = useState<StoreProfile | null>(null);
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
      
      try {
        // Fetch store profile
        const profileRef = doc(db, 'storeProfiles', user.storeId);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          setStoreProfile(profileSnap.data() as StoreProfile);
        }
        
        const expensesRef = collection(db, 'expenses');
        const q = query(expensesRef, where('storeId', '==', user.storeId));
        const snapshot = await getDocs(q);
        const expensesList: Expense[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Expense));
        setExpenses(expensesList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      } catch (error) {
        console.error('Error fetching expenses:', error);
        toast({
          title: 'Could not load expenses',
          description: error instanceof Error ? error.message : 'Permission or network error',
          variant: 'destructive',
        });
      }
    };
    fetchExpenses();
  }, [user?.storeId, toast]);

  // Generate expense report number
  const generateExpenseNumber = async (): Promise<string> => {
    if (!user?.storeId) return 'EXP-001';
    
    const db = getFirestore();
    const profileRef = doc(db, 'storeProfiles', user.storeId);
    
    // Fetch the latest store profile to ensure we have current data
    const profileSnap = await getDoc(profileRef);
    const currentProfile = profileSnap.exists() ? (profileSnap.data() as StoreProfile) : null;
    
    const prefix = currentProfile?.invoiceNumberPrefix || 'EXP';
    const nextNumber = (currentProfile?.lastInvoiceNumber || 0) + 1;
    
    await setDoc(profileRef, {
      lastInvoiceNumber: nextNumber
    }, { merge: true });
    
    // Update local state to keep UI in sync
    if (currentProfile) {
      setStoreProfile({ ...currentProfile, lastInvoiceNumber: nextNumber });
    }
    
    return `${prefix}-${nextNumber.toString().padStart(3, '0')}`;
  };

  // Format currency with LBP conversion
  const formatCurrency = (amount: number, includeSymbol: boolean = true): string => {
    const formatted = includeSymbol ? `$${amount.toFixed(2)}` : amount.toFixed(2);
    if (storeProfile?.currency === 'USD' && storeProfile.exchangeRate) {
      const lbpAmount = amount * storeProfile.exchangeRate;
      return `${formatted} (${lbpAmount.toLocaleString()} LBP)`;
    }
    return formatted;
  };

  const handleAddExpense = async () => {
    if (!newExpense.description || newExpense.amount <= 0 || !user?.storeId) {
      toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }

    try {
      const db = getFirestore();
      const invoiceNumber = await generateExpenseNumber();
      const expenseData = {
        ...newExpense,
        invoiceNumber,
        storeId: user.storeId,
        createdAt: new Date().toISOString(),
        createdBy: user.id,
        taxDeductible: false,
        isRecurring: newExpense.recurring || false,
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
      toast({ title: "Success", description: `Expense ${invoiceNumber} recorded!` });
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

  // Generate Expense Report HTML with templates
  const generateExpenseHTML = (expense: Expense) => {
    const template = storeProfile?.invoiceTemplate || 'modern';
    const storeName = storeProfile?.name || 'Your Store';
    const storeLogo = storeProfile?.logo || '';
    const storeSlogan = storeProfile?.slogan || '';
    const storeWebsite = storeProfile?.website || '';
    const storePhone = storeProfile?.phone || '';
    const storeEmail = storeProfile?.email || '';
    const storeTaxNumber = storeProfile?.taxNumber || '';
    const expNum = expense.invoiceNumber || expense.receiptNumber || expense.id.slice(0, 8).toUpperCase();
    
    const categoryLabel = EXPENSE_CATEGORIES.find(c => c.value === expense.category)?.label || expense.category;

    // Modern Template
    if (template === 'modern') {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Expense Report ${expNum}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              padding: 40px; 
              background: #f0f9ff;
              color: #1e293b;
            }
            .report-container {
              max-width: 800px;
              margin: 0 auto;
              background: white;
              padding: 40px;
              border-radius: 12px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header { 
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              padding-bottom: 30px;
              border-bottom: 3px solid #0ea5e9;
              margin-bottom: 30px;
            }
            .logo-section {
              display: flex;
              align-items: center;
              gap: 20px;
            }
            .logo {
              width: 150px;
              height: 150px;
              object-fit: contain;
              border-radius: 8px;
            }
            .store-info h1 {
              color: #0ea5e9;
              font-size: 28px;
              margin-bottom: 5px;
            }
            .store-info p {
              color: #64748b;
              font-size: 14px;
              margin: 2px 0;
            }
            .report-info {
              text-align: right;
            }
            .report-info h2 {
              color: #0ea5e9;
              font-size: 32px;
              margin-bottom: 10px;
            }
            .report-info .report-number {
              font-size: 20px;
              font-weight: bold;
              color: #1e293b;
              margin-bottom: 5px;
            }
            .details-section {
              background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
              padding: 25px;
              border-radius: 12px;
              margin: 30px 0;
              border-left: 4px solid #0ea5e9;
            }
            .detail-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 20px;
            }
            .detail-item {
              margin-bottom: 15px;
            }
            .detail-label {
              font-size: 12px;
              font-weight: 600;
              color: #64748b;
              text-transform: uppercase;
              margin-bottom: 5px;
            }
            .detail-value {
              font-size: 16px;
              color: #1e293b;
              font-weight: 600;
            }
            .amount-display {
              background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
              color: white;
              padding: 30px;
              border-radius: 12px;
              text-align: center;
              margin: 30px 0;
            }
            .amount-display .label {
              font-size: 14px;
              opacity: 0.9;
              margin-bottom: 10px;
            }
            .amount-display .amount {
              font-size: 36px;
              font-weight: bold;
            }
            .notes-section {
              margin-top: 30px;
              padding: 20px;
              background: #f0f9ff;
              border-left: 4px solid #0ea5e9;
              border-radius: 8px;
            }
            .footer {
              margin-top: 50px;
              padding-top: 20px;
              border-top: 2px solid #e5e7eb;
              text-align: center;
              color: #64748b;
              font-size: 13px;
            }
            @media print {
              body { padding: 20px; background: white; }
              .report-container { box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <div class="report-container">
            <div class="header">
              <div class="logo-section">
                ${storeLogo ? `<img src="${storeLogo}" alt="${storeName}" class="logo">` : ''}
                <div class="store-info">
                  <h1>${storeName}</h1>
                  ${storeSlogan ? `<p style="font-style: italic; color: #0ea5e9;">"${storeSlogan}"</p>` : ''}
                  ${storeWebsite ? `<p>🌐 ${storeWebsite}</p>` : ''}
                  ${storePhone ? `<p>📞 ${storePhone}</p>` : ''}
                  ${storeEmail ? `<p>📧 ${storeEmail}</p>` : ''}
                  ${storeTaxNumber ? `<p>Tax #: ${storeTaxNumber}</p>` : ''}
                </div>
              </div>
              <div class="report-info">
                <h2>EXPENSE REPORT</h2>
                <div class="report-number">${expNum}</div>
                <p style="color: #64748b;">${new Date(expense.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
            </div>
            
            <div class="details-section">
              <div class="detail-grid">
                <div class="detail-item">
                  <div class="detail-label">Category</div>
                  <div class="detail-value">${categoryLabel}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">Payment Method</div>
                  <div class="detail-value" style="text-transform: capitalize;">${expense.paymentMethod.replace('_', ' ')}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">Description</div>
                  <div class="detail-value">${expense.description}</div>
                </div>
                ${expense.vendor ? `
                <div class="detail-item">
                  <div class="detail-label">Vendor</div>
                  <div class="detail-value">${expense.vendor}</div>
                </div>
                ` : ''}
              </div>
            </div>

            <div class="amount-display">
              <div class="label">EXPENSE AMOUNT</div>
              <div class="amount">${formatCurrency(expense.amount, true)}</div>
            </div>

            ${expense.notes ? `
            <div class="notes-section">
              <strong style="color: #0ea5e9;">Notes:</strong><br/>
              <p style="color: #334155; margin-top: 10px;">${expense.notes}</p>
            </div>
            ` : ''}

            <div class="footer">
              <p>This is an official expense record from ${storeName}</p>
              ${storeEmail || storePhone ? `<p>Contact: ${storeEmail || storePhone}</p>` : ''}
            </div>
          </div>
        </body>
        </html>
      `;
    }
    
    // Classic Template
    if (template === 'classic') {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Expense Report ${expNum}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Georgia', serif;
              padding: 40px; 
              background: #fafafa;
              color: #2c2c2c;
            }
            .report-container {
              max-width: 800px;
              margin: 0 auto;
              background: white;
              padding: 50px;
              border: 2px solid #d4af37;
            }
            .header { 
              text-align: center;
              padding-bottom: 30px;
              border-bottom: 3px double #d4af37;
              margin-bottom: 40px;
            }
            .logo {
              width: 150px;
              height: 150px;
              object-fit: contain;
              margin: 0 auto 20px;
              display: block;
              border: 3px solid #d4af37;
              padding: 10px;
              background: white;
            }
            .header h1 {
              color: #2c2c2c;
              font-size: 32px;
              margin-bottom: 10px;
              font-weight: 400;
              letter-spacing: 2px;
            }
            .header .slogan {
              color: #d4af37;
              font-style: italic;
              font-size: 16px;
              margin-bottom: 15px;
            }
            .report-title {
              text-align: center;
              margin: 30px 0;
            }
            .report-title h2 {
              font-size: 36px;
              color: #d4af37;
              font-weight: 400;
              letter-spacing: 3px;
              margin-bottom: 10px;
            }
            .report-title .report-number {
              font-size: 18px;
              color: #2c2c2c;
              font-weight: 600;
            }
            .details-box {
              background: #faf9f6;
              padding: 30px;
              border: 1px solid #d4af37;
              margin: 30px 0;
            }
            .detail-item {
              padding: 15px 0;
              border-bottom: 1px solid #e0e0e0;
            }
            .detail-label {
              font-size: 12px;
              font-weight: 600;
              color: #d4af37;
              text-transform: uppercase;
              letter-spacing: 1.5px;
              margin-bottom: 8px;
            }
            .detail-value {
              font-size: 17px;
              color: #2c2c2c;
            }
            .amount-box {
              background: #2c2c2c;
              color: #d4af37;
              padding: 30px;
              text-align: center;
              border: 3px double #d4af37;
              margin: 40px 0;
            }
            .amount-box .label {
              font-size: 14px;
              letter-spacing: 2px;
              margin-bottom: 15px;
            }
            .amount-box .amount {
              font-size: 40px;
              font-weight: bold;
            }
            .footer {
              margin-top: 60px;
              padding-top: 30px;
              border-top: 3px double #d4af37;
              text-align: center;
              color: #666;
              font-size: 13px;
              font-style: italic;
            }
            @media print {
              body { padding: 20px; background: white; }
            }
          </style>
        </head>
        <body>
          <div class="report-container">
            <div class="header">
              ${storeLogo ? `<img src="${storeLogo}" alt="${storeName}" class="logo">` : ''}
              <h1>${storeName}</h1>
              ${storeSlogan ? `<div class="slogan">"${storeSlogan}"</div>` : ''}
              <div class="contact-info" style="font-size: 13px; color: #666; line-height: 1.6;">
                ${storeWebsite ? `${storeWebsite}<br/>` : ''}
                ${storePhone ? `${storePhone} • ` : ''}${storeEmail ? `${storeEmail}` : ''}<br/>
                ${storeTaxNumber ? `Tax Registration: ${storeTaxNumber}` : ''}
              </div>
            </div>
            
            <div class="report-title">
              <h2>EXPENSE REPORT</h2>
              <div class="report-number">${expNum}</div>
              <p style="color: #999; font-size: 14px; margin-top: 10px;">${new Date(expense.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            
            <div class="details-box">
              <div class="detail-item">
                <div class="detail-label">Category</div>
                <div class="detail-value">${categoryLabel}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">Description</div>
                <div class="detail-value">${expense.description}</div>
              </div>
              ${expense.vendor ? `
              <div class="detail-item">
                <div class="detail-label">Vendor/Payee</div>
                <div class="detail-value">${expense.vendor}</div>
              </div>
              ` : ''}
              <div class="detail-item" style="border-bottom: none;">
                <div class="detail-label">Payment Method</div>
                <div class="detail-value" style="text-transform: capitalize;">${expense.paymentMethod.replace('_', ' ')}</div>
              </div>
            </div>

            <div class="amount-box">
              <div class="label">TOTAL EXPENSE</div>
              <div class="amount">${formatCurrency(expense.amount, true)}</div>
            </div>

            ${expense.notes ? `
            <div style="margin-top: 40px; padding: 20px; border: 1px solid #d4af37; border-radius: 5px;">
              <strong style="color: #d4af37;">Notes:</strong><br/>
              <p style="color: #2c2c2c; margin-top: 10px; line-height: 1.8;">${expense.notes}</p>
            </div>
            ` : ''}

            <div class="footer">
              <p>Certified expense record from ${storeName}</p>
            </div>
          </div>
        </body>
        </html>
      `;
    }
    
    // Vibrant Template - default
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Expense Report ${expNum}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Helvetica Neue', Arial, sans-serif;
            padding: 40px; 
            background: linear-gradient(135deg, #fff5eb 0%, #fef3f2 100%);
            color: #1a1a1a;
          }
          .report-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
          }
          .header-banner {
            background: linear-gradient(135deg, #f97316 0%, #ea580c 50%, #9333ea 100%);
            padding: 40px;
            color: white;
            position: relative;
            overflow: hidden;
          }
          .header-banner::before {
            content: '';
            position: absolute;
            top: -50%;
            right: -10%;
            width: 300px;
            height: 300px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 50%;
          }
          .header-content {
            position: relative;
            z-index: 1;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .logo-section {
            display: flex;
            align-items: center;
            gap: 20px;
          }
          .logo {
            width: 150px;
            height: 150px;
            object-fit: contain;
            background: white;
            padding: 10px;
            border-radius: 15px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
          }
          .store-details h1 {
            font-size: 32px;
            margin-bottom: 8px;
            font-weight: 700;
          }
          .store-details p {
            font-size: 14px;
            opacity: 0.95;
            margin: 3px 0;
          }
          .report-badge {
            background: white;
            color: #f97316;
            padding: 20px 30px;
            border-radius: 15px;
            text-align: right;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
          }
          .report-badge h2 {
            font-size: 28px;
            margin-bottom: 8px;
            color: #f97316;
          }
          .report-badge .number {
            font-size: 20px;
            font-weight: bold;
            color: #1a1a1a;
          }
          .content-area {
            padding: 40px;
          }
          .details-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin-bottom: 40px;
          }
          .detail-box {
            background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
            padding: 20px;
            border-radius: 12px;
            border-left: 4px solid #f97316;
          }
          .detail-box h3 {
            color: #f97316;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 10px;
            font-weight: 700;
          }
          .detail-box .value {
            font-size: 17px;
            font-weight: 600;
            color: #1a1a1a;
          }
          .amount-display {
            background: linear-gradient(135deg, #f97316 0%, #9333ea 100%);
            color: white;
            padding: 35px;
            border-radius: 15px;
            text-align: center;
            margin: 30px 0;
          }
          .amount-display .label {
            font-size: 16px;
            letter-spacing: 2px;
            margin-bottom: 15px;
          }
          .amount-display .amount {
            font-size: 42px;
            font-weight: bold;
          }
          .footer {
            margin-top: 50px;
            padding: 30px;
            background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
            border-radius: 12px;
            text-align: center;
          }
          .footer p {
            color: #666;
            font-size: 14px;
            line-height: 1.6;
          }
          @media print {
            body { padding: 0; background: white; }
            .report-container { box-shadow: none; }
          }
        </style>
      </head>
      <body>
        <div class="report-container">
          <div class="header-banner">
            <div class="header-content">
              <div class="logo-section">
                ${storeLogo ? `<img src="${storeLogo}" alt="${storeName}" class="logo">` : ''}
                <div class="store-details">
                  <h1>${storeName}</h1>
                  ${storeSlogan ? `<p style="font-style: italic; font-size: 16px;">"${storeSlogan}"</p>` : ''}
                  ${storeWebsite ? `<p>🌐 ${storeWebsite}</p>` : ''}
                  ${storePhone ? `<p>📞 ${storePhone}</p>` : ''}
                  ${storeEmail ? `<p>📧 ${storeEmail}</p>` : ''}
                  ${storeTaxNumber ? `<p>🔖 Tax: ${storeTaxNumber}</p>` : ''}
                </div>
              </div>
              <div class="report-badge">
                <h2>EXPENSE REPORT</h2>
                <div class="number">${expNum}</div>
                <p style="font-size: 13px; color: #666; margin-top: 8px;">${new Date(expense.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
            </div>
          </div>
          
          <div class="content-area">
            <div class="details-grid">
              <div class="detail-box">
                <h3>Category</h3>
                <div class="value">${categoryLabel}</div>
              </div>
              <div class="detail-box">
                <h3>Payment Method</h3>
                <div class="value" style="text-transform: capitalize;">${expense.paymentMethod.replace('_', ' ')}</div>
              </div>
              <div class="detail-box" style="grid-column: span 2;">
                <h3>Description</h3>
                <div class="value">${expense.description}</div>
              </div>
              ${expense.vendor ? `
              <div class="detail-box" style="grid-column: span 2;">
                <h3>Vendor/Payee</h3>
                <div class="value">${expense.vendor}</div>
              </div>
              ` : ''}
            </div>

            <div class="amount-display">
              <div class="label">TOTAL EXPENSE</div>
              <div class="amount">${formatCurrency(expense.amount, true)}</div>
            </div>

            ${expense.notes ? `
            <div style="margin-top: 40px; padding: 25px; background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%); border-left: 4px solid #f97316; border-radius: 12px;">
              <h3 style="color: #f97316; font-size: 16px; margin-bottom: 10px;">Notes</h3>
              <p style="color: #4a4a4a; line-height: 1.6;">${expense.notes}</p>
            </div>
            ` : ''}

            <div class="footer">
              <p><strong>Official Expense Record</strong></p>
              <p>${storeName} | ${storeEmail || storePhone || ''}</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  // Export expense as PDF
  const handleExportExpensePDF = async (expense: Expense) => {
    try {
      const html = generateExpenseHTML(expense);
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      document.body.appendChild(tempDiv);

      const canvas = await html2canvas(tempDiv, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      const expNum = expense.invoiceNumber || expense.receiptNumber || expense.id.slice(0, 8).toUpperCase();
      pdf.save(`Expense-${expNum}.pdf`);

      document.body.removeChild(tempDiv);
      toast({ title: "Success", description: "Expense report downloaded!" });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({ title: "Error", description: "Failed to generate PDF", variant: "destructive" });
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

  return (
    <AdminPageShell
      title="Expense Tracking"
      description="Record and monitor business expenses"
      eyebrow="Finance"
      backTo="/admin/inventory"
      backLabel="Back to Inventory"
      actions={(
        <>
          <Input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-48"
          />
          <Button onClick={() => setIsAddingExpense(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Expense
          </Button>
        </>
      )}
    >
        <Dialog open={isAddingExpense} onOpenChange={setIsAddingExpense}>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
          <AdminStatCard title="Total Expenses" value={`$${totalExpenses.toFixed(2)}`} icon={DollarSign} gradient="from-slate-600 to-slate-800" />
          <AdminStatCard title="Transactions" value={filteredExpenses.length} icon={Calendar} gradient="from-sky-500 to-blue-700" />
          <AdminStatCard title="Recurring" value={recurringExpenses.length} icon={TrendingUp} gradient="from-emerald-500 to-teal-700" />
          <AdminStatCard title="Categories" value={categoryBreakdown.length} icon={AlertCircle} gradient="from-violet-500 to-purple-700" />
        </div>

        {categoryBreakdown.length > 0 && (
          <AdminPanel className="mb-6">
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
          </AdminPanel>
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
            <AdminPanel>
              <CardContent className="py-12 text-center">
                <DollarSign className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500">No expenses recorded for this period.</p>
              </CardContent>
            </AdminPanel>
          ) : (
            filteredExpenses.map((expense) => (
              <AdminPanel key={expense.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        {expense.invoiceNumber ? `${expense.invoiceNumber} - ${expense.description}` : expense.description}
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
                        {expense.invoiceNumber && (
                          <div className="text-xs text-gray-500">Report: {expense.invoiceNumber}</div>
                        )}
                        {expense.receiptNumber && (
                          <div className="text-xs text-gray-500">Receipt: {expense.receiptNumber}</div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleExportExpensePDF(expense)}
                        title="Download PDF"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingExpense(expense)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {expense.notes && (
                  <CardContent>
                    <p className="text-sm text-gray-600">{expense.notes}</p>
                  </CardContent>
                )}
              </AdminPanel>
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

    </AdminPageShell>
  );
};

export default AdminExpenses;
