import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getFirestore } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Estimates & Quotes</h1>
            <p className="text-muted-foreground">Create quotes and convert to invoices (CORE-INV-02)</p>
          </div>
          <Button asChild variant="outline">
            <Link to="/admin/finance">Back to Finance</Link>
          </Button>
        </div>
        {loading ? (
          <p>Loading…</p>
        ) : estimates.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No estimates yet</CardTitle>
              <CardDescription>Estimates you create will appear here.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-3">
            {estimates.map((est) => (
              <Card key={est.id}>
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
              </Card>
            ))}
          </div>
        )}
      </div>
    </ModuleGate>
  );
};

export default FinanceEstimates;
