import React, { useState, useEffect, useCallback } from 'react';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  orderBy,
  limit,
} from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Eye,
  Users,
  MousePointerClick,
  Mail,
  TrendingUp,
  RefreshCw,
  Globe,
  Search,
  Share2,
  ArrowRight,
} from 'lucide-react';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SeoEvent {
  event_name: string;
  page_path: string;
  source: string;
  session_id: string;
  user_id: string | null;
  referrer: string | null;
  label: string | null;
  created_at: Timestamp;
}

interface SeoLead {
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  source_page?: string;
  source: string;
  session_id: string;
  created_at: Timestamp;
}

interface DailyPoint {
  date: string;
  views: number;
  uniques: number;
  cta: number;
  leads: number;
}

interface PageStat {
  page: string;
  views: number;
  cta: number;
  leads: number;
  conversion: number;
}

interface SourceStat {
  name: string;
  value: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const COLORS = ['#0d9488', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ef4444', '#10b981'];

function labelDate(ts: Timestamp): string {
  const d = ts.toDate();
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function buildDateRange(daysBack: number): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date(end.getTime() - daysBack * 24 * 60 * 60 * 1000);
  return { start, end };
}

function buildDailyBuckets(start: Date, end: Date): Record<string, DailyPoint> {
  const buckets: Record<string, DailyPoint> = {};
  const cursor = new Date(start);
  while (cursor <= end) {
    const key = `${cursor.getMonth() + 1}/${cursor.getDate()}`;
    buckets[key] = { date: key, views: 0, uniques: 0, cta: 0, leads: 0 };
    cursor.setDate(cursor.getDate() + 1);
  }
  return buckets;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, sub, icon: Icon, accent = 'text-teal-600' }) => (
  <AdminPanel>
    <CardContent className="p-5 flex items-start gap-4">
      <div className={`rounded-full p-2.5 bg-gray-100 ${accent}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </CardContent>
  </AdminPanel>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const AdminSEOAnalytics: React.FC = () => {
  const [timeRange, setTimeRange] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Aggregated data
  const [totalViews, setTotalViews] = useState(0);
  const [uniqueVisitors, setUniqueVisitors] = useState(0);
  const [ctaClicks, setCtaClicks] = useState(0);
  const [totalLeads, setTotalLeads] = useState(0);
  const [conversionRate, setConversionRate] = useState(0);
  const [dailyData, setDailyData] = useState<DailyPoint[]>([]);
  const [pageStats, setPageStats] = useState<PageStat[]>([]);
  const [sourceStats, setSourceStats] = useState<SourceStat[]>([]);
  const [recentLeads, setRecentLeads] = useState<(SeoLead & { id: string })[]>([]);
  const [funnelData, setFunnelData] = useState<{ name: string; value: number; pct: number }[]>([]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const db = getFirestore();
      const daysBack = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const { start, end } = buildDateRange(daysBack);
      const startTs = Timestamp.fromDate(start);
      const endTs = Timestamp.fromDate(end);

      // ── Fetch events ──────────────────────────────────────────────────────
      const eventsQ = query(
        collection(db, 'seo_events'),
        where('created_at', '>=', startTs),
        where('created_at', '<=', endTs),
        limit(10000)
      );
      const eventsSnap = await getDocs(eventsQ);
      const events: SeoEvent[] = [];
      eventsSnap.forEach((doc) => events.push(doc.data() as SeoEvent));

      // ── Fetch leads ───────────────────────────────────────────────────────
      const leadsQ = query(
        collection(db, 'seo_leads'),
        where('created_at', '>=', startTs),
        where('created_at', '<=', endTs),
        orderBy('created_at', 'desc'),
        limit(500)
      );
      const leadsSnap = await getDocs(leadsQ);
      const leads: (SeoLead & { id: string })[] = [];
      leadsSnap.forEach((doc) =>
        leads.push({ id: doc.id, ...(doc.data() as SeoLead) })
      );

      // ── Aggregate events ──────────────────────────────────────────────────
      const buckets = buildDailyBuckets(start, end);
      const sessionsSeen = new Set<string>();
      const pageMap: Record<string, { views: number; cta: number }> = {};
      const sourceMap: Record<string, number> = {};
      let views = 0;
      let ctas = 0;

      events.forEach((ev) => {
        if (!ev.created_at) return;
        const dayKey = labelDate(ev.created_at);
        if (!buckets[dayKey]) return;

        const page = ev.page_path || ev.page_url || '/';
        if (!pageMap[page]) pageMap[page] = { views: 0, cta: 0 };
        const src = ev.source || 'direct';
        sourceMap[src] = (sourceMap[src] || 0) + 1;

        if (ev.event_name === 'page_view') {
          views++;
          buckets[dayKey].views++;
          pageMap[page].views++;
          if (!sessionsSeen.has(ev.session_id)) {
            sessionsSeen.add(ev.session_id);
            buckets[dayKey].uniques++;
          }
        } else if (ev.event_name === 'cta_click') {
          ctas++;
          buckets[dayKey].cta++;
          pageMap[page].cta++;
        }
      });

      // Add leads to daily buckets and pageMap
      const leadsPerPage: Record<string, number> = {};
      leads.forEach((lead) => {
        if (!lead.created_at) return;
        const dayKey = labelDate(lead.created_at);
        if (buckets[dayKey]) buckets[dayKey].leads++;
        const sp = lead.source_page || '/';
        leadsPerPage[sp] = (leadsPerPage[sp] || 0) + 1;
      });

      // ── Format outputs ────────────────────────────────────────────────────
      const daily = Object.values(buckets).sort((a, b) =>
        a.date.localeCompare(b.date, undefined, { numeric: true })
      );

      const pages: PageStat[] = Object.entries(pageMap)
        .map(([page, stat]) => {
          const pageleads = leadsPerPage[page] || 0;
          return {
            page,
            views: stat.views,
            cta: stat.cta,
            leads: pageleads,
            conversion: stat.views > 0 ? Math.round((pageleads / stat.views) * 100 * 10) / 10 : 0,
          };
        })
        .sort((a, b) => b.views - a.views)
        .slice(0, 15);

      const sources: SourceStat[] = Object.entries(sourceMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      const totalLeadCount = leads.length;
      const uniqueCount = sessionsSeen.size;
      const conv = uniqueCount > 0 ? Math.round((totalLeadCount / uniqueCount) * 100 * 10) / 10 : 0;

      const topViews = views;
      const funnel = [
        { name: 'Page Views', value: topViews, pct: 100 },
        { name: 'CTA Clicks', value: ctas, pct: topViews > 0 ? Math.round((ctas / topViews) * 100) : 0 },
        { name: 'Leads', value: totalLeadCount, pct: topViews > 0 ? Math.round((totalLeadCount / topViews) * 100) : 0 },
      ];

      setTotalViews(views);
      setUniqueVisitors(uniqueCount);
      setCtaClicks(ctas);
      setTotalLeads(totalLeadCount);
      setConversionRate(conv);
      setDailyData(daily);
      setPageStats(pages);
      setSourceStats(sources);
      setRecentLeads(leads.slice(0, 20));
      setFunnelData(funnel);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('[AdminSEOAnalytics] fetch error', err);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Source icon helper ────────────────────────────────────────────────────
  const sourceIcon = (name: string) => {
    if (name === 'organic') return <Search className="h-3.5 w-3.5" />;
    if (name === 'direct') return <Globe className="h-3.5 w-3.5" />;
    return <Share2 className="h-3.5 w-3.5" />;
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <AdminPageShell
      title="SEO & Traffic Analytics"
      description={
        lastRefresh
          ? `Public site tracking — grabio.space · refreshed ${lastRefresh.toLocaleTimeString()}`
          : 'Public site tracking — grabio.space'
      }
      className="max-w-7xl mx-auto px-4 py-6"
      actions={(
        <>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </>
      )}
    >
        {/* Overview stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Page Views"
            value={totalViews.toLocaleString()}
            sub={`Last ${timeRange === '7d' ? '7' : timeRange === '30d' ? '30' : '90'} days`}
            icon={Eye}
            accent="text-teal-600"
          />
          <StatCard
            title="Unique Visitors"
            value={uniqueVisitors.toLocaleString()}
            sub="By session"
            icon={Users}
            accent="text-blue-600"
          />
          <StatCard
            title="CTA Clicks"
            value={ctaClicks.toLocaleString()}
            sub={totalViews > 0 ? `${Math.round((ctaClicks / totalViews) * 100)}% of views` : '—'}
            icon={MousePointerClick}
            accent="text-amber-600"
          />
          <StatCard
            title="Leads"
            value={totalLeads.toLocaleString()}
            sub={`${conversionRate}% conversion`}
            icon={Mail}
            accent="text-purple-600"
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="traffic">
          <TabsList className="mb-4">
            <TabsTrigger value="traffic">Traffic</TabsTrigger>
            <TabsTrigger value="pages">Pages</TabsTrigger>
            <TabsTrigger value="leads">Leads</TabsTrigger>
            <TabsTrigger value="funnel">Funnel</TabsTrigger>
          </TabsList>

          {/* ─── Traffic Tab ─────────────────────────────────────────── */}
          <TabsContent value="traffic" className="space-y-6">
            {/* Page views over time */}
            <AdminPanel>
              <CardHeader>
                <CardTitle className="text-base">Visitors Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-64 flex items-center justify-center text-gray-400">Loading…</div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={dailyData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                      <defs>
                        <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="uniqueGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="views"
                        name="Page Views"
                        stroke="#0d9488"
                        fill="url(#viewsGrad)"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Area
                        type="monotone"
                        dataKey="uniques"
                        name="Unique Visitors"
                        stroke="#0ea5e9"
                        fill="url(#uniqueGrad)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </AdminPanel>

            {/* Sources */}
            <div className="grid md:grid-cols-2 gap-6">
              <AdminPanel>
                <CardHeader>
                  <CardTitle className="text-base">Traffic Sources</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading || sourceStats.length === 0 ? (
                    <div className="h-56 flex items-center justify-center text-gray-400">
                      {loading ? 'Loading…' : 'No data yet'}
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={sourceStats}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ name, percent }) =>
                            `${name} ${Math.round((percent ?? 0) * 100)}%`
                          }
                          labelLine={false}
                        >
                          {sourceStats.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </AdminPanel>

              <AdminPanel>
                <CardHeader>
                  <CardTitle className="text-base">Source Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {sourceStats.length === 0 && !loading && (
                      <p className="text-sm text-gray-400">No data yet</p>
                    )}
                    {sourceStats.map((src, i) => {
                      const total = sourceStats.reduce((s, x) => s + x.value, 0);
                      const pct = total > 0 ? Math.round((src.value / total) * 100) : 0;
                      return (
                        <div key={src.name} className="flex items-center gap-3">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ background: COLORS[i % COLORS.length] }}
                          />
                          <div className="flex items-center gap-1.5 text-sm text-gray-700 flex-1">
                            {sourceIcon(src.name)}
                            <span className="capitalize">{src.name}</span>
                          </div>
                          <span className="text-sm font-medium text-gray-900">{src.value.toLocaleString()}</span>
                          <Badge variant="secondary" className="text-xs">{pct}%</Badge>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </AdminPanel>
            </div>
          </TabsContent>

          {/* ─── Pages Tab ───────────────────────────────────────────── */}
          <TabsContent value="pages" className="space-y-6">
            <AdminPanel>
              <CardHeader>
                <CardTitle className="text-base">Top Pages</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-32 flex items-center justify-center text-gray-400">Loading…</div>
                ) : pageStats.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4">No page data yet. Publish and visit public pages to start tracking.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-gray-500 text-left">
                          <th className="pb-2 font-medium">Page</th>
                          <th className="pb-2 font-medium text-right">Views</th>
                          <th className="pb-2 font-medium text-right">CTA</th>
                          <th className="pb-2 font-medium text-right">Leads</th>
                          <th className="pb-2 font-medium text-right">Conv. %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageStats.map((ps) => (
                          <tr key={ps.page} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="py-2.5 text-teal-700 font-mono text-xs truncate max-w-[200px]">
                              {ps.page}
                            </td>
                            <td className="py-2.5 text-right">{ps.views.toLocaleString()}</td>
                            <td className="py-2.5 text-right">{ps.cta}</td>
                            <td className="py-2.5 text-right">{ps.leads}</td>
                            <td className="py-2.5 text-right">
                              <Badge
                                variant={ps.conversion > 2 ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {ps.conversion}%
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

            {/* Bar chart of top pages */}
            {pageStats.length > 0 && (
              <AdminPanel>
                <CardHeader>
                  <CardTitle className="text-base">Views by Page</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={pageStats.slice(0, 8)}
                      layout="vertical"
                      margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="page"
                        width={120}
                        tick={{ fontSize: 10 }}
                      />
                      <Tooltip />
                      <Bar dataKey="views" name="Views" fill="#0d9488" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="cta" name="CTA Clicks" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </AdminPanel>
            )}
          </TabsContent>

          {/* ─── Leads Tab ───────────────────────────────────────────── */}
          <TabsContent value="leads" className="space-y-6">
            {/* Leads over time */}
            <AdminPanel>
              <CardHeader>
                <CardTitle className="text-base">Leads Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-64 flex items-center justify-center text-gray-400">Loading…</div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={dailyData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                      <defs>
                        <linearGradient id="leadsGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="leads"
                        name="Leads"
                        stroke="#8b5cf6"
                        fill="url(#leadsGrad)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </AdminPanel>

            {/* Recent leads list */}
            <AdminPanel>
              <CardHeader>
                <CardTitle className="text-base">Recent Leads</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-24 flex items-center justify-center text-gray-400">Loading…</div>
                ) : recentLeads.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4">No leads yet.</p>
                ) : (
                  <div className="space-y-3">
                    {recentLeads.map((lead) => (
                      <div
                        key={lead.id}
                        className="flex items-start justify-between gap-4 border-b pb-3 last:border-0"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {lead.name || '—'}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {lead.email ?? lead.phone ?? 'no contact info'}
                          </p>
                          {lead.source_page && (
                            <p className="text-xs text-teal-600 font-mono mt-0.5 truncate">
                              {lead.source_page}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <Badge variant="outline" className="text-xs capitalize">
                            {lead.source}
                          </Badge>
                          {lead.created_at && (
                            <span className="text-xs text-gray-400">
                              {lead.created_at.toDate().toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </AdminPanel>
          </TabsContent>

          {/* ─── Funnel Tab ──────────────────────────────────────────── */}
          <TabsContent value="funnel" className="space-y-6">
            <AdminPanel>
              <CardHeader>
                <CardTitle className="text-base">Conversion Funnel</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-40 flex items-center justify-center text-gray-400">Loading…</div>
                ) : (
                  <>
                    <div className="space-y-4 mb-8">
                      {funnelData.map((step, i) => (
                        <div key={step.name}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-700">{step.name}</span>
                            <span className="text-sm text-gray-500">
                              {step.value.toLocaleString()}{' '}
                              <span className="text-gray-400">({step.pct}%)</span>
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-5 overflow-hidden">
                            <div
                              className="h-full rounded-full flex items-center justify-center text-white text-xs font-medium transition-all duration-500"
                              style={{
                                width: `${Math.max(step.pct, 2)}%`,
                                background: COLORS[i],
                              }}
                            >
                              {step.pct > 10 ? `${step.pct}%` : ''}
                            </div>
                          </div>
                          {i < funnelData.length - 1 && (
                            <div className="flex items-center ml-2 mt-1">
                              <ArrowRight className="h-3 w-3 text-gray-300" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={funnelData} margin={{ top: 0, right: 10, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {funnelData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>

                    {/* Summary */}
                    <div className="mt-6 grid grid-cols-3 divide-x rounded-lg border bg-white overflow-hidden">
                      <div className="p-4 text-center">
                        <TrendingUp className="h-4 w-4 text-teal-600 mx-auto mb-1" />
                        <p className="text-xs text-gray-500">Views → CTA</p>
                        <p className="text-lg font-bold text-gray-900">
                          {funnelData[0]?.value > 0
                            ? `${Math.round((funnelData[1]?.value / funnelData[0]?.value) * 100)}%`
                            : '—'}
                        </p>
                      </div>
                      <div className="p-4 text-center">
                        <TrendingUp className="h-4 w-4 text-amber-500 mx-auto mb-1" />
                        <p className="text-xs text-gray-500">CTA → Lead</p>
                        <p className="text-lg font-bold text-gray-900">
                          {funnelData[1]?.value > 0
                            ? `${Math.round((funnelData[2]?.value / funnelData[1]?.value) * 100)}%`
                            : '—'}
                        </p>
                      </div>
                      <div className="p-4 text-center">
                        <TrendingUp className="h-4 w-4 text-purple-500 mx-auto mb-1" />
                        <p className="text-xs text-gray-500">Overall Conv.</p>
                        <p className="text-lg font-bold text-gray-900">{conversionRate}%</p>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </AdminPanel>
          </TabsContent>
        </Tabs>
    </AdminPageShell>
  );
};

export default AdminSEOAnalytics;
