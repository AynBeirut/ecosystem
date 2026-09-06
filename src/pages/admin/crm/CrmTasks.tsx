import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import { fetchTeamFilterAgents, type CrmAssignableAgent } from '@/lib/crmAssignableAgents';
import {
  assignableTaskMembers,
  canManageTeamTaskList,
  canViewTaskFeedback,
  filterTasksByAssigneeFilter,
  filterTasksForViewer,
  taskFilterAgents,
  taskAssigneeFilterKey,
  webTaskUserRole,
} from '@/lib/storeTaskPermissions';
import {
  createStoreTask,
  deleteStoreTask,
  fetchStoreTasks,
  filterStoreTasks,
  formatTaskDueDate,
  isTaskDueToday,
  isTaskOverdue,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  updateStoreTask,
  type StoreTask,
  type StoreTaskFilter,
  type StoreTaskPriority,
} from '@/lib/storeTasks';
import { useToast } from '@/hooks/use-toast';

const FILTERS: Array<{ id: StoreTaskFilter; label: string }> = [
  { id: 'all', label: 'Open' },
  { id: 'mine', label: 'Mine' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'today', label: 'Today' },
  { id: 'done', label: 'Done' },
  { id: 'feedback', label: 'Feedback' },
];

const PRIORITIES: StoreTaskPriority[] = ['low', 'medium', 'high', 'urgent'];

function priorityVariant(p: StoreTaskPriority): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (p === 'urgent') return 'destructive';
  if (p === 'high') return 'default';
  return 'secondary';
}

