import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AdminPageShell from '@/components/admin/AdminPageShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  createSeoKeyword,
  deleteSeoKeyword,
  importSeoKeywords,
  isPriorityKeyword,
  listSeoKeywords,
  parseSeoKeywordCsv,
  seedSolutionKeywords,
  seedBlogClusterKeywords,
  syncGscRankingsToKeywords,
  SEO_INTENT_STAGES,
  SEO_KEYWORD_STATUSES,
  sortSeoKeywords,
  updateSeoKeyword,
  type SeoIntentStage,
  type SeoKeywordInput,
  type SeoKeywordRecord,
  type SeoKeywordStatus,
} from '@/lib/seoKeywords';
import { Download, Pencil, Plus, RefreshCw, Search, Sparkles, Trash2, Upload, LineChart, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getGscToken, resolveGscToken } from '@/lib/seoTechnical';

const EMPTY_FORM: SeoKeywordInput = {
  keyword: '',
  monthlyVolume: 0,
  keywordDifficulty: 0,
  assignedPageUrl: '',
  intentStage: 'consideration',
  status: 'active',
  keywordOrigin: 'manual',
  rankingPosition: null,
};

function StatChip({ label, value, tone }: { label: string; value: number; tone?: 'active' | 'rank' | 'priority' }) {
  return (
    <div className={tone ? `seo-kw-chip seo-kw-chip--${tone}` : 'seo-kw-chip'}>
      <span className="seo-kw-chip-value">{value.toLocaleString()}</span>
      <span className="seo-kw-chip-label">{label}</span>
    </div>
  );
}

