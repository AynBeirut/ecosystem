import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildDocumentWrite,
  buildHrAssetWrite,
  buildHrEmployeePatch,
  buildHrEmployeeWrite,
  buildHrNoteWrite,
  buildHrRecordPatch,
  buildLeaveDecision,
  buildLeaveWrite,
  buildShiftWrite,
  buildTrainingAssignmentWrite,
  buildTrainingCompletion,
  documentState,
  hrDashboardCounts,
  hrReportCounts,
  isTrainingOverdue,
  recordsForStore,
  weekBounds,
} from '@/lib/hrCore';
import { canAccessOfficialHr } from '@/lib/restaurantRolePolicy';
import { visibleHrShellSections } from '@/lib/hrVenueOpsShell';
import { isAdminFeatureAllowed, staffPayrollShortcutVisible } from '@/lib/featureAccessGate';
import { isExcludedFromPayrollRoster } from '@/lib/staffPayrollDisplay';
import type { StoreEntitlements } from '@/lib/entitlements';

const storeA = 'store-a';
const storeB = 'store-b';
const employee = { id: 'emp-1', name: 'Nora Haddad', storeId: storeA };

const financeOff: StoreEntitlements = {
  source: 'modular',
  pricingVersion: 'modular-v2',
  tier: 'pro',
  modules: { pos: true, team: true, restaurant: true },
  businessWorkflow: 'live_kitchen',
  startingPackage: 'pkg_live_kitchen',
  seatCount: 1,
  posLocationCount: 1,
  composedProductSource: 'platform',
  limits: {
    productLimit: 100,
    storageLimitMb: 5120,
    monthlyOperationsLimit: null,
    allowsComposed: false,
    allowsManufacturing: false,
    allowsCatalogImages: true,
  },
};

const hrOnProfile = {
  businessWorkflow: 'live_kitchen' as const,
  venueOpsSettings: {
    restaurantFirstNavEnabled: true,
    enableBusinessFinance: false,
    enableOfficialHr: true,
  },
};