const CrmTasks: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const storeId = getActualStoreId(user);
  const uid = user?.id || '';
  const userName = user?.name || user?.email || 'Admin';
  const { userRole, subAccountRole } = webTaskUserRole(user || {});
  const teamView = canManageTeamTaskList(userRole, subAccountRole);

  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StoreTaskFilter>('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [agents, setAgents] = useState<CrmAssignableAgent[]>([]);
  const [tasks, setTasks] = useState<StoreTask[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StoreTask | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<StoreTaskPriority>('medium');
  const [dueAt, setDueAt] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedbackTask, setFeedbackTask] = useState<StoreTask | null>(null);
  const [feedbackText, setFeedbackText] = useState('');

  const assignable = useMemo(
    () => assignableTaskMembers(userRole, subAccountRole, agents, uid),
    [userRole, subAccountRole, agents, uid],
  );

  const load = useCallback(async () => {
    if (!storeId || !uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [taskList, agentList] = await Promise.all([
        fetchStoreTasks(storeId),
        fetchTeamFilterAgents(storeId),
      ]);
      setAgents(agentList);
      setTasks(filterTasksForViewer(taskList, userRole, subAccountRole, uid, agentList));
    } catch (e) {
      toast({
        title: 'Failed to load tasks',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
      setTasks([]);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, [storeId, uid, userRole, subAccountRole, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const scopedTasks = useMemo(
    () => filterTasksForViewer(tasks, userRole, subAccountRole, uid, agents),
    [tasks, userRole, subAccountRole, uid, agents],
  );

  const displayed = useMemo(() => {
    const byAssignee = teamView
      ? filterTasksByAssigneeFilter(scopedTasks, assigneeFilter, agents)
      : scopedTasks;
    const rows = filterStoreTasks(byAssignee, filter, uid);
    if (filter !== 'feedback') return rows;
    return rows.filter((t) => canViewTaskFeedback(t, userRole, subAccountRole, uid, agents));
  }, [scopedTasks, assigneeFilter, agents, teamView, filter, uid, userRole, subAccountRole]);

  const overdueCount = useMemo(() => scopedTasks.filter((t) => isTaskOverdue(t)).length, [scopedTasks]);
  const todayCount = useMemo(() => scopedTasks.filter((t) => isTaskDueToday(t)).length, [scopedTasks]);
  const openCount = useMemo(
    () => scopedTasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled').length,
    [scopedTasks],
  );
  const filterAgents = taskFilterAgents(userRole, subAccountRole, agents, uid);

  const resetForm = () => {
    setEditing(null);
    setTitle('');
    setDescription('');
    setPriority('medium');
    setDueAt('');
    const self = assignable.find((a) => a.userId === uid) || assignable[0];
    setAssigneeId(self?.userId || uid);
    setFormOpen(false);
  };

  const openCreate = () => {
    resetForm();
    const self = assignable.find((a) => a.userId === uid) || assignable[0];
    setAssigneeId(self?.userId || uid);
    setFormOpen(true);
  };

  const openEdit = (task: StoreTask) => {
    setEditing(task);
    setTitle(task.title);
    setDescription(task.description || '');
    setPriority(task.priority);
    setDueAt(task.dueAt ? task.dueAt.slice(0, 16) : '');
    setAssigneeId(task.assignedToUserId);
    setFormOpen(true);
  };

  const saveTask = async () => {
    if (!storeId || !uid || !title.trim()) {
      toast({ title: 'Task title is required', variant: 'destructive' });
      return;
    }
    const member = assignable.find((a) => a.userId === assigneeId);
    if (!member?.userId) {
      toast({ title: 'Pick a valid assignee', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const dueIso = dueAt ? new Date(dueAt).toISOString() : null;
      if (editing) {
        await updateStoreTask(editing.id, {
          title: title.trim(),
          description: description.trim() || null,
          priority,
          dueAt: dueIso,
          assignedToUserId: member.userId,
          assignedToName: member.name,
          assignedToRepId: member.id,
        });
        toast({ title: 'Task updated' });
      } else {
        await createStoreTask(
          storeId,
          {
            title: title.trim(),
            description: description.trim(),
            priority,
            dueAt: dueIso,
            assignedToUserId: member.userId,
            assignedToName: member.name,
            assignedToRepId: member.id,
          },
          { uid, name: userName },
        );
        toast({ title: 'Task created' });
      }
      resetForm();
      await load();
    } catch (e) {
      toast({
        title: 'Save failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const markDone = async (task: StoreTask) => {
    setFeedbackTask(task);
    setFeedbackText(task.completionFeedback || '');
  };

  const submitFeedback = async () => {
    if (!feedbackTask) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      await updateStoreTask(feedbackTask.id, {
        status: 'done',
        completedAt: now,
        completionFeedback: feedbackText.trim() || null,
        feedbackAt: feedbackText.trim() ? now : null,
      });
      setFeedbackTask(null);
      setFeedbackText('');
      toast({ title: 'Task marked done' });
      await load();
    } catch (e) {
      toast({
        title: 'Could not complete task',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const removeTask = async (task: StoreTask) => {
    if (!window.confirm(`Delete task "${task.title}"?`)) return;
    try {
      await deleteStoreTask(task.id);
      toast({ title: 'Task deleted' });
      await load();
    } catch (e) {
      toast({
        title: 'Delete failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Team tasks</h2>
          <p className="text-sm text-muted-foreground">
            {openCount} open · {overdueCount} overdue · {todayCount} due today
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          New task
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f.id}
              size="sm"
              variant={filter === f.id ? 'default' : 'outline'}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </Button>
          ))}
          {teamView ? (
            <div className="w-full pt-2 border-t mt-2 space-y-2">
              <Label className="text-xs text-muted-foreground">Agent to-do list</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={assigneeFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setAssigneeFilter('all')}
                >
                  All agents
                </Button>
                {filterAgents.map((a) => {
                  const key = taskAssigneeFilterKey(a);
                  return (
                    <Button
                      key={a.id}
                      size="sm"
                      variant={assigneeFilter === key ? 'default' : 'outline'}
                      onClick={() => setAssigneeFilter(key)}
                    >
                      {a.name}
                    </Button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : displayed.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No tasks match these filters.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tasks ({displayed.length})</CardTitle>
            <CardDescription>
              Admin sees all tasks · sales manager sees team tasks only (not admin tasks).
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayed.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <div className="font-medium">{task.title}</div>
                      {task.description ? (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {task.description}
                        </p>
                      ) : null}
                      {task.completionFeedback &&
                      canViewTaskFeedback(task, userRole, subAccountRole, uid, agents) ? (
                        <p className="text-xs text-green-700 mt-1">Feedback: {task.completionFeedback}</p>
                      ) : null}
                    </TableCell>
                    <TableCell>{task.assignedToName}</TableCell>
                    <TableCell className={isTaskOverdue(task) ? 'text-red-600 font-medium' : ''}>
                      {formatTaskDueDate(task)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={priorityVariant(task.priority)}>
                        {TASK_PRIORITY_LABELS[task.priority]}
                      </Badge>
                    </TableCell>
                    <TableCell>{TASK_STATUS_LABELS[task.status]}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {task.status !== 'done' ? (
                          <Button size="icon" variant="ghost" title="Mark done" onClick={() => markDone(task)}>
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                        <Button size="icon" variant="ghost" title="Edit" onClick={() => openEdit(task)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {teamView ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Delete"
                            onClick={() => removeTask(task)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={formOpen} onOpenChange={(o) => !o && resetForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit task' : 'New task'}</DialogTitle>
            <DialogDescription>Assign to a sales team member.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as StoreTaskPriority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Due date</Label>
                <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Assign to</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {assignable.map((a) => (
                    <SelectItem key={a.userId!} value={a.userId!}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
            <Button onClick={saveTask} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(feedbackTask)} onOpenChange={(o) => !o && setFeedbackTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete task</DialogTitle>
            <DialogDescription>Optional feedback for {feedbackTask?.title}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="What was done?"
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeedbackTask(null)}>Cancel</Button>
            <Button onClick={submitFeedback} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Mark done'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CrmTasks;
