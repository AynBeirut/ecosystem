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
  countAcquiredThisMonth,
  createAcquiredLink,
  createLinkProspect,
  deleteAcquiredLink,
  deleteLinkProspect,
  downloadCsv,
  exportAcquiredCsv,
  exportProspectsCsv,
  isDeadLinkStatus,
  LINK_PROSPECT_STATUSES,
  LINK_PROSPECT_TYPES,
  listAcquiredLinks,
  listLinkProspects,
  loadLinkSettings,
  recheckAcquiredLink,
  saveLinkSettings,
  updateAcquiredLink,
  updateLinkProspect,
  type LinkProspectStatus,
  type LinkProspectType,
  type SeoLinkAcquired,
  type SeoLinkAcquiredInput,
  type SeoLinkProspect,
  type SeoLinkProspectInput,
} from '@/lib/seoLinkBuilding';
import {
  Download,
  Link2,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';

const EMPTY_PROSPECT: SeoLinkProspectInput = {
  domain: '',
  drScore: null,
  type: 'directory',
  status: 'prospecting',
  notes: '',
};

const EMPTY_ACQUIRED: SeoLinkAcquiredInput = {
  domain: '',
  linkingUrl: '',
  targetUrl: 'https://grabio.space/',
  anchorText: '',
  drScore: null,
  acquiredDate: new Date().toISOString().split('T')[0],
  notes: '',
};

const AdminSEOLinks: React.FC = () => {
  const [prospects, setProspects] = useState<SeoLinkProspect[]>([]);
  const [acquired, setAcquired] = useState<SeoLinkAcquired[]>([]);
  const [monthlyTarget, setMonthlyTarget] = useState(5);
  const [loading, setLoading] = useState(true);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [prospectDialog, setProspectDialog] = useState(false);
  const [editingProspect, setEditingProspect] = useState<SeoLinkProspect | null>(null);
  const [prospectForm, setProspectForm] = useState<SeoLinkProspectInput>(EMPTY_PROSPECT);

  const [acquiredDialog, setAcquiredDialog] = useState(false);
  const [editingAcquired, setEditingAcquired] = useState<SeoLinkAcquired | null>(null);
  const [acquiredForm, setAcquiredForm] = useState<SeoLinkAcquiredInput>(EMPTY_ACQUIRED);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, a, settings] = await Promise.all([listLinkProspects(), listAcquiredLinks(), loadLinkSettings()]);
      setProspects(p);
      setAcquired(a);
      setMonthlyTarget(settings.monthlyLinkTarget);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const acquiredThisMonth = useMemo(() => countAcquiredThisMonth(acquired), [acquired]);
  const progressPct = useMemo(
    () => (monthlyTarget > 0 ? Math.min(100, Math.round((acquiredThisMonth / monthlyTarget) * 100)) : 0),
    [acquiredThisMonth, monthlyTarget],
  );

  const saveTarget = async () => {
    await saveLinkSettings({ monthlyLinkTarget: monthlyTarget });
    setMessage('Monthly target saved.');
  };

  const openProspectCreate = () => {
    setEditingProspect(null);
    setProspectForm(EMPTY_PROSPECT);
    setProspectDialog(true);
  };

  const openProspectEdit = (row: SeoLinkProspect) => {
    setEditingProspect(row);
    setProspectForm({
      domain: row.domain,
      drScore: row.drScore,
      type: row.type,
      status: row.status,
      notes: row.notes,
    });
    setProspectDialog(true);
  };

  const saveProspect = async () => {
    if (!prospectForm.domain.trim()) return;
    if (editingProspect) await updateLinkProspect(editingProspect.id, prospectForm);
    else await createLinkProspect(prospectForm);
    setProspectDialog(false);
    await load();
  };

  const openAcquiredCreate = () => {
    setEditingAcquired(null);
    setAcquiredForm({ ...EMPTY_ACQUIRED, acquiredDate: new Date().toISOString().split('T')[0] });
    setAcquiredDialog(true);
  };

  const openAcquiredEdit = (row: SeoLinkAcquired) => {
    setEditingAcquired(row);
    setAcquiredForm({
      domain: row.domain,
      linkingUrl: row.linkingUrl,
      targetUrl: row.targetUrl,
      anchorText: row.anchorText,
      drScore: row.drScore,
      acquiredDate: row.acquiredDate,
      notes: row.notes,
    });
    setAcquiredDialog(true);
  };

  const saveAcquired = async () => {
    if (!acquiredForm.linkingUrl.trim()) return;
    if (editingAcquired) await updateAcquiredLink(editingAcquired.id, acquiredForm);
    else await createAcquiredLink(acquiredForm);
    setAcquiredDialog(false);
    await load();
  };

  const runRecheck = async (row: SeoLinkAcquired) => {
    setCheckingId(row.id);
    try {
      const status = await recheckAcquiredLink(row.id, row.linkingUrl);
      setMessage(`Checked ${row.linkingUrl} → HTTP ${status}`);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Recheck failed');
    } finally {
      setCheckingId(null);
    }
  };

  return (
    <AdminPageShell title="SEO Link Building" description="Outreach pipeline, acquired backlinks log, monthly targets, and dead link checks.">
      <div className="space-y-6">
        {message && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</div>}

        <AdminPanel>
          <div className="p-4 space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm text-gray-500">Monthly link target progress</p>
                <p className="text-2xl font-bold">{acquiredThisMonth} / {monthlyTarget}</p>
              </div>
              <div className="flex items-end gap-2">
                <div>
                  <Label htmlFor="link-target">Target</Label>
                  <Input id="link-target" type="number" min={1} className="w-24" value={monthlyTarget} onChange={(e) => setMonthlyTarget(Number(e.target.value) || 5)} />
                </div>
                <Button variant="outline" onClick={() => void saveTarget()}>Save</Button>
              </div>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
              <div className="h-full bg-teal-600 transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="text-xs text-gray-500">{progressPct}% of monthly target</p>
          </div>
        </AdminPanel>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}Refresh
          </Button>
          <Button variant="outline" onClick={() => downloadCsv('seo-prospects.csv', exportProspectsCsv(prospects))}>
            <Download className="h-4 w-4 mr-2" />Export prospects
          </Button>
          <Button variant="outline" onClick={() => downloadCsv('seo-acquired-links.csv', exportAcquiredCsv(acquired))}>
            <Download className="h-4 w-4 mr-2" />Export acquired
          </Button>
        </div>

        <Tabs defaultValue="prospects">
          <TabsList>
            <TabsTrigger value="prospects">Prospects</TabsTrigger>
            <TabsTrigger value="acquired">Acquired links</TabsTrigger>
          </TabsList>

          <TabsContent value="prospects" className="mt-4 space-y-4">
            <Button onClick={openProspectCreate}><Plus className="h-4 w-4 mr-2" />Add prospect</Button>
            <AdminPanel>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domain</TableHead>
                    <TableHead>DR</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prospects.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-500">No prospects yet.</TableCell></TableRow>}
                  {prospects.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-sm">{row.domain}</TableCell>
                      <TableCell>{row.drScore ?? '—'}</TableCell>
                      <TableCell><Badge variant="outline">{row.type.replace('_', ' ')}</Badge></TableCell>
                      <TableCell><Badge>{row.status}</Badge></TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-gray-600">{row.notes || '—'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openProspectEdit(row)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => void deleteLinkProspect(row.id).then(load)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AdminPanel>
          </TabsContent>

          <TabsContent value="acquired" className="mt-4 space-y-4">
            <Button onClick={openAcquiredCreate}><Plus className="h-4 w-4 mr-2" />Log acquired link</Button>
            <AdminPanel>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Linking URL</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Anchor</TableHead>
                    <TableHead>DR</TableHead>
                    <TableHead>Acquired</TableHead>
                    <TableHead>HTTP</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {acquired.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-500">No acquired links logged.</TableCell></TableRow>}
                  {acquired.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs max-w-[180px] truncate">{row.linkingUrl}</TableCell>
                      <TableCell className="font-mono text-xs max-w-[140px] truncate">{row.targetUrl}</TableCell>
                      <TableCell className="max-w-[120px] truncate">{row.anchorText || '—'}</TableCell>
                      <TableCell>{row.drScore ?? '—'}</TableCell>
                      <TableCell>{row.acquiredDate}</TableCell>
                      <TableCell>
                        {row.lastHttpStatus != null ? (
                          <Badge variant={isDeadLinkStatus(row.lastHttpStatus) ? 'destructive' : 'outline'}>
                            {row.lastHttpStatus}
                          </Badge>
                        ) : (
                          '—'
                        )}
                        {row.lastCheckedAt && <div className="text-[10px] text-gray-400">{row.lastCheckedAt}</div>}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="sm" variant="outline" disabled={checkingId === row.id} onClick={() => void runRecheck(row)}>
                          {checkingId === row.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openAcquiredEdit(row)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => void deleteAcquiredLink(row.id).then(load)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AdminPanel>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={prospectDialog} onOpenChange={setProspectDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingProspect ? 'Edit prospect' : 'Add prospect'}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Domain</Label><Input value={prospectForm.domain} onChange={(e) => setProspectForm({ ...prospectForm, domain: e.target.value })} placeholder="example.com" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>DR score</Label><Input type="number" min={0} max={100} value={prospectForm.drScore ?? ''} onChange={(e) => setProspectForm({ ...prospectForm, drScore: e.target.value ? Number(e.target.value) : null })} /></div>
              <div>
                <Label>Type</Label>
                <Select value={prospectForm.type} onValueChange={(v) => setProspectForm({ ...prospectForm, type: v as LinkProspectType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LINK_PROSPECT_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={prospectForm.status} onValueChange={(v) => setProspectForm({ ...prospectForm, status: v as LinkProspectStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LINK_PROSPECT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Notes</Label><Textarea value={prospectForm.notes} onChange={(e) => setProspectForm({ ...prospectForm, notes: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProspectDialog(false)}>Cancel</Button>
            <Button onClick={() => void saveProspect()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={acquiredDialog} onOpenChange={setAcquiredDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingAcquired ? 'Edit acquired link' : 'Log acquired link'}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Referring domain</Label><Input value={acquiredForm.domain} onChange={(e) => setAcquiredForm({ ...acquiredForm, domain: e.target.value })} /></div>
            <div><Label>Linking URL</Label><Input value={acquiredForm.linkingUrl} onChange={(e) => setAcquiredForm({ ...acquiredForm, linkingUrl: e.target.value })} /></div>
            <div><Label>Target URL on grabio.space</Label><Input value={acquiredForm.targetUrl} onChange={(e) => setAcquiredForm({ ...acquiredForm, targetUrl: e.target.value })} /></div>
            <div><Label>Anchor text</Label><Input value={acquiredForm.anchorText} onChange={(e) => setAcquiredForm({ ...acquiredForm, anchorText: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>DR score</Label><Input type="number" min={0} max={100} value={acquiredForm.drScore ?? ''} onChange={(e) => setAcquiredForm({ ...acquiredForm, drScore: e.target.value ? Number(e.target.value) : null })} /></div>
              <div><Label>Date acquired</Label><Input type="date" value={acquiredForm.acquiredDate} onChange={(e) => setAcquiredForm({ ...acquiredForm, acquiredDate: e.target.value })} /></div>
            </div>
            <div><Label>Notes</Label><Textarea value={acquiredForm.notes} onChange={(e) => setAcquiredForm({ ...acquiredForm, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcquiredDialog(false)}>Cancel</Button>
            <Button onClick={() => void saveAcquired()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPageShell>
  );
};

export default AdminSEOLinks;
