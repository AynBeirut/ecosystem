import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getFirestore } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import { listEstimates, type FinanceEstimate } from '@/lib/financeService';
import ModuleGate from '@/components/ModuleGate';

const FinanceEstimates: React.FC = () => {
  const { user } = useAuth();
  const storeId = getActualStoreId(user);
  const [estimates, setEstimates] = useState<FinanceEstimate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeId) return;
    void listEstimates(getFirestore(), storeId)
      .then(setEstimates)
      .finally(() => setLoading(false));
  }, [storeId]);

  return (
    <ModuleGate moduleId="invoice_manager">
      <AdminPageShell
        title="Estimates & Quotes"
        description="Create quotes and convert to invoices (CORE-INV-02)"
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
        ) : estimates.length === 0 ? (
          <AdminPanel>
            <CardHeader>
              <CardTitle>No estimates yet</CardTitle>
              <CardDescription>Estimates you create will appear here.</CardDescription>
            </CardHeader>
          </AdminPanel>
        ) : (
          <div className="space-y-3">
            {estimates.map((est) => (
              <AdminPanel key={est.id}>
                <CardContent className="py-4 flex justify-between">
                  <div>
                    <p className="font-medium">{est.number}</p>
                    <p className="text-sm text-muted-foreground">{est.clientName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {est.currency} {est.total?.toFixed(2)}
                    </p>
                    <p className="text-sm capitalize">{est.status}</p>
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

export default FinanceEstimates;
