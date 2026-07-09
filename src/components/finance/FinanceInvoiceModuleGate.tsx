import React from 'react';
import { Link } from 'react-router-dom';
import { useStoreEntitlements } from '@/hooks/useStoreEntitlements';
import { canUseInvoiceManagerApp } from '@/lib/entitlements';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type FinanceInvoiceModuleGateProps = {
  children: React.ReactNode;
};

const FinanceInvoiceModuleGate: React.FC<FinanceInvoiceModuleGateProps> = ({ children }) => {
  const { profile, loading } = useStoreEntitlements();

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 flex justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (canUseInvoiceManagerApp(profile)) {
    return <>{children}</>;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Invoice Manager</CardTitle>
          <CardDescription>
            Enable Invoicing &amp; Billing or Invoice Manager on your subscription to use this module.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link to="/subscription">Manage subscription</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinanceInvoiceModuleGate;
