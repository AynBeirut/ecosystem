import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import PublicPageShell from '@/components/public/PublicPageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/useAuth';
import { submitCareerApplication } from '@/lib/careerService';
import type { FreelancerTrack } from '@/types/career';
import { toast } from 'sonner';

const TRACK_META: Record<FreelancerTrack, { title: string; blurb: string }> = {
  designer_builder: {
    title: 'Designer / Web Builder',
    blurb: 'Tell us about your design experience and the kind of stores you want to build.',
  },
  accounting: {
    title: 'Accounting Freelancer',
    blurb: 'Share your accounting background and the operations you want to support on Grabio.',
  },
};

function parseTrack(raw: string | undefined): FreelancerTrack | null {
  if (raw === 'designer_builder' || raw === 'accounting') return raw;
  return null;
}

const CareersApply: React.FC = () => {
  const { track: trackParam } = useParams();
  const track = parseTrack(trackParam);
  const navigate = useNavigate();
  const { user } = useAuth();
  const meta = track ? TRACK_META[track] : null;

  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
    portfolioUrl: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const onboardingPath = useMemo(
    () => (track ? `/onboarding/freelancer?track=${track}` : '/onboarding/freelancer'),
    [track],
  );

  if (!track || !meta) {
    return (
      <PublicPageShell
        title="Careers Apply"
        description="Apply to join Grabio as a freelancer."
        eyebrow="Careers"
        heroTitle="Unknown track"
        heroDescription="Choose a valid application track from the careers page."
      >
        <div className="public-panel text-center">
          <Link to="/careers" className="text-teal-700 font-medium hover:text-teal-800">
            Back to careers
          </Link>
        </div>
      </PublicPageShell>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Name and email are required');
      return;
    }

    setSubmitting(true);
    try {
      const id = await submitCareerApplication({
        track,
        name: form.name,
        email: form.email,
        phone: form.phone,
        portfolioUrl: form.portfolioUrl,
        message: form.message,
        applicantUid: user?.id,
      });
      setSubmittedId(id);
      toast.success('Application submitted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not submit application');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PublicPageShell
      title={`Apply — ${meta.title}`}
      description={meta.blurb}
      url={`/careers/apply/${track}`}
      eyebrow="Careers"
      heroTitle={`Apply — ${meta.title}`}
      heroDescription={meta.blurb}
      subnav={[{ label: '← Careers', href: '/careers' }]}
    >
      {submittedId ? (
        <div className="public-panel space-y-4">
          <p className="font-semibold text-teal-900">Application received</p>
          <p className="text-sm text-slate-600">
            Reference: <span className="font-mono">{submittedId}</span>
          </p>
          {user ? (
            <Button onClick={() => navigate(onboardingPath)} className="bg-teal-600 hover:bg-teal-700">
              Continue to freelancer setup
            </Button>
          ) : (
            <div className="flex flex-wrap gap-3">
              <Button asChild className="bg-teal-600 hover:bg-teal-700">
                <Link to={`/login?tab=signup&next=${encodeURIComponent(onboardingPath)}`}>
                  Create account & continue
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to={`/login?next=${encodeURIComponent(onboardingPath)}`}>Sign in</Link>
              </Button>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="public-panel space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="portfolio">Portfolio / LinkedIn (optional)</Label>
            <Input
              id="portfolio"
              value={form.portfolioUrl}
              onChange={(e) => setForm((f) => ({ ...f, portfolioUrl: e.target.value }))}
              placeholder="https://"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Why this track?</Label>
            <Textarea
              id="message"
              rows={5}
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              placeholder="Experience, tools you use, types of clients you want..."
            />
          </div>
          <Button type="submit" disabled={submitting} className="bg-teal-600 hover:bg-teal-700">
            <Send className="h-4 w-4 mr-2" />
            {submitting ? 'Submitting…' : 'Submit application'}
          </Button>
        </form>
      )}
    </PublicPageShell>
  );
};

export default CareersApply;
