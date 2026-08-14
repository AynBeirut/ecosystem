import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { BUILD_METHOD_LABELS, type BuildMethod, isGrabioEditorMethod } from '@/lib/buildMethod';
import { createWordPressProvisioningRequest } from '@/lib/wordpressProvisioningService';
import {
  BUILDER_WIZARD_STEPS,
  BUSINESS_INTENT_OPTIONS,
  SITE_INTENT_OPTIONS,
  buildBuilderWizardPatch,
  EDITOR_SETUP_VERSION,
  isBuilderSetupComplete,
  isLegacyWizardStep,
  normalizeWizardStep,
  profilePatchForSiteIntent,
  resolveSetupStep,
  setupStepsForBuildMethod,
  stripUndefinedForFirestore,
  type BuilderWizardStepId,
  type BusinessIntent,
  type SiteIntent,
} from '@/lib/builderWizard';
import type { StoreProfile } from '@/types/storeProfile';

type BuilderSetupGateProps = {
  targetMethod: BuildMethod;
  children?: React.ReactNode;
};

const SETUP_COPY: Record<
  BuildMethod,
  { title: string; description: string; eyebrow: string; backTo: string }
> = {
  classic: {
    title: 'Classic Template',
    description: 'Tell us about your site, then open the classic drag-and-drop editor.',
    eyebrow: 'Classic',
    backTo: '/admin/dashboard',
  },
  theme_editor: {
    title: 'Theme Editor',
    description: 'Tell us about your site, then open the live theme editor.',
    eyebrow: 'Theme Editor',
    backTo: '/admin/dashboard',
  },
  wordpress: {
    title: 'WordPress',
    description: 'Tell us about your site, then enter your domain to create the environment.',
    eyebrow: 'WordPress',
    backTo: '/admin/dashboard',
  },
  import: {
    title: 'Import',
    description: 'Import setup',
    eyebrow: 'Import',
    backTo: '/admin/dashboard',
  },
};

type SetupShellCopy = (typeof SETUP_COPY)[BuildMethod];

function BuilderSetupShell({
  copy,
  children,
}: {
  copy: SetupShellCopy;
  children: React.ReactNode;
}) {
  return (
    <AdminPageShell
      title={copy.title}
      description={copy.description}
      eyebrow={copy.eyebrow}
      backTo={copy.backTo}
      className="max-w-4xl"
    >
      {children}
    </AdminPageShell>
  );
}

