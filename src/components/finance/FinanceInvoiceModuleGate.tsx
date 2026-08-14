import React from 'react';
import { Link } from 'react-router-dom';
import { useStoreEntitlements } from '@/hooks/useStoreEntitlements';
import { canUseInvoiceManagerApp } from '@/lib/entitlements';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type FinanceInvoiceModuleGateProps = {
  children: React.ReactNode;
  variant?: 'finance' | 'invoice';
};

const FinanceInvoiceModuleGate: React.FC<FinanceInvoiceModuleGateProps> = ({ children }) => {
  const { profile, loading } = useStoreEntitlements();

  if (!loading && !canUseInvoiceManagerApp(profile)) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Business Finance</CardTitle>
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
  }

  return <>{children}</>;
};

export default FinanceInvoiceModuleGate;
