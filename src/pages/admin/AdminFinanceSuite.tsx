import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, CreditCard, Receipt } from 'lucide-react';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';

const money = (value: number) => `$${Number.isFinite(value) ? value.toFixed(2) : '0.00'}`;

type FinanceTotals = {
  grossRevenue: number;
  paidRevenue: number;
  receivable: number;
  totalExpenses: number;
  monthlyExpenses: number;
};

const AdminFinanceSuite: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState<FinanceTotals>({
    grossRevenue: 0,
    paidRevenue: 0,
    receivable: 0,
    totalExpenses: 0,
    monthlyExpenses: 0,
  });

  useEffect(() => {
    const fetchFinance = async () => {
      const storeId = user?.storeId || user?.id;
      if (!storeId) {
        setLoading(false);
        return;
      }

      try {
        const db = getFirestore();
        const [ordersSnap, expensesSnap] = await Promise.all([
          getDocs(query(collection(db, 'orders'), where('storeId', '==', storeId))),
          getDocs(query(collection(db, 'expenses'), where('storeId', '==', storeId))),
        ]);

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

        let grossRevenue = 0;
        let paidRevenue = 0;
        let receivable = 0;

        ordersSnap.forEach((orderDoc) => {
          const data = orderDoc.data() as Record<string, unknown>;
          const status = String(data.status || '').toLowerCase();
          if (status === 'cancelled') return;

          const total = Number(data.total || 0);
          const paid = Number(data.amountPaid || 0);
          if (Number.isFinite(total) && total > 0) {
            grossRevenue += total;
            paidRevenue += Math.max(0, Math.min(total, Number.isFinite(paid) ? paid : 0));
            receivable += Math.max(0, total - (Number.isFinite(paid) ? paid : 0));
          }
        });

        let totalExpenses = 0;
        let monthlyExpenses = 0;

        expensesSnap.forEach((expenseDoc) => {
          const data = expenseDoc.data() as Record<string, unknown>;
          const amount = Number(data.amount || 0);
          if (!Number.isFinite(amount) || amount <= 0) return;

          totalExpenses += amount;

          const rawDate = data.date || data.createdAt;
          const expenseTime = rawDate ? new Date(String(rawDate)).getTime() : 0;
          if (expenseTime >= monthStart) {
            monthlyExpenses += amount;
          }
        });

        setTotals({ grossRevenue, paidRevenue, receivable, totalExpenses, monthlyExpenses });
      } catch (error) {
        console.error('Failed to load finance suite data', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFinance();
  }, [user?.id, user?.storeId]);

  const balanceNow = useMemo(() => totals.paidRevenue - totals.totalExpenses, [totals.paidRevenue, totals.totalExpenses]);
  const netCapital = useMemo(() => totals.grossRevenue - totals.totalExpenses, [totals.grossRevenue, totals.totalExpenses]);

  return (
    <AdminPageShell title="Finance Suite" description="Balance, capital, credit and bill-pay control center." backTo="/admin/dashboard">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <AdminPanel>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Balance
              </CardTitle>
              <CardDescription>Paid revenue minus all expenses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? '...' : money(balanceNow)}</div>
              <Badge variant={balanceNow >= 0 ? 'default' : 'destructive'} className="mt-2">
                {balanceNow >= 0 ? 'Positive cash position' : 'Negative cash position'}
              </Badge>
            </CardContent>
          </AdminPanel>

          <AdminPanel>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Capital
              </CardTitle>
              <CardDescription>Gross revenue minus total expenses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? '...' : money(netCapital)}</div>
              <p className="text-xs text-muted-foreground mt-2">Gross: {money(totals.grossRevenue)}</p>
            </CardContent>
          </AdminPanel>

          <AdminPanel>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Credit
              </CardTitle>
              <CardDescription>Outstanding receivables</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? '...' : money(totals.receivable)}</div>
              <p className="text-xs text-muted-foreground mt-2">Collected: {money(totals.paidRevenue)}</p>
            </CardContent>
          </AdminPanel>

          <AdminPanel>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Bill Pay
              </CardTitle>
              <CardDescription>Expense control and payable tracking</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? '...' : money(totals.monthlyExpenses)}</div>
              <p className="text-xs text-muted-foreground mt-2">This month expenses</p>
            </CardContent>
          </AdminPanel>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <AdminPanel>
            <CardHeader>
              <CardTitle>Balance Module</CardTitle>
              <CardDescription>Track incoming payments and current cash position.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link to="/admin/payments">Open Payments</Link>
              </Button>
            </CardContent>
          </AdminPanel>

          <AdminPanel>
            <CardHeader>
              <CardTitle>Capital Module</CardTitle>
              <CardDescription>Analyze profitability and capital movement.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link to="/admin/revenue">Open Revenue</Link>
              </Button>
            </CardContent>
          </AdminPanel>

          <AdminPanel>
            <CardHeader>
              <CardTitle>Credit Module</CardTitle>
              <CardDescription>Monitor receivables and account statement.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link to="/admin/account-statement">Open Statement</Link>
              </Button>
            </CardContent>
          </AdminPanel>

          <AdminPanel>
            <CardHeader>
              <CardTitle>Bill Pay Module</CardTitle>
              <CardDescription>Manage expenses and bank reconciliation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild className="w-full" variant="outline">
                <Link to="/admin/expenses">Open Expenses</Link>
              </Button>
              <Button asChild className="w-full" variant="outline">
                <Link to="/admin/bank-reconciliation">Open Reconciliation</Link>
              </Button>
            </CardContent>
          </AdminPanel>
        </div>
    </AdminPageShell>
  );
};

export default AdminFinanceSuite;
