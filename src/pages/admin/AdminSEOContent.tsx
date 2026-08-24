import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { GRABIO_SOLUTIONS } from '@/lib/grabioSolutions';
import {
  listSeoKeywords,
  SEO_INTENT_STAGES,
  type SeoKeywordRecord,
} from '@/lib/seoKeywords';
import {
  buildPillarClusterMap,
  checklistScore,
  createSeoContent,
  deleteSeoContent,
  draftToHtml,
  generateSeoContentDraft,
  generateSeoContentPhase3Batch,
  listSeoContent,
  SEO_CONTENT_STATUSES,
  SEO_CONTENT_TYPES,
  sortSeoContent,
  updateSeoContent,
  type SeoContentInput,
  type SeoContentRecord,
  type SeoContentStatus,
  type SeoContentType,
} from '@/lib/seoContent';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react';

const EMPTY_FORM: SeoContentInput = {
  title: '',
  targetKeywordId: null,
  targetKeyword: '',
  contentType: 'blog',
  intentStage: 'consideration',
  status: 'idea',
  publishDate: null,
  assignedUrl: '',
  pillarSlug: 'inventory',
  checklist: {
    hasH1: false,
    hasMetaTitle: false,
    hasMetaDescription: false,
    wordCount: 0,
    internalLinksCount: 0,
    schemaType: '',
    intentStageMatch: false,
  },
  draft: null,
  notes: '',
};

function CheckIcon({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
  ) : (
    <XCircle className="h-4 w-4 text-red-400" />
  );
}

