import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  addGapToKeywordEngine,
  createCompetitor,
  deleteCompetitor,
  deleteGap,
  GAP_STATUSES,
  importCompetitorKeywordGaps,
  listCompetitorGaps,
  listCompetitors,
  updateGapStatus,
  type GapStatus,
  type SeoCompetitorGapRecord,
  type SeoCompetitorRecord,
} from '@/lib/seoCompetitors';
import {
  Loader2,
  Plus,
  RefreshCw,
  Swords,
  Trash2,
  Upload,
  Zap,
} from 'lucide-react';

const AdminSEOCompetitors: React.FC = () => {
  const [competitors, setCompetitors] = useState<SeoCompetitorRecord[]>([]);
  const [gaps, setGaps] = useState<SeoCompetitorGapRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [newDomain, setNewDomain] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string>('');
  const [keywordPaste, setKeywordPaste] = useState('');
  const [importing, setImporting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | GapStatus>('all');
  const [pageUrlByGap, setPageUrlByGap] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [compRows, gapRows] = await Promise.all([listCompetitors(), listCompetitorGaps()]);
      setCompetitors(compRows);
      setGaps(gapRows);
      setSelectedCompetitorId((prev) => prev || compRows[0]?.id || '');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to load competitors');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredGaps = useMemo(() => {
    if (filterStatus === 'all') return gaps;
    return gaps.filter((g) => g.status === filterStatus);
  }, [filterStatus, gaps]);

  const stats = useMemo(() => ({
    competitors: competitors.length,
    newGaps: gaps.filter((g) => g.status === 'new').length,
    added: gaps.filter((g) => g.status === 'added').length,
    rejected: gaps.filter((g) => g.status === 'rejected').length,
  }), [competitors.length, gaps]);

  const addCompetitor = async () => {
    if (!newDomain.trim() || !newLabel.trim()) {
      setMessage('Domain and label are required');
      return;
    }
    await createCompetitor(newDomain, newLabel);
    setNewDomain('');
    setNewLabel('');
    setMessage('Competitor added.');
    await load();
  };

  const removeCompetitor = async (row: SeoCompetitorRecord) => {
    if (!window.confirm(`Remove ${row.label}? Gap records will remain.`)) return;
    await deleteCompetitor(row.id);
    await load();
  };

  const importGaps = async () => {
    const competitor = competitors.find((c) => c.id === selectedCompetitorId);
    if (!competitor) {
      setMessage('Select a competitor first');
      return;
    }
    if (!keywordPaste.trim()) {
      setMessage('Paste keywords (one per line or comma-separated)');
      return;
    }
    setImporting(true);
    try {
      const result = await importCompetitorKeywordGaps(competitor, keywordPaste);
      setKeywordPaste('');
      setMessage(
        `Imported ${result.imported} gap keyword(s). Skipped ${result.skippedExisting} already in keyword engine, ${result.skippedDuplicate} duplicate gaps.`,
      );
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleGapStatus = async (gap: SeoCompetitorGapRecord, status: GapStatus) => {
    await updateGapStatus(gap.id, status);
    await load();
  };

  const handleAddToKeywords = async (gap: SeoCompetitorGapRecord) => {
    try {
      await addGapToKeywordEngine(gap, pageUrlByGap[gap.id] ?? '');
      setMessage(`Added "${gap.keyword}" to keyword engine.`);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to add keyword');
    }
  };

  return (
    <AdminPageShell
      title="SEO Competitor Gaps"
      description="Log competitor domains, paste their ranking keywords, and feed gaps into the keyword engine."
    >
      <div className="space-y-6">
        {message && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {message}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <AdminPanel><div className="p-4"><p className="text-sm text-gray-500">Competitors</p><p className="text-2xl font-bold">{stats.competitors}</p></div></AdminPanel>
          <AdminPanel><div className="p-4"><p className="text-sm text-gray-500">New gaps</p><p className="text-2xl font-bold text-amber-700">{stats.newGaps}</p></div></AdminPanel>
          <AdminPanel><div className="p-4"><p className="text-sm text-gray-500">Added to plan</p><p className="text-2xl font-bold text-emerald-700">{stats.added}</p></div></AdminPanel>
          <AdminPanel><div className="p-4"><p className="text-sm text-gray-500">Rejected</p><p className="text-2xl font-bold text-gray-600">{stats.rejected}</p></div></AdminPanel>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
        </div>

        <Tabs defaultValue="gaps">
          <TabsList>
            <TabsTrigger value="gaps">Gap keywords</TabsTrigger>
            <TabsTrigger value="competitors">Competitors</TabsTrigger>
            <TabsTrigger value="import">Import gaps</TabsTrigger>
          </TabsList>

          <TabsContent value="competitors" className="mt-4 space-y-4">
            <AdminPanel>
              <div className="p-4 grid sm:grid-cols-3 gap-3 border-b">
                <div>
                  <Label>Domain</Label>
                  <Input value={newDomain} onChange={(e) => setNewDomain(e.target.value)} placeholder="competitor.com" />
                </div>
                <div>
                  <Label>Label</Label>
                  <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Competitor A" />
                </div>
                <div className="flex items-end">
                  <Button onClick={() => void addCompetitor()}><Plus className="h-4 w-4 mr-2" />Add</Button>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {competitors.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-gray-500 py-6">No competitors yet.</TableCell></TableRow>
                  )}
                  {competitors.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.label}</TableCell>
                      <TableCell className="font-mono text-xs">{row.domain}</TableCell>
                      <TableCell>{row.createdAt?.toDate().toLocaleDateString() ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => void removeCompetitor(row)} aria-label="Delete">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AdminPanel>
          </TabsContent>

          <TabsContent value="import" className="mt-4">
            <AdminPanel>
              <div className="p-4 space-y-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Swords className="h-4 w-4" />
                  Paste keywords a competitor ranks for — platform flags gaps vs your keyword engine.
                </div>
                <div className="max-w-md">
                  <Label>Competitor</Label>
                  <Select value={selectedCompetitorId} onValueChange={setSelectedCompetitorId}>
                    <SelectTrigger><SelectValue placeholder="Select competitor" /></SelectTrigger>
                    <SelectContent>
                      {competitors.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.label} ({c.domain})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Keyword list</Label>
                  <Textarea
                    value={keywordPaste}
                    onChange={(e) => setKeywordPaste(e.target.value)}
                    rows={10}
                    placeholder={'inventory software lebanon\npos system smb\naccounting software cloud'}
                  />
                </div>
                <Button onClick={() => void importGaps()} disabled={importing || !competitors.length}>
                  {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                  Analyze &amp; import gaps
                </Button>
                <p className="text-xs text-gray-500">
                  SerpAPI auto-fetch hook reserved for future — manual paste works today.
                </p>
              </div>
            </AdminPanel>
          </TabsContent>

          <TabsContent value="gaps" className="mt-4 space-y-4">
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {GAP_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>

            <AdminPanel>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keyword</TableHead>
                    <TableHead>Competitor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Target URL</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGaps.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-gray-500 py-8">No gap keywords yet. Import from the Import tab.</TableCell></TableRow>
                  )}
                  {filteredGaps.map((gap) => (
                    <TableRow key={gap.id}>
                      <TableCell className="font-medium">{gap.keyword}</TableCell>
                      <TableCell>
                        <div className="text-sm">{gap.competitorLabel}</div>
                        <div className="text-xs text-gray-500 font-mono">{gap.competitorDomain}</div>
                      </TableCell>
                      <TableCell>
                        <Select value={gap.status} onValueChange={(v) => void handleGapStatus(gap, v as GapStatus)}>
                          <SelectTrigger className="h-8 w-[120px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {GAP_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8 text-xs"
                          placeholder="/solutions/..."
                          value={pageUrlByGap[gap.id] ?? ''}
                          onChange={(e) => setPageUrlByGap((p) => ({ ...p, [gap.id]: e.target.value }))}
                        />
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="sm" variant="outline" onClick={() => void handleAddToKeywords(gap)} disabled={gap.status === 'added'}>
                          <Zap className="h-3.5 w-3.5 mr-1" />Add to keywords
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => void deleteGap(gap.id).then(load)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
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

export default AdminSEOCompetitors;
