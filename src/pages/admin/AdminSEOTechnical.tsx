/**
 * AdminSEOTechnical.tsx — Phase 2 technical SEO health monitor
 * Apache audit (seo_audits), broken link resolution, PageSpeed CWV, redirect chains, GSC inspection
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Activity,
  ArrowRightLeft,
  Gauge,
  Link2Off,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import {
  computeTechnicalHealthScore,
  fetchGscSitemaps,
  resolveGscToken,
  inspectGscUrls,
  loadAuditSnapshot,
  loadBrokenLinkStatuses,
  loadPageSpeedSnapshot,
  loadRedirectChains,
  mergeBrokenLinks,
  runPageSpeedChecks,
  saveBrokenLinkResolution,
  saveRedirectChains,
  PSI_KEY,
  DEFAULT_PAGESPEED_URLS,
  type AuditSnapshot,
  type BrokenLinkResolution,
  type BrokenLinkRow,
  type GscInspectionRow,
  type PageSpeedRow,
  type RedirectChainRow,
} from '@/lib/seoTechnical';
import {
  getCanonicalHealthToken,
  loadCanonicalHealthSnapshot,
  refreshCanonicalHealth,
  type CanonicalHealthSnapshot,
} from '@/lib/seoCanonicalHealth';
import {
  getGscPhase2Token,
  loadGscPhase2Snapshot,
  runGscPhase2,
  type GscPhase2Snapshot,
} from '@/lib/seoGscPhase2';

const AdminSEOTechnical: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditSnapshot | null>(null);
  const [brokenLinks, setBrokenLinks] = useState<BrokenLinkRow[]>([]);
  const [pagespeed, setPagespeed] = useState<PageSpeedRow[] | null>(null);
  const [redirects, setRedirects] = useState<RedirectChainRow[]>([]);
  const [gscSitemaps, setGscSitemaps] = useState<Array<{ path: string; warnings: number; errors: number }>>([]);
  const [gscInspections, setGscInspections] = useState<GscInspectionRow[]>([]);
  const [canonical, setCanonical] = useState<CanonicalHealthSnapshot | null>(null);
  const [phase2, setPhase2] = useState<GscPhase2Snapshot | null>(null);
  const [runningPsi, setRunningPsi] = useState(false);
  const [runningGsc, setRunningGsc] = useState(false);
  const [refreshingCanonical, setRefreshingCanonical] = useState(false);
  const [gscConnected, setGscConnected] = useState(false);
  const [runningPhase2, setRunningPhase2] = useState(false);
  const [savingRow, setSavingRow] = useState<string | null>(null);
  const [newRedirect, setNewRedirect] = useState({ fromUrl: '', toUrl: '', hops: 2, notes: '' });

  const healthScore = useMemo(() => {
    if (canonical) return canonical.healthScore;
    return computeTechnicalHealthScore(audit, pagespeed);
  }, [canonical, audit, pagespeed]);

  const healthSourceLabel = canonical
    ? 'GSC + GA4 (canonical)'
    : audit?.vhost_mode === 'redirect_stub'
      ? 'VPS redirect stub only'
      : 'Apache audit';

  const openBrokenCount = useMemo(
    () => brokenLinks.filter((row) => row.resolution === 'open' && row.id !== 'summary').length,
    [brokenLinks],
  );

  const cwvAlerts = useMemo(
    () => (pagespeed ?? []).filter((row) => row.alerts.length > 0).length,
    [pagespeed],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [auditSnap, resolutions, psiSnap, chains, canonicalSnap, phase2Snap] = await Promise.all([
        loadAuditSnapshot(),
        loadBrokenLinkStatuses(),
        loadPageSpeedSnapshot(),
        loadRedirectChains(),
        loadCanonicalHealthSnapshot(),
        loadGscPhase2Snapshot(),
      ]);
      setAudit(auditSnap);
      setCanonical(canonicalSnap);
      setPhase2(phase2Snap);
      setBrokenLinks(mergeBrokenLinks(auditSnap, resolutions));
      setPagespeed(psiSnap);
      setRedirects(chains);

      const token = await resolveGscToken();
      setGscConnected(Boolean(token));
      if (token) {
        try {
          setGscSitemaps(await fetchGscSitemaps(token));
        } catch {
          /* optional */
        }
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to load technical SEO data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleResolutionChange = async (row: BrokenLinkRow, resolution: BrokenLinkResolution) => {
    if (row.id === 'summary') return;
    setSavingRow(row.url);
    try {
      await saveBrokenLinkResolution(row.url, row.hits, resolution);
      setBrokenLinks((prev) =>
        prev.map((item) => (item.url === row.url ? { ...item, resolution } : item)),
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save resolution');
    } finally {
      setSavingRow(null);
    }
  };

  const handleRunPageSpeed = async () => {
    setRunningPsi(true);
    setMessage(null);
    try {
      const pages = await runPageSpeedChecks();
      setPagespeed(pages);
      setMessage(`PageSpeed check complete for ${pages.length} URLs.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'PageSpeed check failed');
    } finally {
      setRunningPsi(false);
    }
  };

  const handleRunPhase2 = async () => {
    const token = await getGscPhase2Token();
    if (!token) {
      setMessage('Connect Google Search Console on SEO Audit first.');
      return;
    }
    setRunningPhase2(true);
    setMessage(null);
    try {
      const result = await runGscPhase2(token);
      setPhase2(result);
      setGscSitemaps(result.sitemaps);
      setGscInspections(result.inspections);
      setCanonical(await loadCanonicalHealthSnapshot());
      setMessage(
        `Phase 2 complete — sitemap ${result.sitemapSubmitted ? 'submitted' : 'submit failed'}, `
        + `${result.passCount}/${result.inspections.length} URLs PASS.`,
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Phase 2 GSC run failed');
    } finally {
      setRunningPhase2(false);
    }
  };

  const handleRefreshCanonicalHealth = async () => {
    const token = await getCanonicalHealthToken();
    if (!token) {
      setMessage('Connect Google Search Console on SEO Audit first, then return here.');
      return;
    }
    setRefreshingCanonical(true);
    setMessage(null);
    try {
      const snapshot = await refreshCanonicalHealth(token, 28, pagespeed);
      setCanonical(snapshot);
      setGscSitemaps(await fetchGscSitemaps(token));
      setGscInspections(await inspectGscUrls(token, DEFAULT_PAGESPEED_URLS));
      setMessage(`Canonical health refreshed — ${snapshot.healthScore}% (GSC + GA4).`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Canonical health refresh failed');
    } finally {
      setRefreshingCanonical(false);
    }
  };

  const handleRunGscInspection = async () => {
    const token = await resolveGscToken();
    if (!token) {
      setMessage('Connect Google Search Console on SEO Audit page first (same browser session).');
      return;
    }
    setRunningGsc(true);
    try {
      const [sitemaps, inspections] = await Promise.all([
        fetchGscSitemaps(token),
        inspectGscUrls(token, DEFAULT_PAGESPEED_URLS),
      ]);
      setGscSitemaps(sitemaps);
      setGscInspections(inspections);
      setMessage(`GSC inspection complete for ${inspections.length} URLs.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'GSC inspection failed');
    } finally {
      setRunningGsc(false);
    }
  };

  const addRedirectChain = async () => {
    if (!newRedirect.fromUrl.trim() || !newRedirect.toUrl.trim()) return;
    const chain: RedirectChainRow = {
      id: crypto.randomUUID(),
      fromUrl: newRedirect.fromUrl.trim(),
      toUrl: newRedirect.toUrl.trim(),
      hops: Math.max(2, newRedirect.hops),
      notes: newRedirect.notes.trim() || undefined,
    };
    const next = [...redirects, chain];
    await saveRedirectChains(next);
    setRedirects(next);
    setNewRedirect({ fromUrl: '', toUrl: '', hops: 2, notes: '' });
  };

  const removeRedirect = async (id: string) => {
    const next = redirects.filter((row) => row.id !== id);
    await saveRedirectChains(next);
    setRedirects(next);
  };

  return (
    <AdminPageShell
      title="SEO Technical Health"
      description="Canonical site health from GSC + GA4. PageSpeed CWV, redirects, and VPS stub logs are secondary."
    >
      <div className="space-y-6">
        {message && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {message}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AdminPanel>
            <div className="p-5">
              <p className="text-sm text-gray-500">Site health score</p>
              <p className="text-3xl font-bold text-gray-900">{healthScore}%</p>
              <p className="text-xs text-gray-400 mt-1">
                {canonical
                  ? `GSC + GA4 · ${new Date(canonical.refreshedAt).toLocaleDateString()}`
                  : healthSourceLabel}
              </p>
            </div>
          </AdminPanel>
          <AdminPanel>
            <div className="p-5 flex items-start gap-3">
              <Search className="h-5 w-5 text-teal-600 mt-1" />
              <div>
                <p className="text-sm text-gray-500">GSC clicks (28d)</p>
                <p className="text-2xl font-bold">{(canonical?.gsc.clicks ?? 0).toLocaleString()}</p>
                <p className="text-xs text-gray-400">
                  {canonical
                    ? `${(canonical.gsc.ctr * 100).toFixed(1)}% CTR · pos ${canonical.gsc.position.toFixed(1)}`
                    : 'Refresh canonical health'}
                </p>
              </div>
            </div>
          </AdminPanel>
          <AdminPanel>
            <div className="p-5 flex items-start gap-3">
              <Activity className="h-5 w-5 text-blue-500 mt-1" />
              <div>
                <p className="text-sm text-gray-500">GA4 page views (28d)</p>
                <p className="text-2xl font-bold">{(canonical?.ga4.pageViews ?? 0).toLocaleString()}</p>
                <p className="text-xs text-gray-400">
                  {canonical?.ga4.organicSessions ?? 0} organic sessions · Firestore events
                </p>
              </div>
            </div>
          </AdminPanel>
          <AdminPanel>
            <div className="p-5 flex items-start gap-3">
              <Gauge className="h-5 w-5 text-orange-500 mt-1" />
              <div>
                <p className="text-sm text-gray-500">GSC / CWV issues</p>
                <p className="text-2xl font-bold">
                  {(canonical?.gsc.indexingIssues ?? 0) + (canonical?.pagespeed.cwvAlerts ?? cwvAlerts)}
                </p>
                <p className="text-xs text-gray-400">
                  {canonical?.gsc.sitemapErrors ?? 0} sitemap errors · {cwvAlerts} CWV alerts
                </p>
              </div>
            </div>
          </AdminPanel>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void handleRefreshCanonicalHealth()} disabled={refreshingCanonical}>
            {refreshingCanonical ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
            Refresh GSC + GA4 health
          </Button>
          {!gscConnected && (
            <p className="text-sm text-gray-500 self-center">
              <a href="/admin/seo-audit" className="text-teal-600 underline">Connect GSC</a> first.
            </p>
          )}
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Reload saved data
          </Button>
        </div>

        {audit?.vhost_mode === 'redirect_stub' && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            VPS Apache log is a redirect stub (scanner traffic only). Use GSC + GA4 above for real site health.
          </div>
        )}

        <Tabs defaultValue="gsc">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="gsc">GSC + GA4</TabsTrigger>
            <TabsTrigger value="cwv">Core Web Vitals</TabsTrigger>
            <TabsTrigger value="redirects">Redirects</TabsTrigger>
            <TabsTrigger value="vps">VPS stub log</TabsTrigger>
          </TabsList>

          <TabsContent value="vps" className="mt-4">
            <AdminPanel>
              <div className="p-4 border-b">
                <h3 className="font-semibold flex items-center gap-2">
                  <Link2Off className="h-4 w-4" /> VPS Apache 404s (secondary)
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Scanner traffic on the VPS redirect stub — not canonical site traffic.
                </p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>URL</TableHead>
                    <TableHead className="w-24">Hits</TableHead>
                    <TableHead className="w-40">Resolution</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {brokenLinks.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-gray-500 py-8">
                        No audit data. Run the Apache log uploader on the VPS.
                      </TableCell>
                    </TableRow>
                  )}
                  {brokenLinks.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs break-all">{row.url}</TableCell>
                      <TableCell>{row.hits.toLocaleString()}</TableCell>
                      <TableCell>
                        {row.id === 'summary' ? (
                          <Badge variant="outline">Run audit script</Badge>
                        ) : (
                          <Select
                            value={row.resolution}
                            onValueChange={(v) => void handleResolutionChange(row, v as BrokenLinkResolution)}
                            disabled={savingRow === row.url}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">Open</SelectItem>
                              <SelectItem value="fixed">Fixed</SelectItem>
                              <SelectItem value="redirect">Redirect added</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AdminPanel>
          </TabsContent>

          <TabsContent value="cwv" className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => void handleRunPageSpeed()} disabled={runningPsi || !PSI_KEY}>
                {runningPsi ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Activity className="h-4 w-4 mr-2" />}
                Run PageSpeed check
              </Button>
              {!PSI_KEY && (
                <p className="text-sm text-amber-700">
                  Add <code>VITE_PAGESPEED_API_KEY</code> to enable automated checks.
                </p>
              )}
            </div>
            <AdminPanel>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>URL</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Desktop</TableHead>
                    <TableHead>LCP</TableHead>
                    <TableHead>CLS</TableHead>
                    <TableHead>INP</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!pagespeed?.length && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                        No PageSpeed snapshot yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {(pagespeed ?? []).map((row) => (
                    <TableRow key={row.url}>
                      <TableCell className="font-mono text-xs max-w-[200px] truncate">{row.url}</TableCell>
                      <TableCell>{row.mobileScore ?? '—'}</TableCell>
                      <TableCell>{row.desktopScore ?? '—'}</TableCell>
                      <TableCell>{row.lcpSeconds != null ? `${row.lcpSeconds.toFixed(2)}s` : '—'}</TableCell>
                      <TableCell>{row.cls != null ? row.cls.toFixed(3) : '—'}</TableCell>
                      <TableCell>{row.inpMs != null ? `${Math.round(row.inpMs)}ms` : '—'}</TableCell>
                      <TableCell>
                        {row.alerts.length === 0 ? (
                          <Badge className="bg-emerald-100 text-emerald-800">Pass</Badge>
                        ) : (
                          <Badge variant="destructive">{row.alerts.length} alert(s)</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AdminPanel>
          </TabsContent>

          <TabsContent value="redirects" className="mt-4 space-y-4">
            <AdminPanel>
              <div className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="lg:col-span-2">
                  <Label>From URL</Label>
                  <Input
                    value={newRedirect.fromUrl}
                    onChange={(e) => setNewRedirect((p) => ({ ...p, fromUrl: e.target.value }))}
                    placeholder="/old-path"
                  />
                </div>
                <div className="lg:col-span-2">
                  <Label>To URL</Label>
                  <Input
                    value={newRedirect.toUrl}
                    onChange={(e) => setNewRedirect((p) => ({ ...p, toUrl: e.target.value }))}
                    placeholder="/new-path"
                  />
                </div>
                <div>
                  <Label>Hops</Label>
                  <Input
                    type="number"
                    min={2}
                    value={newRedirect.hops}
                    onChange={(e) => setNewRedirect((p) => ({ ...p, hops: Number(e.target.value) || 2 }))}
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-4">
                  <Label>Notes</Label>
                  <Input
                    value={newRedirect.notes}
                    onChange={(e) => setNewRedirect((p) => ({ ...p, notes: e.target.value }))}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={() => void addRedirectChain()}>Add chain</Button>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Hops</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {redirects.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500 py-6">
                        No redirect chains logged. Add chains with 2+ hops to track fixes.
                      </TableCell>
                    </TableRow>
                  )}
                  {redirects.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.fromUrl}</TableCell>
                      <TableCell className="font-mono text-xs">{row.toUrl}</TableCell>
                      <TableCell>
                        <Badge variant={row.hops >= 2 ? 'destructive' : 'outline'}>{row.hops}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">{row.notes ?? '—'}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => void removeRedirect(row.id)}>
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AdminPanel>
          </TabsContent>

          <TabsContent value="gsc" className="mt-4 space-y-4">
            <AdminPanel>
              <div className="p-4 border-b">
                <h3 className="font-semibold">Phase 2 — GSC sitemap + URL inspection</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Resubmits <code className="text-xs">/sitemap.xml</code>, pings Google/Bing, inspects all{' '}
                  <code className="text-xs">/solutions/*</code> pillars and published <code className="text-xs">/pages/*</code>.
                </p>
              </div>
              <div className="p-4 flex flex-wrap items-center gap-3">
                <Button onClick={() => void handleRunPhase2()} disabled={runningPhase2}>
                  {runningPhase2 ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                  Run Phase 2 GSC
                </Button>
                {!gscConnected && (
                  <span className="text-sm text-gray-500">
                    <a href="/admin/seo-audit" className="text-teal-600 underline">Connect GSC</a> first (~30s run).
                  </span>
                )}
                {phase2 && (
                  <span className="text-sm text-gray-600">
                    Last run {new Date(phase2.ranAt).toLocaleString()} · {phase2.passCount}/{phase2.inspections.length} PASS
                  </span>
                )}
              </div>
              {phase2 && (
                <div className="px-4 pb-4 text-xs text-gray-500 space-y-1">
                  <p>Sitemap: {phase2.sitemapSubmitted ? '✓ submitted' : `✗ ${phase2.sitemapSubmitDetail}`}</p>
                  <p>Ping: {phase2.sitemapPing?.success ? '✓ Google/Bing ping sent' : phase2.sitemapPing?.message ?? '—'}</p>
                  <p>{phase2.inspectUrls.length} URLs inspected (solutions + programmatic pages)</p>
                </div>
              )}
            </AdminPanel>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void handleRunGscInspection()} disabled={runningGsc}>
                {runningGsc ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                Quick inspect (6 URLs)
              </Button>
            </div>

            <AdminPanel>
              <div className="p-4 border-b font-semibold">Sitemaps</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Path</TableHead>
                    <TableHead>Warnings</TableHead>
                    <TableHead>Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gscSitemaps.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-gray-500 py-6">
                        Connect GSC and refresh to load sitemap status.
                      </TableCell>
                    </TableRow>
                  )}
                  {gscSitemaps.map((row) => (
                    <TableRow key={row.path}>
                      <TableCell className="font-mono text-xs break-all">{row.path}</TableCell>
                      <TableCell>{row.warnings}</TableCell>
                      <TableCell>
                        {row.errors > 0 ? (
                          <Badge variant="destructive">{row.errors}</Badge>
                        ) : (
                          row.errors
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AdminPanel>

            <AdminPanel>
              <div className="p-4 border-b font-semibold">URL index status</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>URL</TableHead>
                    <TableHead>Verdict</TableHead>
                    <TableHead>Coverage</TableHead>
                    <TableHead>Indexing</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gscInspections.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-gray-500 py-6">
                        Run inspection to check homepage and solution pillars.
                      </TableCell>
                    </TableRow>
                  )}
                  {gscInspections.map((row) => (
                    <TableRow key={row.url}>
                      <TableCell className="font-mono text-xs max-w-[220px] truncate">{row.url}</TableCell>
                      <TableCell>
                        <Badge variant={row.verdict === 'PASS' ? 'outline' : 'destructive'}>{row.verdict}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{row.coverageState}</TableCell>
                      <TableCell className="text-xs">{row.indexingState}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AdminPanel>
          </TabsContent>
        </Tabs>
      </div>
    </AdminPageShell>
  );
};

export default AdminSEOTechnical;
