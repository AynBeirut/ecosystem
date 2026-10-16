import {
  isAdminFeatureAllowed,
  type FeatureAccessActor,
} from '@/lib/featureAccessGate';
import { canAccessOfficialHr } from '@/lib/restaurantRolePolicy';
import type { StoreEntitlements } from '@/lib/entitlements';
import type { StoreProfile } from '@/types/storeProfile';

export type OpsShellSection = {
  id: string;
  label: string;
  path: string;
  summary: string;
};

/** Shell tabs only. Records are a later phase. */
export const HR_SHELL_SECTIONS: OpsShellSection[] = [
  {
    id: 'overview',
    label: 'Overview',
    path: '/admin/hr',
    summary: 'Employee, leave, training, and document counts for this store.',
  },
  {
    id: 'employees',
    label: 'Employees',
    path: '/admin/hr/employees',
    summary: 'Add and edit people in this store. A wage is not required.',
  },
  {
    id: 'attendance',
    label: 'Attendance',
    path: '/admin/hr/attendance',
    summary: 'Opens the existing Daily Presence screen.',
  },
  {
    id: 'leave',
    label: 'Leave',
    path: '/admin/hr/leave',
    summary: 'Create leave, then approve or reject it.',
  },
  {
    id: 'training',
    label: 'Training',
    path: '/admin/hr/training',
    summary: 'Create training, assign it, and mark it complete.',
  },
  {
    id: 'documents',
    label: 'Documents',
    path: '/admin/hr/documents',
    summary: 'Document titles and expiry dates. No file upload in this step.',
  },
  {
    id: 'schedule',
    label: 'Schedule',
    path: '/admin/hr/schedule',
    summary: 'Shifts for this store: person, date, times, and station.',
  },
  {
    id: 'notes',
    label: 'Notes',
    path: '/admin/hr/notes',
    summary: 'Manager notes and incidents. Floor roles do not see this tab.',
  },
  {
    id: 'assets',
    label: 'Assets',
    path: '/admin/hr/assets',
    summary: 'Uniforms and items issued to people in this store.',
  },
  {
    id: 'reports',
    label: 'Reports',
    path: '/admin/hr/reports',
    summary: 'Counts for people, leave, training, documents, shifts, incidents, and issued items.',
  },
];

export const HR_PAYROLL_SECTION: OpsShellSection = {
  id: 'payroll',
  label: 'Payroll',
  path: '/admin/hr/payroll',
  summary: 'Salary and ledger posting stay behind finance. Nothing is posted from this shell.',
};

export const VENUE_OPS_SHELL_SECTIONS: OpsShellSection[] = [
  {
    id: 'overview',
    label: 'Overview',
    path: '/admin/venue-ops',
    summary: 'Daily venue operations. No prices or stock are required.',
  },
  {
    id: 'allergens',
    label: 'Allergen Matrix',
    path: '/admin/venue-ops/allergens',
    summary: 'Item allergens, cross-contamination, and guest warnings. No price.',
  },
  {
    id: 'bible',
    label: 'Menu Bible',
    path: '/admin/venue-ops/bible',
    summary: 'Service knowledge cards. No cost.',
  },
  {
    id: 'specs',
    label: 'Beverage Specs',
    path: '/admin/venue-ops/specs',
    summary: 'Method, par, and prep. Cost is not stored here.',
  },
  {
    id: 'briefings',
    label: 'Briefings',
    path: '/admin/venue-ops/briefings',
    summary: 'Daily and monthly food and beverage briefings.',
  },
  {
    id: 'floor',
    label: 'Floor Map',
    path: '/admin/venue-ops/floor',
    summary: 'Sections, tables, and seats for this store.',
  },
  {
    id: 'standards',
    label: 'Standards & SOPs',
    path: '/admin/venue-ops/standards',
    summary: 'Standards and SOPs for this store.',
  },
  {
    id: 'training',
    label: 'Training',
    path: '/admin/venue-ops/training',
    summary: 'Training assignments stay in HR when that module is on.',
  },
  {
    id: 'import',
    label: 'Import preview',
    path: '/admin/venue-ops/import',
    summary: 'Map a spreadsheet into venue fields. Nothing is saved.',
  },
];

