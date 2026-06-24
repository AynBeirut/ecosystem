import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getFirestore } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Receipts & Payment Orders</h1>
            <p className="text-muted-foreground">Payment confirmations (CORE-INV-03)</p>
          </div>
          <Button asChild variant="outline">
            <Link to="/admin/finance">Back to Finance</Link>
          </Button>
        </div>
        {loading ? (
          <p>Loading…</p>
        ) : receipts.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No receipts yet</CardTitle>
              <CardDescription>Recorded payments will appear here.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-3">
            {receipts.map((r) => (
              <Card key={r.id}>
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
              </Card>
            ))}
          </div>
        )}
      </div>
    </ModuleGate>
  );
};

export default FinanceReceipts;