const AdminSEOKeywords: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<SeoKeywordRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [filterIntent, setFilterIntent] = useState<'all' | SeoIntentStage>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | SeoKeywordStatus>('all');
  const [filterRanked, setFilterRanked] = useState<'all' | 'ranked' | 'unranked'>('ranked');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'keyword' | 'monthlyVolume' | 'keywordDifficulty' | 'rankingPosition'>('rankingPosition');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SeoKeywordRecord | null>(null);
  const [form, setForm] = useState<SeoKeywordInput>(EMPTY_FORM);
  const [gscConnected, setGscConnected] = useState(() => Boolean(getGscToken()));
  const [gscSyncing, setGscSyncing] = useState(false);
  const [syncAlert, setSyncAlert] = useState<{ tone: 'ok' | 'warn' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listSeoKeywords());
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to load keywords');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void resolveGscToken().then((tok) => setGscConnected(Boolean(tok)));
  }, [load]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (filterIntent !== 'all' && row.intentStage !== filterIntent) return false;
      if (filterStatus !== 'all' && row.status !== filterStatus) return false;
      if (filterRanked === 'ranked' && (row.rankingPosition == null || row.rankingPosition <= 0)) return false;
      if (filterRanked === 'unranked' && row.rankingPosition != null && row.rankingPosition > 0) return false;
      if (!q) return true;
      return (
        row.keyword.toLowerCase().includes(q) ||
        row.assignedPageUrl.toLowerCase().includes(q)
      );
    });
    return sortSeoKeywords(filtered, sortKey, sortDir);
  }, [filterIntent, filterRanked, filterStatus, rows, search, sortDir, sortKey]);

  const stats = useMemo(() => {
    const active = rows.filter((row) => row.status === 'active').length;
    const priority = rows.filter(isPriorityKeyword).length;
    const withRank = rows.filter((row) => row.rankingPosition != null && row.rankingPosition > 0).length;
    return { total: rows.length, active, priority, withRank };
  }, [rows]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (row: SeoKeywordRecord) => {
    setEditing(row);
    setForm({
      keyword: row.keyword,
      monthlyVolume: row.monthlyVolume,
      keywordDifficulty: row.keywordDifficulty,
      assignedPageUrl: row.assignedPageUrl,
      intentStage: row.intentStage,
      status: row.status,
      keywordOrigin: row.keywordOrigin ?? 'manual',
      rankingPosition: row.rankingPosition,
    });
    setDialogOpen(true);
  };

  const saveForm = async () => {
    if (!form.keyword.trim()) {
      setMessage('Keyword text is required');
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      if (editing) {
        await updateSeoKeyword(editing.id, form);
      } else {
        await createSeoKeyword(form);
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const removeRow = async (row: SeoKeywordRecord) => {
    if (!window.confirm(`Delete keyword "${row.keyword}"?`)) return;
    setSaving(true);
    try {
      await deleteSeoKeyword(row.id);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  const handleCsvImport = async (file: File) => {
    setSaving(true);
    setMessage(null);
    try {
      const text = await file.text();
      const { rows: parsed, errors } = parseSeoKeywordCsv(text);
      if (parsed.length === 0) {
        setMessage(errors[0] ?? 'No rows found in CSV');
        return;
      }
      const result = await importSeoKeywords(parsed);
      const errorText = [...errors, ...result.errors].slice(0, 3).join(' · ');
      setMessage(
        `Imported ${result.imported} keyword(s)${result.skipped ? `, skipped ${result.skipped}` : ''}${errorText ? ` — ${errorText}` : ''}`,
      );
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'CSV import failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSeed = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const [pillar, blog] = await Promise.all([seedSolutionKeywords(true), seedBlogClusterKeywords(true)]);
      setMessage(`Seeded ${pillar.imported + blog.imported} keyword(s) (pillar + blog cluster)`);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Seed failed');
    } finally {
      setSaving(false);
    }
  };

  const handleGscSync = async () => {
    setGscSyncing(true);
    setSyncAlert({ tone: 'warn', text: 'Pulling ranks from Google Search Console…' });
    try {
      const token = await resolveGscToken();
      if (!token) {
        setGscConnected(false);
        setSyncAlert({
          tone: 'err',
          text: 'GSC not connected. Open SEO Audit → Connect Search Console (once). That saves login for all browsers.',
        });
        return;
      }
      const result = await syncGscRankingsToKeywords(token);
      await load();
      setGscConnected(true);
      setSyncAlert({
        tone: 'ok',
        text:
          `${result.synced + result.addedFromGsc} keywords ranked from Google` +
          (result.addedFromGsc ? ` (${result.addedFromGsc} new)` : '') +
          (result.pagesFixed ? ` · ${result.pagesFixed} page URLs corrected` : '') +
          (result.topRanked[0] ? ` · best: “${result.topRanked[0].keyword}” #${result.topRanked[0].position}` : ''),
      });
    } catch (err) {
      setSyncAlert({
        tone: 'err',
        text: err instanceof Error ? err.message : 'GSC sync failed',
      });
    } finally {
      setGscSyncing(false);
    }
  };

  const exportCsv = () => {
    const header = 'keyword,volume,kd,page_url,intent,status,ranking';
    const lines = rows.map((row) =>
      [
        `"${row.keyword.replace(/"/g, '""')}"`,
        row.monthlyVolume,
        row.keywordDifficulty,
        row.assignedPageUrl,
        row.intentStage,
        row.status,
        row.rankingPosition ?? '',
      ].join(','),
    );
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'grabio-seo-keywords.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminPageShell
      title="SEO Keywords"
      description="Target keywords for grabio.space — volume, difficulty, intent, pages, and Google ranks."
      className="seo-keywords-cute"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading || saving}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={saving}>
            <Upload className="h-4 w-4 mr-1" />
            Import
          </Button>
          <Button variant="outline" size="sm" onClick={() => void handleSeed()} disabled={saving}>
            <Sparkles className="h-4 w-4 mr-1" />
            Seed
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Add keyword
          </Button>
        </div>
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleCsvImport(file);
          e.target.value = '';
        }}
      />

      {syncAlert ? (
        <p
          className={`seo-kw-alert ${
            syncAlert.tone === 'ok' ? 'seo-kw-alert--ok' : syncAlert.tone === 'err' ? 'seo-kw-alert--err' : ''
          }`}
        >
          {syncAlert.text}
        </p>
      ) : null}

      <div className="seo-kw-bar">
        <div className="seo-kw-chips">
          <StatChip label="total" value={stats.total} />
          <StatChip label="active" value={stats.active} tone="active" />
          <StatChip label="ranked" value={stats.withRank} tone="rank" />
          <StatChip label="priority" value={stats.priority} tone="priority" />
        </div>
        {gscConnected ? (
          <Button size="sm" onClick={() => void handleGscSync()} disabled={gscSyncing}>
            <LineChart className={`h-4 w-4 mr-1.5 ${gscSyncing ? 'animate-pulse' : ''}`} />
            {gscSyncing ? 'Pulling…' : 'Pull ranks'}
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/seo-audit">
              Connect GSC
              <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
            </Link>
          </Button>
        )}
      </div>

      <div className="seo-kw-panel">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 flex-1">
            <div>
              <Label className="seo-kw-field-label">Search</Label>
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="keyword-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Keyword or page URL"
                  className="pl-8"
                />
              </div>
            </div>
            <div>
              <Label className="seo-kw-field-label">Intent</Label>
              <Select value={filterIntent} onValueChange={(v) => setFilterIntent(v as typeof filterIntent)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All intents</SelectItem>
                  {SEO_INTENT_STAGES.map((stage) => (
                    <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="seo-kw-field-label">Status</Label>
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {SEO_KEYWORD_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="seo-kw-field-label">Google rank</Label>
              <Select value={filterRanked} onValueChange={(v) => setFilterRanked(v as typeof filterRanked)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ranked">Ranked in GSC</SelectItem>
                  <SelectItem value="all">All keywords</SelectItem>
                  <SelectItem value="unranked">No rank yet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="seo-kw-field-label">Sort</Label>
              <Select
                value={`${sortKey}:${sortDir}`}
                onValueChange={(v) => {
                  const [key, dir] = v.split(':') as [typeof sortKey, typeof sortDir];
                  setSortKey(key);
                  setSortDir(dir);
                }}
              >
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="keyword:asc">Keyword A–Z</SelectItem>
                  <SelectItem value="monthlyVolume:desc">Volume high–low</SelectItem>
                  <SelectItem value="keywordDifficulty:asc">KD low–high</SelectItem>
                  <SelectItem value="rankingPosition:asc">Rank best–worst</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {message ? <p className="mt-4 text-sm text-muted-foreground">{message}</p> : null}

        <div className="seo-kw-table-wrap">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Keyword</TableHead>
                <TableHead>Volume</TableHead>
                <TableHead>KD</TableHead>
                <TableHead>Page</TableHead>
                <TableHead>Intent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rank</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8}>Loading keywords…</TableCell></TableRow>
              ) : filteredRows.length === 0 ? (
                <TableRow><TableCell colSpan={8}>No keywords yet — Seed or Import CSV.</TableCell></TableRow>
              ) : (
                filteredRows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={
                      row.rankingPosition != null && row.rankingPosition <= 10
                        ? 'bg-emerald-500/10'
                        : isPriorityKeyword(row)
                          ? 'bg-amber-500/10'
                          : undefined
                    }
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {row.keyword}
                        {row.keywordOrigin === 'gsc' ? (
                          <Badge variant="outline" className="text-xs">GSC</Badge>
                        ) : null}
                        {isPriorityKeyword(row) ? (
                          <Badge variant="secondary" className="text-xs">Priority</Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>{row.monthlyVolume.toLocaleString()}</TableCell>
                    <TableCell>{row.keywordDifficulty}</TableCell>
                    <TableCell className="max-w-[220px] truncate text-muted-foreground">{row.assignedPageUrl || '—'}</TableCell>
                    <TableCell><Badge variant="outline">{row.intentStage}</Badge></TableCell>
                    <TableCell><Badge variant={row.status === 'active' ? 'default' : 'secondary'}>{row.status}</Badge></TableCell>
                    <TableCell>
                      {row.rankingPosition != null ? (
                        <Badge
                          className={
                            row.rankingPosition <= 10
                              ? 'bg-emerald-600 hover:bg-emerald-600'
                              : row.rankingPosition <= 20
                                ? 'bg-amber-500 hover:bg-amber-500'
                                : ''
                          }
                        >
                          #{row.rankingPosition}
                        </Badge>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(row)} aria-label="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => void removeRow(row)} aria-label="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit keyword' : 'Add keyword'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label htmlFor="kw-text">Keyword</Label>
              <Input id="kw-text" value={form.keyword} onChange={(e) => setForm({ ...form, keyword: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="kw-volume">Monthly volume</Label>
                <Input
                  id="kw-volume"
                  type="number"
                  value={form.monthlyVolume}
                  onChange={(e) => setForm({ ...form, monthlyVolume: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label htmlFor="kw-kd">Keyword difficulty</Label>
                <Input
                  id="kw-kd"
                  type="number"
                  value={form.keywordDifficulty}
                  onChange={(e) => setForm({ ...form, keywordDifficulty: Number(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="kw-url">Assigned page URL</Label>
              <Input
                id="kw-url"
                value={form.assignedPageUrl}
                onChange={(e) => setForm({ ...form, assignedPageUrl: e.target.value })}
                placeholder="/solutions/accounting"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Intent stage</Label>
                <Select value={form.intentStage} onValueChange={(v) => setForm({ ...form, intentStage: v as SeoIntentStage })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SEO_INTENT_STAGES.map((stage) => (
                      <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as SeoKeywordStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SEO_KEYWORD_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="kw-rank">Ranking position (manual)</Label>
              <Input
                id="kw-rank"
                type="number"
                value={form.rankingPosition ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    rankingPosition: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void saveForm()} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPageShell>
  );
};

export default AdminSEOKeywords;