describe('HR core phase 2', () => {
  it('creates an employee with no salary and keeps them off the payroll roster', () => {
    const payload = buildHrEmployeeWrite({
      storeId: storeA,
      name: 'Nora Haddad',
      position: 'Host',
      now: '2026-09-28T00:00:00.000Z',
    });
    expect(payload).not.toHaveProperty('salary');
    expect(payload).not.toHaveProperty('hourlyRate');
    expect(payload).not.toHaveProperty('monthlySalary');
    expect(payload.payrollExcluded).toBe(true);
    expect(payload.storeId).toBe(storeA);
    expect(isExcludedFromPayrollRoster(payload as { payrollExcluded?: boolean })).toBe(true);
    expect(isExcludedFromPayrollRoster({ name: 'Existing', salary: 500 } as never)).toBe(false);
    const patch = buildHrEmployeePatch({ storeId: storeA, name: 'Nora Haddad', position: 'Host', status: 'active' });
    expect(patch).not.toHaveProperty('salary');
    expect(patch).not.toHaveProperty('payrollExcluded');
    expect(patch).not.toHaveProperty('storeId');
    expect(buildLeaveDecision({ status: 'approved', now: '2026-09-28T00:00:00.000Z' }).status).toBe('approved');
    expect(buildTrainingCompletion('2026-09-28T00:00:00.000Z').status).toBe('completed');
    const assignment = buildTrainingAssignmentWrite({
      storeId: storeA,
      employee: { id: 'emp-1', name: 'Nora Haddad', storeId: storeA },
      trainingTitle: 'Service',
      trainingItemId: 'item-1',
      dueDate: '2026-09-28',
      now: '2026-09-28T00:00:00.000Z',
    });
    expect(isTrainingOverdue(assignment, '2026-09-28')).toBe(true);
    expect(isTrainingOverdue({ ...assignment, status: 'completed' }, '2026-09-28')).toBe(false);
    const employee = { id: 'emp-1', name: 'Nora Haddad', storeId: storeA };
    const shift = buildShiftWrite({
      storeId: storeA,
      employee,
      shiftDate: '2026-09-28',
      startTime: '09:00',
      endTime: '17:00',
      station: 'Floor',
    });
    expect(shift.weekStart).toBe(weekBounds('2026-09-28').start);
    expect(buildHrRecordPatch(shift)).not.toHaveProperty('storeId');
    const note = buildHrNoteWrite({ storeId: storeA, employee, noteDate: '2026-09-28', category: 'incident', note: 'Late open' });
    expect(note.managerOnly).toBe(true);
    expect(note.staffName).toBe('Nora Haddad');
    const asset = buildHrAssetWrite({ storeId: storeA, employee, itemType: 'uniform', itemName: 'Jacket', status: 'issued' });
    expect(asset).not.toHaveProperty('salary');
    expect(hrReportCounts({
      employees: [{ status: 'active' }],
      leave: [{ status: 'requested' }],
      training: [{ status: 'assigned', dueDate: '2026-09-28' }],
      documents: [{ status: 'expired' }],
      shifts: [shift],
      notes: [note],
      assets: [asset],
      today: '2026-09-28',
    })).toMatchObject({ activeEmployees: 1, openLeave: 1, overdueTraining: 1, expiringDocuments: 1, shiftsThisWeek: 1, openIncidents: 1, openAssets: 1 });
    expect(hrReportCounts({
      employees: [],
      leave: [],
      training: [],
      documents: [],
      shifts: [],
      notes: [],
      assets: [],
      today: '2026-09-28',
    }).shiftsThisWeek).toBe(0);
    expect(canAccessOfficialHr({ role: 'sub_account', subAccountRole: 'cashier', permissions: [] })).toBe(false);
    expect(visibleHrShellSections({
      profile: hrOnProfile,
      entitlements: financeOff,
      user: { role: 'sub_account', subAccountRole: 'cashier', permissions: [] },
    }).some((section) => section.id === 'notes')).toBe(false);
  });

  it('keeps leave, training, and documents on one store', () => {
    const leave = buildLeaveWrite({
      storeId: storeA,
      employee,
      leaveType: 'sick',
      startDate: '2026-10-01',
      endDate: '2026-10-02',
    });
    expect(leave.storeId).toBe(storeA);
    expect(leave.staffName).toBe('Nora Haddad');
    expect(() =>
      buildLeaveWrite({
        storeId: storeB,
        employee,
        leaveType: 'annual',
        startDate: '2026-10-01',
        endDate: '2026-10-02',
      }),
    ).toThrow(/not in this store/);

    const assignment = buildTrainingAssignmentWrite({
      storeId: storeA,
      employee,
      trainingTitle: 'Allergen briefing',
      trainingItemId: 'item-1',
    });
    expect(assignment.storeId).toBe(storeA);
    expect(assignment.trainingTitle).toBe('Allergen briefing');

    const document = buildDocumentWrite({
      storeId: storeA,
      employee,
      title: 'Work permit',
      expiryDate: '2026-10-01',
      today: '2026-09-28',
    });
    expect(document.storeId).toBe(storeA);
    expect(document.status).toBe('expiring');
    expect(documentState('2026-01-01', '2026-09-28')).toBe('expired');
    expect(recordsForStore([{ storeId: storeA }, { storeId: storeB }], storeA)).toHaveLength(1);
  });

  it('hides payroll when finance is off and still allows HR', () => {
    const owner = { role: 'admin' as const, permissions: [] as string[] };
    expect(isAdminFeatureAllowed('hr', hrOnProfile, financeOff, owner)).toBe(true);
    expect(isAdminFeatureAllowed('payroll', hrOnProfile, financeOff, owner)).toBe(false);
    expect(staffPayrollShortcutVisible(true, hrOnProfile, financeOff, owner)).toBe(false);
    expect(hrDashboardCounts({
      employees: [{ status: 'active' } as never, { status: 'terminated' } as never],
      leave: [{ status: 'requested' }],
      training: [{ status: 'assigned' }],
      documents: [{ status: 'expired' }],
      today: '2026-09-28',
    })).toMatchObject({ activeEmployees: 1, openLeave: 1, openTraining: 1, overdueTraining: 0, expiringDocuments: 1 });
  });

  it('blocks other stores in the HR collection rules', () => {
    const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');
    for (const name of ['hrLeaveRequests', 'hrTrainingItems', 'hrTrainingAssignments', 'hrDocuments']) {
      const block = rules.split(`match /${name}/`)[1]?.slice(0, 500) || '';
      expect(block, name).toContain('canReadStoreHrVenue(resource.data.storeId)');
      expect(block, name).toContain('request.resource.data.storeId == resource.data.storeId');
    }
    expect(rules).toContain('function canReadStoreHrVenue');
    expect(rules).toContain('isStoreAdmin(storeId)');
    expect(rules).toContain('match /salaryPayments/');
  });
});
