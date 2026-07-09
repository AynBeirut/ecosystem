import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import { ECOSYSTEM_FLAGS } from '@/lib/ecosystemFlags';
import { MODULE_CATALOG, isRoadmapModule } from '@/lib/pricingDisplay';
import { PRESET_LIST, buildProfileFromPreset } from '@/lib/packagePresets';
import {
  applyModuleToggle,
  enforceWorkflowExclusivity,
  inferWorkflowFromModules,
  validateModuleSelection,
} from '@/lib/moduleDependencies';
import {
  getModuleLabel,
  rankModuleSuggestions,
  suggestionQuestionsForWorkflow,
  type SuggestionAnswer,
} from '@/lib/moduleSuggestions';
import { presetToEnabledModules, CORE_MODULE_IDS, type StartingPackageKey } from '@/lib/moduleManifest';
import { loadPackageDraft, savePackageDraft } from '@/lib/packageDraft';
import type { StoreProfile } from '@/types/storeProfile';
import { toast } from 'sonner';
import AdminPageHero from '@/components/admin/AdminPageHero';
import AdminModuleIcon from '@/components/admin/AdminModuleIcon';
import PoweredByEmoove from '@/components/PoweredByEmoove';

type OnboardingPath = 'custom' | 'preset';

const TOGGLEABLE_MODULES = MODULE_CATALOG.filter(
  (m) => !CORE_MODULE_IDS.includes(m.id as (typeof CORE_MODULE_IDS)[number]) && !isRoadmapModule(m),
);

