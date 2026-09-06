import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import ScreenSafeArea from '../../components/ScreenSafeArea';
import DatePickerField from '../../components/DatePickerField';
import { useAuth } from '../../context/AuthContext';
import { useResolvedStoreId } from '../../hooks/useResolvedStoreId';
import {
  agentDisplayName,
  fetchTaskTeamAgents,
  type CrmAssignableAgent,
} from '../../lib/crmMobileService';
import { resolveMobileCrmRepId } from '../../lib/crmRepResolve';
import {
  assignableTaskMembers,
  canAssignTaskToMember,
  canManageTeamTaskList,
  canViewTaskFeedback,
  filterTasksByAssigneeFilter,
  filterTasksForViewer,
  findTaskAssigneeMember,
  isStoreTaskAdmin,
  taskFilterAgents,
  taskAssigneeFilterKey,
  taskAssigneeSelectionKey,
} from '../../lib/storeTaskPermissions';
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
  type StoreTaskStatus,
} from '../../lib/storeTaskService';
import { COLORS, RADIUS, SHADOW } from '../../theme';

const FILTERS: Array<{ id: StoreTaskFilter; label: string }> = [
  { id: 'all', label: 'Open' },
  { id: 'mine', label: 'Mine' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'today', label: 'Today' },
  { id: 'done', label: 'Done' },
  { id: 'feedback', label: 'Feedback' },
];

const PRIORITIES: StoreTaskPriority[] = ['low', 'medium', 'high', 'urgent'];

