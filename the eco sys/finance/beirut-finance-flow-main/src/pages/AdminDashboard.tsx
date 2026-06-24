import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  Activity, AlertTriangle, CheckCircle2, RefreshCw, FileText, Clock,
  TrendingUp, DollarSign, Users, FolderOpen, ExternalLink, Download
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend
} from "recharts";

import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

import { supabase } from "@/integrations/supabase/client";
import { useAppContext } from "@/context/AppContext";

// ---------- types ----------
type Invoice = {
  id: string;
  client_id: string | null;
  client_name: string;
  total: number | null;
  amount: number | null;
  date: string;
  created_at: string;
};

type Timesheet = {
  id: string;
  project_id: string | null;
  staff_name: string;
  hours: number;
  rate: number;
  is_billable: boolean | null;
  invoiced: boolean | null;
  needs_sync: boolean;
  invoice_id: string | null;
  updated_at: string;
};

type AuditLog = {
  id: string;
  invoice_id: string | null;
  timesheet_ids: string[];
  status: string;
  error: string | null;
  created_at: string;
};

type Project = {
  id: string;
  name: string;
  client_id: string | null;
  client_name: string | null;
};

// ---------- helpers ----------
const fmtMoney = (n: number) => `$${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const monthKey = (d: string) => {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
};
const dayKey = (d: string) => new Date(d).toISOString().slice(0, 10);

const PAGE_SIZE = 50;

const exportCSV = (filename: string, rows: Record<string, any>[]) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(","), ...rows.map(r => headers.map(h => escape(r[h])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

const AdminDashboard = () => {
  const { user, retryFailedTimesheets, currentUserRole, activeOrganizationId } = useAppContext();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [retrying, setRetrying] = useState(false);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // table filters
  const [tsFilter, setTsFilter] = useState<"all" | "uninvoiced" | "failed">("all");
  const [tsProject, setTsProject] = useState<string>("all");
  const [tsSearch, setTsSearch] = useState("");
  const [tsPage, setTsPage] = useState(1);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // ---------- data load ----------
  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [invRes, tsRes, auditRes, projRes] = await Promise.all([
        supabase.from("invoices").select("id,client_id,client_name,total,amount,date,created_at").order("date", { ascending: false }).limit(1000),
        supabase.from("timesheets").select("id,project_id,staff_name,hours,rate,is_billable,invoiced,needs_sync,invoice_id,updated_at").order("updated_at", { ascending: false }).limit(1000),
        supabase.from("psa_audit_logs").select("id,invoice_id,timesheet_ids,status,error,created_at").order("created_at", { ascending: false }).limit(500),
        supabase.from("projects").select("id,name,client_id,client_name"),
      ]);

      if (invRes.error) console.error("[Admin] invoices", invRes.error);
      if (tsRes.error) console.error("[Admin] timesheets", tsRes.error);
      if (auditRes.error) console.error("[Admin] audit", auditRes.error);
      if (projRes.error) console.error("[Admin] projects", projRes.error);

      setInvoices((invRes.data as Invoice[]) || []);
      setTimesheets((tsRes.data as Timesheet[]) || []);
      setAuditLogs((auditRes.data as AuditLog[]) || []);
      setProjects((projRes.data as Project[]) || []);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadAll(); }, [loadAll, refreshTick]);

  // auto refresh every 15s
  useEffect(() => {
    const t = setInterval(() => setRefreshTick(x => x + 1), 15000);
    return () => clearInterval(t);
  }, []);

  // realtime subscriptions
  useEffect(() => {
    const ch = supabase
      .channel("admin-psa")
      .on("postgres_changes", { event: "*", schema: "public", table: "timesheets" }, () => setRefreshTick(x => x + 1))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "psa_audit_logs" }, () => setRefreshTick(x => x + 1))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // ---------- derived metrics ----------
  const projectMap = useMemo(() => {
    const m = new Map<string, Project>();
    projects.forEach(p => m.set(p.id, p));
    return m;
  }, [projects]);

  const overview = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const totalInvoices = invoices.length;
    const monthInvoices = invoices.filter(i => new Date(i.date) >= monthStart).length;
    const totalRevenue = invoices.reduce((s, i) => s + Number(i.total ?? i.amount ?? 0), 0);
    const monthRevenue = invoices
      .filter(i => new Date(i.date) >= monthStart)
      .reduce((s, i) => s + Number(i.total ?? i.amount ?? 0), 0);

    const uninvoicedCount = timesheets.filter(t => !t.invoiced && t.is_billable !== false).length;
    const pendingSync = timesheets.filter(t => t.needs_sync).length;

    const successCount = auditLogs.filter(a => a.status === "success").length;
    const failureCount = auditLogs.filter(a => a.status !== "success").length;
    const totalLogs = successCount + failureCount;
    const failureRate = totalLogs > 0 ? (failureCount / totalLogs) * 100 : 0;

    return {
      totalInvoices, monthInvoices, totalRevenue, monthRevenue,
      uninvoicedCount, pendingSync, failureRate, successCount, failureCount, totalLogs
    };
  }, [invoices, timesheets, auditLogs]);

  // PSA health windows
  const psaHealth = useMemo(() => {
    const windowDays = (days: number) => {
      const cutoff = Date.now() - days * 86400000;
      const win = auditLogs.filter(a => new Date(a.created_at).getTime() >= cutoff);
      const ok = win.filter(a => a.status === "success").length;
      const tot = win.length;
      return { ok, fail: tot - ok, tot, rate: tot ? (ok / tot) * 100 : 0 };
    };
    const errMap = new Map<string, number>();
    auditLogs.forEach(a => {
      if (a.status !== "success" && a.error) {
        errMap.set(a.error, (errMap.get(a.error) || 0) + 1);
      }
    });
    const topError = [...errMap.entries()].sort((a, b) => b[1] - a[1])[0];

    return { d7: windowDays(7), d30: windowDays(30), topError };
  }, [auditLogs]);

  // success/failure over last 14 days
  const auditSeries = useMemo(() => {
    const days: Record<string, { date: string; success: number; failure: number }> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const k = dayKey(d.toISOString());
      days[k] = { date: k.slice(5), success: 0, failure: 0 };
    }
    auditLogs.forEach(a => {
      const k = dayKey(a.created_at);
      if (days[k]) {
        if (a.status === "success") days[k].success += 1;
        else days[k].failure += 1;
      }
    });
    return Object.values(days);
  }, [auditLogs]);

  // monthly revenue trend (last 6 months)
  const revenueTrend = useMemo(() => {
    const months: Record<string, { month: string; revenue: number; count: number }> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const k = monthKey(d.toISOString());
      months[k] = { month: k, revenue: 0, count: 0 };
    }
    invoices.forEach(i => {
      const k = monthKey(i.date);
      if (months[k]) {
        months[k].revenue += Number(i.total ?? i.amount ?? 0);
        months[k].count += 1;
      }
    });
    return Object.values(months);
  }, [invoices]);

  // top clients
  const topClients = useMemo(() => {
    const m = new Map<string, { name: string; revenue: number; count: number }>();
    invoices.forEach(i => {
      const key = i.client_name || "Unknown";
      const cur = m.get(key) || { name: key, revenue: 0, count: 0 };
      cur.revenue += Number(i.total ?? i.amount ?? 0);
      cur.count += 1;
      m.set(key, cur);
    });
    return [...m.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [invoices]);

  const avgInvoice = useMemo(() => {
    if (!invoices.length) return 0;
    return invoices.reduce((s, i) => s + Number(i.total ?? i.amount ?? 0), 0) / invoices.length;
  }, [invoices]);

  // project billing coverage
  const projectCoverage = useMemo(() => {
    const map = new Map<string, { project: Project; total: number; invoiced: number }>();
    timesheets.forEach(t => {
      if (!t.project_id || t.is_billable === false) return;
      const proj = projectMap.get(t.project_id);
      if (!proj) return;
      const cur = map.get(t.project_id) || { project: proj, total: 0, invoiced: 0 };
      cur.total += Number(t.hours || 0);
      if (t.invoiced) cur.invoiced += Number(t.hours || 0);
      map.set(t.project_id, cur);
    });
    return [...map.values()]
      .map(r => ({
        ...r,
        unpaid: Math.max(0, r.total - r.invoiced),
        coverage: r.total > 0 ? (r.invoiced / r.total) * 100 : 0,
      }))
      .sort((a, b) => a.coverage - b.coverage);
  }, [timesheets, projectMap]);

  // sync recovery groups
  const syncGroups = useMemo(() => {
    const groups: Record<string, { invoiceId: string; rows: Timesheet[]; lastUpdate: string }> = {};
    timesheets.filter(t => t.needs_sync).forEach(t => {
      const key = t.invoice_id || "unlinked";
      const g = groups[key] || { invoiceId: key, rows: [], lastUpdate: t.updated_at };
      g.rows.push(t);
      if (new Date(t.updated_at) > new Date(g.lastUpdate)) g.lastUpdate = t.updated_at;
      groups[key] = g;
    });
    return Object.values(groups);
  }, [timesheets]);

  // ---------- timesheet pipeline filter ----------
  const filteredTs = useMemo(() => {
    let rows = timesheets;
    if (tsFilter === "uninvoiced") rows = rows.filter(r => !r.invoiced);
    if (tsFilter === "failed") rows = rows.filter(r => r.needs_sync);
    if (tsProject !== "all") rows = rows.filter(r => r.project_id === tsProject);
    if (tsSearch.trim()) {
      const q = tsSearch.toLowerCase();
      rows = rows.filter(r =>
        r.staff_name?.toLowerCase().includes(q) ||
        (r.invoice_id || "").toLowerCase().includes(q) ||
        (projectMap.get(r.project_id || "")?.name || "").toLowerCase().includes(q) ||
        (projectMap.get(r.project_id || "")?.client_name || "").toLowerCase().includes(q)
      );
    }
    return rows;
  }, [timesheets, tsFilter, tsProject, tsSearch, projectMap]);

  const tsPageRows = filteredTs.slice((tsPage - 1) * PAGE_SIZE, tsPage * PAGE_SIZE);
  const tsTotalPages = Math.max(1, Math.ceil(filteredTs.length / PAGE_SIZE));

  // ---------- actions ----------
  const handleRetry = async () => {
    setRetrying(true);
    try {
      await retryFailedTimesheets();
      toast({ title: "Retry triggered", description: "Sync recovery executed." });
      setRefreshTick(x => x + 1);
    } catch (e: any) {
      toast({ title: "Retry failed", description: e?.message || "Unknown error", variant: "destructive" });
    } finally {
      setRetrying(false);
    }
  };

  // ---------- UI ----------
  // Hard role gate: must have an active org AND be owner/admin to render anything
  if (!activeOrganizationId) return <Navigate to="/" replace />;
  if (!currentUserRole) {
    return (
      <AppLayout onLogout={handleLogout}>
        <div className="p-8 text-sm text-muted-foreground">Verifying access…</div>
      </AppLayout>
    );
  }
  if (!["owner", "admin"].includes(currentUserRole)) {
    return <Navigate to="/" replace />;
  }

  return (
    <AppLayout onLogout={handleLogout}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6 text-indigo-600" /> Admin Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">PSA health, billing accuracy & operational debugging</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setRefreshTick(x => x + 1)} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button size="sm" onClick={handleRetry} disabled={retrying || overview.pendingSync === 0}>
              <RefreshCw className={`mr-2 h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
              Trigger Retry ({overview.pendingSync})
            </Button>
          </div>
        </div>

        {/* KPI ROW */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Kpi icon={<FileText className="h-4 w-4" />} label="Total Invoices" value={overview.totalInvoices.toString()} sub={`${overview.monthInvoices} this month`} />
          <Kpi icon={<DollarSign className="h-4 w-4" />} label="Total Revenue" value={fmtMoney(overview.totalRevenue)} sub={`${fmtMoney(overview.monthRevenue)} MTD`} />
          <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Avg Invoice" value={fmtMoney(avgInvoice)} />
          <Kpi icon={<Clock className="h-4 w-4" />} label="Uninvoiced TS" value={overview.uninvoicedCount.toString()} sub="billable, not linked" />
          <Kpi
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Pending Sync"
            value={overview.pendingSync.toString()}
            tone={overview.pendingSync > 0 ? "warn" : "ok"}
          />
          <Kpi
            icon={overview.failureRate > 0 ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            label="Failed Sync Rate"
            value={`${overview.failureRate.toFixed(1)}%`}
            sub={`${overview.failureCount}/${overview.totalLogs} ops`}
            tone={overview.failureRate > 5 ? "warn" : "ok"}
          />
        </div>

        {/* PSA HEALTH */}
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">PSA Sync Health (last 14 days)</CardTitle>
              <CardDescription>Successful vs failed link operations</CardDescription>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={auditSeries}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="success" stroke="hsl(142 71% 45%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="failure" stroke="hsl(0 72% 51%)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Health Summary</CardTitle>
              <CardDescription>Success rate windows</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <HealthRow label="Last 7 days" data={psaHealth.d7} />
              <HealthRow label="Last 30 days" data={psaHealth.d30} />
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-1">Most common failure</p>
                {psaHealth.topError ? (
                  <div>
                    <p className="text-sm font-medium truncate" title={psaHealth.topError[0]}>
                      {psaHealth.topError[0]}
                    </p>
                    <Badge variant="destructive" className="mt-1">{psaHealth.topError[1]} occurrences</Badge>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No failures recorded</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for the heavier sections */}
        <Tabs defaultValue="pipeline" className="w-full">
          <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full md:w-auto">
            <TabsTrigger value="pipeline">Timesheets</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="coverage">Coverage</TabsTrigger>
            <TabsTrigger value="recovery">Recovery</TabsTrigger>
          </TabsList>

          {/* PIPELINE */}
          <TabsContent value="pipeline" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Timesheet Pipeline</CardTitle>
                  <CardDescription>{filteredTs.length} rows · page {tsPage}/{tsTotalPages}</CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!filteredTs.length}
                  onClick={() => exportCSV(
                    `timesheets-${new Date().toISOString().slice(0,10)}.csv`,
                    filteredTs.map(r => {
                      const proj = r.project_id ? projectMap.get(r.project_id) : null;
                      return {
                        staff: r.staff_name,
                        project: proj?.name || "",
                        client: proj?.client_name || "",
                        hours: r.hours,
                        rate: r.rate,
                        status: r.needs_sync ? "failed_sync" : r.invoiced ? "invoiced" : "uninvoiced",
                        invoice_id: r.invoice_id || "",
                        updated_at: r.updated_at,
                      };
                    })
                  )}
                >
                  <Download className="mr-2 h-4 w-4" /> Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-3">
                  <Select value={tsFilter} onValueChange={(v: any) => { setTsFilter(v); setTsPage(1); }}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="uninvoiced">Uninvoiced</SelectItem>
                      <SelectItem value="failed">Failed sync</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={tsProject} onValueChange={(v) => { setTsProject(v); setTsPage(1); }}>
                    <SelectTrigger className="w-56"><SelectValue placeholder="Project" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All projects</SelectItem>
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Search staff / client / invoice…"
                    value={tsSearch}
                    onChange={(e) => { setTsSearch(e.target.value); setTsPage(1); }}
                    className="max-w-xs"
                  />
                </div>

                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Staff</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead className="text-right">Hours</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Invoice</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tsPageRows.length === 0 && (
                        <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No rows</TableCell></TableRow>
                      )}
                      {tsPageRows.map(r => {
                        const proj = r.project_id ? projectMap.get(r.project_id) : null;
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{r.staff_name}</TableCell>
                            <TableCell>{proj?.name || "—"}</TableCell>
                            <TableCell>{proj?.client_name || "—"}</TableCell>
                            <TableCell className="text-right">{Number(r.hours).toFixed(2)}</TableCell>
                            <TableCell className="text-right">{fmtMoney(Number(r.rate))}</TableCell>
                            <TableCell>
                              {r.needs_sync ? (
                                <Badge variant="destructive">Failed sync</Badge>
                              ) : r.invoiced ? (
                                <Badge className="bg-green-600 hover:bg-green-600">Invoiced</Badge>
                              ) : (
                                <Badge variant="secondary">Uninvoiced</Badge>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {r.invoice_id ? (
                                <Link to="/invoices" className="text-indigo-600 hover:underline inline-flex items-center gap-1">
                                  {r.invoice_id.slice(0, 8)}… <ExternalLink className="h-3 w-3" />
                                </Link>
                              ) : "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {tsTotalPages > 1 && (
                  <div className="flex justify-end gap-2 mt-3">
                    <Button size="sm" variant="outline" disabled={tsPage <= 1} onClick={() => setTsPage(p => p - 1)}>Prev</Button>
                    <Button size="sm" variant="outline" disabled={tsPage >= tsTotalPages} onClick={() => setTsPage(p => p + 1)}>Next</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* INVOICES */}
          <TabsContent value="invoices" className="mt-4">
            <div className="grid lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Revenue Trend (6 months)</CardTitle>
                </CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={revenueTrend}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: any) => fmtMoney(Number(v))} />
                      <Line type="monotone" dataKey="revenue" stroke="hsl(221 83% 53%)" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Top Clients by Revenue</CardTitle>
                </CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topClients} layout="vertical" margin={{ left: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
                      <Tooltip formatter={(v: any) => fmtMoney(Number(v))} />
                      <Bar dataKey="revenue" fill="hsl(262 83% 58%)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* COVERAGE */}
          <TabsContent value="coverage" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" /> Project Billing Coverage
                </CardTitle>
                <CardDescription>Projects under 70% are highlighted</CardDescription>
              </CardHeader>
              <CardContent>
                {projectCoverage.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No project timesheets yet</p>
                ) : (
                  <div className="grid md:grid-cols-2 gap-3">
                    {projectCoverage.map(p => {
                      const under = p.coverage < 70;
                      return (
                        <div key={p.project.id} className={`p-3 rounded-md border ${under ? "border-amber-400 bg-amber-50/50 dark:bg-amber-950/20" : ""}`}>
                          <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0">
                              <p className="font-medium truncate">{p.project.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{p.project.client_name || "No client"}</p>
                            </div>
                            <Badge variant={under ? "destructive" : "secondary"}>{p.coverage.toFixed(0)}%</Badge>
                          </div>
                          <Progress value={p.coverage} className="my-2 h-2" />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Invoiced: {p.invoiced.toFixed(1)}h</span>
                            <span>Unpaid: {p.unpaid.toFixed(1)}h</span>
                            <span>Total: {p.total.toFixed(1)}h</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* RECOVERY */}
          <TabsContent value="recovery" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Sync Recovery Panel</CardTitle>
                  <CardDescription>{syncGroups.length} groups · {overview.pendingSync} timesheets pending</CardDescription>
                </div>
                <Button size="sm" onClick={handleRetry} disabled={retrying || overview.pendingSync === 0}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${retrying ? "animate-spin" : ""}`} /> Trigger Retry
                </Button>
              </CardHeader>
              <CardContent>
                {syncGroups.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                    All clear — no pending sync items.
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice</TableHead>
                          <TableHead className="text-right">Rows</TableHead>
                          <TableHead>Last update</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {syncGroups.map(g => (
                          <TableRow key={g.invoiceId}>
                            <TableCell className="font-mono text-xs">
                              {g.invoiceId === "unlinked" ? <Badge variant="outline">unlinked</Badge> : `${g.invoiceId.slice(0, 12)}…`}
                            </TableCell>
                            <TableCell className="text-right">{g.rows.length}</TableCell>
                            <TableCell className="text-xs">{new Date(g.lastUpdate).toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                              {g.invoiceId !== "unlinked" && (
                                <Button asChild size="sm" variant="outline">
                                  <Link to="/invoices">
                                    <ExternalLink className="h-3 w-3 mr-1" /> View invoice
                                  </Link>
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Recent audit log entries */}
                <div className="mt-6">
                  <p className="text-sm font-medium mb-2">Recent audit log</p>
                  <div className="rounded-md border max-h-64 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>When</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Invoice</TableHead>
                          <TableHead className="text-right">TS count</TableHead>
                          <TableHead>Error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditLogs.slice(0, 30).map(a => (
                          <TableRow key={a.id}>
                            <TableCell className="text-xs">{new Date(a.created_at).toLocaleString()}</TableCell>
                            <TableCell>
                              {a.status === "success"
                                ? <Badge className="bg-green-600 hover:bg-green-600">success</Badge>
                                : <Badge variant="destructive">{a.status}</Badge>}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{a.invoice_id ? `${a.invoice_id.slice(0, 10)}…` : "—"}</TableCell>
                            <TableCell className="text-right">{a.timesheet_ids?.length || 0}</TableCell>
                            <TableCell className="text-xs text-muted-foreground truncate max-w-xs" title={a.error || ""}>{a.error || "—"}</TableCell>
                          </TableRow>
                        ))}
                        {auditLogs.length === 0 && (
                          <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">No audit entries yet</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

// ---------- subcomponents ----------
const Kpi = ({
  icon, label, value, sub, tone
}: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: "ok" | "warn" }) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center justify-between text-muted-foreground text-xs">
        <span>{label}</span>
        <span className={tone === "warn" ? "text-amber-600" : tone === "ok" ? "text-green-600" : ""}>{icon}</span>
      </div>
      <p className="text-xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </CardContent>
  </Card>
);

const HealthRow = ({ label, data }: { label: string; data: { ok: number; fail: number; tot: number; rate: number } }) => (
  <div>
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{data.rate.toFixed(1)}%</span>
    </div>
    <Progress value={data.rate} className="h-2 mt-1" />
    <p className="text-xs text-muted-foreground mt-1">{data.ok} ok · {data.fail} failed · {data.tot} total</p>
  </div>
);

export default AdminDashboard;
