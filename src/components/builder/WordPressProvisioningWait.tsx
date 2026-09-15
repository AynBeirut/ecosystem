import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Loader2, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  subscribeWordPressProvisioningRequest,
  testWordPressProvisioningDns,
  fetchBuilderDemoWordPressCredentials,
} from '@/lib/wordpressProvisioningService';
import type { WordPressProvisioningRequest } from '@/types/wordpressProvisioning';

type WordPressProvisioningWaitProps = {
  requestId: string;
  contactEmail?: string;
  onRetry?: () => void | Promise<void>;
  retrying?: boolean;
  /** Builder demo workspace — staging subdomain only, no client DNS/email go-live */
  demoMode?: boolean;
  stagingDomain?: string;
};

const DEMO_STATUS_STEPS = [
  { key: 'pending', label: 'Request received' },
  { key: 'in_progress', label: 'Installing WordPress on staging VPS' },
  { key: 'completed', label: 'Staging site ready' },
] as const;

const STATUS_STEPS = [
  { key: 'pending', label: 'Request received' },
  { key: 'in_progress', label: 'Installing WordPress on VPS' },
  { key: 'awaiting_dns', label: 'Point DNS & test' },
  { key: 'completed', label: 'Credentials emailed' },
] as const;

function stepIndex(status: string, demoMode = false): number {
  if (status === 'completed') return demoMode ? 3 : 4;
  if (status === 'awaiting_dns') return 3;
  if (status === 'in_progress') return 2;
  if (status === 'failed' || status === 'cancelled') return -1;
  return 1;
}

