/**
 * AdminSEOAudit.tsx
 * ─────────────────
 * SEO Audit Dashboard for grabio.space
 * - Google Search Console data via OAuth 2.0 (clicks, impressions, CTR, position)
 * - Firestore seo_events data (page views, CTA clicks, leads)
 *
 * Auth flow: user clicks "Connect Search Console" → Google OAuth popup →
 * access token stored in sessionStorage → GSC API calls made client-side.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  limit,
} from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Search,
  MousePointerClick,
  Eye,
  BarChart2,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  Info,
  LogIn,
  LogOut,
  Mail,
  Globe,
} from 'lucide-react';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';

// ─── Config ───────────────────────────────────────────────────────────────────

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
const GSC_PROPERTY     = import.meta.env.VITE_GSC_PROPERTY as string || 'https://www.grabio.space/';
const GSC_SCOPE        = 'https://www.googleapis.com/auth/webmasters.readonly';
const TOKEN_KEY        = 'grabio_gsc_token';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GSCRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface GSCResponse {
  rows?: GSCRow[];
}

interface KeywordRow {
  keyword: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface PageRow {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface DailyRow {
  date: string;
  clicks: number;
  impressions: number;
  views: number;
  leads: number;
}

interface FirestoreStats {
  totalViews: number;
  uniqueVisitors: number;
  ctaClicks: number;
  totalLeads: number;
  dailySeries: Record<string, { views: number; leads: number }>;
}

// ─── OAuth helpers ────────────────────────────────────────────────────────────

function getStoredToken(): string | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const { token, expires } = JSON.parse(raw) as { token: string; expires: number };
    if (Date.now() > expires) {
      sessionStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

function storeToken(token: string, expiresIn: number): void {
  sessionStorage.setItem(TOKEN_KEY, JSON.stringify({
    token,
    expires: Date.now() + expiresIn * 1000 - 60_000,
  }));
}

function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

function launchOAuth(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!GOOGLE_CLIENT_ID) {
      reject(new Error('VITE_GOOGLE_CLIENT_ID not set in .env'));
      return;
    }
    const redirectUri = `${window.location.origin}/auth/gsc-callback`;
    const params = new URLSearchParams({
      client_id:     GOOGLE_CLIENT_ID,
      redirect_uri:  redirectUri,
      response_type: 'token',
      scope:         GSC_SCOPE,
      prompt:        'select_account',
    });

    const popup = window.open(
      `https://accounts.google.com/o/oauth2/auth?${params}`,
      'gsc_oauth',
      'width=520,height=640,left=200,top=80',
    );
    if (!popup) {
      reject(new Error('Popup was blocked by the browser. Allow popups for this site and try again.'));
      return;
    }

    // Listen for postMessage from GscCallback page
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (!event.data || event.data.type !== 'GSC_TOKEN' && event.data.type !== 'GSC_ERROR') return;
      cleanup();
      if (event.data.type === 'GSC_TOKEN') {
        storeToken(event.data.token, event.data.expiresIn);
        resolve(event.data.token);
      } else {
        reject(new Error(event.data.error || 'Authentication failed'));
      }
    };

    // Fallback: detect popup closed without completing auth
    const closedCheck = setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error('Sign-in window was closed before completing. Try again.'));
      }
    }, 800);

    function cleanup() {
      window.removeEventListener('message', onMessage);
      clearInterval(closedCheck);
      if (!popup.closed) popup.close();
    }

    window.addEventListener('message', onMessage);
  });
}

// ─── GSC API call ─────────────────────────────────────────────────────────────

async function fetchGSC(
  token: string,
  dimension: string[],
  startDate: string,
  endDate: string,
  rowLimit = 100,
): Promise<GSCRow[]> {
  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_PROPERTY)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions: dimension,
        rowLimit,
        startRow: 0,
      }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } }).error?.message || `GSC API error ${res.status}`);
  }
  const data: GSCResponse = await res.json();
  return data.rows || [];
}

// ─── Firestore helpers ────────────────────────────────────────────────────────

async function fetchFirestoreStats(startDate: string, endDate: string): Promise<FirestoreStats> {
  const db = getFirestore();
  const startTs = Timestamp.fromDate(new Date(startDate + 'T00:00:00Z'));
  const endTs   = Timestamp.fromDate(new Date(endDate   + 'T23:59:59Z'));

  const eventsQ = query(
    collection(db, 'seo_events'),
    where('created_at', '>=', startTs),
    where('created_at', '<=', endTs),
    limit(10000),
  );
  const leadsQ = query(
    collection(db, 'seo_leads'),
    where('created_at', '>=', startTs),
    where('created_at', '<=', endTs),
    limit(500),
  );

  const [eventsSnap, leadsSnap] = await Promise.all([
    getDocs(eventsQ),
    getDocs(leadsQ),
  ]);

  let totalViews = 0;
  const sessionsSeen = new Set<string>();
  let ctaClicks = 0;
  const dailySeries: Record<string, { views: number; leads: number }> = {};

  eventsSnap.forEach((doc) => {
    const d = doc.data();
    const dayKey = d.created_at?.toDate().toISOString().split('T')[0] || '';
    if (!dailySeries[dayKey]) dailySeries[dayKey] = { views: 0, leads: 0 };
    if (d.event_name === 'page_view') {
      totalViews++;
      dailySeries[dayKey].views++;
      sessionsSeen.add(d.session_id);
    }
    if (d.event_name === 'cta_click') ctaClicks++;
  });

  let totalLeads = 0;
  leadsSnap.forEach((doc) => {
    const d = doc.data();
    totalLeads++;
    const dayKey = d.created_at?.toDate().toISOString().split('T')[0] || '';
    if (!dailySeries[dayKey]) dailySeries[dayKey] = { views: 0, leads: 0 };
    dailySeries[dayKey].leads++;
  });

  return {
    totalViews,
    uniqueVisitors: sessionsSeen.size,
    ctaClicks,
    totalLeads,
    dailySeries,
  };
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function daysBack(n: number): { start: string; end: string } {
  const end   = new Date();
  const start = new Date(Date.now() - n * 86400 * 1000);
  return {
    start: start.toISOString().split('T')[0],
    end:   end.toISOString().split('T')[0],
  };
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return `${String(d.getUTCDate()).padStart(2,'0')}/${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()]}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: number | null;
  accent?: string;
}
const StatCard: React.FC<StatCardProps> = ({ title, value, sub, icon: Icon, trend, accent = 'text-teal-600' }) => (
  <AdminPanel>
    <CardContent className="p-5 flex items-start gap-4">
      <div className={`rounded-full p-2.5 bg-gray-100 flex-shrink-0 ${accent}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-gray-500 truncate">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        {trend != null && (
          <p className={`text-xs mt-0.5 flex items-center gap-1 ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(trend)}% vs prev period
          </p>
        )}
      </div>
    </CardContent>
  </AdminPanel>
);

// ─── Connect screen ───────────────────────────────────────────────────────────

const ConnectScreen: React.FC<{ onConnect: () => void; loading: boolean; error: string }> = ({
  onConnect, loading, error,
}) => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
    <div className="bg-teal-50 rounded-full p-6">
      <Search className="h-12 w-12 text-teal-600" />
    </div>
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Connect Google Search Console</h2>
      <p className="text-gray-500 max-w-md">
        Sign in with the Google account that has access to{' '}
        <span className="font-mono text-teal-700 text-sm">{GSC_PROPERTY}</span>{' '}
        in Search Console to load live SEO data.
      </p>
    </div>
    {error && (
      <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm max-w-md">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        {error}
      </div>
    )}
    <Button size="lg" onClick={onConnect} disabled={loading} className="gap-2 bg-teal-600 hover:bg-teal-700">
      <LogIn className="h-4 w-4" />
      {loading ? 'Connecting…' : 'Connect Search Console'}
    </Button>
    <div className="grid grid-cols-3 gap-4 text-sm text-gray-500 max-w-lg">
      {[
        { icon: Search,           label: 'Keywords & Rankings' },
        { icon: MousePointerClick,label: 'Clicks & Impressions' },
        { icon: BarChart2,        label: 'Page Performance' },
      ].map(({ icon: I, label }) => (
        <div key={label} className="flex flex-col items-center gap-2 p-3 bg-gray-50 rounded-lg">
          <I className="h-5 w-5 text-teal-600" />
          <span className="text-center leading-tight">{label}</span>
        </div>
      ))}
    </div>
    <p className="text-xs text-gray-400 max-w-sm">
      Read-only access. Your credentials never leave your browser.
    </p>
  </div>
);

// ─── Main ─────────────────────────────────────────────────────────────────────

const AdminSEOAudit: React.FC = () => {
  const [token, setToken]           = useState<string | null>(getStoredToken);
  const [connecting, setConnecting] = useState(false);
  const [oauthError, setOauthError] = useState('');
  const [timeRange, setTimeRange]   = useState('28d');
  const [loading, setLoading]       = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // GSC data
  const [keywords, setKeywords]   = useState<KeywordRow[]>([]);
  const [pages, setPages]         = useState<PageRow[]>([]);
  const [dailyGSC, setDailyGSC]   = useState<DailyRow[]>([]);
  const [totals, setTotals]       = useState({ clicks: 0, impressions: 0, avgCtr: 0, avgPos: 0 });

  // Firestore data
  const [fsStats, setFsStats]     = useState<FirestoreStats | null>(null);

  const loadData = useCallback(async (tok: string) => {
    setLoading(true);
    try {
      const days = timeRange === '7d' ? 7 : timeRange === '28d' ? 28 : timeRange === '90d' ? 90 : 180;
      const { start, end } = daysBack(days);

      const [kwRows, pageRows, dateRows, fs] = await Promise.all([
        fetchGSC(tok, ['query'],      start, end, 100),
        fetchGSC(tok, ['page'],       start, end, 100),
        fetchGSC(tok, ['date'],       start, end, 500),
        fetchFirestoreStats(start, end),
      ]);

      // Keywords
      const kws: KeywordRow[] = kwRows.map((r) => ({
        keyword:     r.keys[0],
        clicks:      r.clicks,
        impressions: r.impressions,
        ctr:         Math.round(r.ctr * 1000) / 10,
        position:    Math.round(r.position * 10) / 10,
      }));

      // Pages
      const pgs: PageRow[] = pageRows.map((r) => ({
        page:        r.keys[0].replace(GSC_PROPERTY.replace(/\/$/, ''), '') || '/',
        clicks:      r.clicks,
        impressions: r.impressions,
        ctr:         Math.round(r.ctr * 1000) / 10,
        position:    Math.round(r.position * 10) / 10,
      }));

      // Daily series — merge GSC + Firestore
      const daily: DailyRow[] = dateRows.map((r) => {
        const isoDate = r.keys[0];
        const fsDay   = fs.dailySeries[isoDate] || { views: 0, leads: 0 };
        return {
          date:        formatDate(isoDate),
          clicks:      r.clicks,
          impressions: r.impressions,
          views:       fsDay.views,
          leads:       fsDay.leads,
        };
      }).sort((a, b) => a.date.localeCompare(b.date));

      // Totals
      const totalClicks      = kws.reduce((s, k) => s + k.clicks, 0);
      const totalImpressions = kws.reduce((s, k) => s + k.impressions, 0);
      const avgCtr = totalImpressions > 0
        ? Math.round((totalClicks / totalImpressions) * 1000) / 10
        : 0;
      const avgPos = kws.length > 0
        ? Math.round((kws.reduce((s, k) => s + k.position, 0) / kws.length) * 10) / 10
        : 0;

      setKeywords(kws);
      setPages(pgs);
      setDailyGSC(daily);
      setTotals({ clicks: totalClicks, impressions: totalImpressions, avgCtr, avgPos });
      setFsStats(fs);
      setLastRefresh(new Date());
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg.includes('401') || msg.includes('403')) {
        clearToken();
        setToken(null);
      }
      console.error('[SEOAudit]', err);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    if (token) loadData(token);
  }, [token, loadData]);

  const handleConnect = async () => {
    setConnecting(true);
    setOauthError('');
    try {
      const tok = await launchOAuth();
      setToken(tok);
    } catch (err) {
      setOauthError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    clearToken();
    setToken(null);
    setKeywords([]);
    setPages([]);
    setDailyGSC([]);
    setFsStats(null);
  };

  // ── Summary insight banner ─────────────────────────────────────────────────
  const top3Impression = pages.slice(0, 3);
  const avgPosition = totals.avgPos;
  const positionColor = avgPosition <= 10 ? 'text-emerald-600' : avgPosition <= 20 ? 'text-amber-600' : 'text-red-500';

  return (
    <AdminPageShell
      title="SEO Audit Report"
      description="Google Search Console + Firestore — grabio.space"
      className="max-w-7xl mx-auto px-4 py-6"
      actions={
        token ? (
          <div className="flex items-center gap-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="28d">Last 28 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="180d">Last 6 months</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => loadData(token)} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleDisconnect} title="Disconnect GSC">
              <LogOut className="h-4 w-4 text-gray-400" />
            </Button>
          </div>
        ) : undefined
      }
    >
        {/* Not connected */}
        {!token && (
          <ConnectScreen onConnect={handleConnect} loading={connecting} error={oauthError} />
        )}

        {/* Connected — dashboard */}
        {token && (
          <>
            {/* Insight banner */}
            {!loading && totals.clicks > 0 && (
              <div className="bg-teal-900 text-white rounded-xl p-5 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-teal-300 text-sm font-medium uppercase tracking-wide mb-1">SEO Audit Finding</p>
                    <h2 className="text-xl font-bold leading-snug">
                      {totals.impressions.toLocaleString()} impressions in the selected period.{' '}
                      Avg. position{' '}
                      <span className={avgPosition <= 10 ? 'text-emerald-400' : 'text-amber-400'}>
                        #{avgPosition}
                      </span>
                      {avgPosition <= 10
                        ? ' — you are on page 1. Protect it.'
                        : avgPosition <= 20
                        ? ' — page 2. Push these keywords to page 1.'
                        : ' — too deep. Needs content & link work.'}
                    </h2>
                  </div>
                  <Badge className="bg-teal-700 text-white flex-shrink-0">Live</Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  {[
                    { label: 'Total Clicks',       value: totals.clicks.toLocaleString() },
                    { label: 'Total Impressions',  value: totals.impressions.toLocaleString() },
                    { label: 'Avg. CTR',           value: `${totals.avgCtr}%` },
                    { label: 'Avg. Position',      value: `#${totals.avgPos}` },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-teal-800 rounded-lg px-3 py-2.5">
                      <p className="text-teal-300 text-xs">{label}</p>
                      <p className="text-white text-lg font-bold">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard title="Organic Clicks"      value={totals.clicks.toLocaleString()}       sub="From search results"        icon={MousePointerClick} accent="text-teal-600" />
              <StatCard title="Impressions"          value={totals.impressions.toLocaleString()}  sub="Times shown in Google"      icon={Eye}               accent="text-blue-600" />
              <StatCard title="Page Views (Site)"    value={fsStats?.totalViews.toLocaleString() ?? '—'}  sub="Tracked on-site"   icon={Globe}             accent="text-purple-600" />
              <StatCard title="Leads Captured"       value={fsStats?.totalLeads.toLocaleString() ?? '—'} sub="Contact form submissions" icon={Mail}          accent="text-amber-600" />
            </div>

            {/* Tabs */}
            <Tabs defaultValue="traffic">
              <TabsList>
                <TabsTrigger value="traffic">Traffic Trend</TabsTrigger>
                <TabsTrigger value="keywords">Keywords</TabsTrigger>
                <TabsTrigger value="pages">Pages</TabsTrigger>
                <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
              </TabsList>

              {/* ── Traffic Trend ─────────────────────────────────── */}
              <TabsContent value="traffic" className="space-y-6 mt-4">
                <AdminPanel>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center justify-between">
                      <span>Organic Traffic Trend — Clicks & Impressions</span>
                      <span className="text-xs text-gray-400 font-normal">
                        {dailyGSC.length} days · avg {dailyGSC.length > 0 ? Math.round(totals.clicks / dailyGSC.length) : 0} clicks/day
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="h-64 flex items-center justify-center text-gray-400">Loading…</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={dailyGSC} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                          <defs>
                            <linearGradient id="clicksGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="impGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                          <YAxis yAxisId="left"  tick={{ fontSize: 10 }} />
                          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Legend />
                          <Area yAxisId="left"  type="monotone" dataKey="clicks"      name="Clicks"      stroke="#0d9488" fill="url(#clicksGrad)" strokeWidth={2} dot={false} />
                          <Area yAxisId="right" type="monotone" dataKey="impressions" name="Impressions"  stroke="#0ea5e9" fill="url(#impGrad)"    strokeWidth={2} dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </AdminPanel>

                {/* On-site behaviour */}
                {fsStats && fsStats.totalViews > 0 && (
                  <AdminPanel>
                    <CardHeader>
                      <CardTitle className="text-base">On-Site Behaviour — Page Views & Leads</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={dailyGSC} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                          <defs>
                            <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                          <Tooltip />
                          <Legend />
                          <Area type="monotone" dataKey="views" name="Page Views" stroke="#8b5cf6" fill="url(#viewsGrad)" strokeWidth={2} dot={false} />
                          <Bar  dataKey="leads" name="Leads"      fill="#f59e0b" radius={[2,2,0,0]} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </AdminPanel>
                )}
              </TabsContent>

              {/* ── Keywords ──────────────────────────────────────── */}
              <TabsContent value="keywords" className="mt-4">
                <AdminPanel>
                  <CardHeader>
                    <CardTitle className="text-base">Top Ranking Keywords</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="h-32 flex items-center justify-center text-gray-400">Loading…</div>
                    ) : keywords.length === 0 ? (
                      <p className="text-sm text-gray-400 py-4">No keyword data yet — GSC may take a few days to populate.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-gray-500 text-left">
                              <th className="pb-2 font-medium">#</th>
                              <th className="pb-2 font-medium">Keyword</th>
                              <th className="pb-2 font-medium text-right">Clicks</th>
                              <th className="pb-2 font-medium text-right">Impr.</th>
                              <th className="pb-2 font-medium text-right">CTR</th>
                              <th className="pb-2 font-medium text-right">Position</th>
                            </tr>
                          </thead>
                          <tbody>
                            {keywords.map((kw, i) => (
                              <tr key={kw.keyword} className="border-b last:border-0 hover:bg-gray-50">
                                <td className="py-2.5 text-gray-400 text-xs">{i + 1}</td>
                                <td className="py-2.5 font-medium text-gray-900 max-w-[280px] truncate">{kw.keyword}</td>
                                <td className="py-2.5 text-right">{kw.clicks.toLocaleString()}</td>
                                <td className="py-2.5 text-right text-gray-500">{kw.impressions.toLocaleString()}</td>
                                <td className="py-2.5 text-right">{kw.ctr}%</td>
                                <td className="py-2.5 text-right">
                                  <Badge
                                    variant={kw.position <= 10 ? 'default' : kw.position <= 20 ? 'secondary' : 'outline'}
                                    className="text-xs"
                                  >
                                    #{kw.position}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </AdminPanel>
              </TabsContent>

              {/* ── Pages ─────────────────────────────────────────── */}
              <TabsContent value="pages" className="space-y-6 mt-4">
                <AdminPanel>
                  <CardHeader>
                    <CardTitle className="text-base">Top Crawled Pages — Ranking Signal Map</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="h-32 flex items-center justify-center text-gray-400">Loading…</div>
                    ) : pages.length === 0 ? (
                      <p className="text-sm text-gray-400 py-4">No page data yet.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-gray-500 text-left">
                              <th className="pb-2 font-medium">#</th>
                              <th className="pb-2 font-medium">Page URL</th>
                              <th className="pb-2 font-medium text-right">Clicks</th>
                              <th className="pb-2 font-medium text-right">Impr.</th>
                              <th className="pb-2 font-medium text-right">CTR</th>
                              <th className="pb-2 font-medium text-right">Position</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pages.map((pg, i) => (
                              <tr key={pg.page} className="border-b last:border-0 hover:bg-gray-50">
                                <td className="py-2.5 text-gray-400 text-xs">{i + 1}</td>
                                <td className="py-2.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-teal-700 text-xs truncate max-w-[240px]">{pg.page}</span>
                                    <a
                                      href={`${GSC_PROPERTY.replace(/\/$/, '')}${pg.page}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <ExternalLink className="h-3 w-3 text-gray-400 hover:text-teal-600" />
                                    </a>
                                  </div>
                                </td>
                                <td className="py-2.5 text-right">{pg.clicks.toLocaleString()}</td>
                                <td className="py-2.5 text-right text-gray-500">{pg.impressions.toLocaleString()}</td>
                                <td className="py-2.5 text-right">{pg.ctr}%</td>
                                <td className="py-2.5 text-right">
                                  <Badge
                                    variant={pg.position <= 10 ? 'default' : pg.position <= 20 ? 'secondary' : 'outline'}
                                    className="text-xs"
                                  >
                                    #{pg.position}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </AdminPanel>

                {/* Bar chart */}
                {pages.length > 0 && (
                  <AdminPanel>
                    <CardHeader>
                      <CardTitle className="text-base">Clicks by Page</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart
                          data={pages.slice(0, 10)}
                          layout="vertical"
                          margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 11 }} />
                          <YAxis type="category" dataKey="page" width={130} tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Bar dataKey="clicks" name="Clicks" fill="#0d9488" radius={[0,4,4,0]} />
                          <Bar dataKey="impressions" name="Impressions" fill="#0ea5e9" radius={[0,4,4,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </AdminPanel>
                )}
              </TabsContent>

              {/* ── Opportunities ─────────────────────────────────── */}
              <TabsContent value="opportunities" className="mt-4 space-y-4">
                <AdminPanel>
                  <CardHeader>
                    <CardTitle className="text-base">Ranking Opportunities — Action Plan</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {loading ? (
                      <div className="h-32 flex items-center justify-center text-gray-400">Analysing…</div>
                    ) : (
                      <>
                        {/* High impressions, low clicks — CTR opportunity */}
                        {(() => {
                          const lowCtr = keywords.filter(k => k.impressions >= 50 && k.ctr < 2).slice(0, 5);
                          if (lowCtr.length === 0) return null;
                          return (
                            <div className="border rounded-lg p-4 space-y-3">
                              <div className="flex items-center gap-2">
                                <div className="bg-amber-100 text-amber-700 rounded-full p-1.5"><AlertTriangle className="h-4 w-4" /></div>
                                <div>
                                  <p className="font-semibold text-gray-900">Improve Title & Meta Description</p>
                                  <p className="text-xs text-gray-500">High impressions but low CTR — Google shows you but users don't click</p>
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                {lowCtr.map(k => (
                                  <div key={k.keyword} className="flex items-center justify-between text-sm bg-amber-50 rounded px-3 py-2">
                                    <span className="font-medium truncate max-w-[200px]">{k.keyword}</span>
                                    <div className="flex items-center gap-3 flex-shrink-0">
                                      <span className="text-gray-500">{k.impressions.toLocaleString()} impr.</span>
                                      <Badge variant="outline" className="text-xs text-amber-700 border-amber-300">CTR {k.ctr}%</Badge>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <p className="text-xs text-gray-500">Fix: rewrite title tags to include action verbs and power words. Match search intent.</p>
                            </div>
                          );
                        })()}

                        {/* Position 11–20 — page 2 opportunity */}
                        {(() => {
                          const page2 = keywords.filter(k => k.position > 10 && k.position <= 20 && k.impressions >= 20).slice(0, 5);
                          if (page2.length === 0) return null;
                          return (
                            <div className="border rounded-lg p-4 space-y-3">
                              <div className="flex items-center gap-2">
                                <div className="bg-blue-100 text-blue-700 rounded-full p-1.5"><TrendingUp className="h-4 w-4" /></div>
                                <div>
                                  <p className="font-semibold text-gray-900">Page 2 → Page 1 Push</p>
                                  <p className="text-xs text-gray-500">These keywords rank 11–20. A small push gets them to page 1 — highest ROI opportunity.</p>
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                {page2.map(k => (
                                  <div key={k.keyword} className="flex items-center justify-between text-sm bg-blue-50 rounded px-3 py-2">
                                    <span className="font-medium truncate max-w-[200px]">{k.keyword}</span>
                                    <div className="flex items-center gap-3 flex-shrink-0">
                                      <span className="text-gray-500">{k.impressions.toLocaleString()} impr.</span>
                                      <Badge variant="secondary" className="text-xs">#{k.position}</Badge>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <p className="text-xs text-gray-500">Fix: add internal links pointing to these pages. Strengthen content depth. Build 1–2 backlinks.</p>
                            </div>
                          );
                        })()}

                        {/* Good performers — protect them */}
                        {(() => {
                          const top = keywords.filter(k => k.position <= 5 && k.clicks >= 5).slice(0, 5);
                          if (top.length === 0) return null;
                          return (
                            <div className="border rounded-lg p-4 space-y-3">
                              <div className="flex items-center gap-2">
                                <div className="bg-emerald-100 text-emerald-700 rounded-full p-1.5"><CheckCircle className="h-4 w-4" /></div>
                                <div>
                                  <p className="font-semibold text-gray-900">Strong Performers — Protect These</p>
                                  <p className="text-xs text-gray-500">Top 5 positions — monitor weekly for drops and keep content fresh</p>
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                {top.map(k => (
                                  <div key={k.keyword} className="flex items-center justify-between text-sm bg-emerald-50 rounded px-3 py-2">
                                    <span className="font-medium truncate max-w-[200px]">{k.keyword}</span>
                                    <div className="flex items-center gap-3 flex-shrink-0">
                                      <span className="text-gray-500">{k.clicks} clicks</span>
                                      <Badge className="text-xs bg-emerald-600">#{k.position}</Badge>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}

                        {keywords.length === 0 && (
                          <div className="flex items-center gap-3 text-gray-500 bg-gray-50 rounded-lg p-4">
                            <Info className="h-5 w-5 text-gray-400 flex-shrink-0" />
                            <p className="text-sm">No keyword data available yet. GSC may take 2–3 days to populate after verifying the property.</p>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </AdminPanel>
              </TabsContent>
            </Tabs>
          </>
        )}
    </AdminPageShell>
  );
};

export default AdminSEOAudit;