const AdminSEOContent: React.FC = () => {
  const [rows, setRows] = useState<SeoContentRecord[]>([]);
  const [keywords, setKeywords] = useState<SeoKeywordRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | SeoContentStatus>('all');
  const [filterType, setFilterType] = useState<'all' | SeoContentType>('all');
  const [sortKey, setSortKey] = useState<'title' | 'status' | 'publishDate' | 'contentType'>('title');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SeoContentRecord | null>(null);
  const [form, setForm] = useState<SeoContentInput>(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [contentRows, keywordRows] = await Promise.all([listSeoContent(), listSeoKeywords()]);
      setRows(contentRows);
      setKeywords(keywordRows);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to load content');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pillarMap = useMemo(() => buildPillarClusterMap(rows), [rows]);
  const gapPillars = useMemo(() => pillarMap.filter((p) => p.needsMore), [pillarMap]);

  const filteredRows = useMemo(() => {
    const filtered = rows.filter((row) => {
      if (filterStatus !== 'all' && row.status !== filterStatus) return false;
      if (filterType !== 'all' && row.contentType !== filterType) return false;
      return true;
    });
    return sortSeoContent(filtered, sortKey, 'asc');
  }, [filterStatus, filterType, rows, sortKey]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (row: SeoContentRecord) => {
    setEditing(row);
    setForm({
      title: row.title,
      targetKeywordId: row.targetKeywordId,
      targetKeyword: row.targetKeyword,
      contentType: row.contentType,
      intentStage: row.intentStage,
      status: row.status,
      publishDate: row.publishDate,
      assignedUrl: row.assignedUrl,
      pillarSlug: row.pillarSlug,
      checklist: row.checklist,
      draft: row.draft,
      notes: row.notes,
    });
    setDialogOpen(true);
  };

  const applyKeyword = (keywordId: string) => {
    const kw = keywords.find((k) => k.id === keywordId);
    if (!kw) return;
    const pillarSlug =
      GRABIO_SOLUTIONS.find((p) => kw.assignedPageUrl.includes(`/solutions/${p.slug}`))?.slug ??
      form.pillarSlug;
    setForm((prev) => ({
      ...prev,
      targetKeywordId: kw.id,
      targetKeyword: kw.keyword,
      intentStage: kw.intentStage,
      assignedUrl: prev.assignedUrl || kw.assignedPageUrl.replace(/\/solutions\/[^/]+/, '/blog/...'),
      pillarSlug,
    }));
  };

  const saveRow = async () => {
    if (!form.title.trim()) {
      setMessage('Title is required');
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      if (editing) {
        await updateSeoContent(editing.id, form);
      } else {
        await createSeoContent(form);
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const removeRow = async (row: SeoContentRecord) => {
    if (!window.confirm(`Delete "${row.title}"?`)) return;
    await deleteSeoContent(row.id);
    await load();
  };

  const runPhase3Batch = async () => {
    const pending = rows.filter(
      (r) =>
        r.status === 'idea' &&
        !r.draft &&
        (r.pillarSlug === 'inventory' || r.pillarSlug === 'accounting'),
    ).length;
    if (pending === 0) {
      setMessage('No inventory/accounting ideas waiting for drafts.');
      return;
    }
    if (!window.confirm(`Generate ${pending} draft(s) via Cursor? ~30–60s each.`)) return;

    setBatchGenerating(true);
    setBatchProgress(null);
    setMessage(null);
    try {
      const result = await generateSeoContentPhase3Batch((current, total, title) => {
        setBatchProgress(`${current}/${total}: ${title}`);
      });
      setMessage(
        `Phase 3 complete — ${result.generated} draft(s) generated.${result.failed.length ? ` Failed: ${result.failed.join(', ')}` : ''}`,
      );
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Phase 3 batch failed');
    } finally {
      setBatchGenerating(false);
      setBatchProgress(null);
    }
  };

  const runAiDraft = async () => {
    setGenerating(true);
    setMessage(null);
    try {
      const draft = await generateSeoContentDraft(form);
      setForm((prev) => ({ ...prev, draft, status: prev.status === 'idea' ? 'draft' : prev.status }));
      setMessage('AI draft generated. Review checklist before publishing.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'AI draft failed');
    } finally {
      setGenerating(false);
    }
  };

  const copyDraft = async () => {
    if (!form.draft) return;
    await navigator.clipboard.writeText(form.draft.rawMarkdown || draftToHtml(form.draft));
    setMessage('Draft copied to clipboard.');
  };

  const exportHtml = () => {
    if (!form.draft) return;
    const blob = new Blob([draftToHtml(form.draft)], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${form.title.replace(/\s+/g, '-').toLowerCase() || 'seo-draft'}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const checklist = form.draft
    ? {
        hasH1: Boolean(form.draft.h1.trim()),
        hasMetaTitle: form.draft.metaTitle.length >= 30 && form.draft.metaTitle.length <= 65,
        hasMetaDescription: form.draft.metaDescription.length >= 120 && form.draft.metaDescription.length <= 165,
        wordCount: (form.draft.rawMarkdown || '').split(/\s+/).filter(Boolean).length,
        internalLinksCount: form.draft.suggestedInternalLinks.length,
        schemaType: form.draft.schemaType,
        intentStageMatch: true,
      }
    : form.checklist;

  return (
    <AdminPageShell
      title="SEO Content Engine"
      description="Plan pillar clusters, track the content calendar, and generate AI drafts with on-page checklists."
    >
      <div className="space-y-6">
        {message && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {message}
          </div>
        )}

        {gapPillars.length > 0 && (
          <AdminPanel>
            <div className="p-4 flex flex-wrap items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-900">Content gap alert</p>
                <p className="text-sm text-amber-800 mt-1">
                  These pillars have fewer than 5 cluster articles assigned:{' '}
                  {gapPillars.map((p) => p.title).join(', ')}
                </p>
              </div>
            </div>
          </AdminPanel>
        )}

        <div className="flex flex-wrap gap-2 items-center">
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add content</Button>
          <Button
            variant="secondary"
            onClick={() => void runPhase3Batch()}
            disabled={batchGenerating || generating}
          >
            {batchGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Phase 3: Generate pillar drafts
          </Button>
          {batchProgress && <span className="text-sm text-gray-500">{batchProgress}</span>}
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
        </div>

        <Tabs defaultValue="calendar">
          <TabsList>
            <TabsTrigger value="calendar">Content calendar</TabsTrigger>
            <TabsTrigger value="pillars">Pillar + cluster map</TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-3">
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {SEO_CONTENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={(v) => setFilterType(v as typeof filterType)}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {SEO_CONTENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortKey} onValueChange={(v) => setSortKey(v as typeof sortKey)}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Sort" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="title">Sort by title</SelectItem>
                  <SelectItem value="status">Sort by status</SelectItem>
                  <SelectItem value="publishDate">Sort by publish date</SelectItem>
                  <SelectItem value="contentType">Sort by type</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <AdminPanel>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Keyword</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pillar</TableHead>
                    <TableHead>Publish</TableHead>
                    <TableHead>SEO</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={8}>Loading…</TableCell></TableRow>
                  ) : filteredRows.length === 0 ? (
                    <TableRow><TableCell colSpan={8}>No content items yet.</TableCell></TableRow>
                  ) : (
                    filteredRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium max-w-[200px] truncate">{row.title}</TableCell>
                        <TableCell className="max-w-[160px] truncate">{row.targetKeyword || '—'}</TableCell>
                        <TableCell><Badge variant="outline">{row.contentType}</Badge></TableCell>
                        <TableCell><Badge>{row.status}</Badge></TableCell>
                        <TableCell>{row.pillarSlug ?? '—'}</TableCell>
                        <TableCell>{row.publishDate ?? '—'}</TableCell>
                        <TableCell>{checklistScore(row.checklist)}%</TableCell>
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
            </AdminPanel>
          </TabsContent>

          <TabsContent value="pillars" className="mt-4">
            <AdminPanel>
              <Accordion type="multiple" className="px-2">
                {pillarMap.map((pillar) => (
                  <AccordionItem key={pillar.slug} value={pillar.slug}>
                    <AccordionTrigger>
                      <div className="flex items-center gap-3 text-left">
                        <span className="font-semibold">{pillar.title}</span>
                        <Badge variant={pillar.needsMore ? 'destructive' : 'outline'}>
                          {pillar.clusterCount}/5 cluster articles
                        </Badge>
                        <span className="text-xs text-gray-500 font-mono">{pillar.pillarUrl}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      {pillar.clusterItems.length === 0 ? (
                        <p className="text-sm text-gray-500 py-2">No cluster articles assigned yet.</p>
                      ) : (
                        <ul className="space-y-2 py-2">
                          {pillar.clusterItems.map((item) => (
                            <li key={item.id} className="flex items-center justify-between gap-2 text-sm border rounded-md px-3 py-2">
                              <span>{item.title}</span>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{item.status}</Badge>
                                <Button size="sm" variant="ghost" onClick={() => openEdit(item)}>Edit</Button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </AdminPanel>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit content' : 'Add content'}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div>
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Link keyword (Phase 1)</Label>
                <Select
                  value={form.targetKeywordId ?? 'none'}
                  onValueChange={(v) => {
                    if (v === 'none') {
                      setForm((prev) => ({ ...prev, targetKeywordId: null }));
                    } else {
                      applyKeyword(v);
                    }
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Select keyword" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {keywords.map((kw) => (
                      <SelectItem key={kw.id} value={kw.id}>{kw.keyword}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Target keyword</Label>
                <Input
                  value={form.targetKeyword}
                  onChange={(e) => setForm({ ...form, targetKeyword: e.target.value })}
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.contentType} onValueChange={(v) => setForm({ ...form, contentType: v as SeoContentType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SEO_CONTENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as SeoContentStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SEO_CONTENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Intent</Label>
                <Select value={form.intentStage} onValueChange={(v) => setForm({ ...form, intentStage: v as typeof form.intentStage })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SEO_INTENT_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Pillar</Label>
                <Select value={form.pillarSlug ?? 'none'} onValueChange={(v) => setForm({ ...form, pillarSlug: v === 'none' ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {GRABIO_SOLUTIONS.map((p) => (
                      <SelectItem key={p.slug} value={p.slug}>{p.shortTitle}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Publish date</Label>
                <Input
                  type="date"
                  value={form.publishDate ?? ''}
                  onChange={(e) => setForm({ ...form, publishDate: e.target.value || null })}
                />
              </div>
            </div>

            <div>
              <Label>Assigned URL</Label>
              <Input
                value={form.assignedUrl}
                onChange={(e) => setForm({ ...form, assignedUrl: e.target.value })}
                placeholder="/blog/inventory-management-lebanon"
              />
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>

            <AdminPanel>
              <div className="p-4 border-b flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">On-page checklist</p>
                  <p className="text-sm text-gray-500">Score: {checklistScore(checklist)}%</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => void runAiDraft()} disabled={generating}>
                    {generating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                    AI draft
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void copyDraft()} disabled={!form.draft}>
                    <Copy className="h-4 w-4 mr-1" />Copy
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportHtml} disabled={!form.draft}>
                    <Download className="h-4 w-4 mr-1" />Export HTML
                  </Button>
                </div>
              </div>
              <div className="p-4 grid sm:grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2"><CheckIcon ok={checklist.hasH1} /> H1 present</div>
                <div className="flex items-center gap-2"><CheckIcon ok={checklist.hasMetaTitle} /> Meta title (30–65 chars)</div>
                <div className="flex items-center gap-2"><CheckIcon ok={checklist.hasMetaDescription} /> Meta description (120–165)</div>
                <div className="flex items-center gap-2"><CheckIcon ok={checklist.wordCount >= 800} /> Word count ≥ 800 ({checklist.wordCount})</div>
                <div className="flex items-center gap-2"><CheckIcon ok={checklist.internalLinksCount >= 3} /> Internal links ≥ 3 ({checklist.internalLinksCount})</div>
                <div className="flex items-center gap-2"><CheckIcon ok={Boolean(checklist.schemaType)} /> Schema: {checklist.schemaType || '—'}</div>
                <div className="flex items-center gap-2"><CheckIcon ok={checklist.intentStageMatch} /> Intent stage match</div>
              </div>
              {form.draft && (
                <div className="p-4 border-t space-y-2">
                  <p className="text-sm font-medium">{form.draft.h1}</p>
                  <p className="text-xs text-gray-500">{form.draft.metaTitle}</p>
                  <div
                    className="prose prose-sm max-w-none border rounded-md p-3 max-h-48 overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: `${form.draft.bodyHtml}${form.draft.faqHtml}` }}
                  />
                </div>
              )}
            </AdminPanel>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void saveRow()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPageShell>
  );
};

export default AdminSEOContent;
