import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getFirestore } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import { listReceipts, type FinanceReceipt } from '@/lib/financeService';
import ModuleGate from '@/components/ModuleGate';

const FinanceReceipts: React.FC = () => {
  const { user } = useAuth();
  const storeId = getActualStoreId(user);
  const [receipts, setReceipts] = useState<FinanceReceipt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeId) return;
    void listReceipts(getFirestore(), storeId)
      .then(setReceipts)
      .finally(() => setLoading(false));
  }, [storeId]);

  return (
    <ModuleGate moduleId="invoice_manager">
      <AdminPageShell
        title="Receipts & Payment Orders"
        description="Payment confirmations (CORE-INV-03)"
        eyebrow="Finance"
        backTo="/admin/finance"
        backLabel="Finance"
        actions={
          <Button asChild variant="outline">
            <Link to="/admin/finance">Back to Finance</Link>
          </Button>
        }
      >        {loading ? (
          <p>Loading…</p>
        ) : receipts.length === 0 ? (
          <AdminPanel>
            <CardHeader>
              <CardTitle>No receipts yet</CardTitle>
              <CardDescription>Recorded payments will appear here.</CardDescription>
            </CardHeader>
          </AdminPanel>
        ) : (
          <div className="space-y-3">
            {receipts.map((r) => (
              <AdminPanel key={r.id}>
                <CardContent className="py-4 flex justify-between">
                  <div>
                    <p className="font-medium">{r.number}</p>
                    <p className="text-sm text-muted-foreground">{r.clientName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {r.currency} {r.amount.toFixed(2)}
                    </p>
                    <p className="text-sm">{r.paymentMethod}</p>
                  </div>
                </CardContent>
              </AdminPanel>
            ))}
          </div>
        )}
      </AdminPageShell>
    </ModuleGate>
  );
};

export default FinanceReceipts;
