/** Invoice Manager daily task labels — Firestore `invoiceTeamTasks` only. */
export const DAILY_TASK_LABELS = {
  singular: 'Daily task',
  plural: 'Daily tasks',
  heading: 'Daily tasks',
  nav: 'Daily tasks',
  new: 'New daily task',
  edit: 'Edit daily task',
  delete: 'Delete daily task?',
  empty: 'No daily tasks yet. Tap + New daily task to add one.',
  titleRequired: 'Daily task title is required',
  due: 'Daily task due',
  overdue: 'Daily task overdue',
  unavailable: 'Daily tasks not available yet — ask admin to deploy Firestore rules.',
} as const;

/** NGO / project tasks — Firestore `projectTasks` (future UI). */
export const PROJECT_TASK_LABELS = {
  singular: 'Project task',
  plural: 'Project tasks',
  heading: 'Project tasks',
  nav: 'Project tasks',
  new: 'New project task',
  edit: 'Edit project task',
} as const;
