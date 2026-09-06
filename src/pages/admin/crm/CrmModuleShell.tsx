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
  loadCrmReps,
  loadCrmStoreAreas,
  loadCrmTasks,
  loadCrmVisitRouteDetail,
  loadCrmVisitRouteForm,
  preloadCrmPages,
} from '@/pages/admin/crm/crmEmbeddedLoaders';

const CRM_NAV = [
  { to: '/admin/crm/dashboard', label: 'Stats', preload: loadCrmPerformance },
  { to: '/admin/crm/customers', label: 'Clients', preload: loadCrmCustomers },
  { to: '/admin/crm/map', label: 'Map & Pipeline', preload: loadCrmMap },
  { to: '/admin/crm/activities', label: 'Visits', preload: loadCrmActivities },
  { to: '/admin/crm/reps', label: 'Reps', preload: loadCrmReps },
  { to: '/admin/crm/areas', label: 'Areas', preload: loadCrmStoreAreas },
  { to: '/admin/crm/tasks', label: 'Tasks', preload: loadCrmTasks },
] as const;

const CrmModuleShell: React.FC = () => {
  const location = useLocation();
  const isClientProfile = /^\/admin\/crm\/clients\/[^/]+/.test(location.pathname);
  const isVisitRouteForm =
    location.pathname === '/admin/crm/visit-routes/new'
    || /^\/admin\/crm\/visit-routes\/[^/]+\/edit$/.test(location.pathname);
  const isVisitRouteDetail =
    /^\/admin\/crm\/visit-routes\/[^/]+$/.test(location.pathname)
    && !isVisitRouteForm
    && location.pathname !== '/admin/crm/visit-routes/new';

  useEffect(() => {
    preloadCrmPages(CRM_PAGE_LOADERS);
  }, []);

  if (location.pathname === '/admin/crm/performance') {
    return <Navigate to="/admin/crm/dashboard" replace />;
  }

  if (location.pathname === '/admin/crm/pipeline') {
    return <Navigate to="/admin/crm/map" replace />;
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
        ) : isVisitRouteForm ? (
          <CrmEmbeddedPage loader={loadCrmVisitRouteForm} />
        ) : isVisitRouteDetail ? (
          <CrmEmbeddedPage loader={loadCrmVisitRouteDetail} />
        ) : (
          <CrmTabHost />
        )}
      </AdminPageShell>
    </CrmAddonGate>
  );
};

export default CrmModuleShell;
