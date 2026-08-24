import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
  buildGeneratedPage,
  buildSitemapUrlList,
  buildSitemapXmlSnippet,
  countPublishedThisMonth,
  deleteProgPage,
  deleteProgTemplate,
  generatePageBatch,
  listProgPages,
  listProgTemplates,
  loadProgSeeds,
  loadProgSettings,
  loadSeoEventsForDeadScan,
  PROG_PAGE_STATUSES,
  saveProgSeeds,
  saveProgSettings,
  saveProgTemplate,
  scanDeadProgPages,
  seedDefaultTemplatesIfEmpty,
  updatePageStatus,
  pingPlatformSitemap,
  type ProgGeneratedPage,
  type ProgSeedData,
  type ProgSettings,
  type ProgTemplate,
} from '@/lib/seoProgrammatic';
import {
  Copy,
  Layers,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react';

const EMPTY_TEMPLATE: Omit<ProgTemplate, 'id'> = {
  name: '',
  titlePattern: '{category} in {city} | Grabio',
  metaPattern: 'Grabio {category} for {storeType} in {city}.',
  h1Pattern: '{category} for {storeType} in {city}',
  bodyPattern: '<p>Content for {city} / {area}.</p>',
  faqQuestionPattern: 'Best {category} in {city}?',
  faqAnswerPattern: 'Grabio offers {category} for {storeType} in {city}.',
  enabled: true,
};

const AdminSEOProgrammatic: React.FC = () => {
  const [templates, setTemplates] = useState<ProgTemplate[]>([]);
  const [seeds, setSeeds] = useState<ProgSeedData | null>(null);
  const [settings, setSettings] = useState<ProgSettings | null>(null);
  const [pages, setPages] = useState<ProgGeneratedPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [sitemapSnippet, setSitemapSnippet] = useState('');
  const [pingingSitemap, setPingingSitemap] = useState(false);

  const [tplDialog, setTplDialog] = useState(false);
  const [editingTpl, setEditingTpl] = useState<ProgTemplate | null>(null);
  const [tplForm, setTplForm] = useState(EMPTY_TEMPLATE);

  const [genTemplateId, setGenTemplateId] = useState('');
  const [genCity, setGenCity] = useState('Beirut');
  const [selectedAreas, setSelectedAreas] = useState<Set<string>>(new Set());
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectedStoreTypes, setSelectedStoreTypes] = useState<Set<string>>(new Set());
  const [previewHtml, setPreviewHtml] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await seedDefaultTemplatesIfEmpty();
      const [tpl, seedRows, cfg, pageRows] = await Promise.all([
        listProgTemplates(),
        loadProgSeeds(),
        loadProgSettings(),
        listProgPages(),
      ]);
      setTemplates(tpl);
      setSeeds(seedRows);
      setSettings(cfg);
      setPages(pageRows);
      setGenTemplateId((prev) => prev || tpl[0]?.id || '');
      setSelectedAreas((prev) => (prev.size ? prev : new Set(seedRows.areas.slice(0, 2))));
      setSelectedCategories((prev) => (prev.size ? prev : new Set(seedRows.categories.slice(0, 2))));
      setSelectedStoreTypes((prev) => (prev.size ? prev : new Set(seedRows.storeTypes.slice(0, 1))));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const publishedCount = useMemo(() => pages.filter((p) => p.status === 'published').length, [pages]);
  const queuedCount = useMemo(() => pages.filter((p) => p.status === 'queued').length, [pages]);
  const deadCount = useMemo(() => pages.filter((p) => p.status === 'dead').length, [pages]);
  const publishedThisMonth = useMemo(() => countPublishedThisMonth(pages), [pages]);

  const openTplCreate = () => {
    setEditingTpl(null);
    setTplForm(EMPTY_TEMPLATE);
    setTplDialog(true);
  };

  const openTplEdit = (row: ProgTemplate) => {
    setEditingTpl(row);
    setTplForm({ ...row });
    setTplDialog(true);
  };

  const saveTpl = async () => {
    await saveProgTemplate(editingTpl?.id ?? null, tplForm);
    setTplDialog(false);
    await load();
  };

  const saveSeeds = async () => {
    if (!seeds) return;
    await saveProgSeeds(seeds);
    setMessage('Seed data saved.');
  };

  const saveSettings = async () => {
    if (!settings) return;
    await saveProgSettings(settings);
    setMessage('Settings saved.');
  };

  const runGenerate = async () => {
    if (!genTemplateId) return;
    setGenerating(true);
    try {
      const count = await generatePageBatch({
        templateId: genTemplateId,
        city: genCity,
        areas: [...selectedAreas],
        categories: [...selectedCategories],
        storeTypes: [...selectedStoreTypes],
        maxPages: 24,
      });
      setMessage(`Generated ${count} page(s)${settings?.automationMode ? ' (auto-published)' : ' (queued)'}.`);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Generate failed');
    } finally {
      setGenerating(false);
    }
  };

  const runPreview = () => {
    const tpl = templates.find((t) => t.id === genTemplateId);
    if (!tpl || !seeds) return;
    const vars = {
      city: genCity,
      area: [...selectedAreas][0] ?? seeds.areas[0],
      category: [...selectedCategories][0] ?? seeds.categories[0],
      storeType: [...selectedStoreTypes][0] ?? seeds.storeTypes[0],
    };
    const built = buildGeneratedPage(tpl, vars);
    setPreviewHtml(`<h1>${built.h1}</h1>${built.bodyHtml}${built.faqHtml}`);
  };

  const runDeadScan = async () => {
    setScanning(true);
    try {
      const events = await loadSeoEventsForDeadScan();
      const dead = await scanDeadProgPages(events);
      setMessage(`Dead page scan: ${dead.length} page(s) flagged (0 sessions in 60 days).`);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  const exportSitemap = () => {
    const urls = buildSitemapUrlList(pages);
    setSitemapSnippet(buildSitemapXmlSnippet(urls));
    setMessage(`${urls.length} URL(s) ready — merge into public/sitemap.xml.`);
  };

  const copySitemap = async () => {
    if (!sitemapSnippet) return;
    await navigator.clipboard.writeText(sitemapSnippet);
    setMessage('Sitemap snippet copied.');
  };

  const runSitemapPing = async () => {
    setPingingSitemap(true);
    try {
      const result = await pingPlatformSitemap();
      if (!result.success) {
        setMessage(result.message || 'Sitemap ping failed.');
        return;
      }
      const ok = result.results?.filter((r) => r.ok).length ?? 0;
      setMessage(`Sitemap ping sent — ${ok}/${result.results?.length ?? 0} engines OK. Live URL: ${result.sitemapUrl}`);
    } finally {
      setPingingSitemap(false);
    }
  };

  const toggleSet = (set: Set<string>, value: string, updater: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    updater(next);
  };

  const seedText = (key: keyof ProgSeedData) => (seeds?.[key] ?? []).join('\n');

  const updateSeedText = (key: keyof ProgSeedData, text: string) => {
    if (!seeds) return;
    setSeeds({
      ...seeds,
      [key]: text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean),
    });
  };

  return (
    <AdminPageShell title="SEO Programmatic" description="Template-driven page generation, publish queue, dead page monitor, and sitemap hooks.">
      <div className="space-y-6">
        {message && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</div>}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <AdminPanel><div className="p-4"><p className="text-sm text-gray-500">Published</p><p className="text-2xl font-bold">{publishedCount}</p></div></AdminPanel>
          <AdminPanel><div className="p-4"><p className="text-sm text-gray-500">Queued</p><p className="text-2xl font-bold">{queuedCount}</p></div></AdminPanel>
          <AdminPanel><div className="p-4"><p className="text-sm text-gray-500">Dead flagged</p><p className="text-2xl font-bold text-red-600">{deadCount}</p></div></AdminPanel>
          <AdminPanel><div className="p-4"><p className="text-sm text-gray-500">Published this month</p><p className="text-2xl font-bold">{publishedThisMonth}</p></div></AdminPanel>
          <AdminPanel><div className="p-4"><p className="text-sm text-gray-500">Monthly target</p><p className="text-2xl font-bold">{settings?.monthlyPageTarget ?? 20}</p></div></AdminPanel>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}Refresh
          </Button>
          <Button variant="outline" onClick={exportSitemap}><Copy className="h-4 w-4 mr-2" />Legacy snippet</Button>
          <Button variant="outline" onClick={() => void runSitemapPing()} disabled={pingingSitemap}>
            {pingingSitemap ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}Ping sitemap
          </Button>
          <Button variant="outline" onClick={() => void runDeadScan()} disabled={scanning}>
            {scanning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Layers className="h-4 w-4 mr-2" />}Scan dead pages
          </Button>
        </div>

        <Tabs defaultValue="generator">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="generator">Generator</TabsTrigger>
            <TabsTrigger value="queue">Publish queue</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="seeds">Seed data</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="generator" className="mt-4 space-y-4">
            <AdminPanel>
              <div className="p-4 grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Template</Label>
                  <Select value={genTemplateId} onValueChange={setGenTemplateId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>City</Label><Input value={genCity} onChange={(e) => setGenCity(e.target.value)} /></div>
              </div>
              {seeds && (
                <div className="p-4 grid md:grid-cols-3 gap-4 border-t">
                  {(['areas', 'categories', 'storeTypes'] as const).map((key) => (
                    <div key={key}>
                      <Label className="capitalize">{key}</Label>
                      <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                        {seeds[key].map((item) => {
                          const set = key === 'areas' ? selectedAreas : key === 'categories' ? selectedCategories : selectedStoreTypes;
                          const setFn = key === 'areas' ? setSelectedAreas : key === 'categories' ? setSelectedCategories : setSelectedStoreTypes;
                          return (
                            <label key={item} className="flex items-center gap-2 text-sm">
                              <Checkbox checked={set.has(item)} onCheckedChange={() => toggleSet(set, item, setFn)} />
                              {item}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="p-4 flex gap-2 border-t">
                <Button onClick={() => void runGenerate()} disabled={generating}><Sparkles className="h-4 w-4 mr-2" />Generate batch</Button>
                <Button variant="outline" onClick={runPreview}>Preview one</Button>
              </div>
              {previewHtml && (
                <div className="p-4 border-t prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: previewHtml }} />
              )}
            </AdminPanel>
          </TabsContent>

          <TabsContent value="queue" className="mt-4">
            <AdminPanel>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>60d sessions</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pages.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-gray-500">No pages yet.</TableCell></TableRow>}
                  {pages.map((row) => (
                    <TableRow key={row.slug}>
                      <TableCell className="max-w-[200px] truncate font-medium">{row.title}</TableCell>
                      <TableCell><Badge variant={row.status === 'published' ? 'default' : row.status === 'dead' ? 'destructive' : 'outline'}>{row.status}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">/pages/{row.slug}</TableCell>
                      <TableCell>{row.sessions60d ?? '—'}</TableCell>
                      <TableCell className="text-right space-x-1">
                        {row.status === 'queued' && (
                          <Button size="sm" onClick={() => void updatePageStatus(row.slug, 'published').then(load)}>Publish</Button>
                        )}
                        {row.status === 'dead' && (
                          <Button size="sm" variant="outline" onClick={() => void updatePageStatus(row.slug, 'queued').then(load)}>Re-queue</Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => void deleteProgPage(row.slug).then(load)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AdminPanel>
          </TabsContent>

          <TabsContent value="templates" className="mt-4 space-y-4">
            <Button onClick={openTplCreate}><Plus className="h-4 w-4 mr-2" />New template</Button>
            <AdminPanel>
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Title pattern</TableHead><TableHead /><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {templates.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell className="text-xs font-mono truncate max-w-[280px]">{row.titlePattern}</TableCell>
                      <TableCell><Button variant="ghost" size="icon" onClick={() => openTplEdit(row)}><Pencil className="h-4 w-4" /></Button></TableCell>
                      <TableCell><Button variant="ghost" size="icon" onClick={() => void deleteProgTemplate(row.id).then(load)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AdminPanel>
          </TabsContent>

          <TabsContent value="seeds" className="mt-4 space-y-4">
            {seeds && (['cities', 'areas', 'categories', 'storeTypes'] as const).map((key) => (
              <AdminPanel key={key}>
                <div className="p-4">
                  <Label className="capitalize">{key} (one per line)</Label>
                  <Textarea className="mt-2 font-mono text-sm" rows={5} value={seedText(key)} onChange={(e) => updateSeedText(key, e.target.value)} />
                </div>
              </AdminPanel>
            ))}
            <Button onClick={() => void saveSeeds()}>Save seed data</Button>
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <AdminPanel>
              <div className="p-4 space-y-4 max-w-md">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={settings?.automationMode ?? false}
                    onCheckedChange={(v) => settings && setSettings({ ...settings, automationMode: Boolean(v) })}
                  />
                  Automation mode — auto-publish on generate (skip manual queue)
                </label>
                <div>
                  <Label>Monthly page target</Label>
                  <Input type="number" min={1} value={settings?.monthlyPageTarget ?? 20} onChange={(e) => settings && setSettings({ ...settings, monthlyPageTarget: Number(e.target.value) || 20 })} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Published /pages/* URLs are merged automatically at{' '}
                  <a href="https://grabio.space/sitemap.xml" className="underline" target="_blank" rel="noreferrer">/sitemap.xml</a>.
                  Use Ping sitemap after bulk publishes.
                </p>
                <Button onClick={() => void saveSettings()}>Save settings</Button>
                {sitemapSnippet && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label>Sitemap snippet</Label>
                      <Button size="sm" variant="outline" onClick={() => void copySitemap()}><Copy className="h-3 w-3 mr-1" />Copy</Button>
                    </div>
                    <Textarea readOnly rows={8} className="font-mono text-xs" value={sitemapSnippet} />
                  </div>
                )}
              </div>
            </AdminPanel>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={tplDialog} onOpenChange={setTplDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingTpl ? 'Edit template' : 'New template'}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Name</Label><Input value={tplForm.name} onChange={(e) => setTplForm({ ...tplForm, name: e.target.value })} /></div>
            <div><Label>Title pattern</Label><Input value={tplForm.titlePattern} onChange={(e) => setTplForm({ ...tplForm, titlePattern: e.target.value })} /></div>
            <div><Label>Meta pattern</Label><Textarea value={tplForm.metaPattern} onChange={(e) => setTplForm({ ...tplForm, metaPattern: e.target.value })} rows={2} /></div>
            <div><Label>H1 pattern</Label><Input value={tplForm.h1Pattern} onChange={(e) => setTplForm({ ...tplForm, h1Pattern: e.target.value })} /></div>
            <div><Label>Body HTML pattern</Label><Textarea value={tplForm.bodyPattern} onChange={(e) => setTplForm({ ...tplForm, bodyPattern: e.target.value })} rows={3} /></div>
            <div><Label>FAQ question pattern</Label><Input value={tplForm.faqQuestionPattern} onChange={(e) => setTplForm({ ...tplForm, faqQuestionPattern: e.target.value })} /></div>
            <div><Label>FAQ answer pattern</Label><Textarea value={tplForm.faqAnswerPattern} onChange={(e) => setTplForm({ ...tplForm, faqAnswerPattern: e.target.value })} rows={2} /></div>
            <p className="text-xs text-gray-500">Slots: {'{city}'} {'{area}'} {'{category}'} {'{storeType}'}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTplDialog(false)}>Cancel</Button>
            <Button onClick={() => void saveTpl()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPageShell>
  );
};

export default AdminSEOProgrammatic;
