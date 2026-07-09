import type { BusinessWorkflow } from '@/lib/moduleManifest';

/** Module IDs that conflict when enabled together */
const MUTUAL_EXCLUSIONS: Array<[string, string]> = [
  ['restaurant', 'factory'],
  ['pos', 'factory'],
];

export type ModuleDependencyIssue = {
  moduleId: string;
  reason: string;
  severity: 'error' | 'warning';
};

export function enforceWorkflowExclusivity(
  modules: Record<string, boolean>,
  workflow: BusinessWorkflow,
): Record<string, boolean> {
  const next = { ...modules };
  if (workflow === 'live_kitchen') {
    next.restaurant = true;
    if (next.pos === undefined) next.pos = true;
    next.factory = false;
  } else if (workflow === 'factory') {
    next.factory = true;
    next.restaurant = false;
    next.pos = false;
  }
  return next;
}

export function validateModuleSelection(
  modules: Record<string, boolean>,
  workflow?: BusinessWorkflow,
): ModuleDependencyIssue[] {
  const issues: ModuleDependencyIssue[] = [];
  const hasKitchen = Boolean(modules.restaurant || modules.pos);
  const hasFactory = Boolean(modules.factory);

  if (hasKitchen && hasFactory) {
    issues.push({
      moduleId: 'factory',
      reason: 'Live Kitchen and Factory workflows cannot run together. Kitchen takes priority.',
      severity: 'error',
    });
  }

  if (workflow === 'ngo' || workflow === 'freelancer') {
    if (modules.stock || modules.factory || modules.restaurant) {
      issues.push({
        moduleId: 'stock',
        reason: 'NGO/Freelancer packages do not include inventory workflows.',
        severity: 'warning',
      });
    }
  }

  if (modules.crm && !modules.invoicing) {
    issues.push({
      moduleId: 'crm',
      reason: 'CRM requires Invoicing module.',
      severity: 'error',
    });
  }

  MUTUAL_EXCLUSIONS.forEach(([a, b]) => {
    if (modules[a] && modules[b]) {
      issues.push({
        moduleId: b,
        reason: `${a} and ${b} are mutually exclusive.`,
        severity: 'error',
      });
    }
  });

  return issues;
}

export function applyModuleToggle(
  modules: Record<string, boolean>,
  moduleId: string,
  enabled: boolean,
): Record<string, boolean> {
  const next = { ...modules, [moduleId]: enabled };

  if (enabled && moduleId === 'restaurant') {
    next.factory = false;
  }
  if (enabled && moduleId === 'factory') {
    next.restaurant = false;
    next.pos = false;
  }
  if (enabled && moduleId === 'pos') {
    next.factory = false;
  }

  return next;
}

export function inferWorkflowFromModules(modules: Record<string, boolean>): BusinessWorkflow {
  const hasKitchen = Boolean(modules.restaurant || modules.pos);
  const hasFactory = Boolean(modules.factory);
  if (hasKitchen && !hasFactory) return 'live_kitchen';
  if (hasFactory && !hasKitchen) return 'factory';
  if (hasKitchen && hasFactory) return 'live_kitchen';
  if (!modules.stock && !modules.marketplace) return 'freelancer';
  return 'shop';
}
