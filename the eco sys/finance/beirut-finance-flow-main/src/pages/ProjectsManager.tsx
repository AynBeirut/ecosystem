import { useState, useEffect, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import { useAppContext } from "@/context/AppContext";
import { useSupabaseTable, useSupabaseUserId } from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, FolderOpen, Calendar, DollarSign, Trash2, FileText, AlertTriangle, RefreshCw } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import type { InvoiceDraftFromProject } from "@/context/AppContext";

interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  client_id: string | null;
  client_name: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  budget: number | null;
  budget_currency: string;
  created_at: string;
  updated_at: string;
}

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  on_hold: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

const ProjectsManager = () => {
  const { logout, clients, createInvoice, generateInvoiceDraftFromProject, retryFailedTimesheets, activeOrganizationId } = useAppContext();
  const { toast } = useToast();
  const userId = useSupabaseUserId();
  const { data: projects, loading, insert, update, remove } = useSupabaseTable<Project>("projects", userId, { scope: "organization", organizationId: activeOrganizationId });
  const [activeTab, setActiveTab] = useState("list");
  const [draft, setDraft] = useState<InvoiceDraftFromProject | null>(null);
  const [draftProjectName, setDraftProjectName] = useState("");
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [retrying, setRetrying] = useState(false);

  const refreshPendingCount = useCallback(async () => {
    try {
      const { count, error } = await (supabase as any)
        .from("timesheets")
        .select("id", { count: "exact", head: true })
        .eq("needs_sync", true);
      if (!error) setPendingSyncCount(count || 0);
    } catch (e) {
      console.error("[ProjectsManager][pendingSync]", e);
    }
  }, []);

  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  const handleManualRetry = async () => {
    setRetrying(true);
    try {
      await retryFailedTimesheets();
      await refreshPendingCount();
      toast({ title: "Retry complete", description: "Pending timesheet links re-processed." });
    } finally {
      setRetrying(false);
    }
  };


  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState("active");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budget, setBudget] = useState("");
  const [budgetCurrency, setBudgetCurrency] = useState("USD");

  const resetForm = () => {
    setName(""); setDescription(""); setClientId(""); setStatus("active");
    setStartDate(""); setEndDate(""); setBudget(""); setBudgetCurrency("USD");
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ title: "Error", description: "Project name is required", variant: "destructive" });
      return;
    }
    if (!activeOrganizationId) {
      toast({ title: "Error", description: "No active organization selected", variant: "destructive" });
      return;
    }
    const client = clients.find(c => c.id === clientId);
    const result = await insert({
      name: name.trim(),
      description: description || null,
      client_id: clientId || null,
      client_name: client?.name || null,
      status,
      start_date: startDate || null,
      end_date: endDate || null,
      budget: budget ? parseFloat(budget) : null,
      budget_currency: budgetCurrency,
      organization_id: activeOrganizationId,
    } as any);
    if (result) {
      toast({ title: "Success", description: "Project created" });
      resetForm();
      setActiveTab("list");
    }
  };

  const handleDelete = async (id: string) => {
    if (await remove(id)) {
      toast({ title: "Deleted", description: "Project removed" });
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    await update(id, { status: newStatus } as any);
  };

  const handleOpenInvoiceDraft = async (project: Project) => {
    const d = await generateInvoiceDraftFromProject(project.id);
    if (!d) {
      toast({ title: "No billable time available", description: "There are no unbilled, billable time entries for this project." });
      return;
    }
    setDraft(d);
    setDraftProjectName(project.name);
  };

  const handleConfirmCreateInvoice = async () => {
    if (!draft) return;
    setCreatingInvoice(true);
    try {
      const id = await createInvoice({
        clientId: draft.clientId,
        clientName: draft.clientName || draftProjectName,
        items: draft.items,
        amount: draft.amount,
        currency: draft.currency,
      } as any);
      if (id) {
        toast({ title: "Invoice created", description: `Invoice ${id} generated from ${draft.items.length} time entries.` });
        setDraft(null);
        refreshPendingCount();
      } else {
        toast({ title: "Failed to create invoice", variant: "destructive" });
      }
    } finally {
      setCreatingInvoice(false);
    }
  };

  const formatCurrency = (amount: number | null, currency: string) => {
    if (amount === null) return "—";
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  };

  return (
    <AppLayout onLogout={logout}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Projects</h1>
            <p className="text-muted-foreground">Manage your business projects</p>
          </div>
          <Button onClick={() => setActiveTab("create")}>
            <Plus className="mr-2 h-4 w-4" /> New Project
          </Button>
        </div>

        {pendingSyncCount > 0 && (
          <Card className="border-amber-300/60 bg-amber-50 dark:bg-amber-950/30">
            <CardContent className="flex items-center justify-between gap-4 py-3">
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="font-medium">
                  {pendingSyncCount} timesheet{pendingSyncCount === 1 ? "" : "s"} pending sync
                </span>
                <span className="text-muted-foreground hidden sm:inline">
                  — failed to link to invoice. Will retry automatically.
                </span>
              </div>
              <Button size="sm" variant="outline" onClick={handleManualRetry} disabled={retrying}>
                <RefreshCw className={`mr-2 h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`} />
                Retry now
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Active Projects</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{projects.filter(p => p.status === "active").length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Budget</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{formatCurrency(projects.reduce((s, p) => s + (p.budget || 0), 0), "USD")}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Completed</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{projects.filter(p => p.status === "completed").length}</p></CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="list">All Projects</TabsTrigger>
            <TabsTrigger value="create">New Project</TabsTrigger>
          </TabsList>

          <TabsContent value="list">
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : projects.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground"><FolderOpen className="mx-auto h-12 w-12 mb-4 opacity-50" />No projects yet. Create your first project.</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {projects.map(project => (
                  <Card key={project.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <h3 className="font-semibold text-lg">{project.name}</h3>
                          {project.description && <p className="text-sm text-muted-foreground">{project.description}</p>}
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            {project.client_name && <span>Client: {project.client_name}</span>}
                            {project.start_date && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{project.start_date}</span>}
                            {project.budget !== null && <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{formatCurrency(project.budget, project.budget_currency)}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select value={project.status} onValueChange={(v) => handleStatusChange(project.id, v)}>
                            <SelectTrigger className="w-32">
                              <Badge className={statusColors[project.status]}>{project.status}</Badge>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="on_hold">On Hold</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button variant="outline" size="sm" onClick={() => handleOpenInvoiceDraft(project)}>
                            <FileText className="mr-2 h-4 w-4" /> Invoice from Project
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(project.id)}>
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

          <TabsContent value="create">
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Project Name *</Label>
                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="Project name" />
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
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Project description" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Budget</Label>
                    <Input type="number" value={budget} onChange={e => setBudget(e.target.value)} placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Select value={budgetCurrency} onValueChange={setBudgetCurrency}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="LBP">LBP</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={handleCreate} className="w-full">Create Project</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Invoice draft from project: {draftProjectName}</DialogTitle>
              <DialogDescription>
                Review the prefilled time entries before creating the invoice.
              </DialogDescription>
            </DialogHeader>
            {draft && (
              <div className="space-y-3">
                <div className="text-sm">
                  <span className="text-muted-foreground">Client: </span>
                  <span className="font-medium">{draft.clientName || "—"}</span>
                </div>
                <div className="border rounded-md divide-y max-h-72 overflow-auto">
                  {draft.items.map(it => (
                    <div key={it.id} className="p-3 flex items-center justify-between text-sm">
                      <div className="flex-1 pr-2">
                        <div className="font-medium">{it.description}</div>
                        <div className="text-muted-foreground text-xs">
                          {it.quantity}h × {new Intl.NumberFormat("en-US", { style: "currency", currency: draft.currency }).format(it.unitPrice)}
                        </div>
                      </div>
                      <div className="font-semibold">
                        {new Intl.NumberFormat("en-US", { style: "currency", currency: draft.currency }).format(it.subtotal)}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="text-lg font-bold">
                    {new Intl.NumberFormat("en-US", { style: "currency", currency: draft.currency }).format(draft.amount)}
                  </span>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDraft(null)} disabled={creatingInvoice}>Cancel</Button>
              <Button onClick={handleConfirmCreateInvoice} disabled={creatingInvoice}>
                {creatingInvoice ? "Creating..." : "Create Invoice"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default ProjectsManager;
