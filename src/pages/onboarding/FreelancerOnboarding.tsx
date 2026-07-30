import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/context/useAuth';
import { createPlatformFreelancer, getPlatformFreelancer } from '@/lib/freelancerService';
import type { FreelancerTrack } from '@/types/career';
import { toast } from 'sonner';
import PoweredByEmoove from '@/components/PoweredByEmoove';

const TRACK_OPTIONS: Array<{ id: FreelancerTrack; title: string; description: string }> = [
  {
    id: 'designer_builder',
    title: 'Designer / Web Builder',
    description: 'Demo stores, templates, product catalogs, and client handoff.',
  },
  {
    id: 'accounting',
    title: 'Accounting Freelancer',
    description: 'Finance sandboxes and client accounting sub-accounts.',
  },
];

function parseTrack(raw: string | null): FreelancerTrack | null {
  if (raw === 'designer_builder' || raw === 'accounting') return raw;
  return null;
}

const FreelancerOnboarding: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetTrack = parseTrack(searchParams.get('track'));
  const [selected, setSelected] = useState<FreelancerTrack | null>(presetTrack);
  const [saving, setSaving] = useState(false);

  const title = useMemo(() => {
    if (selected === 'designer_builder') return 'Set up your builder workspace';
    if (selected === 'accounting') return 'Set up your accounting workspace';
    return 'Choose your freelancer track';
  }, [selected]);

  const handleContinue = async () => {
    if (!user) {
      navigate(`/login?tab=signup&next=${encodeURIComponent('/onboarding/freelancer')}`);
      return;
    }
    if (!selected) {
      toast.error('Choose a track');
      return;
    }

    setSaving(true);
    try {
      const existing = await getPlatformFreelancer(user.id);
      if (!existing) {
        await createPlatformFreelancer(user.id, {
          track: selected,
          displayName: user.name || user.email?.split('@')[0] || 'Freelancer',
          email: user.email || '',
        });
      }
      toast.success('Freelancer workspace ready');
      navigate('/freelancer', { replace: true });
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#eef2f7]">
      <div className="container mx-auto max-w-3xl px-4 py-10 space-y-8">
        <div className="text-center space-y-2">
          <p className="text-sm font-medium text-teal-700">Grabio Freelancers</p>
          <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
          <p className="text-slate-600 max-w-xl mx-auto">
            Work with multiple store owners. Your client list appears after they add you as a sub-account.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {TRACK_OPTIONS.map((option) => {
            const active = selected === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelected(option.id)}
                className={`text-left rounded-2xl border p-5 transition ${
                  active
                    ? 'border-teal-500 bg-white shadow-md ring-2 ring-teal-200'
                    : 'border-slate-200 bg-white hover:border-teal-300'
                }`}
              >
                <p className="font-semibold text-slate-900">{option.title}</p>
                <p className="mt-2 text-sm text-slate-600">{option.description}</p>
              </button>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>What you get</CardTitle>
            <CardDescription>Freelancer workspace</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 space-y-2">
            <p>• Client list for every store that adds your email as sub-account</p>
            <p>• Builder track: 3 demo websites + transfer to store owner</p>
            <p>• Accounting track: 3 test sandboxes on finance workflows</p>
            <p>• Support multiple clients from one login</p>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/careers" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            ← Back to careers
          </Link>
          <Button onClick={handleContinue} disabled={saving || !selected} className="bg-teal-600 hover:bg-teal-700">
            {saving ? 'Setting up…' : 'Open freelancer workspace'}
          </Button>
        </div>

        <PoweredByEmoove />
      </div>
    </div>
  );
};

export default FreelancerOnboarding;
