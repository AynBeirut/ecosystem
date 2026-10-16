import type { FinanceServiceTask, ServiceTaskCompletion, ServiceTaskCompletionOutcome } from '../types';

export const COMPLETION_OUTCOMES: ServiceTaskCompletionOutcome[] = ['done', 'reported', 'call'];

export function completionOutcomeLabel(outcome: ServiceTaskCompletionOutcome): string {
  if (outcome === 'done') return 'Done';
  if (outcome === 'reported') return 'Reported';
  return 'Call';
}

export function currentUsageMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function serviceTaskUnitsCompleted(task: FinanceServiceTask): number {
  const month = currentUsageMonth();
  if (task.billingType === 'monthly' && task.usageMonth && task.usageMonth !== month) {
    return 0;
  }
  if (task.unitsCompleted != null) return task.unitsCompleted;
  return task.unitsUsedThisMonth ?? 0;
}

/** Remaining occurrences this month (e.g. 12/m or 30/m). */
export function serviceTaskUnitsRemaining(task: FinanceServiceTask): number | null {
  if (task.billingType !== 'monthly' || !task.monthlyUnits) return null;
  return Math.max(0, task.monthlyUnits - serviceTaskUnitsCompleted(task));
}

export function mapCompletions(raw: unknown): ServiceTaskCompletion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const item = row as Record<string, unknown>;
      const outcome = item.outcome;
      if (outcome !== 'done' && outcome !== 'reported' && outcome !== 'call') return null;
      return {
        at: String(item.at || ''),
        outcome,
      };
    })
    .filter((c): c is ServiceTaskCompletion => !!c && !!c.at);
}