const WordPressProvisioningWait: React.FC<WordPressProvisioningWaitProps> = ({
  requestId,
  contactEmail,
  onRetry,
  retrying,
  demoMode = false,
  stagingDomain,
}) => {
  const [request, setRequest] = useState<WordPressProvisioningRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [testingDns, setTestingDns] = useState(false);
  const [dnsMessage, setDnsMessage] = useState<string | null>(null);
  const [demoCredentials, setDemoCredentials] = useState<{
    wpAdminUrl: string;
    wpUsername: string;
    wpPassword: string;
    hostingDomain: string;
  } | null>(null);
  const [loadingDemoCredentials, setLoadingDemoCredentials] = useState(false);
  const [demoCredentialsError, setDemoCredentialsError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeWordPressProvisioningRequest(requestId, (next) => {
      setRequest(next);
      setLoading(false);
    });
    return unsub;
  }, [requestId]);

  const isCompleted = request?.status === 'completed';
  const statusSteps = demoMode ? DEMO_STATUS_STEPS : STATUS_STEPS;
  const activeStep = useMemo(
    () => stepIndex(request?.status || 'pending', demoMode),
    [request?.status, demoMode],
  );
  const dnsTarget = request?.dnsTarget || '104.207.71.117';
  const domain =
    request?.hostingDomain ||
    request?.stagingDomain ||
    request?.preferredDomain ||
    stagingDomain ||
    '';
  const wpAdminUrl =
    demoCredentials?.wpAdminUrl ||
    request?.wpAdminUrl ||
    (domain ? `https://${domain.replace(/^www\./, '')}/wp-admin` : '');
  const emailTarget = contactEmail || request?.contactEmail || 'the contact email';
  const awaitingDns = request?.status === 'awaiting_dns';
  const emailProcessing =
    request?.status === 'completed' &&
    Boolean(request.accessEmailSentAt) &&
    !request.accessEmailRedeemedAt;
  const showFiveMinutePrompt =
    !demoMode &&
    (request?.status === 'pending' ||
      request?.status === 'in_progress' ||
      awaitingDns ||
      emailProcessing);

  useEffect(() => {
    if (!demoMode || request?.status !== 'completed' || demoCredentials) return;
    let cancelled = false;
    const load = async () => {
      setLoadingDemoCredentials(true);
      setDemoCredentialsError(null);
      try {
        const auth = getAuth();
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) {
          throw new Error('Sign in again to load demo credentials');
        }
        const creds = await fetchBuilderDemoWordPressCredentials(requestId, idToken);
        if (!cancelled) setDemoCredentials(creds);
      } catch (err) {
        if (!cancelled) {
          setDemoCredentialsError(err instanceof Error ? err.message : 'Could not load demo credentials');
        }
      } finally {
        if (!cancelled) setLoadingDemoCredentials(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [demoMode, request?.status, requestId, demoCredentials]);

  const handleTestDns = async () => {
    const auth = getAuth();
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) {
      toast.error('Sign in again to test DNS');
      return;
    }

    setTestingDns(true);
    setDnsMessage(null);
    try {
      const result = await testWordPressProvisioningDns(requestId, idToken);
      setDnsMessage(result.message);
      if (result.dnsOk && result.emailSent) {
        toast.success(result.message);
      } else if (result.dnsOk) {
        toast.message(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'DNS test failed';
      setDnsMessage(message);
      toast.error(message);
    } finally {
      setTestingDns(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!request) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Request not found</CardTitle>
          <CardDescription>We could not load provisioning status for this request.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (request.status === 'failed') {
    return (
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Provisioning failed
          </CardTitle>
          <CardDescription>{request.provisionError || 'Unknown error from VPS provisioning.'}</CardDescription>
        </CardHeader>
        {onRetry && (
          <CardContent>
            <Button onClick={() => void onRetry()} disabled={retrying} className="gap-2">
              {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Try again
            </Button>
          </CardContent>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {demoMode && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
          <p className="font-medium">Staging only — not client go-live</p>
          <p className="text-violet-900/90 mt-1">
            This WordPress site runs on <strong>{domain || stagingDomain || 'a Grabio staging URL'}</strong>.
            To use a client custom domain, transfer the demo to a real store on a website package first.
          </p>
        </div>
      )}

      {showFiveMinutePrompt && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
          <Clock className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-950 space-y-1">
            {emailProcessing ? (
              <>
                <p className="font-medium">Email processing — allow up to 5 minutes</p>
                <p className="text-amber-900/90">
                  DNS verified. We sent a secure one-time link to <strong>{emailTarget}</strong>.
                  Check inbox and spam.
                </p>
              </>
            ) : awaitingDns ? (
              <>
                <p className="font-medium">Point DNS first, then test</p>
                <p className="text-amber-900/90">
                  WordPress is installed. Add the A records below at your registrar, then click{' '}
                  <strong>Test DNS</strong>. We only send the credential email after DNS passes.
                </p>
              </>
            ) : (
              <>
                <p className="font-medium">This usually takes up to 5 minutes</p>
                <p className="text-amber-900/90">
                  We are installing WordPress on the VPS. DNS and credential email come next.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">WordPress site</CardTitle>
          <CardDescription>
            {demoMode
              ? 'Credentials appear here for staging practice — no credential email is sent.'
              : awaitingDns
              ? 'WordPress is ready — point your domain, test DNS, then we email credentials.'
              : request.status === 'completed'
                ? 'Credential email sent after DNS was verified.'
                : 'Creating your domain and installing WordPress — allow up to 5 minutes.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="space-y-3">
            {statusSteps.map((step, index) => {
              const done = isCompleted || activeStep > index + 1;
              const active = !isCompleted && activeStep === index + 1;
              return (
                <li key={step.key} className="flex items-center gap-3 text-sm">
                  {done ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  ) : active ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                  ) : (
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span className={done || active ? 'text-foreground' : 'text-muted-foreground'}>
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>

          {!demoMode && (
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 space-y-3">
            <p className="text-sm font-medium text-sky-950">Step 1 — Point your domain</p>
            <p className="text-sm text-sky-900/90">
              Add these A records at your registrar for{' '}
              <strong>{domain || 'your domain'}</strong>.
            </p>
            <div className="grid gap-2 sm:grid-cols-3 text-sm pt-1">
              <div>
                <span className="text-muted-foreground">Type</span>
                <p>A</p>
              </div>
              <div>
                <span className="text-muted-foreground">Name</span>
                <p>@ and www</p>
              </div>
              <div>
                <span className="text-muted-foreground">Value</span>
                <p className="font-mono break-all">{dnsTarget}</p>
              </div>
            </div>

            {awaitingDns && (
              <div className="space-y-2 pt-2">
                <Button
                  onClick={() => void handleTestDns()}
                  disabled={testingDns}
                  className="gap-2"
                >
                  {testingDns ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Test DNS
                </Button>
                {(dnsMessage || request.dnsLastCheckMessage) && (
                  <p
                    className={`text-sm ${
                      request.dnsVerifiedAt ? 'text-emerald-700' : 'text-destructive'
                    }`}
                  >
                    {dnsMessage || request.dnsLastCheckMessage}
                  </p>
                )}
              </div>
            )}
          </div>
          )}

          {demoMode && request.status === 'completed' && domain && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
              Staging site URL:{' '}
              <a
                className="font-mono underline break-all"
                href={`https://${domain}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                https://{domain}
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">WordPress admin login</CardTitle>
          <CardDescription>
            {demoMode
              ? loadingDemoCredentials
                ? 'Loading staging credentials…'
                : demoCredentialsError
                  ? demoCredentialsError
                  : 'Use these only for demo practice on the staging URL.'
              : awaitingDns
              ? 'Complete DNS test above — then we email the password within 5 minutes.'
              : emailProcessing
                ? `Credential email sent to ${emailTarget}. Allow up to 5 minutes.`
                : request.status === 'completed'
                  ? `Sign in after opening the secure email link sent to ${emailTarget}.`
                  : 'Waiting for WordPress install…'}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="wp-admin-url">Admin URL</Label>
            <Input
              id="wp-admin-url"
              readOnly
              value={
                demoMode
                  ? wpAdminUrl || (request.status === 'completed' ? 'Loading…' : 'Pending…')
                  : awaitingDns
                    ? 'Available after DNS test + email'
                    : wpAdminUrl || 'Pending…'
              }
              className="font-mono text-xs"
            />
          </div>
          <div>
            <Label htmlFor="wp-username">Username</Label>
            <Input
              id="wp-username"
              readOnly
              value={
                demoCredentials?.wpUsername ||
                request.wpUsername ||
                (demoMode && request.status === 'completed' ? 'Loading…' : request.status === 'completed' ? 'Sent in your email' : 'Waiting…')
              }
              className="font-mono text-xs"
            />
          </div>
          <div>
            <Label htmlFor="wp-password">Password</Label>
            <Input
              id="wp-password"
              readOnly
              value={
                demoCredentials?.wpPassword ||
                (demoMode
                  ? request.status === 'completed'
                    ? loadingDemoCredentials
                      ? 'Loading…'
                      : 'Unavailable'
                    : 'Available after install'
                  : awaitingDns
                    ? 'Sent after DNS test passes'
                    : request.status === 'completed'
                      ? 'Sent via secure one-time email link — check inbox'
                      : 'Waiting for provisioning…')
              }
              className="text-xs"
            />
          </div>
          {demoCredentialsError && demoMode && (
            <div className="sm:col-span-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDemoCredentials(null);
                  setDemoCredentialsError(null);
                }}
              >
                Retry loading credentials
              </Button>
            </div>
          )}
          {wpAdminUrl && (demoMode ? isCompleted : request.status === 'completed' && request.accessEmailSentAt) && (
            <div className="sm:col-span-2 space-y-2">
              <p className="text-xs text-muted-foreground">
                {demoMode
                  ? 'Staging WordPress only — transfer demo before connecting a client domain.'
                  : 'Open this only after you received the credential email and DNS is live.'}
              </p>
              <Button asChild className="gap-2">
                <a href={wpAdminUrl} target="_blank" rel="noopener noreferrer">
                  Open WordPress admin <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WordPressProvisioningWait;
