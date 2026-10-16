import { useEffect, useMemo, useState } from 'react';
import OpsHubShell from '@/components/admin/OpsHubShell';
import { useAuth } from '@/context/useAuth';
import { Link, useLocation } from 'react-router-dom';
import { useStoreEntitlements } from '@/hooks/useStoreEntitlements';
import { activeOpsShellSection, hrVenueOpsNavVisibility, optionalOpsBridges, visibleHrShellSections } from '@/lib/hrVenueOpsShell';
import { getActualStoreId, resolveStoreIdForAuthUser } from '@/lib/storeUtils';
import { HrAssets, HrNotes, HrReports, HrSchedule } from '@/pages/admin/hr/HrAdvancedPanels';
import {
  HrAttendance,
  HrDocuments,
  HrEmployees,
  HrLeave,
  HrOverview,
  HrTraining,
  useHrCoreData,
} from '@/pages/admin/hr/HrCorePanels';
import { canAccessOfficialHr } from '@/lib/restaurantRolePolicy';

const CORE_SECTIONS = new Set([
  'overview',
  'employees',
  'attendance',
  'leave',
  'training',
  'documents',
  'schedule',
  'notes',
  'assets',
  'reports',
  'payroll',
]);

const AdminHrShell: React.FC = () => {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { profile, entitlements } = useStoreEntitlements();
  const [storeId, setStoreId] = useState<string | null>(null);
  const actor = useMemo(
    () =>
      user
        ? { role: user.role, subAccountRole: user.subAccountRole, permissions: user.permissions }
        : undefined,
    [user],
  );

  const sections = useMemo(
    () => visibleHrShellSections({ profile, entitlements, user: actor }),
    [profile, entitlements, actor],
  );
  const gateInput = { profile, entitlements, user: actor };
  const gates = hrVenueOpsNavVisibility(gateInput);
  const bridges = optionalOpsBridges(gateInput);
  const active = activeOpsShellSection(pathname, sections);
  const core = useHrCoreData(CORE_SECTIONS.has(active.id) ? storeId : null);

  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      if (!user?.id) return;
      const id = getActualStoreId(user) || (await resolveStoreIdForAuthUser(user.id));
      if (!cancelled) setStoreId(id || null);
    };
    void resolve();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const notes = [
    gates.payroll
      ? 'Finance is on. Payroll stays on the existing Staff and Salary screens.'
      : 'Payroll is hidden because finance is off or not on this subscription.',
  ];
  if (core.error) notes.push(core.error);

  const legacyLinks =
    user?.role === 'admin'
      ? [
          ...bridges.payroll,
          { to: '/admin/staff-presence', label: 'Daily Presence' },
        ]
      : [];

  const body = !storeId ? (
    <p>Opening this store…</p>
  ) : active.id === 'overview' ? (
    <HrOverview bundle={core.bundle} payrollAllowed={gates.payroll} />
  ) : active.id === 'employees' ? (
    <HrEmployees storeId={storeId} bundle={core.bundle} onSaved={core.reload} />
  ) : active.id === 'attendance' ? (
    <HrAttendance payrollLinks={bridges.attendancePayroll} />
  ) : active.id === 'leave' ? (
    <HrLeave storeId={storeId} bundle={core.bundle} onSaved={core.reload} />
  ) : active.id === 'training' ? (
    <HrTraining storeId={storeId} bundle={core.bundle} onSaved={core.reload} />
  ) : active.id === 'documents' ? (
    <HrDocuments storeId={storeId} bundle={core.bundle} onSaved={core.reload} />
  ) : active.id === 'schedule' ? (
    <HrSchedule storeId={storeId} bundle={core.bundle} onSaved={core.reload} />
  ) : active.id === 'notes' && canAccessOfficialHr(actor) ? (
    <HrNotes storeId={storeId} bundle={core.bundle} onSaved={core.reload} />
  ) : active.id === 'assets' ? (
    <HrAssets storeId={storeId} bundle={core.bundle} onSaved={core.reload} />
  ) : active.id === 'reports' ? (
    <HrReports bundle={core.bundle} />
  ) : active.id === 'payroll' ? (
    <div className="space-y-2">
      <p>Salary amounts and ledger posting stay on the existing payroll screens.</p>
      {bridges.payroll.map((link) => (
        <p key={link.to}>
          <Link to={link.to} className="font-medium text-teal-800 underline">{link.label}</Link>
        </p>
      ))}
    </div>
  ) : null;

  return (
    <OpsHubShell
      eyebrow="Team & HR"
      title="HR"
      description="Employees, attendance, leave, and training for this store. Invoice documents and the website theme are separate."
      sections={sections}
      active={active}
      notes={notes}
      legacyLinks={legacyLinks}
    >
      {body}
    </OpsHubShell>
  );
};

export default AdminHrShell;
