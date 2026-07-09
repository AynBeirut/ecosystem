import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useStoreEntitlements } from '@/hooks/useStoreEntitlements';
import ModuleGate from '@/components/ModuleGate';
import { getApiBaseUrl } from '@/lib/apiBase';

export type AiFieldDef = {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select';
  placeholder?: string;
  options?: string[];
  required?: boolean;
  rows?: number;
};

export type AiToolConfig = {
  moduleId: string;
  tool: string;
  icon: string;
  title: string;
  description: string;
  fields: AiFieldDef[];
  buildPrompt: (values: Record<string, string>) => string;
  outputLabel?: string;
};

type Props = { config: AiToolConfig };

const AiToolPage: React.FC<Props> = ({ config }) => {
  const { profile } = useStoreEntitlements();
  const { toast } = useToast();
  const auth = getAuth();

  const [values, setValues] = useState<Record<string, string>>({});
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number | null>(
    profile?.aiCreditBalance ?? null,
  );

  const balance = creditBalance ?? profile?.aiCreditBalance ?? 0;

  const handleGenerate = async () => {
    const missing = config.fields
      .filter((f) => f.required && !values[f.id]?.trim())
      .map((f) => f.label);
    if (missing.length) {
      toast({ title: 'Missing fields', description: missing.join(', '), variant: 'destructive' });
      return;
    }

    const prompt = config.buildPrompt(values);
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      toast({ title: 'Not signed in', variant: 'destructive' });
      return;
    }

    setLoading(true);
    setOutput('');
    try {
      const res = await fetch(`${getApiBaseUrl()}/ai/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          storeId: auth.currentUser?.uid,
          tool: config.tool,
          prompt,
        }),
      });
      const data = await res.json() as {
        success: boolean;
        content?: string;
        balanceAfter?: number;
        message?: string;
      };
      if (!data.success) throw new Error(data.message || 'Generation failed');
      setOutput(data.content ?? '');
      if (typeof data.balanceAfter === 'number') setCreditBalance(data.balanceAfter);
    } catch (err) {
      toast({
        title: 'Generation failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    void navigator.clipboard.writeText(output);
    toast({ title: 'Copied to clipboard' });
  };

  const isAiConfigured = Boolean(
    (profile as Record<string, unknown> | null)?.aiIntegrationSettings,
  );

  return (
    <ModuleGate moduleId={config.moduleId}>
      <AdminPageShell
        title={config.title}
        description={config.description}
        eyebrow="AI Tools"
        backTo="/admin/ai-builder"
        backLabel="AI Builder"
        className="max-w-3xl"
        actions={
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Credits</p>
            <p className="text-xl font-bold">{balance}</p>
          </div>
        }
      >
        {!isAiConfigured && (
          <AdminPanel className="mb-6 border-amber-200 bg-amber-50">
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-amber-800">
                AI integration not configured.{' '}
                <Link to="/admin/ai-builder" className="underline font-medium">
                  Set up your API key in AI Builder
                </Link>{' '}
                first.
              </p>
            </CardContent>
          </AdminPanel>
        )}

        {balance === 0 && (
          <AdminPanel className="mb-6 border-red-200 bg-red-50">
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-red-800">
                No credits remaining.{' '}
                <Link to="/admin/ai-builder" className="underline font-medium">
                  Buy credits
                </Link>{' '}
                to continue.
              </p>
            </CardContent>
          </AdminPanel>
        )}

        {/* Input form */}
        <AdminPanel className="mb-6">
          <CardHeader>
            <CardTitle>Input</CardTitle>
            <CardDescription>Fill in the details below and hit Generate.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {config.fields.map((field) => (
              <div key={field.id}>
                <label className="text-sm font-medium block mb-1">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {field.type === 'textarea' ? (
                  <textarea
                    className="w-full border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                    rows={field.rows ?? 3}
                    placeholder={field.placeholder}
                    value={values[field.id] ?? ''}
                    onChange={(e) => setValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                  />
                ) : field.type === 'select' ? (
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    value={values[field.id] ?? ''}
                    onChange={(e) => setValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                  >
                    <option value="">Select…</option>
                    {field.options?.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder={field.placeholder}
                    value={values[field.id] ?? ''}
                    onChange={(e) => setValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                  />
                )}
              </div>
            ))}
            <Button
              onClick={() => void handleGenerate()}
              disabled={loading || !isAiConfigured || balance === 0}
              className="w-full"
            >
              {loading ? 'Generating…' : `Generate ${config.title}`}
            </Button>
          </CardContent>
        </AdminPanel>

        {/* Output */}
        {output && (
          <AdminPanel>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">{config.outputLabel ?? 'Result'}</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">AI generated</Badge>
                <Button size="sm" variant="outline" onClick={handleCopy}>Copy</Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">{output}</pre>
            </CardContent>
          </AdminPanel>
        )}
      </AdminPageShell>
    </ModuleGate>
  );
};

export default AiToolPage;
