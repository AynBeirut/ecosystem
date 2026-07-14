import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useAppContext } from "@/context/AppContext";
import { useSupabaseTable, useSupabaseUserId } from "@/hooks/useSupabaseData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, Sparkles, Upload, ArrowRight, Loader2, Trash2, Save } from "lucide-react";

interface Deliverable {
  name: string;
  description: string;
  estimated_days: number;
}

interface TimelinePhase {
  phase: string;
  description: string;
  duration_days: number;
  order: number;
}

interface Proposal {
  id: string;
  user_id: string;
  project_id: string | null;
  client_id: string | null;
  client_name: string | null;
  title: string;
  rfp_text: string | null;
  technical_response: string | null;
  scope_summary: string | null;
  deliverables: Deliverable[];
  timeline: TimelinePhase[];
  estimated_value: number | null;
  currency: string;
  status: string;
  converted_invoice_id: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Project {
  id: string;
  name: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  converted: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
};

const ProposalsManager = () => {
  const { logout, clients, createInvoice, user, activeOrganizationId } = useAppContext();
  const { toast } = useToast();
  const userId = useSupabaseUserId();
  const orgOpts = { scope: "organization" as const, organizationId: activeOrganizationId };
  const { data: proposals, loading, insert, update, remove } = useSupabaseTable<Proposal>("proposals", userId, orgOpts);
  const { data: projects } = useSupabaseTable<Project>("projects", userId, orgOpts);
  const [activeTab, setActiveTab] = useState("list");
  const [generating, setGenerating] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [convertTarget, setConvertTarget] = useState<Proposal | null>(null);

  // Form state for new proposal
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("none");
  const [projectId, setProjectId] = useState("none");
  const [rfpText, setRfpText] = useState("");
  const [technicalResponse, setTechnicalResponse] = useState("");
  const [scopeSummary, setScopeSummary] = useState("");
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [timeline, setTimeline] = useState<TimelinePhase[]>([]);
  const [estimatedValue, setEstimatedValue] = useState("");
  const [currency, setCurrency] = useState("USD");

  const resetForm = () => {
    setTitle(""); setClientId("none"); setProjectId("none"); setRfpText("");
    setTechnicalResponse(""); setScopeSummary("");
    setDeliverables([]); setTimeline([]);
    setEstimatedValue(""); setCurrency("USD");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type === "text/plain" || file.name.endsWith(".txt")) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setRfpText(ev.target?.result as string || "");
        toast({ title: "File loaded", description: "RFP text extracted from file" });
      };
      reader.readAsText(file);
    } else {
      toast({ title: "Info", description: "For best results, paste the RFP text directly or use a .txt file" });
    }
  };

  // Task 1: AI generation with proper error handling
  const handleGenerateAI = async () => {
    if (!rfpText.trim() || rfpText.trim().length < 20) {
      toast({ title: "Error", description: "Please provide RFP text (at least 20 characters)", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-proposal`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            rfpText,
            companyName: user?.company?.name || "",
            companyDescription: user?.company?.description || "",
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Unknown error" }));
        if (response.status === 400) {
          toast({ title: "RFP Too Short", description: err.error || "Please provide more detailed RFP content.", variant: "destructive" });
        } else if (response.status === 402) {
          toast({ title: "Credits Exhausted", description: err.error || "AI credits exhausted. Please add credits.", variant: "destructive" });
        } else if (response.status === 429) {
          toast({ title: "Rate Limited", description: err.error || "Too many requests. Please try again shortly.", variant: "destructive" });
        } else {
          toast({ title: "Error", description: err.error || "AI generation failed. Please try again.", variant: "destructive" });
        }
        return;
      }

      const data = await response.json();
      const proposal = data.proposal;

      // Populate form fields from AI result
      if (proposal.title && !title) setTitle(proposal.title);
      setTechnicalResponse(proposal.technical_response || "");
      setScopeSummary(proposal.scope_summary || "");
      setDeliverables(
        (proposal.deliverables || []).map((d: Deliverable) => ({
          name: d.name || "",
          description: d.description || "",
          estimated_days: d.estimated_days || 0,
        }))
      );
      setTimeline(
        (proposal.timeline || []).map((t: TimelinePhase, i: number) => ({
          phase: t.phase || "",
          description: t.description || "",
          duration_days: t.duration_days || 0,
          order: t.order || i + 1,
        }))
      );
      if (proposal.estimated_value) setEstimatedValue(String(proposal.estimated_value));

      // Auto-save as draft
      if (!activeOrganizationId) {
        toast({ title: "Error", description: "No active organization selected", variant: "destructive" });
        return;
      }
      const client = clientId !== "none" ? clients.find(c => c.id === clientId) : null;
      const saved = await insert({
        title: proposal.title || title || "Untitled Proposal",
        client_id: clientId !== "none" ? clientId : null,
        client_name: client?.name || null,
        project_id: projectId !== "none" ? projectId : null,
        rfp_text: rfpText,
        technical_response: proposal.technical_response || null,
        scope_summary: proposal.scope_summary || null,
        deliverables: proposal.deliverables || [],
        timeline: proposal.timeline || [],
        estimated_value: proposal.estimated_value || null,
        currency,
        status: "draft",
        converted_invoice_id: null,
        submitted_at: null,
        organization_id: activeOrganizationId,
      } as any);

      if (saved) {
        setSelectedProposal(saved);
        toast({ title: "AI Draft Generated & Saved", description: "Proposal saved as draft. Edit details below." });
        // Load into edit view
        loadProposalIntoForm(saved);
        setActiveTab("view");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to generate proposal";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  // Load proposal data into form for editing
  const loadProposalIntoForm = (p: Proposal) => {
    setTitle(p.title);
    setClientId(p.client_id || "none");
    setProjectId(p.project_id || "none");
    setRfpText(p.rfp_text || "");
    setTechnicalResponse(p.technical_response || "");
    setScopeSummary(p.scope_summary || "");
    setDeliverables(
      (p.deliverables || []).map((d: Deliverable) => ({
        name: d.name || "",
        description: d.description || "",
        estimated_days: d.estimated_days || 0,
      }))
    );
    setTimeline(
      (p.timeline || []).map((t: TimelinePhase, i: number) => ({
        phase: t.phase || "",
        description: t.description || "",
        duration_days: t.duration_days || 0,
        order: t.order || i + 1,
      }))
    );
    setEstimatedValue(p.estimated_value ? String(p.estimated_value) : "");
    setCurrency(p.currency || "USD");
  };

  // Task 3: Save new proposal (from create tab, no AI)
  const handleSaveNew = async () => {
    if (!title.trim()) {
      toast({ title: "Error", description: "Title is required", variant: "destructive" });
      return;
    }
    if (!activeOrganizationId) {
      toast({ title: "Error", description: "No active organization selected", variant: "destructive" });
      return;
    }
    const client = clientId !== "none" ? clients.find(c => c.id === clientId) : null;
    const saved = await insert({
      title: title.trim(),
      client_id: clientId !== "none" ? clientId : null,
      client_name: client?.name || null,
      project_id: projectId !== "none" ? projectId : null,
      rfp_text: rfpText || null,
      technical_response: technicalResponse || null,
      scope_summary: scopeSummary || null,
      deliverables,
      timeline,
      estimated_value: estimatedValue ? parseFloat(estimatedValue) : null,
      currency,
      status: "draft",
      converted_invoice_id: null,
      submitted_at: null,
      organization_id: activeOrganizationId,
    } as any);
    if (saved) {
      toast({ title: "Saved", description: "Proposal saved as draft" });
      resetForm();
      setActiveTab("list");
    }
  };

  // Task 3: Update existing proposal
  const handleUpdateProposal = async () => {
    if (!selectedProposal) return;
    if (!title.trim()) {
      toast({ title: "Error", description: "Title is required", variant: "destructive" });
      return;
    }
    const client = clientId !== "none" ? clients.find(c => c.id === clientId) : null;
    const success = await update(selectedProposal.id, {
      title: title.trim(),
      client_id: clientId !== "none" ? clientId : null,
      client_name: client?.name || null,
      project_id: projectId !== "none" ? projectId : null,
      rfp_text: rfpText || null,
      technical_response: technicalResponse || null,
      scope_summary: scopeSummary || null,
      deliverables,
      timeline,
      estimated_value: estimatedValue ? parseFloat(estimatedValue) : null,
      currency,
    } as any);
    if (success) {
      const updated: Proposal = {
        ...selectedProposal,
        title: title.trim(),
        client_id: clientId !== "none" ? clientId : null,
        client_name: client?.name || null,
        project_id: projectId !== "none" ? projectId : null,
        rfp_text: rfpText || null,
        technical_response: technicalResponse || null,
        scope_summary: scopeSummary || null,
        deliverables,
        timeline,
        estimated_value: estimatedValue ? parseFloat(estimatedValue) : null,
        currency,
      };
      setSelectedProposal(updated);
      toast({ title: "Saved", description: "Proposal updated successfully" });
    }
  };

  // Task 4: Convert proposal to invoice
  const handleConvertToInvoice = async (proposal: Proposal) => {
    const items = (proposal.deliverables || []).length > 0
      ? proposal.deliverables.map((d: Deliverable, i: number) => ({
          id: `del-${Date.now()}-${i}`,
          description: `${d.name}${d.description ? `: ${d.description}` : ""}`,
          quantity: 1,
          unitPrice: proposal.estimated_value
            ? Math.round((proposal.estimated_value / proposal.deliverables.length) * 100) / 100
            : 0,
          subtotal: proposal.estimated_value
            ? Math.round((proposal.estimated_value / proposal.deliverables.length) * 100) / 100
            : 0,
        }))
      : [{
          id: `item-${Date.now()}`,
          description: proposal.title,
          quantity: 1,
          unitPrice: proposal.estimated_value || 0,
          subtotal: proposal.estimated_value || 0,
        }];

    const invoiceId = await createInvoice({
      clientId: proposal.client_id || undefined,
      clientName: proposal.client_name || "Unknown Client",
      items,
      amount: proposal.estimated_value || 0,
      currency: proposal.currency,
      notes: `Converted from Proposal: ${proposal.title}`,
    });

    if (invoiceId) {
      await update(proposal.id, { status: "converted", converted_invoice_id: invoiceId } as any);
      setSelectedProposal(prev => prev ? { ...prev, status: "converted", converted_invoice_id: invoiceId } : null);
      toast({ title: "Success", description: `Invoice ${invoiceId} created from proposal` });
    } else {
      toast({ title: "Error", description: "Failed to create invoice. Check limits or stock.", variant: "destructive" });
    }
    setConvertTarget(null);
  };

  // Task 2: Deliverable editing helpers
  const updateDeliverable = (index: number, field: keyof Deliverable, value: string | number) => {
    setDeliverables(prev => prev.map((d, i) => i === index ? { ...d, [field]: value } : d));
  };

  const removeDeliverable = (index: number) => {
    setDeliverables(prev => prev.filter((_, i) => i !== index));
  };

  const addDeliverable = () => {
    setDeliverables(prev => [...prev, { name: "", description: "", estimated_days: 0 }]);
  };

  // Task 2: Timeline editing helpers
  const updateTimelinePhase = (index: number, field: keyof TimelinePhase, value: string | number) => {
    setTimeline(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t));
  };

  const removeTimelinePhase = (index: number) => {
    setTimeline(prev => prev.filter((_, i) => i !== index));
  };

  const addTimelinePhase = () => {
    setTimeline(prev => [...prev, { phase: "", description: "", duration_days: 0, order: prev.length + 1 }]);
  };

  const formatCurrency = (amount: number | null, curr: string) => {
    if (amount === null) return "—";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: curr }).format(amount);
  };

  // Shared deliverables/timeline editor
  const renderDeliverablesEditor = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="font-semibold">Deliverables</Label>
        <Button type="button" variant="outline" size="sm" onClick={addDeliverable}>
          <Plus className="mr-1 h-3 w-3" /> Add Deliverable
        </Button>
      </div>
      {deliverables.map((d, i) => (
        <div key={i} className="p-3 border rounded-lg space-y-2">
          <div className="flex items-center gap-2">
            <Input value={d.name} onChange={e => updateDeliverable(i, "name", e.target.value)} placeholder="Deliverable name" className="flex-1" />
            <NumericInput allowDecimal={false} value={d.estimated_days as number | null | undefined} onValueChange={(n) => updateDeliverable(i, "estimated_days", n ?? 0)} placeholder="Days" className="w-20" />
            <Button type="button" variant="ghost" size="icon" onClick={() => removeDeliverable(i)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
          <Textarea value={d.description} onChange={e => updateDeliverable(i, "description", e.target.value)} placeholder="Description" rows={2} />
        </div>
      ))}
      {deliverables.length === 0 && <p className="text-sm text-muted-foreground">No deliverables added yet.</p>}
    </div>
  );

  const renderTimelineEditor = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="font-semibold">Timeline</Label>
        <Button type="button" variant="outline" size="sm" onClick={addTimelinePhase}>
          <Plus className="mr-1 h-3 w-3" /> Add Phase
        </Button>
      </div>
      {timeline.map((t, i) => (
        <div key={i} className="p-3 border rounded-lg space-y-2">
          <div className="flex items-center gap-2">
            <Input value={t.phase} onChange={e => updateTimelinePhase(i, "phase", e.target.value)} placeholder="Phase name" className="flex-1" />
            <NumericInput allowDecimal={false} value={t.duration_days as number | null | undefined} onValueChange={(n) => updateTimelinePhase(i, "duration_days", n ?? 0)} placeholder="Days" className="w-20" />
            <NumericInput allowDecimal={false} value={t.order as number | null | undefined} onValueChange={(n) => updateTimelinePhase(i, "order", n ?? 0)} placeholder="#" className="w-16" />
            <Button type="button" variant="ghost" size="icon" onClick={() => removeTimelinePhase(i)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
          <Textarea value={t.description} onChange={e => updateTimelinePhase(i, "description", e.target.value)} placeholder="Description" rows={2} />
        </div>
      ))}
      {timeline.length === 0 && <p className="text-sm text-muted-foreground">No timeline phases added yet.</p>}
    </div>
  );

  return (
    <AppLayout onLogout={logout}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Proposals</h1>
            <p className="text-muted-foreground">AI-powered proposal generation from RFPs</p>
          </div>
          <Button onClick={() => { resetForm(); setSelectedProposal(null); setActiveTab("create"); }}>
            <Plus className="mr-2 h-4 w-4" /> New Proposal
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{proposals.length}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Drafts</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{proposals.filter(p => p.status === "draft").length}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Accepted</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-green-600">{proposals.filter(p => p.status === "accepted").length}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Value</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatCurrency(proposals.reduce((s, p) => s + (p.estimated_value || 0), 0), "USD")}</p></CardContent></Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="list">All Proposals</TabsTrigger>
            <TabsTrigger value="create">New Proposal</TabsTrigger>
            {selectedProposal && <TabsTrigger value="view">Edit Proposal</TabsTrigger>}
          </TabsList>

          {/* LIST TAB */}
          <TabsContent value="list">
            {loading ? <p className="text-muted-foreground">Loading...</p> : proposals.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground"><FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />No proposals yet.</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {proposals.map(proposal => (
                  <Card key={proposal.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setSelectedProposal(proposal); loadProposalIntoForm(proposal); setActiveTab("view"); }}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <h3 className="font-semibold">{proposal.title}</h3>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            {proposal.client_name && <span>Client: {proposal.client_name}</span>}
                            <span>{new Date(proposal.created_at).toLocaleDateString()}</span>
                            {proposal.estimated_value && <span>{formatCurrency(proposal.estimated_value, proposal.currency)}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={statusColors[proposal.status]}>{proposal.status}</Badge>
                          {proposal.status !== "converted" && (
                            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setConvertTarget(proposal); }}>
                              <ArrowRight className="mr-1 h-3 w-3" /> Invoice
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); remove(proposal.id); }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* CREATE TAB */}
          <TabsContent value="create">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Step 1: Upload RFP</CardTitle>
                  <CardDescription>Paste RFP text or upload a text file, then generate AI draft</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <label className="cursor-pointer">
                      <input type="file" accept=".txt,.text" onChange={handleFileUpload} className="hidden" />
                      <Button variant="outline" asChild><span><Upload className="mr-2 h-4 w-4" /> Upload File</span></Button>
                    </label>
                  </div>
                  <Textarea value={rfpText} onChange={e => setRfpText(e.target.value)} placeholder="Paste the RFP content here..." rows={8} />
                  <Button onClick={handleGenerateAI} disabled={generating || !rfpText.trim()} className="w-full">
                    {generating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating AI Draft...</> : <><Sparkles className="mr-2 h-4 w-4" /> Generate AI Proposal Draft</>}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Step 2: Proposal Details</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Title *</Label>
                      <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Proposal title" />
                    </div>
                    <div className="space-y-2">
                      <Label>Client</Label>
                      <Select value={clientId} onValueChange={setClientId}>
                        <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No client</SelectItem>
                          {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Project</Label>
                      <Select value={projectId} onValueChange={setProjectId}>
                        <SelectTrigger><SelectValue placeholder="Link to project" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No project</SelectItem>
                          {(projects as Project[]).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Estimated Value</Label>
                      <div className="flex gap-2">
                        <Input type="number" value={estimatedValue} onChange={e => setEstimatedValue(e.target.value)} placeholder="0.00" />
                        <Select value={currency} onValueChange={setCurrency}>
                          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="LBP">LBP</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Scope Summary</Label>
                    <Textarea value={scopeSummary} onChange={e => setScopeSummary(e.target.value)} placeholder="Summary of scope..." rows={3} />
                  </div>
                  <div className="space-y-2">
                    <Label>Technical Response</Label>
                    <Textarea value={technicalResponse} onChange={e => setTechnicalResponse(e.target.value)} placeholder="Technical response..." rows={4} />
                  </div>

                  {renderDeliverablesEditor()}
                  {renderTimelineEditor()}

                  <Button onClick={handleSaveNew} className="w-full">
                    <Save className="mr-2 h-4 w-4" /> Save Proposal
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* VIEW / EDIT TAB */}
          <TabsContent value="view">
            {selectedProposal && (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{selectedProposal.title}</CardTitle>
                      <div className="flex gap-2">
                        <Select value={selectedProposal.status} onValueChange={async (v) => {
                          await update(selectedProposal.id, { status: v, ...(v === "submitted" ? { submitted_at: new Date().toISOString() } : {}) } as any);
                          setSelectedProposal({ ...selectedProposal, status: v });
                        }}>
                          <SelectTrigger className="w-36"><Badge className={statusColors[selectedProposal.status]}>{selectedProposal.status}</Badge></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="submitted">Submitted</SelectItem>
                            <SelectItem value="accepted">Accepted</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <CardDescription>
                      {selectedProposal.client_name && `Client: ${selectedProposal.client_name} • `}
                      Created: {new Date(selectedProposal.created_at).toLocaleDateString()}
                      {selectedProposal.converted_invoice_id && ` • Invoice: ${selectedProposal.converted_invoice_id}`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Title *</Label>
                        <Input value={title} onChange={e => setTitle(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Estimated Value</Label>
                        <div className="flex gap-2">
                          <Input type="number" value={estimatedValue} onChange={e => setEstimatedValue(e.target.value)} placeholder="0.00" />
                          <Select value={currency} onValueChange={setCurrency}>
                            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="USD">USD</SelectItem>
                              <SelectItem value="LBP">LBP</SelectItem>
                              <SelectItem value="EUR">EUR</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Scope Summary</Label>
                      <Textarea value={scopeSummary} onChange={e => setScopeSummary(e.target.value)} rows={3} />
                    </div>
                    <div className="space-y-2">
                      <Label>Technical Response</Label>
                      <Textarea value={technicalResponse} onChange={e => setTechnicalResponse(e.target.value)} rows={4} />
                    </div>

                    {renderDeliverablesEditor()}
                    {renderTimelineEditor()}

                    <div className="flex gap-2">
                      <Button onClick={handleUpdateProposal} className="flex-1">
                        <Save className="mr-2 h-4 w-4" /> Save Changes
                      </Button>
                      {selectedProposal.status !== "converted" && (
                        <Button variant="outline" onClick={() => setConvertTarget(selectedProposal)}>
                          <ArrowRight className="mr-2 h-4 w-4" /> Convert to Invoice
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Task 4: Confirmation dialog for invoice conversion */}
      <AlertDialog open={!!convertTarget} onOpenChange={(open) => { if (!open) setConvertTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convert to Invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a new invoice from "{convertTarget?.title}" with {convertTarget?.deliverables?.length || 0} line item(s) totaling {formatCurrency(convertTarget?.estimated_value ?? null, convertTarget?.currency || "USD")}.
              {convertTarget?.status === "converted" && " This proposal has already been converted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => convertTarget && handleConvertToInvoice(convertTarget)}
              disabled={convertTarget?.status === "converted"}
            >
              Convert
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default ProposalsManager;
