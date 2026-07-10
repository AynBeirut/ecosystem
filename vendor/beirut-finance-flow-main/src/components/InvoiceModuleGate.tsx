import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useGrabioStore } from '@/hooks/useGrabioStore';
import { enforceModuleGates } from '@/lib/grabio/entitlements';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type InvoiceModuleGateProps = {
  children: React.ReactNode;
};

const InvoiceModuleGate = ({ children }: InvoiceModuleGateProps) => {
  const { authLoading, loading, invoiceModuleEnabled, role } = useGrabioStore();

  if (!enforceModuleGates()) {
    return <>{children}</>;
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (invoiceModuleEnabled) {
    return <>{children}</>;
  }

  const isOwner = role === 'owner';

  return (
    <div className="container mx-auto px-4 py-8 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Invoice Manager</CardTitle>
          <CardDescription>
            {isOwner
              ? 'Your plan includes Invoicing & Billing — open the app below. If this is wrong, refresh after changing modules on subscription.'
              : 'Invoice Manager is not enabled for this store. Contact your store administrator.'}
          </CardDescription>
        </CardHeader>
        {isOwner && (
          <CardContent>
            <Button asChild className="w-full">
              <a href="https://grabio.space/subscription" target="_blank" rel="noopener noreferrer">
                Manage subscription on Grabio
              </a>
            </Button>
            <Button asChild variant="outline" className="w-full mt-2">
              <Link to="/">Back to home</Link>
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default InvoiceModuleGate;
