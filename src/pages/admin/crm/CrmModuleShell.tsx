import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import CrmAddonGate from '@/components/crm/CrmAddonGate';
import CrmFirestoreIndexNotice from '@/components/crm/CrmFirestoreIndexNotice';
import AdminPageShell from '@/components/admin/AdminPageShell';
import { cn } from '@/lib/utils';

const CRM_NAV = [
  { to: '/admin/crm/pipeline', label: 'Pipeline' },
  { to: '/admin/crm/activities', label: 'Activities' },
  { to: '/admin/crm/map', label: 'Map' },
  { to: '/admin/crm/performance', label: 'Performance' },
  { to: '/admin/crm/reps', label: 'Reps' },
] as const;

const CrmModuleShell: React.FC = () => {
  const location = useLocation();

  return (
    <CrmAddonGate>
      <AdminPageShell
        title="Sales CRM"
        description="Pipeline, activities, and rep performance."
        eyebrow="CRM Module"
        backTo="/admin/dashboard"
        backLabel="Dashboard"
      >
        <nav className="flex flex-wrap gap-2">
          {CRM_NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border',
                location.pathname.startsWith(item.to)
                  ? 'bg-[#0b1220] text-white border-slate-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <CrmFirestoreIndexNotice />
        <Outlet />
      </AdminPageShell>
    </CrmAddonGate>
  );
};

export default CrmModuleShell;
