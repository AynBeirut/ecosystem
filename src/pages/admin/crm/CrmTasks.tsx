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
} from '@/lib/crmTaskPermissions';
import {
  createStoreTask,
  deleteStoreTask,
  fetchStoreTasks,
  filterStoreTasks,
  formatTaskAssigneeNames,
  formatTaskDueDate,
  isTaskDueToday,
  isTaskOverdue,
  nextStepTaskTitle,
  taskTypeRequiresDueDate,
  formatTaskScheduledWhen,
  TASK_ACTIVITY_TYPES,
  TASK_ACTIVITY_TYPE_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  updateStoreTask,
  type StoreTask,
  type StoreTaskFilter,
  type StoreTaskPriority,
  type TaskActivityType,
  type TaskAssignee,
} from '@/lib/crmTasks';
import { CRM_TASK_LABELS } from '@/lib/taskDomains';
import CrmActivityTypeIcon from '@/components/crm/CrmActivityTypeIcon';
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
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [taskType, setTaskType] = useState<TaskActivityType>('visit');
  const [completeMode, setCompleteMode] = useState<'done' | 'next_step'>('done');
  const [nextStepType, setNextStepType] = useState<TaskActivityType>('call');
  const [nextStepAt, setNextStepAt] = useState('');
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
        title: CRM_TASK_LABELS.loadFailed,
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
    setAssigneeIds(self?.userId ? [self.userId] : uid ? [uid] : []);
    setTaskType('visit');
    setFormOpen(false);
  };

  const openCreate = () => {
    resetForm();
    const self = assignable.find((a) => a.userId === uid) || assignable[0];
    setAssigneeIds(self?.userId ? [self.userId] : uid ? [uid] : []);
    setFormOpen(true);
  };

  const openEdit = (task: StoreTask) => {
    setEditing(task);
    setTitle(task.title);
    setDescription(task.description || '');
    setPriority(task.priority);
    setDueAt(task.dueAt ? task.dueAt.slice(0, 16) : '');
    if (task.assignees?.length) {
      setAssigneeIds(task.assignees.map((a) => a.userId));
    } else {
      setAssigneeIds(task.assignedToUserId ? [task.assignedToUserId] : []);
    }
    setTaskType(task.taskType || 'visit');
    setFormOpen(true);
  };

  const toggleAssignee = (userId: string) => {
    setAssigneeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const saveTask = async () => {
    if (!storeId || !uid || !title.trim()) {
      toast({ title: CRM_TASK_LABELS.titleRequired, variant: 'destructive' });
      return;
    }
    if (assigneeIds.length === 0) {
      toast({ title: 'Pick at least one assignee', variant: 'destructive' });
      return;
    }
    const selected: TaskAssignee[] = assigneeIds
      .map((id) => {
        const member = assignable.find((a) => a.userId === id);
        if (!member?.userId) return null;
        return { userId: member.userId, name: member.name, repId: member.id };
      })
      .filter(Boolean) as TaskAssignee[];
    if (selected.length === 0) {
      toast({ title: 'Pick valid assignees', variant: 'destructive' });
      return;
    }
    if (taskTypeRequiresDueDate(taskType) && !dueAt) {
      toast({
        title: `${TASK_ACTIVITY_TYPE_LABELS[taskType]} needs a date & time`,
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      const dueIso = dueAt ? new Date(dueAt).toISOString() : null;
      const primary = selected[0];
      if (editing) {
        await updateStoreTask(editing.id, {
          title: title.trim(),
          description: description.trim() || null,
          priority,
          dueAt: dueIso,
          assignedToUserId: primary.userId,
          assignedToName: selected.map((a) => a.name).join(', '),
          assignedToRepId: primary.repId || null,
          assignees: selected,
          taskType,
        });
        toast({ title: CRM_TASK_LABELS.updated });
      } else {
        await createStoreTask(
          storeId,
          {
            title: title.trim(),
            description: description.trim(),
            priority,
            dueAt: dueIso,
            assignees: selected,
            taskType,
          },
          { uid, name: userName },
        );
        toast({ title: CRM_TASK_LABELS.created });
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
    setCompleteMode('done');
    setNextStepType('call');
    setNextStepAt('');
  };

  const submitFeedback = async () => {
    if (!feedbackTask || !storeId) return;
    if (completeMode === 'next_step') {
      if (!nextStepAt) {
        toast({ title: 'Pick date/time for next step', variant: 'destructive' });
        return;
      }
      if (taskTypeRequiresDueDate(nextStepType) && !nextStepAt) {
        toast({
          title: `${TASK_ACTIVITY_TYPE_LABELS[nextStepType]} needs a date & time`,
          variant: 'destructive',
        });
        return;
      }
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const feedback = feedbackText.trim();
      const assignees: TaskAssignee[] = feedbackTask.assignees?.length
        ? feedbackTask.assignees
        : [{
            userId: feedbackTask.assignedToUserId,
            name: feedbackTask.assignedToName,
            repId: feedbackTask.assignedToRepId,
          }];

      if (completeMode === 'next_step') {
        const dueIso = new Date(nextStepAt).toISOString();
        const stepLabel = TASK_ACTIVITY_TYPE_LABELS[nextStepType];
        const completionNote = feedback
          ? `${feedback} · Next: ${stepLabel}`
          : `Next: ${stepLabel}`;
        await updateStoreTask(feedbackTask.id, {
          status: 'done',
          completedAt: now,
          completionFeedback: completionNote,
          feedbackAt: now,
        });
        await createStoreTask(
          storeId,
          {
            title: nextStepTaskTitle(nextStepType, feedbackTask.title),
            description: feedbackTask.description || undefined,
            priority: feedbackTask.priority,
            dueAt: dueIso,
            assignees,
            taskType: nextStepType,
          },
          { uid, name: userName },
        );
        toast({ title: `CRM task done — ${stepLabel} scheduled` });
      } else {
        await updateStoreTask(feedbackTask.id, {
          status: 'done',
          completedAt: now,
          completionFeedback: feedback || null,
          feedbackAt: feedback ? now : null,
        });
        toast({ title: CRM_TASK_LABELS.markedDone });
      }
      setFeedbackTask(null);
      setFeedbackText('');
      setCompleteMode('done');
      setNextStepAt('');
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
      toast({ title: CRM_TASK_LABELS.deleted });
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
          <h2 className="text-xl font-semibold">{CRM_TASK_LABELS.heading}</h2>
          <p className="text-sm text-muted-foreground">
            {openCount} open · {overdueCount} overdue · {todayCount} due today
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          {CRM_TASK_LABELS.new}
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
            {CRM_TASK_LABELS.emptyFiltered}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{CRM_TASK_LABELS.list} ({displayed.length})</CardTitle>
            <CardDescription>
              Admin sees all CRM tasks · sales manager sees team CRM tasks only (not admin tasks).
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>{CRM_TASK_LABELS.singular}</TableHead>
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
                      {task.taskType ? (
                        <div className="space-y-1">
                          <CrmActivityTypeIcon type={task.taskType} showLabel />
                          {task.dueAt && (task.taskType === 'call' || task.taskType === 'meeting') ? (
                            <p className="text-xs font-medium text-foreground">
                              {formatTaskScheduledWhen(task.dueAt)}
                            </p>
                          ) : null}
                        </div>
                      ) : '—'}
                    </TableCell>
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
                    <TableCell>{formatTaskAssigneeNames(task)}</TableCell>
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
            <DialogTitle>{editing ? CRM_TASK_LABELS.edit : CRM_TASK_LABELS.new}</DialogTitle>
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
                <Label>
                  Due date
                  {taskTypeRequiresDueDate(taskType) ? ' *' : ''}
                </Label>
                <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
                {taskTypeRequiresDueDate(taskType) ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    {TASK_ACTIVITY_TYPE_LABELS[taskType]} must have a scheduled date & time.
                  </p>
                ) : null}
              </div>
            </div>
            <div>
              <Label>Task type</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {TASK_ACTIVITY_TYPES.map((t) => (
                  <Button
                    key={t}
                    type="button"
                    size="sm"
                    variant={taskType === t ? 'default' : 'outline'}
                    onClick={() => setTaskType(t)}
                  >
                    <CrmActivityTypeIcon type={t} className="mr-1" />
                    {TASK_ACTIVITY_TYPE_LABELS[t]}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label>Assign to (one or more)</Label>
              <div className="mt-2 space-y-2 rounded-md border p-3 max-h-48 overflow-y-auto">
                {assignable.map((a) => (
                  <label key={a.userId!} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={assigneeIds.includes(a.userId!)}
                      onChange={() => toggleAssignee(a.userId!)}
                    />
                    <span>{a.name}</span>
                  </label>
                ))}
              </div>
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
            <DialogDescription>{feedbackTask?.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={completeMode === 'done' ? 'default' : 'outline'}
                onClick={() => setCompleteMode('done')}
              >
                Mark as done
              </Button>
              <Button
                type="button"
                size="sm"
                variant={completeMode === 'next_step' ? 'default' : 'outline'}
                onClick={() => setCompleteMode('next_step')}
              >
                Schedule next step
              </Button>
            </div>
            {completeMode === 'next_step' ? (
              <>
                <div>
                  <Label>Next step</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {TASK_ACTIVITY_TYPES.map((t) => (
                      <Button
                        key={t}
                        type="button"
                        size="sm"
                        variant={nextStepType === t ? 'default' : 'outline'}
                        onClick={() => setNextStepType(t)}
                      >
                        <CrmActivityTypeIcon type={t} className="mr-1" />
                        {TASK_ACTIVITY_TYPE_LABELS[t]}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>
                    {TASK_ACTIVITY_TYPE_LABELS[nextStepType]} date & time *
                  </Label>
                  <Input
                    type="datetime-local"
                    value={nextStepAt}
                    onChange={(e) => setNextStepAt(e.target.value)}
                  />
                </div>
              </>
            ) : null}
            <div>
              <Label>Notes {completeMode === 'done' ? '(optional)' : ''}</Label>
              <Textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder={completeMode === 'next_step' ? 'What was discussed?' : 'What was done?'}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeedbackTask(null)}>Cancel</Button>
            <Button onClick={submitFeedback} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : completeMode === 'next_step' ? 'Done & schedule' : 'Mark done'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CrmTasks;
