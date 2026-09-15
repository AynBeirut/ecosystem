import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/useAuth';
import { hasStoreAdminAccess } from '@/lib/subAccountAccess';
import { useModuleEntitlement } from '@/hooks/useModuleEntitlement';
import { canUseModule } from '@/lib/entitlements';
import { ECOSYSTEM_FLAGS } from '@/lib/ecosystemFlags';
import { MODULE_CATALOG } from '@/lib/pricingDisplay';
import { peekCachedStoreProfile } from '@/hooks/useStoreEntitlements';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type ModuleGateProps = {
  moduleId: string;
  children: React.ReactNode;
};

function moduleDisplayName(moduleId: string): string {
  return MODULE_CATALOG.find((m) => m.id === moduleId)?.name ?? moduleId;
}

/**
 * Renders children when the store has the module entitled.
 * When VITE_ECOSYSTEM_ENFORCE_MODULES is off, passes through.
 */
const ModuleGate: React.FC<ModuleGateProps> = ({ moduleId, children }) => {
  const { user } = useAuth();
  const { enabled, loading, storeId } = useModuleEntitlement(moduleId);
  const enforce = ECOSYSTEM_FLAGS.enforceModuleGates;
  const cachedEnabled = storeId
    ? canUseModule(peekCachedStoreProfile(storeId), moduleId)
    : false;

  if (!enforce) {
    return <>{children}</>;
  }

  if (enabled || cachedEnabled) {
    return <>{children}</>;
  }

  // Sub-accounts inherit the store owner's modules; permission checks gate access.
  if (loading && user?.role !== 'sub_account') {
    return (
      <div className="container mx-auto px-4 py-12 flex justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  const isOwner = hasStoreAdminAccess(user);
  const label = moduleDisplayName(moduleId);

  return (
    <div className="container mx-auto px-4 py-8 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>{label}</CardTitle>
          <CardDescription>
            {isOwner
              ? `Enable ${label} on your subscription to use this module.`
              : `${label} is not enabled for this store. Contact your store administrator.`}
          </CardDescription>
        </CardHeader>
        {isOwner && (
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/subscription">Manage subscription</Link>
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default ModuleGate;
