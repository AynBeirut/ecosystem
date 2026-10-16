export const INVOICE_TEAM_TASKS_COLLECTION = 'invoiceTeamTasks';
export const INVOICE_TEAM_TASK_DOMAIN = 'invoice_team';

export type StoreTaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';
export type StoreTaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type StoreTask = {
  id: string;
  storeId: string;
  title: string;
  description?: string | null;
  status: StoreTaskStatus;
  priority: StoreTaskPriority;
  assignedToUserId: string;
  assignedToName: string;
  assignedToRepId?: string | null;
  createdBy: string;
  createdByName: string;
  dueAt?: string | null;
  completedAt?: string | null;
  completionFeedback?: string | null;
  feedbackAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StoreTaskInput = {
  title: string;
  description?: string;
  priority?: StoreTaskPriority;
  assignedToUserId: string;
  assignedToName: string;
  assignedToRepId?: string | null;
  dueAt?: string | null;
};

export type StoreTaskFilter = 'all' | 'mine' | 'overdue' | 'today' | 'done' | 'feedback';
