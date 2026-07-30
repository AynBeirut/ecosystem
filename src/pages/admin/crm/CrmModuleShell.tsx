import React, { useEffect } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import CrmAddonGate from '@/components/crm/CrmAddonGate';
import CrmFirestoreIndexNotice from '@/components/crm/CrmFirestoreIndexNotice';
import AdminPageShell from '@/components/admin/AdminPageShell';
import { adminSubnavLink } from '@/lib/adminStyles';
import CrmTabHost from '@/pages/admin/crm/CrmTabHost';
import CrmEmbeddedPage from '@/pages/admin/crm/CrmEmbeddedPage';
import {
  CRM_PAGE_LOADERS,
  loadCrmActivities,
  loadCrmClientProfile,
  loadCrmCustomers,
  loadCrmMap,
  loadCrmPerformance,
  loadCrmPipeline,
  loadCrmReps,
  preloadCrmPages,
} from '@/pages/admin/crm/crmEmbeddedLoaders';

const CRM_NAV = [
  { to: '/admin/crm/dashboard', label: 'Dashboard', preload: loadCrmPerformance },
  { to: '/admin/crm/customers', label: 'Customers', preload: loadCrmCustomers },
  { to: '/admin/crm/activities', label: 'Visits', preload: loadCrmActivities },
  { to: '/admin/crm/map', label: 'Map', preload: loadCrmMap },
  { to: '/admin/crm/pipeline', label: 'Pipeline', preload: loadCrmPipeline },
  { to: '/admin/crm/reps', label: 'Reps', preload: loadCrmReps },
] as const;

const CrmModuleShell: React.FC = () => {
  const location = useLocation();
  const isClientProfile = /^\/admin\/crm\/clients\/[^/]+/.test(location.pathname);

  useEffect(() => {
    preloadCrmPages(CRM_PAGE_LOADERS);
  }, []);

  if (location.pathname === '/admin/crm/performance') {
    return <Navigate to="/admin/crm/dashboard" replace />;
  }

  return (
    <CrmAddonGate>
      <AdminPageShell
        title="Sales CRM"
        description="Field sales tracking, visit coverage, and rep performance."
        eyebrow="CRM Module"
        backTo="/admin/dashboard"
        backLabel="Dashboard"
      >
        <nav className="flex flex-wrap gap-2 mb-4">
          {CRM_NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              preventScrollReset
              onMouseEnter={() => preloadCrmPages([item.preload])}
              className={adminSubnavLink(location.pathname.startsWith(item.to))}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <CrmFirestoreIndexNotice />
        {isClientProfile ? (
          <CrmEmbeddedPage loader={loadCrmClientProfile} />
        ) : (
          <CrmTabHost />
        )}
      </AdminPageShell>
    </CrmAddonGate>
  );
};

export default CrmModuleShell;