const BuilderSetupGate: React.FC<BuilderSetupGateProps> = ({ targetMethod, children }) => {
  const { user } = useAuth();
  const { profile, storeId, loading, reload } = useStoreEntitlements();
  const copy = SETUP_COPY[targetMethod];

  const [step, setStep] = useState<BuilderWizardStepId>('site-type');
  const [siteIntent, setSiteIntent] = useState<SiteIntent | undefined>();
  const [businessIntent, setBusinessIntent] = useState<BusinessIntent | undefined>();
  const [saving, setSaving] = useState(false);
  const [wordpressForm, setWordpressForm] = useState({
    businessName: '',
    contactEmail: user?.email || '',
    preferredDomain: '',
    notes: '',
  });
  const [wordpressSubmitted, setWordpressSubmitted] = useState(false);
  const [profileHydrated, setProfileHydrated] = useState(false);
  const legacyMigratedRef = useRef(false);

  const setupComplete = isBuilderSetupComplete(profile, targetMethod);

  useEffect(() => {
    if (!storeId) {
      setProfileHydrated(true);
      return;
    }
    let cancelled = false;
    void reload({ fromServer: true, silent: true }).finally(() => {
      if (!cancelled) setProfileHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [storeId, reload]);

  const persistProfile = useCallback(
    async (patch: Partial<StoreProfile>) => {
      if (!storeId) throw new Error('Store not found');
      const timestamp = new Date().toISOString();
      await setDoc(
        doc(getFirestore(), 'storeProfiles', storeId),
        stripUndefinedForFirestore({ ...patch, updatedAt: timestamp }),
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

    const normalizedStep = normalizeWizardStep(wiz?.step, resolvedSite, targetMethod);
    const activeStep = setupComplete
      ? resolveSetupStep(profile, targetMethod)
      : isGrabioEditorMethod(targetMethod)
        ? resolveSetupStep(profile, targetMethod)
        : normalizedStep === 'method'
          ? resolveSetupStep(profile, targetMethod)
          : normalizedStep;

    setStep(activeStep);
    if (resolvedSite) setSiteIntent(resolvedSite);
    if (wiz?.businessIntent) setBusinessIntent(wiz.businessIntent);
    if (wiz?.wordpressRequestId) setWordpressSubmitted(true);

    setWordpressForm((current) => ({
      ...current,
      businessName: current.businessName || profile.name || profile.storeName || '',
      contactEmail: current.contactEmail || user?.email || profile.email || '',
    }));

    if (
      storeId &&
      wiz?.step &&
      !legacyMigratedRef.current &&
      (isLegacyWizardStep(wiz.step) || legacyWordPressSite || wiz.step === 'method')
    ) {
      legacyMigratedRef.current = true;
      void persistProfile({
        builderWizard: buildBuilderWizardPatch({
          step: resolveSetupStep({ builderWizard: { ...wiz, siteIntent: resolvedSite } }, targetMethod),
          siteIntent: resolvedSite,
          businessIntent: wiz?.businessIntent,
          buildMethod: targetMethod,
          wordpressRequestId: wiz?.wordpressRequestId,
          ...(resolvedSite &&
          wiz?.businessIntent &&
          targetMethod === 'classic' &&
          !wiz.setupCompletedMethods?.theme_editor
            ? {
                editorSetupVersion: EDITOR_SETUP_VERSION,
                setupCompletedMethods: {
                  ...(wiz.setupCompletedMethods || {}),
                  classic: EDITOR_SETUP_VERSION,
                },
              }
            : {}),
        }),
      });
    }
  }, [profile, storeId, persistProfile, targetMethod, setupComplete, user?.email]);

  const visibleSteps = useMemo(
    () => setupStepsForBuildMethod(targetMethod, siteIntent),
    [targetMethod, siteIntent],
  );

  const effectiveStep: BuilderWizardStepId = visibleSteps.includes(step)
    ? step
    : visibleSteps[0] ?? 'site-type';

  const stepIndex = visibleSteps.indexOf(effectiveStep);
  const progressPct = visibleSteps.length > 1 ? ((stepIndex + 1) / visibleSteps.length) * 100 : 0;

  const goToStep = async (next: BuilderWizardStepId) => {
    setStep(next);
    if (storeId) {
      await persistProfile({
        builderWizard: buildBuilderWizardPatch({
          step: next,
          siteIntent,
          businessIntent,
          buildMethod: targetMethod,
        }),
      });
    }
  };

  const finishEditorSetup = async () => {
    if (!storeId || !isGrabioEditorMethod(targetMethod)) return;
    const existingMethods = profile?.builderWizard?.setupCompletedMethods || {};
    await persistProfile({
      builderWizard: buildBuilderWizardPatch({
        step: resolveSetupStep(
          { builderWizard: { siteIntent, businessIntent, buildMethod: targetMethod } },
          targetMethod,
        ),
        siteIntent,
        businessIntent,
        buildMethod: targetMethod,
        editorSetupVersion: EDITOR_SETUP_VERSION,
        setupCompletedMethods: {
          ...existingMethods,
          [targetMethod]: EDITOR_SETUP_VERSION,
        },
      }),
    });
  };

  const handleSiteIntentContinue = async () => {
    if (!siteIntent) {
      toast.error('Choose a site type to continue');
      return;
    }
    setSaving(true);
    try {
      const editorMethod = isGrabioEditorMethod(targetMethod);
      const following =
        editorMethod || siteIntent === 'ecommerce'
          ? ('business-type' as const)
          : targetMethod === 'wordpress'
            ? ('wordpress-request' as const)
            : ('site-type' as const);

      if (editorMethod || siteIntent === 'ecommerce') {
        await persistProfile({
          builderWizard: buildBuilderWizardPatch({
            step: following,
            siteIntent,
            buildMethod: targetMethod,
          }),
        });
        setStep(following);
        return;
      }

      const patch = profilePatchForSiteIntent(siteIntent);
      await persistProfile({
        ...patch,
        builderWizard: buildBuilderWizardPatch({
          step: following,
          siteIntent,
          buildMethod: targetMethod,
        }),
      });
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
    if (!siteIntent) {
      toast.error('Choose a site type first');
      return;
    }
    setSaving(true);
    try {
      const patch =
        siteIntent === 'ecommerce'
          ? profilePatchForSiteIntent('ecommerce', businessIntent)
          : profilePatchForSiteIntent(siteIntent);
      const following =
        targetMethod === 'wordpress'
          ? resolveSetupStep(
              { builderWizard: { siteIntent, businessIntent, buildMethod: targetMethod } },
              targetMethod,
            )
          : ('business-type' as const);
      await persistProfile({
        ...patch,
        builderWizard: buildBuilderWizardPatch({
          step: following,
          siteIntent,
          businessIntent,
          buildMethod: targetMethod,
        }),
      });
      setStep(following);
      if (targetMethod !== 'wordpress') {
        await finishEditorSetup();
      }
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
    if (!wordpressForm.preferredDomain.trim()) {
      toast.error('Domain is required');
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
        builderWizard: buildBuilderWizardPatch({
          step: 'wordpress-request',
          siteIntent,
          businessIntent,
          buildMethod: 'wordpress',
          wordpressRequestId: requestId,
        }),
      });
      setWordpressSubmitted(true);
      toast.success('Environment request submitted — we will contact you soon');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit request');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !profileHydrated) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (setupComplete && targetMethod !== 'wordpress') {
    return <>{children}</>;
  }

  if (setupComplete && targetMethod === 'wordpress') {
    return (
      <ModuleGate moduleId="builder">
        <AdminPageShell
          title={copy.title}
          description="Your WordPress environment request is in progress."
          eyebrow={copy.eyebrow}
          backTo={copy.backTo}
          className="max-w-4xl"
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Request received</CardTitle>
              <CardDescription>
                We will provision WordPress on your domain and email you login details. Track status in{' '}
                <Link to="/admin/wordpress-queue" className="text-primary underline">
                  WordPress queue
                </Link>
                .
              </CardDescription>
            </CardHeader>
          </Card>
        </AdminPageShell>
      </ModuleGate>
    );
  }

  return (
    <ModuleGate moduleId="builder">
      <BuilderSetupShell copy={copy}>
        <div className="mb-6">
          <div className="flex flex-wrap gap-2 mb-3">
            {BUILDER_WIZARD_STEPS.filter((s) => visibleSteps.includes(s.id)).map((s, i) => {
              const active = s.id === effectiveStep;
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
          <p className="text-xs text-muted-foreground mt-2">
            Building with <strong>{BUILD_METHOD_LABELS[targetMethod]}</strong>
          </p>
        </div>

        {effectiveStep === 'site-type' && (
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

        {effectiveStep === 'business-type' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">What type of business?</h2>
            {siteIntent && siteIntent !== 'ecommerce' && (
              <p className="text-sm text-muted-foreground">
                This helps us pre-configure your {BUILD_METHOD_LABELS[targetMethod]} workspace. Your site stays a{' '}
                {siteIntent === 'blog' ? 'blog' : 'display'} site — no checkout required.
              </p>
            )}
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
              onBack={() => void goToStep('site-type')}
              onNext={handleBusinessContinue}
              nextLabel={targetMethod === 'wordpress' ? 'Continue to domain' : 'Open editor'}
              saving={saving}
              disableNext={!businessIntent}
            />
          </div>
        )}

        {effectiveStep === 'wordpress-request' && targetMethod === 'wordpress' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Enter your domain</h2>
            <p className="text-sm text-muted-foreground">
              We create the WordPress environment on your domain — hosting, SSL, and initial setup included.
            </p>
            <div className="grid gap-4">
              <div>
                <Label htmlFor="wp-domain">Domain *</Label>
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
              onBack={() =>
                void goToStep(
                  siteIntent === 'ecommerce' ? 'business-type' : 'site-type',
                )
              }
              onNext={handleWordPressSubmit}
              nextLabel="Create environment"
              saving={saving}
              disableNext={
                !wordpressForm.businessName.trim() ||
                !wordpressForm.contactEmail.trim() ||
                !wordpressForm.preferredDomain.trim()
              }
            />
          </div>
        )}
      </BuilderSetupShell>
    </ModuleGate>
  );
};

type WizardNavProps = {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  saving?: boolean;
  disableNext?: boolean;
};

function WizardNav({
  onBack,
  onNext,
  nextLabel = 'Continue',
  saving,
  disableNext,
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
      {onNext && (
        <Button onClick={onNext} disabled={saving || disableNext} className="gap-1">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {nextLabel} <ArrowRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

export default BuilderSetupGate;
