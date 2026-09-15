import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PublicPageShell from '@/components/public/PublicPageShell';
import { getApiBaseUrl } from '@/lib/apiBase';

type RedeemResponse = {
  success: boolean;
  error?: string;
  requiresConfirmation?: boolean;
  wordpress?: {
    domain: string;
    adminUrl: string;
    username: string;
    password: string;
  };
  dns?: {
    target: string;
  };
};

const WordPressAccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token')?.trim() || '', [searchParams]);
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RedeemResponse | null>(null);

  const revealCredentials = async () => {
    if (!token) {
      setError('Missing access token. Open the secure link from your email.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${getApiBaseUrl()}/wordpress/access/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const raw = await response.text();
      let payload: RedeemResponse;
      try {
        payload = JSON.parse(raw) as RedeemResponse;
      } catch {
        throw new Error('Secure access service unavailable — try again in a minute');
      }
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to load credentials');
      }
      setData(payload);
      setRevealed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicPageShell
      title="WordPress access"
      description="Secure one-time access to your WordPress admin credentials."
      url="/wordpress/access"
      eyebrow="WordPress"
      heroTitle="Your WordPress login"
      heroSubtitle="This link works once. Click reveal, then save the details in your password manager."
    >
      <div className="mx-auto max-w-2xl">
        {!token && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-destructive">Access unavailable</p>
              <p className="text-sm text-muted-foreground mt-1">
                Missing access token. Open the secure link from your email.
              </p>
            </div>
          </div>
        )}

        {token && !revealed && !error && (
          <div className="rounded-xl border p-6 space-y-4 text-center">
            <ShieldCheck className="h-10 w-10 text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">
              For security, credentials are not loaded automatically. Email scanners cannot consume
              this link — you must click reveal.
            </p>
            <Button onClick={() => void revealCredentials()} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Reveal credentials
            </Button>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-destructive">Access unavailable</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
              {/already been used|expired|invalid/i.test(error) && (
                <p className="text-sm text-muted-foreground mt-2">
                  Ask your builder to click <strong>Try again</strong> in WordPress setup for a new
                  secure email link.
                </p>
              )}
            </div>
          </div>
        )}

        {revealed && data?.wordpress && (
          <div className="space-y-6">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-900">
                Credentials loaded successfully. Copy them now — this link cannot be used again.
              </p>
            </div>

            <section className="rounded-xl border p-5 space-y-3">
              <h2 className="font-semibold">WordPress admin</h2>
              <CredentialRow label="Site" value={data.wordpress.domain} />
              <CredentialRow label="Admin URL" value={data.wordpress.adminUrl} />
              <CredentialRow label="Username" value={data.wordpress.username} />
              <CredentialRow label="Password" value={data.wordpress.password} secret />
            </section>

            {data.dns?.target && (
              <section className="rounded-xl border p-5 space-y-3">
                <h2 className="font-semibold">Step 1 — DNS (do this before sign-in)</h2>
                <p className="text-sm text-muted-foreground">
                  Point @ and www A records to this IP at your registrar. The WordPress admin URL
                  will not open until DNS is live.
                </p>
                <CredentialRow label="A record value" value={data.dns.target} />
              </section>
            )}
          </div>
        )}
      </div>
    </PublicPageShell>
  );
};

function CredentialRow({
  label,
  value,
  secret = false,
}: {
  label: string;
  value: string;
  secret?: boolean;
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-[140px_1fr] sm:items-center">
      <span className="text-sm text-muted-foreground">{label}</span>
      <code className="rounded bg-muted px-2 py-1 text-sm break-all">{secret ? value : value}</code>
    </div>
  );
}

export default WordPressAccess;
