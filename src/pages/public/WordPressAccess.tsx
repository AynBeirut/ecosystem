import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import PublicPageShell from '@/components/public/PublicPageShell';

type RedeemResponse = {
  success: boolean;
  error?: string;
  hosting?: {
    domain: string;
    panelUrl: string;
    username: string;
    password: string;
  };
  ftp?: {
    host: string;
    username: string;
    password: string;
  };
};

const WordPressAccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token')?.trim() || '', [searchParams]);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RedeemResponse | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError('Missing access token. Open the secure link from your email.');
      return;
    }

    const API_BASE =
      (import.meta.env as { VITE_API_BASE?: string }).VITE_API_BASE?.replace(/\/$/, '') || '/api';

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `${API_BASE}/wordpress/access/redeem?token=${encodeURIComponent(token)}`,
        );
        const payload = (await response.json()) as RedeemResponse;
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || 'Unable to load credentials');
        }
        setData(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load credentials');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  return (
    <PublicPageShell
      title="WordPress access"
      description="Secure one-time access to your WordPress hosting credentials."
      url="/wordpress/access"
      eyebrow="WordPress hosting"
      heroTitle="Your hosting credentials"
      heroSubtitle="This page works once. Save these details in your password manager."
    >
      <div className="mx-auto max-w-2xl">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading secure credentials…
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-destructive">Access unavailable</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </div>
          </div>
        )}

        {!loading && data?.hosting && data.ftp && (
          <div className="space-y-6">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-900">
                Credentials loaded successfully. Copy them now — this link cannot be used again.
              </p>
            </div>

            <section className="rounded-xl border p-5 space-y-3">
              <h2 className="font-semibold">Webuzo hosting panel</h2>
              <CredentialRow label="Domain" value={data.hosting.domain} />
              <CredentialRow label="Panel URL" value={data.hosting.panelUrl} />
              <CredentialRow label="Username" value={data.hosting.username} />
              <CredentialRow label="Password" value={data.hosting.password} secret />
            </section>

            <section className="rounded-xl border p-5 space-y-3">
              <h2 className="font-semibold">FTP access</h2>
              <CredentialRow label="Host" value={data.ftp.host} />
              <CredentialRow label="Username" value={data.ftp.username} />
              <CredentialRow label="Password" value={data.ftp.password} secret />
            </section>
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