const PackageOnboarding: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetParam = searchParams.get('preset') as StartingPackageKey | null;
  const pathParam = searchParams.get('onboarding') as OnboardingPath | null;

  const draft = loadPackageDraft();
  const [path, setPath] = useState<OnboardingPath>(
    pathParam === 'custom' ? 'custom' : presetParam ? 'preset' : draft?.path ?? 'preset',
  );
  const [selectedPreset, setSelectedPreset] = useState<StartingPackageKey>(
    presetParam && PRESET_LIST.some((p) => p.key === presetParam) ? presetParam : 'pkg_shop',
  );
  const [modules, setModules] = useState<Record<string, boolean>>(() => {
    if (draft?.modules) return { ...draft.modules };
    if (presetParam) return presetToEnabledModules(presetParam);
    return presetToEnabledModules('pkg_shop');
  });
  const [answers, setAnswers] = useState<SuggestionAnswer>({});
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'choose' | 'configure' | 'suggest'>('choose');

  const workflow = useMemo(() => inferWorkflowFromModules(modules), [modules]);
  const issues = useMemo(() => validateModuleSelection(modules, workflow), [modules, workflow]);
  const suggestions = useMemo(() => rankModuleSuggestions(answers), [answers]);
  const questions = useMemo(() => suggestionQuestionsForWorkflow(workflow), [workflow]);

  const handlePresetSelect = (key: StartingPackageKey) => {
    setSelectedPreset(key);
    setModules(presetToEnabledModules(key));
    setPath('preset');
  };

  const handleToggle = (moduleId: string, checked: boolean) => {
    setModules((prev) => applyModuleToggle(prev, moduleId, checked));
  };

  const handleAcceptSuggestion = (moduleId: string) => {
    setModules((prev) => enforceWorkflowExclusivity(applyModuleToggle(prev, moduleId, true), workflow));
    toast.success(`${getModuleLabel(moduleId)} added to your package`);
  };

  const persistOnboarding = async () => {
    if (!user) {
      navigate('/login?tab=signup');
      return;
    }
    const storeId = getActualStoreId(user);
    const normalized = enforceWorkflowExclusivity(modules, workflow);
    const patch: Partial<StoreProfile> =
      path === 'preset'
        ? buildProfileFromPreset(selectedPreset)
        : {
            pricingVersion: 'modular-v2',
            businessWorkflow: workflow,
            enabledModules: normalized,
            seatCount: 1,
            posLocationCount: normalized.pos ? 1 : 0,
            composedProductSource: 'platform',
          };

    setSaving(true);
    try {
      const db = getFirestore();
      const ref = doc(db, 'storeProfiles', storeId);
      const existing = await getDoc(ref);
      if (existing.exists() && existing.data()?.enabledModules) {
        await setDoc(ref, patch, { merge: true });
      } else {
        await setDoc(ref, patch, { merge: true });
      }
      savePackageDraft({
        path,
        preset: path === 'preset' ? selectedPreset : undefined,
        workflow,
        modules: normalized,
      });
      toast.success('Your package is saved');
      navigate('/admin/profile');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save package');
    } finally {
      setSaving(false);
    }
  };

  if (!ECOSYSTEM_FLAGS.modularEntitlements && !ECOSYSTEM_FLAGS.packageDraft) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Package onboarding</CardTitle>
            <CardDescription>
              Enable ecosystem flags in .env.local to use modular onboarding locally.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/admin">Go to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'choose') {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          <AdminPageHero
            title="Choose how to build your package"
            description="Two equal paths — pick what fits your business."
            backTo="/admin/profile"
            backLabel="Back to Store Profile"
          />
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card
            className={`cursor-pointer shadow-sm hover:shadow-md transition-shadow rounded-xl ${path === 'custom' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => {
              setPath('custom');
              setStep('configure');
            }}
          >
            <CardHeader>
              <CardTitle>Customize your package</CardTitle>
              <CardDescription>Start with core invoicing and toggle modules yourself.</CardDescription>
            </CardHeader>
          </Card>
          <Card
            className={`cursor-pointer shadow-sm hover:shadow-md transition-shadow rounded-xl ${path === 'preset' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setStep('configure')}
          >
            <CardHeader>
              <CardTitle>Choose a ready package</CardTitle>
              <CardDescription>Shop, Kitchen, Factory, NGO, or Freelancer presets.</CardDescription>
            </CardHeader>
          </Card>
        </div>
        <Button variant="outline" asChild>
          <Link to="/admin">Skip for now</Link>
        </Button>
        <div className="mt-10 pt-6 border-t border-slate-200 text-center">
          <PoweredByEmoove />
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <AdminPageHero
        title={path === 'preset' ? 'Ready package' : 'Custom package'}
        description="Toggle modules, accept smart suggestions, then save to your store profile."
        backTo="/admin/profile"
        backLabel="Back to Store Profile"
      />
      <div className="mb-6 flex flex-wrap gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link to="/subscription">Subscription & billing</Link>
        </Button>
      </div>

      {path === 'preset' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {PRESET_LIST.map((preset) => (
            <Card
              key={preset.key}
              className={`cursor-pointer rounded-xl shadow-sm hover:shadow-md transition-shadow ${selectedPreset === preset.key ? 'ring-2 ring-primary' : ''}`}
              onClick={() => handlePresetSelect(preset.key)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{preset.label}</CardTitle>
                <CardDescription>${preset.monthlyUsd}/mo · 1 user</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {path === 'custom' && (
        <div className="grid sm:grid-cols-2 gap-3 mb-6">
          {TOGGLEABLE_MODULES.map((mod) => (
            <div
              key={mod.id}
              className={`flex items-center gap-3 border rounded-xl p-3 shadow-sm transition-shadow hover:shadow-md ${
                modules[mod.id] ? 'border-primary/40 bg-primary/5' : 'border-slate-200'
              }`}
            >
              <Checkbox
                id={`mod-${mod.id}`}
                checked={Boolean(modules[mod.id])}
                onCheckedChange={(v) => handleToggle(mod.id, Boolean(v))}
              />
              <AdminModuleIcon moduleId={mod.id} />
              <Label htmlFor={`mod-${mod.id}`} className="cursor-pointer flex-1">
                <span className="font-medium">{mod.name}</span>
                <span className="block text-xs text-muted-foreground">{mod.summary}</span>
              </Label>
            </div>
          ))}
        </div>
      )}

      {issues.length > 0 && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
          {issues.map((issue) => (
            <p key={issue.moduleId}>{issue.reason}</p>
          ))}
        </div>
      )}

      {step === 'configure' && (
        <div className="flex gap-3 mb-8">
          <Button variant="outline" onClick={() => setStep('suggest')}>
            Get suggestions
          </Button>
          <Button onClick={() => void persistOnboarding()} disabled={saving}>
            {saving ? 'Saving…' : 'Save & continue'}
          </Button>
        </div>
      )}

      {step === 'suggest' && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Smart suggestions</CardTitle>
            <CardDescription>Answer a few questions — accept one suggestion at a time.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {questions.map((q) => (
              <div key={q.id} className="flex items-center gap-2">
                <Checkbox
                  id={`q-${q.id}`}
                  checked={Boolean(answers[q.id])}
                  onCheckedChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: Boolean(v) }))}
                />
                <Label htmlFor={`q-${q.id}`}>{q.label}</Label>
              </div>
            ))}
            <div className="space-y-2 pt-4">
              {suggestions.map((s) => (
                <div key={s.moduleId} className="flex items-center justify-between border rounded p-3">
                  <div>
                    <p className="font-medium">{getModuleLabel(s.moduleId)}</p>
                    <p className="text-sm text-muted-foreground">{s.reason}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={Boolean(modules[s.moduleId])}
                    onClick={() => handleAcceptSuggestion(s.moduleId)}
                  >
                    {modules[s.moduleId] ? 'Added' : 'Add'}
                  </Button>
                </div>
              ))}
            </div>
            <Button onClick={() => setStep('configure')}>Back to package</Button>
          </CardContent>
        </Card>
      )}
      <div className="mt-10 pt-6 border-t border-slate-200 text-center">
        <PoweredByEmoove />
      </div>
    </div>
    </div>
  );
};

export default PackageOnboarding;
