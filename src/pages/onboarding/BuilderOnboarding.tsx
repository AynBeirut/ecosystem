import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/context/useAuth';
import { createBuilderAccount } from '@/lib/builderService';
import { BUILDER_BUSINESS_TYPES } from '@/lib/builderConstants';
import type { BuilderBusinessType } from '@/types/builder';
import { toast } from 'sonner';
import PoweredByEmoove from '@/components/PoweredByEmoove';

const BuilderOnboarding: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<BuilderBusinessType | null>(null);
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    if (!user) {
      navigate('/login?tab=signup&next=/onboarding/builder');
      return;
    }
    if (!selected) {
      toast.error('Choose a business type');
      return;
    }

    setSaving(true);
    try {
      await createBuilderAccount(user.id, selected);
      toast.success('Builder account created');
      navigate('/builder', { replace: true });
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Could not create builder account');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#eef2f7]">
      <div className="container mx-auto max-w-3xl px-4 py-10 space-y-8">
        <div className="text-center space-y-2">
          <p className="text-sm font-medium text-teal-700">Grabio Builder Accounts</p>
          <h1 className="text-3xl font-bold text-slate-900">Set up your builder profile</h1>
          <p className="text-slate-600 max-w-xl mx-auto">
            Create isolated demo stores for clients, then transfer a finished demo into a real store when ready.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {BUILDER_BUSINESS_TYPES.map((type) => {
            const active = selected === type.id;
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => setSelected(type.id)}
                className={`text-left rounded-2xl border p-5 transition ${
                  active
                    ? 'border-teal-500 bg-white shadow-md ring-2 ring-teal-200'
                    : 'border-slate-200 bg-white hover:border-teal-300'
                }`}
              >
                <p className="font-semibold text-slate-900">{type.label}</p>
                <p className="mt-2 text-sm text-slate-600">{type.description}</p>
              </button>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>What you get</CardTitle>
            <CardDescription>Phase 2 MVP — local testing slice</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 space-y-2">
            <p>• Up to 5 active demo stores under `builders/&#123;yourUid&#125;/demoStores/`</p>
            <p>• Demo catalog + branding isolated from production commerce</p>
            <p>• Manual transfer into a real `storeProfiles/` store when approved</p>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button className="flex-1" disabled={!selected || saving} onClick={() => void handleContinue()}>
            {saving ? 'Creating…' : 'Continue to builder dashboard'}
          </Button>
          <Button variant="outline" asChild className="flex-1">
            <Link to="/">Back to home</Link>
          </Button>
        </div>

        <PoweredByEmoove />
      </div>
    </div>
  );
};

export default BuilderOnboarding;