type GateInput = {
  profile: StoreProfile | null | undefined;
  entitlements: StoreEntitlements | null;
  user?: FeatureAccessActor;
};

export function visibleHrShellSections(input: GateInput): OpsShellSection[] {
  const sections = HR_SHELL_SECTIONS.filter(
    (section) => section.id !== 'notes' || canAccessOfficialHr(input.user),
  );
  if (isAdminFeatureAllowed('payroll', input.profile, input.entitlements, input.user)) {
    sections.push(HR_PAYROLL_SECTION);
  }
  return sections;
}

export function visibleVenueOpsShellSections(input?: GateInput): OpsShellSection[] {
  if (!input) return VENUE_OPS_SHELL_SECTIONS;
  const showTraining = hrVenueOpsNavVisibility(input).hr;
  return VENUE_OPS_SHELL_SECTIONS.filter((section) => section.id !== 'training' || showTraining);
}

export type OpsBridgeLink = { to: string; label: string };

export function hrVenueOpsNavVisibility(input: GateInput): {
  hr: boolean;
  venueOps: boolean;
  payroll: boolean;
  inventoryLinks: boolean;
  financeLinks: boolean;
  reservationLinks: boolean;
  crmLinks: boolean;
} {
  const { profile, entitlements, user } = input;
  return {
    hr: isAdminFeatureAllowed('hr', profile, entitlements, user),
    venueOps: isAdminFeatureAllowed('venue_ops', profile, entitlements, user),
    payroll: isAdminFeatureAllowed('payroll', profile, entitlements, user),
    inventoryLinks: isAdminFeatureAllowed('inventory', profile, entitlements, user),
    financeLinks: isAdminFeatureAllowed('finance', profile, entitlements, user),
    reservationLinks: isAdminFeatureAllowed('reservations', profile, entitlements, user),
    crmLinks: isAdminFeatureAllowed('crm', profile, entitlements, user),
  };
}

/** Optional links. Empty when the target module is off. Does not post payroll or stock. */
export function optionalOpsBridges(input: GateInput): {
  payroll: OpsBridgeLink[];
  attendancePayroll: OpsBridgeLink[];
  inventory: OpsBridgeLink[];
  floorContext: OpsBridgeLink[];
  hrTraining: OpsBridgeLink[];
} {
  const gates = hrVenueOpsNavVisibility(input);
  return {
    payroll: gates.payroll
      ? [
          { to: '/admin/staff', label: 'Staff (Payroll)' },
          { to: '/admin/salaries', label: 'Salary Payments' },
        ]
      : [],
    attendancePayroll: gates.payroll
      ? [{ to: '/admin/salaries', label: 'Review pay from attendance' }]
      : [],
    inventory: gates.inventoryLinks
      ? [
          { to: '/admin/recipes', label: 'Recipes' },
          { to: '/admin/inventory', label: 'Inventory' },
        ]
      : [],
    floorContext: [
      ...(gates.reservationLinks ? [{ to: '/admin/events', label: 'Reservations' }] : []),
      ...(gates.crmLinks ? [{ to: '/admin/crm', label: 'Guest CRM' }] : []),
    ],
    hrTraining: gates.hr ? [{ to: '/admin/hr/training', label: 'HR training' }] : [],
  };
}

export function activeOpsShellSection(
  pathname: string,
  sections: OpsShellSection[],
): OpsShellSection {
  const match = sections.find(
    (section) =>
      pathname === section.path ||
      (section.path !== '/admin/hr' &&
        section.path !== '/admin/venue-ops' &&
        pathname.startsWith(`${section.path}/`)),
  );
  return match ?? sections[0];
}