export default function CrmTasksScreen() {
  const { user } = useAuth();
  const { storeId } = useResolvedStoreId();
  const teamView = canManageTeamTaskList(user?.userRole, user?.subAccountRole);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<StoreTaskFilter>('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [agents, setAgents] = useState<CrmAssignableAgent[]>([]);
  const [tasks, setTasks] = useState<StoreTask[]>([]);
  const [myRepId, setMyRepId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StoreTask | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<StoreTaskPriority>('medium');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [assigneeId, setAssigneeId] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedbackTask, setFeedbackTask] = useState<StoreTask | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [savingFeedback, setSavingFeedback] = useState(false);

  const assignable = useMemo(
    () =>
      assignableTaskMembers(
        user?.userRole,
        user?.subAccountRole,
        agents,
        user?.uid,
        myRepId,
      ),
    [user, agents, myRepId],
  );

  const load = useCallback(async () => {
    if (!storeId || !user?.uid) {
      setLoading(false);
      return;
    }
    setLoadError(null);
    try {
      const repId = await resolveMobileCrmRepId({ ...user, storeId });
      setMyRepId(repId);
      const [taskList, agentList] = await Promise.all([
        fetchStoreTasks(storeId, {
          managerView: teamView,
          assigneeUserId: teamView ? undefined : user.uid,
          assigneeRepId: teamView ? undefined : repId,
        }),
        fetchTaskTeamAgents(storeId),
      ]);
      setAgents(agentList);
      setTasks(
        filterTasksForViewer(
          taskList,
          user.userRole,
          user.subAccountRole,
          user.uid,
          agentList,
          repId,
        ),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not load tasks';
      setLoadError(msg.includes('permission') ? 'Tasks not available yet — ask admin to deploy Firestore rules.' : msg);
      setTasks([]);
      setAgents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [storeId, user, teamView]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const scopedTasks = useMemo(
    () => filterTasksForViewer(tasks, user?.userRole, user?.subAccountRole, user?.uid, agents, myRepId),
    [tasks, user?.userRole, user?.subAccountRole, user?.uid, agents, myRepId],
  );

  const displayed = useMemo(() => {
    const byAssignee = teamView
      ? filterTasksByAssigneeFilter(scopedTasks, assigneeFilter, agents)
      : scopedTasks;
    const rows = filterStoreTasks(byAssignee, filter, user?.uid || '');
    if (filter !== 'feedback') return rows;
    return rows.filter((t) => canViewTaskFeedback(t, user?.userRole, user?.subAccountRole, user?.uid, agents));
  }, [scopedTasks, assigneeFilter, agents, teamView, filter, user?.uid, user?.userRole, user?.subAccountRole]);

  const overdueCount = useMemo(() => scopedTasks.filter((t) => isTaskOverdue(t)).length, [scopedTasks]);
  const todayCount = useMemo(() => scopedTasks.filter((t) => isTaskDueToday(t)).length, [scopedTasks]);
  const openCount = useMemo(
    () => scopedTasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled').length,
    [scopedTasks],
  );
  const filterAgents = taskFilterAgents(user?.userRole, user?.subAccountRole, agents, user?.uid);

  const resetForm = () => {
    setEditing(null);
    setTitle('');
    setDescription('');
    setPriority('medium');
    setDueDate(null);
    const self = assignable.find((a) => a.userId === user?.uid) || assignable[0];
    setAssigneeId(self ? taskAssigneeSelectionKey(self) : user?.uid || '');
    setFormOpen(false);
  };

  const openCreate = () => {
    resetForm();
    const self = assignable.find((a) => a.userId === user?.uid) || assignable[0];
    setAssigneeId(self ? taskAssigneeSelectionKey(self) : user?.uid || '');
    setFormOpen(true);
  };

  const openEdit = (task: StoreTask) => {
    setEditing(task);
    setTitle(task.title);
    setDescription(task.description || '');
    setPriority(task.priority);
    setDueDate(task.dueAt ? new Date(task.dueAt) : null);
    setAssigneeId(
      task.assignedToUserId && findTaskAssigneeMember(assignable, task.assignedToUserId)
        ? taskAssigneeSelectionKey(findTaskAssigneeMember(assignable, task.assignedToUserId)!)
        : task.assignedToRepId || task.assignedToUserId,
    );
    setFormOpen(true);
  };

  const saveTask = async () => {
    if (!storeId || !user?.uid || !title.trim()) {
      Alert.alert('Missing', 'Task title is required.');
      return;
    }
    const member = findTaskAssigneeMember(assignable, assigneeId);
    if (!member) {
      Alert.alert('Assignee', 'Pick who this task is for.');
      return;
    }
    const assigneeUserId = member.userId || member.id;
    if (!canAssignTaskToMember(assigneeId, user.uid, assignable, user.userRole, user.subAccountRole)) {
      Alert.alert('Not allowed', 'You cannot assign this task to that person.');
      return;
    }
    setSaving(true);
    try {
      const dueAt = dueDate
        ? new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate(), 17, 0).toISOString()
        : null;
      const creatorName = user.teamMemberName || user.displayName || user.email || 'Team member';
      if (editing) {
        await updateStoreTask(editing.id, {
          title: title.trim(),
          description: description.trim() || null,
          priority,
          dueAt,
          assignedToUserId: assigneeUserId,
          assignedToName: member.name.replace(' (Sales manager)', ''),
          assignedToRepId: member.id,
        });
      } else {
        await createStoreTask(
          storeId,
          {
            title: title.trim(),
            description: description.trim(),
            priority,
            dueAt,
            assignedToUserId: assigneeUserId,
            assignedToName: member.name.replace(' (Sales manager)', ''),
            assignedToRepId: member.id,
          },
          { uid: user.uid, name: creatorName },
        );
      }
      resetForm();
      await load();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save task.');
    } finally {
      setSaving(false);
    }
  };

  const markDone = (task: StoreTask) => {
    setFeedbackTask(task);
    setFeedbackText(task.completionFeedback || '');
  };

  const submitDoneWithFeedback = async () => {
    if (!feedbackTask) return;
    setSavingFeedback(true);
    try {
      await updateStoreTask(feedbackTask.id, {
        status: 'done',
        completedAt: new Date().toISOString(),
        completionFeedback: feedbackText.trim() || null,
        feedbackAt: feedbackText.trim() ? new Date().toISOString() : null,
      });
      setFeedbackTask(null);
      setFeedbackText('');
      await load();
    } catch {
      Alert.alert('Error', 'Could not complete task.');
    } finally {
      setSavingFeedback(false);
    }
  };

  const setStatus = async (task: StoreTask, status: StoreTaskStatus) => {
    if (status === 'done') {
      markDone(task);
      return;
    }
    try {
      await updateStoreTask(task.id, {
        status,
        completedAt: null,
        completionFeedback: null,
        feedbackAt: null,
      });
      await load();
    } catch {
      Alert.alert('Error', 'Could not update task.');
    }
  };

  const confirmDelete = (task: StoreTask) => {
    Alert.alert('Delete task?', task.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void deleteStoreTask(task.id).then(load),
      },
    ]);
  };

  const canDeleteTask = (task: StoreTask) =>
    task.createdBy === user?.uid || isStoreTaskAdmin(user?.userRole);

  const renderTask = ({ item }: { item: StoreTask }) => {
    const showFeedback = canViewTaskFeedback(item, user?.userRole, user?.subAccountRole, user?.uid, agents);
    return (
      <TouchableOpacity
        style={[styles.card, isTaskOverdue(item) && styles.cardOverdue, isTaskDueToday(item) && !isTaskOverdue(item) && styles.cardToday]}
        onPress={() => openEdit(item)}
      >
        <View style={styles.cardRow}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <View style={[styles.badge, item.priority === 'urgent' || item.priority === 'high' ? styles.badgeUrgent : styles.badgeNormal]}>
            <Text style={styles.badgeText}>{TASK_PRIORITY_LABELS[item.priority]}</Text>
          </View>
        </View>
        {item.description ? <Text style={styles.cardSub} numberOfLines={2}>{item.description}</Text> : null}
        <Text style={styles.cardMeta}>
          {item.assignedToName}
          {' · '}
          {TASK_STATUS_LABELS[item.status]}
          {' · '}
          <Text style={isTaskOverdue(item) ? styles.dueOverdue : styles.dueNormal}>{formatTaskDueDate(item)}</Text>
        </Text>
        {showFeedback && item.completionFeedback ? (
          <View style={styles.feedbackBox}>
            <Text style={styles.feedbackLabel}>Feedback</Text>
            <Text style={styles.feedbackText}>{item.completionFeedback}</Text>
          </View>
        ) : null}
        <View style={styles.actionRow}>
          {item.status !== 'done' ? (
            <TouchableOpacity style={styles.miniBtn} onPress={() => void setStatus(item, item.status === 'todo' ? 'in_progress' : 'done')}>
              <Text style={styles.miniBtnText}>{item.status === 'todo' ? 'Start' : 'Done'}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.miniBtn} onPress={() => void setStatus(item, 'todo')}>
              <Text style={styles.miniBtnText}>Reopen</Text>
            </TouchableOpacity>
          )}
          {canDeleteTask(item) ? (
            <TouchableOpacity style={[styles.miniBtn, styles.deleteBtn]} onPress={() => confirmDelete(item)}>
              <Text style={[styles.miniBtnText, styles.deleteText]}>Delete</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const listHeader = (
    <View>
      <Text style={styles.heading}>Team tasks</Text>
      <Text style={styles.sub}>
        {teamView
          ? (isStoreTaskAdmin(user?.userRole) ? 'Admin — all team tasks' : 'Manager — your tasks + sales team')
          : 'Your assigned tasks only'}
      </Text>
      {loadError ? (
        <TouchableOpacity style={styles.errorBanner} onPress={() => { setLoading(true); void load(); }}>
          <Text style={styles.errorBannerText}>{loadError} Tap to retry.</Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNum}>{overdueCount}</Text>
          <Text style={styles.summaryLabel}>Overdue</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNum}>{todayCount}</Text>
          <Text style={styles.summaryLabel}>Today</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNum}>{openCount}</Text>
          <Text style={styles.summaryLabel}>Open</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        {FILTERS.map((f) => (
          <TouchableOpacity key={f.id} style={[styles.chip, filter === f.id && styles.chipActive]} onPress={() => setFilter(f.id)}>
            <Text style={[styles.chipText, filter === f.id && styles.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {teamView ? (
        <>
          <Text style={styles.filterLabel}>Agent to-do list</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
            <TouchableOpacity style={[styles.chip, assigneeFilter === 'all' && styles.chipActive]} onPress={() => setAssigneeFilter('all')}>
              <Text style={[styles.chipText, assigneeFilter === 'all' && styles.chipTextActive]}>All agents</Text>
            </TouchableOpacity>
            {filterAgents.map((a) => {
              const key = taskAssigneeFilterKey(a);
              return (
                <TouchableOpacity
                  key={a.id}
                  style={[styles.chip, assigneeFilter === key && styles.chipActive]}
                  onPress={() => setAssigneeFilter(key)}
                >
                  <Text style={[styles.chipText, assigneeFilter === key && styles.chipTextActive]} numberOfLines={1}>
                    {a.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {assigneeFilter !== 'all' ? (
            <Text style={styles.scopeHint}>Tasks for {agentDisplayName(agents, assigneeFilter)}</Text>
          ) : null}
        </>
      ) : null}

      <TouchableOpacity style={styles.createBtn} onPress={openCreate}>
        <Text style={styles.createBtnText}>+ New task</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <ScreenSafeArea style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      </ScreenSafeArea>
    );
  }

  return (
    <ScreenSafeArea style={styles.container}>
      <FlatList
        data={displayed}
        keyExtractor={(item) => item.id}
        renderItem={renderTask}
        contentContainerStyle={styles.list}
        ListHeaderComponent={listHeader}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} colors={[COLORS.primary]} />}
        ListEmptyComponent={<Text style={styles.empty}>No tasks yet. Tap + New task to add one.</Text>}
      />

      <Modal visible={formOpen} animationType="slide" transparent onRequestClose={resetForm}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editing ? 'Edit task' : 'New task'}</Text>
            <TextInput style={styles.input} placeholder="Title *" value={title} onChangeText={setTitle} placeholderTextColor={COLORS.textMuted} />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Notes (optional)"
              value={description}
              onChangeText={setDescription}
              multiline
              placeholderTextColor={COLORS.textMuted}
            />
            <Text style={styles.fieldLabel}>Assign to</Text>
            {assignable.length === 0 ? (
              <Text style={styles.scopeHint}>Loading team… pull down to refresh if empty.</Text>
            ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
              {assignable.map((a) => {
                const key = taskAssigneeSelectionKey(a);
                return (
                <TouchableOpacity
                  key={a.id}
                  style={[styles.chip, assigneeId === key && styles.chipActive]}
                  onPress={() => setAssigneeId(key)}
                >
                  <Text style={[styles.chipText, assigneeId === key && styles.chipTextActive]}>
                    {a.userId === user?.uid ? `${a.name.replace(' (Sales manager)', '')} (you)` : a.name.replace(' (Sales manager)', '')}
                  </Text>
                </TouchableOpacity>
                );
              })}
            </ScrollView>
            )}
            <Text style={styles.fieldLabel}>Priority</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
              {PRIORITIES.map((p) => (
                <TouchableOpacity key={p} style={[styles.chip, priority === p && styles.chipActive]} onPress={() => setPriority(p)}>
                  <Text style={[styles.chipText, priority === p && styles.chipTextActive]}>{TASK_PRIORITY_LABELS[p]}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <DatePickerField label="Due date (optional)" value={dueDate} onChange={setDueDate} placeholder="No due date" />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={resetForm}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={() => void saveTask()} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(feedbackTask)} animationType="slide" transparent onRequestClose={() => setFeedbackTask(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Mark done</Text>
            <Text style={styles.sub}>{feedbackTask?.title}</Text>
            <Text style={styles.fieldLabel}>Feedback (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="What was done? Any notes for your manager…"
              value={feedbackText}
              onChangeText={setFeedbackText}
              multiline
              placeholderTextColor={COLORS.textMuted}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setFeedbackTask(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={() => void submitDoneWithFeedback()} disabled={savingFeedback}>
                {savingFeedback ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Complete</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  heading: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, paddingHorizontal: 12, paddingTop: 8 },
  sub: { fontSize: 13, color: COLORS.textSecondary, paddingHorizontal: 12, marginBottom: 8 },
  summaryRow: { flexDirection: 'row', gap: 8, padding: 12, paddingBottom: 4 },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryNum: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  summaryLabel: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  filterScroll: { flexGrow: 0, maxHeight: 48 },
  filterContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6 },
  filterLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, paddingHorizontal: 12, marginTop: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.border,
    marginRight: 8,
    alignSelf: 'flex-start',
  },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { fontSize: 13, color: COLORS.textPrimary },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  createBtn: {
    marginHorizontal: 12,
    marginVertical: 10,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    alignItems: 'center',
  },
  createBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  list: { paddingHorizontal: 12, paddingBottom: 40 },
  scopeHint: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 8, paddingHorizontal: 12 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.sm,
  },
  cardOverdue: { borderColor: COLORS.error, backgroundColor: '#fef2f2' },
  cardToday: { borderColor: COLORS.info, backgroundColor: '#eff6ff' },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  cardSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  cardMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 6 },
  feedbackBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: RADIUS.md,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  feedbackLabel: { fontSize: 11, fontWeight: '700', color: '#166534', marginBottom: 4 },
  feedbackText: { fontSize: 13, color: COLORS.textPrimary },
  dueOverdue: { color: COLORS.error, fontWeight: '700' },
  dueNormal: { color: COLORS.textSecondary },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  badgeUrgent: { backgroundColor: '#fee2e2' },
  badgeNormal: { backgroundColor: '#e2e8f0' },
  badgeText: { fontSize: 10, fontWeight: '700', color: COLORS.textPrimary },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  miniBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.md, backgroundColor: COLORS.primaryLight },
  deleteBtn: { backgroundColor: '#fee2e2' },
  miniBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  deleteText: { color: COLORS.error },
  empty: { textAlign: 'center', marginTop: 24, color: COLORS.textMuted, fontSize: 14 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: 16,
    maxHeight: '90%',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12, color: COLORS.textPrimary },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 12,
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 10,
    backgroundColor: COLORS.background,
  },
  textArea: { minHeight: 72, textAlignVertical: 'top' },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, marginBottom: 4 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  cancelBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border },
  cancelBtnText: { fontWeight: '700', color: COLORS.textSecondary },
  saveBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: RADIUS.lg, backgroundColor: COLORS.primary },
  saveBtnText: { fontWeight: '700', color: '#fff' },
  errorBanner: {
    marginHorizontal: 12,
    marginBottom: 10,
    padding: 12,
    borderRadius: RADIUS.lg,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorBannerText: { color: COLORS.error, fontSize: 13 },
});
