import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useAppContext } from "@/context/AppContext";
import { useSupabaseTable, useSupabaseUserId } from "@/hooks/useSupabaseData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, CheckSquare, Clock, AlertTriangle, Trash2 } from "lucide-react";

interface Task {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  assigned_to: string | null;
  assigned_name: string | null;
  deadline: string | null;
  priority: string;
  status: string;
  linked_invoice_id: string | null;
  is_milestone: boolean;
  milestone_label: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Project { id: string; name: string; }

interface Timesheet {
  id: string;
  user_id: string;
  project_id: string | null;
  staff_id: string;
  staff_name: string;
  work_date: string;
  hours: number;
  rate: number;
  rate_currency: string;
  description: string | null;
  is_billable: boolean;
  invoiced: boolean;
  invoice_id: string | null;
  created_at: string;
  updated_at: string;
}

const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  medium: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  high: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  urgent: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

const statusColors: Record<string, string> = {
  todo: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  done: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

const TasksManager = () => {
  const { logout, invoices, createInvoice, activeOrganizationId } = useAppContext();
  const { toast } = useToast();
  const userId = useSupabaseUserId();
  const orgOpts = { scope: "organization" as const, organizationId: activeOrganizationId };
  const { data: tasks, loading: tasksLoading, insert: insertTask, update: updateTask, remove: removeTask } = useSupabaseTable<Task>("tasks", userId, orgOpts);
  const { data: timesheets, loading: tsLoading, insert: insertTs, update: updateTs, remove: removeTs } = useSupabaseTable<Timesheet>("timesheets", userId, orgOpts);
  const { data: projects } = useSupabaseTable<Project>("projects", userId, orgOpts);
  const [activeTab, setActiveTab] = useState("tasks");

  // Task form
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskProjectId, setTaskProjectId] = useState("");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [taskDeadline, setTaskDeadline] = useState("");
  const [taskIsMilestone, setTaskIsMilestone] = useState(false);
  const [taskMilestoneLabel, setTaskMilestoneLabel] = useState("");
  const [taskLinkedInvoice, setTaskLinkedInvoice] = useState("");

  // Timesheet form
  const [tsProjectId, setTsProjectId] = useState("");
  const [tsStaffName, setTsStaffName] = useState("");
  const [tsDate, setTsDate] = useState(new Date().toISOString().split("T")[0]);
  const [tsHours, setTsHours] = useState("");
  const [tsRate, setTsRate] = useState("");
  const [tsDesc, setTsDesc] = useState("");
  const [tsBillable, setTsBillable] = useState(true);

  const handleCreateTask = async () => {
    if (!taskTitle.trim()) {
      toast({ title: "Error", description: "Task title required", variant: "destructive" });
      return;
    }
    if (!activeOrganizationId) {
      toast({ title: "Error", description: "No active organization selected", variant: "destructive" });
      return;
    }
    const result = await insertTask({
      title: taskTitle.trim(),
      description: taskDesc || null,
      project_id: taskProjectId || null,
      assigned_to: null,
      assigned_name: null,
      deadline: taskDeadline || null,
      priority: taskPriority,
      status: "todo",
      linked_invoice_id: taskLinkedInvoice || null,
      is_milestone: taskIsMilestone,
      milestone_label: taskMilestoneLabel || null,
      completed_at: null,
      organization_id: activeOrganizationId,
    } as any);
    if (result) {
      toast({ title: "Task created" });
      setTaskTitle(""); setTaskDesc(""); setTaskProjectId(""); setTaskDeadline("");
      setTaskIsMilestone(false); setTaskMilestoneLabel(""); setTaskLinkedInvoice("");
    }
  };

  const handleTaskStatusChange = async (task: Task, newStatus: string) => {
    const updates: any = { status: newStatus };
    if (newStatus === "done") updates.completed_at = new Date().toISOString();
    if (newStatus !== "done") updates.completed_at = null;

    // Warn if marking milestone done but linked invoice not paid
    if (task.is_milestone && task.linked_invoice_id && newStatus === "done") {
      const invoice = invoices.find(i => i.id === task.linked_invoice_id);
      if (invoice && invoice.status !== "paid") {
        toast({ title: "Warning", description: "Linked invoice is not yet paid. Marking milestone as completed anyway.", variant: "destructive" });
      }
    }

    await updateTask(task.id, updates);
  };

  const handleLogTime = async () => {
    if (!tsStaffName.trim() || !tsHours || !tsRate) {
      toast({ title: "Error", description: "Staff name, hours and rate are required", variant: "destructive" });
      return;
    }
    if (!activeOrganizationId) {
      toast({ title: "Error", description: "No active organization selected", variant: "destructive" });
      return;
    }
    const result = await insertTs({
      project_id: tsProjectId || null,
      staff_id: `staff-${tsStaffName.toLowerCase().replace(/\s+/g, "-")}`,
      staff_name: tsStaffName.trim(),
      work_date: tsDate,
      hours: parseFloat(tsHours),
      rate: parseFloat(tsRate),
      rate_currency: "USD",
      description: tsDesc || null,
      is_billable: tsBillable,
      invoiced: false,
      invoice_id: null,
      organization_id: activeOrganizationId,
    } as any);
    if (result) {
      toast({ title: "Time logged" });
      setTsStaffName(""); setTsHours(""); setTsRate(""); setTsDesc("");
    }
  };

  const handleConvertTimesheetToInvoice = async (projectId: string) => {
    const billable = timesheets.filter(ts => ts.project_id === projectId && ts.is_billable && !ts.invoiced);
    if (billable.length === 0) {
      toast({ title: "No billable hours", description: "No uninvoiced billable hours for this project", variant: "destructive" });
      return;
    }
    const project = (projects as any[]).find((p: any) => p.id === projectId);
    const total = billable.reduce((s, ts) => s + ts.hours * ts.rate, 0);
    const invoiceId = await createInvoice({
      clientName: project?.client_name || "Client",
      clientId: project?.client_id || undefined,
      items: billable.map(ts => ({
        id: ts.id,
        description: `${ts.staff_name} - ${ts.description || "Billable hours"} (${ts.work_date})`,
        quantity: ts.hours,
        unitPrice: ts.rate,
        subtotal: ts.hours * ts.rate,
      })),
      amount: total,
      currency: billable[0]?.rate_currency || "USD",
      notes: `Timesheet invoice for project: ${project?.name || "Unknown"}`,
    });
    if (invoiceId) {
      for (const ts of billable) {
        await updateTs(ts.id, { invoiced: true, invoice_id: invoiceId } as any);
      }
      toast({ title: "Invoice created", description: `Invoice ${invoiceId} generated from ${billable.length} timesheet entries` });
    }
  };

  const formatCurrency = (amount: number, curr: string = "USD") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: curr }).format(amount);

  const todoTasks = tasks.filter(t => t.status === "todo");
  const inProgressTasks = tasks.filter(t => t.status === "in_progress");
  const doneTasks = tasks.filter(t => t.status === "done");

  // Group timesheets by project
  const tsProjects = [...new Set(timesheets.map(t => t.project_id).filter(Boolean))];

  return (
    <AppLayout onLogout={logout}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Tasks & Timesheets</h1>
          <p className="text-muted-foreground">Track work, milestones, and billable hours</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Open Tasks</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{todoTasks.length + inProgressTasks.length}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Completed</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-green-600">{doneTasks.length}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Hours</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{timesheets.reduce((s, t) => s + t.hours, 0).toFixed(1)}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Unbilled Amount</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-amber-600">{formatCurrency(timesheets.filter(t => t.is_billable && !t.invoiced).reduce((s, t) => s + t.hours * t.rate, 0))}</p></CardContent></Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="timesheets">Timesheets</TabsTrigger>
          </TabsList>

          <TabsContent value="tasks">
            <div className="space-y-4">
              {/* Quick create */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex gap-2 flex-wrap">
                    <Input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="Task title..." className="flex-1 min-w-[200px]" onKeyDown={e => e.key === "Enter" && handleCreateTask()} />
                    <Select value={taskProjectId} onValueChange={setTaskProjectId}>
                      <SelectTrigger className="w-40"><SelectValue placeholder="Project" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No project</SelectItem>
                        {(projects as any[]).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={taskPriority} onValueChange={setTaskPriority}>
                      <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="date" value={taskDeadline} onChange={e => setTaskDeadline(e.target.value)} className="w-40" />
                    <div className="flex items-center gap-2">
                      <Checkbox checked={taskIsMilestone} onCheckedChange={(v) => setTaskIsMilestone(!!v)} />
                      <Label className="text-sm">Milestone</Label>
                    </div>
                    <Button onClick={handleCreateTask}><Plus className="h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>

              {/* Task columns */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* To Do */}
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2"><Clock className="h-4 w-4" /> To Do ({todoTasks.length})</h3>
                  <div className="space-y-2">
                    {todoTasks.map(task => (
                      <Card key={task.id}>
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-sm">{task.title}</p>
                              {task.deadline && <p className="text-xs text-muted-foreground">Due: {new Date(task.deadline).toLocaleDateString()}</p>}
                            </div>
                            <div className="flex items-center gap-1">
                              <Badge className={`text-xs ${priorityColors[task.priority]}`}>{task.priority}</Badge>
                              {task.is_milestone && <Badge variant="outline" className="text-xs">Milestone</Badge>}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => handleTaskStatusChange(task, "in_progress")} className="text-xs h-7">Start</Button>
                            <Button size="sm" variant="ghost" onClick={() => removeTask(task.id)} className="text-xs h-7"><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* In Progress */}
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> In Progress ({inProgressTasks.length})</h3>
                  <div className="space-y-2">
                    {inProgressTasks.map(task => (
                      <Card key={task.id} className="border-blue-200 dark:border-blue-800">
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-sm">{task.title}</p>
                              {task.deadline && <p className="text-xs text-muted-foreground">Due: {new Date(task.deadline).toLocaleDateString()}</p>}
                            </div>
                            <Badge className={`text-xs ${priorityColors[task.priority]}`}>{task.priority}</Badge>
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => handleTaskStatusChange(task, "done")} className="text-xs h-7"><CheckSquare className="mr-1 h-3 w-3" />Done</Button>
                            <Button size="sm" variant="ghost" onClick={() => handleTaskStatusChange(task, "todo")} className="text-xs h-7">Back</Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Done */}
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2"><CheckSquare className="h-4 w-4" /> Done ({doneTasks.length})</h3>
                  <div className="space-y-2">
                    {doneTasks.slice(0, 10).map(task => (
                      <Card key={task.id} className="opacity-75">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between">
                            <p className="font-medium text-sm line-through">{task.title}</p>
                            <Button size="sm" variant="ghost" onClick={() => removeTask(task.id)} className="h-6"><Trash2 className="h-3 w-3" /></Button>
                          </div>
                          {task.completed_at && <p className="text-xs text-muted-foreground">Completed: {new Date(task.completed_at).toLocaleDateString()}</p>}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="timesheets">
            <div className="space-y-4">
              {/* Log time form */}
              <Card>
                <CardHeader><CardTitle className="text-lg">Log Time</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Staff Name *</Label>
                      <Input value={tsStaffName} onChange={e => setTsStaffName(e.target.value)} placeholder="Name" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Project</Label>
                      <Select value={tsProjectId} onValueChange={setTsProjectId}>
                        <SelectTrigger><SelectValue placeholder="Project" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No project</SelectItem>
                          {(projects as any[]).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Date</Label>
                      <Input type="date" value={tsDate} onChange={e => setTsDate(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Hours *</Label>
                      <Input type="number" step="0.25" value={tsHours} onChange={e => setTsHours(e.target.value)} placeholder="0" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Rate ($/hr) *</Label>
                      <Input type="number" value={tsRate} onChange={e => setTsRate(e.target.value)} placeholder="0" />
                    </div>
                    <div className="flex items-end">
                      <Button onClick={handleLogTime} className="w-full">Log</Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={tsBillable} onCheckedChange={(v) => setTsBillable(!!v)} />
                    <Label>Billable</Label>
                  </div>
                </CardContent>
              </Card>

              {/* Timesheets by project */}
              {tsProjects.map(projId => {
                const projTs = timesheets.filter(t => t.project_id === projId);
                const project = (projects as any[]).find((p: any) => p.id === projId);
                const totalHrs = projTs.reduce((s, t) => s + t.hours, 0);
                const billableAmount = projTs.filter(t => t.is_billable && !t.invoiced).reduce((s, t) => s + t.hours * t.rate, 0);

                return (
                  <Card key={projId}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">{project?.name || "Unknown Project"}</CardTitle>
                          <CardDescription>{totalHrs.toFixed(1)} hours logged • {formatCurrency(billableAmount)} unbilled</CardDescription>
                        </div>
                        {billableAmount > 0 && (
                          <Button variant="outline" onClick={() => handleConvertTimesheetToInvoice(projId!)}>
                            Convert to Invoice
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {projTs.map(ts => (
                          <div key={ts.id} className="flex items-center justify-between p-2 border rounded text-sm">
                            <div className="flex items-center gap-3">
                              <span className="font-medium">{ts.staff_name}</span>
                              <span className="text-muted-foreground">{ts.work_date}</span>
                              <span>{ts.hours}h × {formatCurrency(ts.rate)}</span>
                              {ts.description && <span className="text-muted-foreground">— {ts.description}</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{formatCurrency(ts.hours * ts.rate)}</span>
                              {ts.invoiced ? <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 text-xs">Invoiced</Badge> : ts.is_billable ? <Badge variant="outline" className="text-xs">Billable</Badge> : null}
                              <Button size="sm" variant="ghost" onClick={() => removeTs(ts.id)}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {/* Unassigned timesheets */}
              {timesheets.filter(t => !t.project_id).length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-lg">Unassigned Timesheets</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {timesheets.filter(t => !t.project_id).map(ts => (
                        <div key={ts.id} className="flex items-center justify-between p-2 border rounded text-sm">
                          <div className="flex items-center gap-3">
                            <span className="font-medium">{ts.staff_name}</span>
                            <span className="text-muted-foreground">{ts.work_date}</span>
                            <span>{ts.hours}h × {formatCurrency(ts.rate)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{formatCurrency(ts.hours * ts.rate)}</span>
                            <Button size="sm" variant="ghost" onClick={() => removeTs(ts.id)}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {timesheets.length === 0 && !tsLoading && (
                <Card><CardContent className="py-12 text-center text-muted-foreground"><Clock className="mx-auto h-12 w-12 mb-4 opacity-50" />No time entries yet. Log your first timesheet above.</CardContent></Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default TasksManager;
