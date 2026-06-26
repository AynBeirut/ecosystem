import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import ModuleGate from '@/components/ModuleGate';

const FinancePortfolio: React.FC = () => (
  <ModuleGate moduleId="invoice_manager">
    <AdminPageShell
      title="Portfolio PDF"
      description="Static PDF export of client billing history (INV-02). No Web Builder — export only."
      eyebrow="Finance"
      backTo="/admin/finance"
      backLabel="Finance"
      className="max-w-2xl"
    >
      <AdminPanel>
        <CardHeader>
          <CardTitle>Generate portfolio</CardTitle>
          <CardDescription>
            Select a client from Customers, then export their invoice history as PDF.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button asChild>
            <Link to="/admin/customers">Choose client</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/admin/finance">Back to Finance</Link>
          </Button>
        </CardContent>
      </AdminPanel>
    </AdminPageShell>
  </ModuleGate>
);

export default FinancePortfolio;
