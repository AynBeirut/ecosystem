import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ModuleGate from '@/components/ModuleGate';
import { AI_CREDIT_PACKS } from '@/lib/aiCredits';
import { useStoreEntitlements } from '@/hooks/useStoreEntitlements';

const AiBuilder: React.FC = () => {
  const { profile } = useStoreEntitlements();
  const balance = profile?.aiCreditBalance ?? 0;

  return (
    <ModuleGate moduleId="ai_builder">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="text-2xl font-bold mb-2">AI Builder</h1>
        <p className="text-muted-foreground mb-6">
          Wizard + editor UX — Grabio template store (free standard + paid custom).
        </p>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Credit balance</CardTitle>
            <CardDescription>All AI agents share one prepaid balance.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{balance} credits</p>
          </CardContent>
        </Card>
        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          {AI_CREDIT_PACKS.map((pack) => (
            <Card key={pack.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{pack.label}</CardTitle>
                <CardDescription>${pack.priceUsd}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" disabled>
                  Buy (checkout Phase 6)
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        <Button asChild variant="outline">
          <Link to="/admin">Back to dashboard</Link>
        </Button>
      </div>
    </ModuleGate>
  );
};

export default AiBuilder;
