import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import ModuleGate from '@/components/ModuleGate';
import { AI_CREDIT_PACKS } from '@/lib/aiCredits';
import { useStoreEntitlements } from '@/hooks/useStoreEntitlements';

const AiBuilder: React.FC = () => {
  const { profile } = useStoreEntitlements();
  const balance = profile?.aiCreditBalance ?? 0;

  return (
    <ModuleGate moduleId="ai_builder">
      <AdminPageShell
        title="AI Builder"
        description="Wizard + editor UX — Grabio template store (free standard + paid custom)."
        eyebrow="AI Tools"
        backTo="/admin/dashboard"
        className="max-w-3xl"
      >
        <AdminPanel className="mb-6">
          <CardHeader>
            <CardTitle>Credit balance</CardTitle>
            <CardDescription>All AI agents share one prepaid balance.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{balance} credits</p>
          </CardContent>
        </AdminPanel>
        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          {AI_CREDIT_PACKS.map((pack) => (
            <AdminPanel key={pack.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{pack.label}</CardTitle>
                <CardDescription>${pack.priceUsd}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" disabled>
                  Buy (checkout Phase 6)
                </Button>
              </CardContent>
            </AdminPanel>
          ))}
        </div>
      </AdminPageShell>
    </ModuleGate>
  );
};

export default AiBuilder;
