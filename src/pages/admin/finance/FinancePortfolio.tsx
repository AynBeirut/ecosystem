import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ModuleGate from '@/components/ModuleGate';

const FinancePortfolio: React.FC = () => (
  <ModuleGate moduleId="invoice_manager">
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">Portfolio PDF</h1>
      <p className="text-muted-foreground mb-6">
        Static PDF export of client billing history (INV-02). No Web Builder — export only.
      </p>
      <Card>
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
      </Card>
    </div>
  </ModuleGate>
);

export default FinancePortfolio;
