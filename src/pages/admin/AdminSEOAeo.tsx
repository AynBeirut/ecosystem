import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
  AEO_PLATFORMS,
  aeoChecklistScore,
  createAeoCitation,
  createAeoFaq,
  createAeoSnippet,
  deleteAeoCitation,
  deleteAeoFaq,
  deleteAeoSnippet,
  generateFaqPageJsonLd,
  listAeoCitations,
  listAeoFaqs,
  listAeoSnippets,
  loadAeoContentChecklists,
  updateAeoFaq,
  updateAeoSnippet,
  validateStructuredDataUrl,
  type AeoContentChecklist,
  type SchemaValidationResult,
  type SeoAeoCitationInput,
  type SeoAeoFaqInput,
  type SeoAeoFaqRecord,
  type SeoAeoSnippetInput,
  type SeoAeoSnippetRecord,
} from '@/lib/seoAeo';
import {
  Bot,
  CheckCircle2,
  Copy,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';

const EMPTY_FAQ: SeoAeoFaqInput = {
  question: '',
  answer: '',
  assignedPageUrl: '',
  schemaAdded: false,
};

const EMPTY_CITATION: SeoAeoCitationInput = {
  loggedDate: new Date().toISOString().split('T')[0],
  platform: 'chatgpt',
  queryUsed: '',
  citedUrl: '',
  notes: '',
};

const EMPTY_SNIPPET: SeoAeoSnippetInput = {
  keyword: '',
  snippetHolder: '',
  notes: '',
};

function PassIcon({ ok }: { ok: boolean }) {
  return ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-red-400" />;
}

const AdminSEOAeo: React.FC = () => {
  const [faqs, setFaqs] = useState<SeoAeoFaqRecord[]>([]);
  const [citations, setCitations] = useState<Awaited<ReturnType<typeof listAeoCitations>>>([]);
  const [snippets, setSnippets] = useState<SeoAeoSnippetRecord[]>([]);
  const [contentChecks, setContentChecks] = useState<AeoContentChecklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedFaqIds, setSelectedFaqIds] = useState<Set<string>>(new Set());
  const [generatedSchema, setGeneratedSchema] = useState('');
  const [validateUrl, setValidateUrl] = useState('https://grabio.space/solutions/inventory');
  const [validation, setValidation] = useState<SchemaValidationResult | null>(null);
  const [validating, setValidating] = useState(false);

  const [faqDialog, setFaqDialog] = useState(false);
  const [editingFaq, setEditingFaq] = useState<SeoAeoFaqRecord | null>(null);
  const [faqForm, setFaqForm] = useState<SeoAeoFaqInput>(EMPTY_FAQ);

  const [citationForm, setCitationForm] = useState<SeoAeoCitationInput>(EMPTY_CITATION);
  const [snippetForm, setSnippetForm] = useState<SeoAeoSnippetInput>(EMPTY_SNIPPET);
  const [editingSnippet, setEditingSnippet] = useState<SeoAeoSnippetRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [faqRows, citationRows, snippetRows, checks] = await Promise.all([
        listAeoFaqs(),
        listAeoCitations(),
        listAeoSnippets(),
        loadAeoContentChecklists(),
      ]);
      setFaqs(faqRows);
      setCitations(citationRows);
      setSnippets(snippetRows);
      setContentChecks(checks);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to load AEO data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedFaqs = useMemo(
    () => faqs.filter((f) => selectedFaqIds.has(f.id)),
    [faqs, selectedFaqIds],
  );

  const toggleFaqSelect = (id: string) => {
    setSelectedFaqIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openFaqCreate = () => {
    setEditingFaq(null);
    setFaqForm(EMPTY_FAQ);
    setFaqDialog(true);
  };

  const openFaqEdit = (row: SeoAeoFaqRecord) => {
    setEditingFaq(row);
    setFaqForm({
      question: row.question,
      answer: row.answer,
      assignedPageUrl: row.assignedPageUrl,
      schemaAdded: row.schemaAdded,
    });
    setFaqDialog(true);
  };

  const saveFaq = async () => {
    if (!faqForm.question.trim() || !faqForm.answer.trim()) {
      setMessage('Question and answer required');
      return;
    }
    if (editingFaq) await updateAeoFaq(editingFaq.id, faqForm);
    else await createAeoFaq(faqForm);
    setFaqDialog(false);
    await load();
  };

  const runSchemaGenerate = () => {
    if (!selectedFaqs.length) {
      setMessage('Select at least one FAQ');
      return;
    }
    setGeneratedSchema(generateFaqPageJsonLd(selectedFaqs));
  };

  const copySchema = async () => {
    if (!generatedSchema) return;
    await navigator.clipboard.writeText(generatedSchema);
    setMessage('FAQPage JSON-LD copied.');
  };

  const runValidate = async () => {
    setValidating(true);
    setMessage(null);
    try {
      setValidation(await validateStructuredDataUrl(validateUrl));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setValidating(false);
    }
  };

  const addCitation = async () => {
    if (!citationForm.queryUsed.trim()) return;
    await createAeoCitation(citationForm);
    setCitationForm({ ...EMPTY_CITATION, loggedDate: new Date().toISOString().split('T')[0] });
    await load();
  };

  const saveSnippet = async () => {
    if (!snippetForm.keyword.trim()) return;
    if (editingSnippet) await updateAeoSnippet(editingSnippet.id, snippetForm);
    else await createAeoSnippet(snippetForm);
    setSnippetForm(EMPTY_SNIPPET);
    setEditingSnippet(null);
    await load();
  };

  return (
    <AdminPageShell
      title="SEO AEO"
      description="FAQ schema, AI citation tracking, featured snippets, and structured data validation for answer engines."
    >
      <div className="space-y-6">
        {message && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</div>
        )}

        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Refresh
        </Button>

        <Tabs defaultValue="faqs">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="faqs">FAQ bank</TabsTrigger>
            <TabsTrigger value="schema">Schema generator</TabsTrigger>
            <TabsTrigger value="checklist">Content AEO</TabsTrigger>
            <TabsTrigger value="citations">AI citations</TabsTrigger>
            <TabsTrigger value="snippets">Featured snippets</TabsTrigger>
            <TabsTrigger value="validator">Schema validator</TabsTrigger>
          </TabsList>

          <TabsContent value="faqs" className="mt-4 space-y-4">
            <Button onClick={openFaqCreate}><Plus className="h-4 w-4 mr-2" />Add FAQ</Button>
            <AdminPanel>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Question</TableHead>
                    <TableHead>Page</TableHead>
                    <TableHead>Schema on page</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {faqs.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-gray-500 py-8">No FAQs yet.</TableCell></TableRow>
                  )}
                  {faqs.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="max-w-[280px]">
                        <p className="font-medium truncate">{row.question}</p>
                        <p className="text-xs text-gray-500 truncate">{row.answer}</p>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.assignedPageUrl || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={row.schemaAdded ? 'default' : 'outline'}>
                          {row.schemaAdded ? 'Yes' : 'No'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openFaqEdit(row)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => void deleteAeoFaq(row.id).then(load)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AdminPanel>
          </TabsContent>

          <TabsContent value="schema" className="mt-4 space-y-4">
            <AdminPanel>
              <div className="p-4 space-y-3">
                <p className="text-sm text-gray-600">Select FAQs to build FAQPage JSON-LD.</p>
                {faqs.map((row) => (
                  <label key={row.id} className="flex items-start gap-2 text-sm border rounded-md p-2 cursor-pointer">
                    <Checkbox checked={selectedFaqIds.has(row.id)} onCheckedChange={() => toggleFaqSelect(row.id)} />
                    <span><strong>{row.question}</strong></span>
                  </label>
                ))}
                <div className="flex gap-2">
                  <Button onClick={runSchemaGenerate} disabled={!faqs.length}>Generate schema</Button>
                  <Button variant="outline" onClick={() => void copySchema()} disabled={!generatedSchema}>
                    <Copy className="h-4 w-4 mr-2" />Copy
                  </Button>
                </div>
                {generatedSchema && (
                  <Textarea readOnly value={generatedSchema} rows={12} className="font-mono text-xs" />
                )}
              </div>
            </AdminPanel>
          </TabsContent>

          <TabsContent value="checklist" className="mt-4">
            <AdminPanel>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Content (Phase 3)</TableHead>
                    <TableHead>First sentence</TableHead>
                    <TableHead>&lt;50 words</TableHead>
                    <TableHead>H2 question</TableHead>
                    <TableHead>Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contentChecks.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-gray-500 py-8">Add FAQ sections in SEO Content drafts.</TableCell></TableRow>
                  )}
                  {contentChecks.map((row) => (
                    <TableRow key={row.contentId}>
                      <TableCell>{row.title}</TableCell>
                      <TableCell><PassIcon ok={row.answerInFirstSentence} /></TableCell>
                      <TableCell><PassIcon ok={row.answerUnder50Words} /> <span className="text-xs text-gray-500">({row.answerWordCount}w)</span></TableCell>
                      <TableCell><PassIcon ok={row.questionInH2} /></TableCell>
                      <TableCell>{aeoChecklistScore(row)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AdminPanel>
          </TabsContent>

          <TabsContent value="citations" className="mt-4 space-y-4">
            <AdminPanel>
              <div className="p-4 grid sm:grid-cols-2 gap-3 border-b">
                <div><Label>Date</Label><Input type="date" value={citationForm.loggedDate} onChange={(e) => setCitationForm({ ...citationForm, loggedDate: e.target.value })} /></div>
                <div>
                  <Label>Platform</Label>
                  <Select value={citationForm.platform} onValueChange={(v) => setCitationForm({ ...citationForm, platform: v as typeof citationForm.platform })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{AEO_PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2"><Label>Query used</Label><Input value={citationForm.queryUsed} onChange={(e) => setCitationForm({ ...citationForm, queryUsed: e.target.value })} /></div>
                <div className="sm:col-span-2"><Label>Cited URL</Label><Input value={citationForm.citedUrl} onChange={(e) => setCitationForm({ ...citationForm, citedUrl: e.target.value })} placeholder="https://grabio.space/solutions/..." /></div>
                <div className="sm:col-span-2"><Label>Notes</Label><Input value={citationForm.notes} onChange={(e) => setCitationForm({ ...citationForm, notes: e.target.value })} /></div>
                <Button onClick={() => void addCitation()}><Bot className="h-4 w-4 mr-2" />Log citation</Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Query</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {citations.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.loggedDate}</TableCell>
                      <TableCell><Badge variant="outline">{row.platform}</Badge></TableCell>
                      <TableCell className="max-w-[200px] truncate">{row.queryUsed}</TableCell>
                      <TableCell className="font-mono text-xs truncate max-w-[180px]">{row.citedUrl || '—'}</TableCell>
                      <TableCell><Button variant="ghost" size="icon" onClick={() => void deleteAeoCitation(row.id).then(load)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AdminPanel>
          </TabsContent>

          <TabsContent value="snippets" className="mt-4 space-y-4">
            <AdminPanel>
              <div className="p-4 grid sm:grid-cols-3 gap-3 border-b">
                <div><Label>Keyword</Label><Input value={snippetForm.keyword} onChange={(e) => setSnippetForm({ ...snippetForm, keyword: e.target.value })} /></div>
                <div><Label>Who holds snippet</Label><Input value={snippetForm.snippetHolder} onChange={(e) => setSnippetForm({ ...snippetForm, snippetHolder: e.target.value })} placeholder="competitor.com or Grabio" /></div>
                <div><Label>Notes</Label><Input value={snippetForm.notes} onChange={(e) => setSnippetForm({ ...snippetForm, notes: e.target.value })} /></div>
                <Button onClick={() => void saveSnippet()}>{editingSnippet ? 'Update' : 'Add'} snippet</Button>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>Keyword</TableHead><TableHead>Holder</TableHead><TableHead>Notes</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {snippets.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.keyword}</TableCell>
                      <TableCell>{row.snippetHolder}</TableCell>
                      <TableCell className="text-sm text-gray-600">{row.notes || '—'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => { setEditingSnippet(row); setSnippetForm({ keyword: row.keyword, snippetHolder: row.snippetHolder, notes: row.notes }); }}>Edit</Button>
                        <Button variant="ghost" size="icon" onClick={() => void deleteAeoSnippet(row.id).then(load)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AdminPanel>
          </TabsContent>

          <TabsContent value="validator" className="mt-4 space-y-4">
            <AdminPanel>
              <div className="p-4 space-y-3">
                <Label>Page URL</Label>
                <div className="flex flex-wrap gap-2">
                  <Input className="max-w-xl" value={validateUrl} onChange={(e) => setValidateUrl(e.target.value)} placeholder="https://grabio.space/solutions/inventory" />
                  <Button onClick={() => void runValidate()} disabled={validating}>
                    {validating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                    Validate JSON-LD
                  </Button>
                </div>
                {validation && (
                  <div className="space-y-2 mt-4">
                    <p className="text-sm font-medium">{validation.blockCount} JSON-LD block(s) on {validation.url}</p>
                    {validation.blocks.map((block) => (
                      <div key={block.index} className="border rounded-md p-3 text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          {block.valid ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-red-500" />}
                          <span>Block #{block.index + 1}: {block.types.join(', ') || 'unknown'}</span>
                        </div>
                        {block.errors.length > 0 && <p className="text-xs text-red-600">{block.errors.join('; ')}</p>}
                        <pre className="text-xs bg-gray-50 p-2 rounded mt-2 overflow-x-auto">{block.rawPreview}</pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </AdminPanel>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={faqDialog} onOpenChange={setFaqDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingFaq ? 'Edit FAQ' : 'Add FAQ'}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Question</Label><Input value={faqForm.question} onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })} /></div>
            <div><Label>Answer</Label><Textarea value={faqForm.answer} onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })} rows={4} /></div>
            <div><Label>Assigned page URL</Label><Input value={faqForm.assignedPageUrl} onChange={(e) => setFaqForm({ ...faqForm, assignedPageUrl: e.target.value })} /></div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={faqForm.schemaAdded} onCheckedChange={(v) => setFaqForm({ ...faqForm, schemaAdded: Boolean(v) })} />
              Schema added on live page
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFaqDialog(false)}>Cancel</Button>
            <Button onClick={() => void saveFaq()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPageShell>
  );
};

export default AdminSEOAeo;
