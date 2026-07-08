import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { doc, getFirestore, setDoc } from 'firebase/firestore';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import AdminPageShell from '@/components/admin/AdminPageShell';
import ModuleGate from '@/components/ModuleGate';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useStoreEntitlements } from '@/hooks/useStoreEntitlements';
import { useAuth } from '@/context/useAuth';
import { editorPathForBuildMethod } from '@/lib/buildMethod';
import { createWordPressProvisioningRequest } from '@/lib/wordpressProvisioningService';
import {
  BUILDER_WIZARD_STEPS,
  BUILD_METHOD_OPTIONS,
  BUSINESS_INTENT_OPTIONS,
  SITE_INTENT_OPTIONS,
  profilePatchForSiteIntent,
  stepsForSiteIntent,
  normalizeWizardStep,
  isLegacyWizardStep,
  nextStep,
  prevStep,
  type BuilderWizardStepId,
  type BusinessIntent,
  type SiteIntent,
} from '@/lib/builderWizard';
import type { BuildMethod } from '@/lib/buildMethod';
import type { StoreProfile } from '@/types/storeProfile';

const UnifiedBuilderWizard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, storeId, loading, reload } = useStoreEntitlements();
  const [step, setStep] = useState<BuilderWizardStepId>('site-type');
  const [siteIntent, setSiteIntent] = useState<SiteIntent | undefined>();
  const [businessIntent, setBusinessIntent] = useState<BusinessIntent | undefined>();
  const [buildMethod, setBuildMethod] = useState<BuildMethod | undefined>();
  const [saving, setSaving] = useState(false);

  const [wordpressForm, setWordpressForm] = useState({
    businessName: '',
    contactEmail: user?.email || '',
    preferredDomain: '',
    notes: '',
  });
  const [wordpressSubmitted, setWordpressSubmitted] = useState(false);

  const persistProfile = useCallback(
    async (patch: Partial<StoreProfile>) => {
      if (!storeId) throw new Error('Store not found');
      const timestamp = new Date().toISOString();
      await setDoc(
        doc(getFirestore(), 'storeProfiles', storeId),
        { ...patch, updatedAt: timestamp },
        { merge: true },
      );
      await reload({ silent: true });
    },
    [storeId, reload],
  );

  useEffect(() => {
    if (!profile) return;
    const wiz = profile.builderWizard;
    const legacyWordPressSite = (wiz?.siteIntent as string | undefined) === 'wordpress';
    const resolvedSite =
      wiz?.siteIntent && ['display', 'blog', 'ecommerce'].includes(wiz.siteIntent)
        ? (wiz.siteIntent as SiteIntent)
        : undefined;

    const normalizedStep = normalizeWizardStep(wiz?.step, resolvedSite, wiz?.buildMethod);

    setStep(normalizedStep);
    if (resolvedSite) setSiteIntent(resolvedSite);
    if (wiz?.businessIntent) setBusinessIntent(wiz.businessIntent);
    if (wiz?.buildMethod) setBuildMethod(wiz.buildMethod);
    if (legacyWordPressSite) setBuildMethod('wordpress');
    if (wiz?.wordpressRequestId) setWordpressSubmitted(true);

    if (
      storeId &&
      wiz?.step &&
      (isLegacyWizardStep(wiz.step) || legacyWordPressSite)
    ) {
      void persistProfile({
        builderWizard: {
          step: normalizedStep,
          siteIntent: resolvedSite,
          businessIntent: wiz?.businessIntent,
          buildMethod: wiz?.buildMethod ?? (legacyWordPressSite ? 'wordpress' : undefined),
          wordpressRequestId: wiz?.wordpressRequestId,
          updatedAt: new Date().toISOString(),
        },
      });
    }
  }, [profile, storeId, persistProfile]);

  const visibleSteps = useMemo(() => {
    const base = stepsForSiteIntent(siteIntent);
    if (step === 'wordpress-request' && !base.includes('wordpress-request')) {
      return [...base, 'wordpress-request'];
    }
    return base;
  }, [siteIntent, step]);

  const stepIndex = visibleSteps.indexOf(step);
  const progressPct = visibleSteps.length > 1 ? ((stepIndex + 1) / visibleSteps.length) * 100 : 0;

  const goToStep = async (next: BuilderWizardStepId) => {
    setStep(next);
    if (storeId) {
      await persistProfile({
        builderWizard: {
          step: next,
          siteIntent,
          businessIntent,
          buildMethod,
          updatedAt: new Date().toISOString(),
        },
      });
    }
  };

  const handleSiteIntentContinue = async () => {
    if (!siteIntent) {
      toast.error('Choose a site type to continue');
      return;
    }
    setSaving(true);
    try {
      const following = nextStep('site-type', siteIntent)!;
      if (siteIntent === 'ecommerce') {
        await persistProfile({
          builderWizard: {
            step: following,
            siteIntent,
            updatedAt: new Date().toISOString(),
          },
        });
      } else {
        const patch = profilePatchForSiteIntent(siteIntent);
        await persistProfile({
          ...patch,
          builderWizard: {
            step: following,
            siteIntent,
            updatedAt: new Date().toISOString(),
          },
        });
      }
      setStep(following);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleBusinessContinue = async () => {
    if (!businessIntent) {
      toast.error('Choose a business type to continue');
      return;
    }
    setSaving(true);
    try {
      const patch = profilePatchForSiteIntent('ecommerce', businessIntent);
      const following = nextStep('business-type', siteIntent)!;
      await persistProfile({
        ...patch,
        builderWizard: {
          step: following,
          siteIntent: 'ecommerce',
          businessIntent,
          updatedAt: new Date().toISOString(),
        },
      });
      setStep(following);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleMethodContinue = async () => {
    if (!buildMethod) {
      toast.error('Choose how you want to build');
      return;
    }
    if (buildMethod === 'import') return;

    setSaving(true);
    try {
      const timestamp = new Date().toISOString();
      const wizardPatch = {
        step: buildMethod === 'wordpress' ? ('wordpress-request' as const) : ('method' as const),
        siteIntent,
        businessIntent,
        buildMethod,
        updatedAt: timestamp,
      };

      await persistProfile({ builderWizard: wizardPatch });

      if (buildMethod === 'wordpress') {
        setStep('wordpress-request');
        return;
      }

      const path = editorPathForBuildMethod(buildMethod);
      if (path) {
        navigate(path);
        return;
      }

      toast.error('Unknown build method');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleWordPressSubmit = async () => {
    if (!storeId || !user?.uid) return;
    if (!wordpressForm.businessName.trim()) {
      toast.error('Business name is required');
      return;
    }
    if (!wordpressForm.contactEmail.trim()) {
      toast.error('Contact email is required');
      return;
    }
    setSaving(true);
    try {
      const requestId = await createWordPressProvisioningRequest(storeId, user.uid, {
        businessName: wordpressForm.businessName,
        contactEmail: wordpressForm.contactEmail,
        preferredDomain: wordpressForm.preferredDomain,
        notes: wordpressForm.notes,
      });
      await persistProfile({
        builderWizard: {
          step: 'wordpress-request',
          siteIntent,
          businessIntent,
          buildMethod: 'wordpress',
          wordpressRequestId: requestId,
          updatedAt: new Date().toISOString(),
        },
      });
      setWordpressSubmitted(true);
      toast.success('Request submitted — we will contact you soon');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit request');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ModuleGate moduleId="builder">
      <AdminPageShell
        title="Store Builder"
        description="Choose your site type and how you want to build it."
        eyebrow="Builder"
        backTo="/admin/dashboard"
        className="max-w-4xl"
      >
        <div className="mb-6">
          <div className="flex flex-wrap gap-2 mb-3">
            {BUILDER_WIZARD_STEPS.filter((s) => visibleSteps.includes(s.id)).map((s, i) => {
              const active = s.id === step;
              const done = visibleSteps.indexOf(s.id) < stepIndex;
              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
                    active
                      ? 'bg-primary text-primary-foreground border-primary'
                      : done
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-muted text-muted-foreground border-transparent'
                  }`}
                >
                  {done ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
                  {s.label}
                </div>
              );
            })}
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {step === 'site-type' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">What kind of site are you building?</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {SITE_INTENT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSiteIntent(opt.id)}
                  className={`text-left rounded-xl border p-4 transition-colors ${
                    siteIntent === opt.id
                      ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                      : 'hover:border-primary/40'
                  }`}
                >
                  <p className="font-semibold mb-1">{opt.title}</p>
                  <p className="text-sm text-muted-foreground">{opt.description}</p>
                </button>
              ))}
            </div>
            <WizardNav
              onNext={handleSiteIntentContinue}
              nextLabel="Continue"
              saving={saving}
              disableNext={!siteIntent}
            />
          </div>
        )}

        {step === 'business-type' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">What type of business?</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {BUSINESS_INTENT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setBusinessIntent(opt.id)}
                  className={`text-left rounded-xl border p-4 transition-colors ${
                    businessIntent === opt.id
                      ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                      : 'hover:border-primary/40'
                  }`}
                >
                  <p className="font-semibold mb-1">{opt.title}</p>
                  <p className="text-sm text-muted-foreground">{opt.description}</p>
                </button>
              ))}
            </div>
            <WizardNav
              onBack={() => void goToStep(prevStep('business-type', siteIntent) || 'site-type')}
              onNext={handleBusinessContinue}
              nextLabel="Continue"
              saving={saving}
              disableNext={!businessIntent}
            />
          </div>
        )}

        {step === 'method' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">How do you want to build?</h2>
            <p className="text-sm text-muted-foreground">
              Pick one path to start. You can open the other Grabio editor later — we&apos;ll warn you
              before overwriting design changes.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {BUILD_METHOD_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  disabled={opt.disabled}
                  onClick={() => !opt.disabled && setBuildMethod(opt.id)}
                  className={`text-left rounded-xl border p-4 transition-colors relative ${
                    opt.disabled
                      ? 'opacity-60 cursor-not-allowed bg-muted/30'
                      : buildMethod === opt.id
                        ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                        : 'hover:border-primary/40'
                  }`}
                >
                  {opt.badge ? (
                    <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {opt.badge}
                    </span>
                  ) : null}
                  <p className="font-semibold mb-1 pr-16">{opt.title}</p>
                  <p className="text-sm text-muted-foreground">{opt.description}</p>
                </button>
              ))}
            </div>
            <WizardNav
              onBack={() =>
                void goToStep(
                  prevStep('method', siteIntent) ||
                    (siteIntent === 'ecommerce' ? 'business-type' : 'site-type'),
                )
              }
              onNext={handleMethodContinue}
              nextLabel={
                buildMethod === 'wordpress'
                  ? 'Continue to WordPress request'
                  : buildMethod === 'classic' || buildMethod === 'theme_editor'
                    ? 'Open editor'
                    : 'Continue'
              }
              saving={saving}
              disableNext={!buildMethod || buildMethod === 'import'}
            />
          </div>
        )}

        {step === 'wordpress-request' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">WordPress setup request</h2>
            {wordpressSubmitted ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Request received</CardTitle>
                  <CardDescription>
                    Our team will provision WordPress on your domain and email you login details.
                    Track status in{' '}
                    <Link to="/admin/wordpress-queue" className="text-primary underline">
                      WordPress queue
                    </Link>
                    .
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Grabio-hosted WordPress — we handle hosting, SSL, and initial setup. You manage
                  content in wp-admin after handoff.
                </p>
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="wp-business">Business name *</Label>
                    <Input
                      id="wp-business"
                      value={wordpressForm.businessName}
                      onChange={(e) =>
                        setWordpressForm((f) => ({ ...f, businessName: e.target.value }))
                      }
                      placeholder="Your company or brand"
                    />
                  </div>
                  <div>
                    <Label htmlFor="wp-email">Contact email *</Label>
                    <Input
                      id="wp-email"
                      type="email"
                      value={wordpressForm.contactEmail}
                      onChange={(e) =>
                        setWordpressForm((f) => ({ ...f, contactEmail: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="wp-domain">Preferred domain (optional)</Label>
                    <Input
                      id="wp-domain"
                      value={wordpressForm.preferredDomain}
                      onChange={(e) =>
                        setWordpressForm((f) => ({ ...f, preferredDomain: e.target.value }))
                      }
                      placeholder="www.example.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="wp-notes">Notes (optional)</Label>
                    <Textarea
                      id="wp-notes"
                      rows={3}
                      value={wordpressForm.notes}
                      onChange={(e) => setWordpressForm((f) => ({ ...f, notes: e.target.value }))}
                      placeholder="Theme preferences, pages needed, timeline…"
                    />
                  </div>
                </div>
                <WizardNav
                  onBack={() => void goToStep('method')}
                  onNext={handleWordPressSubmit}
                  nextLabel="Submit request"
                  saving={saving}
                  disableNext={
                    !wordpressForm.businessName.trim() || !wordpressForm.contactEmail.trim()
                  }
                />
              </>
            )}
          </div>
        )}
      </AdminPageShell>
    </ModuleGate>
  );
};

type WizardNavProps = {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  saving?: boolean;
  disableNext?: boolean;
  hideNext?: boolean;
};

function WizardNav({
  onBack,
  onNext,
  nextLabel = 'Continue',
  saving,
  disableNext,
  hideNext,
}: WizardNavProps) {
  return (
    <div className="flex justify-between pt-4">
      {onBack ? (
        <Button variant="outline" onClick={onBack} disabled={saving} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      ) : (
        <span />
      )}
      {!hideNext && onNext && (
        <Button onClick={onNext} disabled={saving || disableNext} className="gap-1">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {nextLabel} <ArrowRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

export default UnifiedBuilderWizard;
