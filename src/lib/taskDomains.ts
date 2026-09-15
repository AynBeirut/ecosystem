/** Isolated task systems — never share a Firestore collection across domains. */
export const TASK_COLLECTIONS = {
  crm: 'crmTasks',
  invoiceTeam: 'invoiceTeamTasks',
  project: 'projectTasks',
  /** Billable service work — subcollection stores/{storeId}/financeServiceTasks */
  invoiceService: 'financeServiceTasks',
  /** Legacy — read-only archive */
  legacy: 'storeTasks',
} as const;

export type TaskDomain = 'crm' | 'invoice_team' | 'project';

/** User-facing names — each task system keeps its own label everywhere in UI. */
export const TASK_DOMAIN_LABELS = {
  crm: {
    singular: 'CRM task',
    plural: 'CRM tasks',
    heading: 'CRM tasks',
    nav: 'CRM tasks',
    new: 'New CRM task',
    edit: 'Edit CRM task',
    delete: 'Delete CRM task?',
    empty: 'No CRM tasks yet.',
    emptyFiltered: 'No CRM tasks match these filters.',
    list: 'CRM tasks',
    titleRequired: 'CRM task title is required',
    created: 'CRM task created',
    updated: 'CRM task updated',
    deleted: 'CRM task deleted',
    markedDone: 'CRM task marked done',
    doneWithNext: 'CRM task done — next step scheduled',
    loadFailed: 'Failed to load CRM tasks',
    unavailable: 'CRM tasks not available yet — ask admin to deploy Firestore rules.',
  },
  invoiceTeam: {
    singular: 'Daily task',
    plural: 'Daily tasks',
    heading: 'Daily tasks',
    nav: 'Daily tasks',
    new: 'New daily task',
    edit: 'Edit daily task',
    delete: 'Delete daily task?',
    empty: 'No daily tasks yet.',
    due: 'Daily task due',
    overdue: 'Daily task overdue',
    titleRequired: 'Daily task title is required',
    created: 'Daily task created',
    updated: 'Daily task updated',
    deleted: 'Daily task deleted',
    markedDone: 'Daily task marked done',
    loadFailed: 'Failed to load daily tasks',
    unavailable: 'Daily tasks not available yet — ask admin to deploy Firestore rules.',
  },
  project: {
    singular: 'Project task',
    plural: 'Project tasks',
    heading: 'Project tasks',
    nav: 'Project tasks',
    new: 'New project task',
    edit: 'Edit project task',
    delete: 'Delete project task?',
    empty: 'No project tasks yet.',
  },
} as const;

export const CRM_TASK_LABELS = TASK_DOMAIN_LABELS.crm;
export const DAILY_TASK_LABELS = TASK_DOMAIN_LABELS.invoiceTeam;
export const PROJECT_TASK_LABELS = TASK_DOMAIN_LABELS.project;
