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
  buildLocalBusinessJsonLd,
  CITATION_STATUSES,
  createGeoCitation,
  createNapComparison,
  deleteGeoCitation,
  deleteNapComparison,
  gbpCompletionPercent,
  listGeoCitations,
  listNapComparisons,
  loadCityMetrics,
  loadGeoConfig,
  napMismatchFields,
  saveCityMetric,
  saveGeoCitation,
  saveGeoConfig,
  seedGeoCitationsIfEmpty,
  type CitationStatus,
  type GeoCityMetric,
  type GeoConfig,
  type GeoCitationRecord,
  type NapComparisonEntry,
  type OfficialNap,
} from '@/lib/seoGeo';
import {
  AlertTriangle,
  Copy,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';

const AdminSEOGeo: React.FC = () => {
  const [config, setConfig] = useState<GeoConfig | null>(null);
  const [cities, setCities] = useState<GeoCityMetric[]>([]);
  const [citations, setCitations] = useState<GeoCitationRecord[]>([]);
  const [napCompare, setNapCompare] = useState<NapComparisonEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [schemaJson, setSchemaJson] = useState('');
  const [newCitation, setNewCitation] = useState({ directory: '', directoryUrl: '', status: 'not_listed' as CitationStatus, notes: '' });
  const [compareForm, setCompareForm] = useState({ label: '', name: '', streetAddress: '', city: '', phone: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await seedGeoCitationsIfEmpty();
      const [cfg, cityRows, citationRows, compareRows] = await Promise.all([
        loadGeoConfig(),
        loadCityMetrics(),
        listGeoCitations(),
        listNapComparisons(),
      ]);
      setConfig(cfg);
      setCities(cityRows);
      setCitations(citationRows);
      setNapCompare(compareRows);
      setSchemaJson(buildLocalBusinessJsonLd(cfg.officialNap));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to load GEO data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const gbpPct = useMemo(
    () => gbpCompletionPercent(config?.gbpTasks ?? []),
    [config?.gbpTasks],
  );

  const napIssues = useMemo(() => {
    if (!config) return [];
    return napCompare.map((entry) => ({
      entry,
      mismatches: napMismatchFields(config.officialNap, entry),
    })).filter((row) => row.mismatches.length > 0);
  }, [config, napCompare]);

  const updateNap = (patch: Partial<OfficialNap>) => {
    if (!config) return;
    const officialNap = { ...config.officialNap, ...patch };
    setConfig({ ...config, officialNap });
    setSchemaJson(buildLocalBusinessJsonLd(officialNap));
  };

  const saveNapAndConfig = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await saveGeoConfig({
        officialNap: config.officialNap,
        gbpTasks: config.gbpTasks,
        entityChecklist: config.entityChecklist,
      });
      setMessage('GEO settings saved.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const saveCity = async (metric: GeoCityMetric) => {
    await saveCityMetric(metric);
    setMessage(`Saved metrics for ${metric.label}.`);
  };

  const copySchema = async () => {
    await navigator.clipboard.writeText(schemaJson);
    setMessage('LocalBusiness JSON-LD copied.');
  };

  const toggleGbpTask = (taskId: string) => {
    if (!config) return;
    setConfig({
      ...config,
      gbpTasks: config.gbpTasks.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t)),
    });
  };

  return (
    <AdminPageShell
      title="SEO GEO"
      description="Local search — city metrics, NAP consistency, citations, Google Business Profile, and entity tracking for Lebanon."
    >
      <div className="space-y-6">
        {message && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
          <Button onClick={() => void saveNapAndConfig()} disabled={saving || !config}>
            {saving ? 'Saving…' : 'Save all settings'}
          </Button>
        </div>

        <Tabs defaultValue="cities">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="cities">Per-city</TabsTrigger>
            <TabsTrigger value="nap">NAP &amp; schema</TabsTrigger>
            <TabsTrigger value="citations">Citations</TabsTrigger>
            <TabsTrigger value="gbp">Google Business</TabsTrigger>
            <TabsTrigger value="entity">Entity SEO</TabsTrigger>
          </TabsList>

          <TabsContent value="cities" className="mt-4">
            <AdminPanel>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>City</TableHead>
                    <TableHead>Active pages</TableHead>
                    <TableHead>Keywords</TableHead>
                    <TableHead>Traffic share %</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cities.map((row, idx) => (
                    <TableRow key={row.cityId}>
                      <TableCell className="font-medium">{row.label}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          className="h-8 w-24"
                          value={row.activePages}
                          onChange={(e) => {
                            const next = [...cities];
                            next[idx] = { ...row, activePages: Number(e.target.value) || 0 };
                            setCities(next);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          className="h-8 w-24"
                          value={row.keywordCount}
                          onChange={(e) => {
                            const next = [...cities];
                            next[idx] = { ...row, keywordCount: Number(e.target.value) || 0 };
                            setCities(next);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          className="h-8 w-24"
                          value={row.estimatedTrafficShare}
                          onChange={(e) => {
                            const next = [...cities];
                            next[idx] = { ...row, estimatedTrafficShare: Number(e.target.value) || 0 };
                            setCities(next);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => void saveCity(cities[idx])}>Save</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AdminPanel>
          </TabsContent>

          <TabsContent value="nap" className="mt-4 space-y-4">
            <AdminPanel>
              <div className="p-4 grid sm:grid-cols-2 gap-3">
                <div><Label>Official name</Label><Input value={config?.officialNap.name ?? ''} onChange={(e) => updateNap({ name: e.target.value })} /></div>
                <div><Label>Phone</Label><Input value={config?.officialNap.phone ?? ''} onChange={(e) => updateNap({ phone: e.target.value })} /></div>
                <div className="sm:col-span-2"><Label>Street address</Label><Input value={config?.officialNap.streetAddress ?? ''} onChange={(e) => updateNap({ streetAddress: e.target.value })} /></div>
                <div><Label>City</Label><Input value={config?.officialNap.city ?? ''} onChange={(e) => updateNap({ city: e.target.value })} /></div>
                <div><Label>Region</Label><Input value={config?.officialNap.region ?? ''} onChange={(e) => updateNap({ region: e.target.value })} /></div>
                <div><Label>Postal code</Label><Input value={config?.officialNap.postalCode ?? ''} onChange={(e) => updateNap({ postalCode: e.target.value })} /></div>
                <div><Label>Country</Label><Input value={config?.officialNap.country ?? 'LB'} onChange={(e) => updateNap({ country: e.target.value })} /></div>
                <div className="sm:col-span-2"><Label>Website URL</Label><Input value={config?.officialNap.url ?? ''} onChange={(e) => updateNap({ url: e.target.value })} /></div>
              </div>
            </AdminPanel>

            <AdminPanel>
              <div className="p-4 border-b flex items-center justify-between">
                <p className="font-semibold">LocalBusiness JSON-LD</p>
                <Button variant="outline" size="sm" onClick={() => void copySchema()}><Copy className="h-4 w-4 mr-1" />Copy</Button>
              </div>
              <Textarea readOnly value={schemaJson} rows={14} className="font-mono text-xs border-0 rounded-none" />
            </AdminPanel>

            <AdminPanel>
              <div className="p-4 border-b font-semibold flex items-center gap-2">
                <MapPin className="h-4 w-4" /> NAP consistency check
              </div>
              <div className="p-4 grid sm:grid-cols-2 gap-3 border-b">
                <Input placeholder="Source label (e.g. Facebook listing)" value={compareForm.label} onChange={(e) => setCompareForm({ ...compareForm, label: e.target.value })} />
                <Input placeholder="Name as listed" value={compareForm.name} onChange={(e) => setCompareForm({ ...compareForm, name: e.target.value })} />
                <Input placeholder="Address" value={compareForm.streetAddress} onChange={(e) => setCompareForm({ ...compareForm, streetAddress: e.target.value })} />
                <Input placeholder="City" value={compareForm.city} onChange={(e) => setCompareForm({ ...compareForm, city: e.target.value })} />
                <Input placeholder="Phone" value={compareForm.phone} onChange={(e) => setCompareForm({ ...compareForm, phone: e.target.value })} />
                <Button onClick={() => void createNapComparison(compareForm).then(() => { setCompareForm({ label: '', name: '', streetAddress: '', city: '', phone: '' }); return load(); })}>
                  <Plus className="h-4 w-4 mr-2" />Add comparison
                </Button>
              </div>
              {napIssues.length > 0 && (
                <div className="p-4 space-y-2">
                  {napIssues.map(({ entry, mismatches }) => (
                    <div key={entry.id} className="flex items-start gap-2 text-sm border border-amber-200 bg-amber-50 rounded-md p-3">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <strong>{entry.label}</strong> — mismatch: {mismatches.join(', ')}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => void deleteNapComparison(entry.id).then(load)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              )}
              {napCompare.length === 0 && (
                <p className="p-4 text-sm text-gray-500">Add directory listings to compare against official NAP.</p>
              )}
            </AdminPanel>
          </TabsContent>

          <TabsContent value="citations" className="mt-4 space-y-4">
            <AdminPanel>
              <div className="p-4 grid sm:grid-cols-4 gap-3 border-b">
                <Input placeholder="Directory name" value={newCitation.directory} onChange={(e) => setNewCitation({ ...newCitation, directory: e.target.value })} />
                <Input placeholder="URL" value={newCitation.directoryUrl} onChange={(e) => setNewCitation({ ...newCitation, directoryUrl: e.target.value })} />
                <Select value={newCitation.status} onValueChange={(v) => setNewCitation({ ...newCitation, status: v as CitationStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CITATION_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}</SelectContent>
                </Select>
                <Button onClick={() => void createGeoCitation(newCitation).then(() => { setNewCitation({ directory: '', directoryUrl: '', status: 'not_listed', notes: '' }); return load(); })}>Add</Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Directory</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {citations.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="font-medium">{row.directory}</div>
                        {row.directoryUrl && <div className="text-xs text-teal-600 truncate max-w-[200px]">{row.directoryUrl}</div>}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={row.status}
                          onValueChange={(v) => void saveGeoCitation(row.id, { ...row, status: v as CitationStatus }).then(load)}
                        >
                          <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                          <SelectContent>{CITATION_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8 text-xs"
                          value={row.notes}
                          onBlur={(e) => void saveGeoCitation(row.id, { ...row, notes: e.target.value })}
                          onChange={(e) => {
                            setCitations((prev) => prev.map((c) => (c.id === row.id ? { ...c, notes: e.target.value } : c)));
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => void deleteGeoCitation(row.id).then(load)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AdminPanel>
          </TabsContent>

          <TabsContent value="gbp" className="mt-4">
            <AdminPanel>
              <div className="p-4 border-b flex items-center justify-between">
                <p className="font-semibold">Google Business Profile checklist</p>
                <Badge>{gbpPct}% complete</Badge>
              </div>
              <div className="p-4 space-y-3">
                {config?.googleMapsUrl ? (
                  <p className="text-sm text-muted-foreground">
                    Maps:{' '}
                    <a href={config.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">
                      Public listing
                    </a>
                    {config.gbpManageUrl ? (
                      <>
                        {' · '}
                        <a href={config.gbpManageUrl} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">
                          Manage GBP
                        </a>
                      </>
                    ) : null}
                    {config.officialNap.gbpActiveSince ? (
                      <span className="block mt-1">Active since {config.officialNap.gbpActiveSince}</span>
                    ) : null}
                  </p>
                ) : null}
                {config?.gbpTasks.map((task) => (
                  <label key={task.id} className="flex items-center gap-3 text-sm border rounded-md p-3 cursor-pointer">
                    <Checkbox checked={task.completed} onCheckedChange={() => toggleGbpTask(task.id)} />
                    <span className={task.completed ? 'line-through text-gray-500' : ''}>{task.label}</span>
                  </label>
                ))}
              </div>
            </AdminPanel>
          </TabsContent>

          <TabsContent value="entity" className="mt-4">
            <AdminPanel>
              <div className="p-4 space-y-4">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={config?.entityChecklist.wikipediaMention ?? false}
                    onCheckedChange={(v) => config && setConfig({
                      ...config,
                      entityChecklist: { ...config.entityChecklist, wikipediaMention: Boolean(v) },
                    })}
                  />
                  Wikipedia mention exists
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={config?.entityChecklist.knowledgePanelTriggered ?? false}
                    onCheckedChange={(v) => config && setConfig({
                      ...config,
                      entityChecklist: { ...config.entityChecklist, knowledgePanelTriggered: Boolean(v) },
                    })}
                  />
                  Google Knowledge Panel triggered
                </label>
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    rows={4}
                    value={config?.entityChecklist.notes ?? ''}
                    onChange={(e) => config && setConfig({
                      ...config,
                      entityChecklist: { ...config.entityChecklist, notes: e.target.value },
                    })}
                  />
                </div>
              </div>
            </AdminPanel>
          </TabsContent>
        </Tabs>
      </div>
    </AdminPageShell>
  );
};

export default AdminSEOGeo;
