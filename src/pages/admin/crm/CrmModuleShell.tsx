import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import CrmAddonGate from '@/components/crm/CrmAddonGate';
import CrmFirestoreIndexNotice from '@/components/crm/CrmFirestoreIndexNotice';
import MobileHeader from '@/components/MobileHeader';
import BackButton from '@/components/BackButton';
import { useIsMobile } from '@/hooks/use-mobile';
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
  const isMobile = useIsMobile();

  return (
    <CrmAddonGate>
      <div className="min-h-screen bg-gray-50">
        {isMobile ? (
          <MobileHeader title="Sales CRM" showBackButton showHomeButton />
        ) : (
          <div className="container mx-auto px-4 pt-6 flex items-center gap-3">
            <BackButton />
            <h1 className="text-2xl font-bold text-gray-900">Sales CRM</h1>
          </div>
        )}

        <nav className="container mx-auto px-4 mt-4 flex flex-wrap gap-2 border-b pb-3">
          {CRM_NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                location.pathname.startsWith(item.to)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <main className="container mx-auto px-4 py-6">
          <CrmFirestoreIndexNotice />
          <Outlet />
        </main>
      </div>
    </CrmAddonGate>
  );
};

export default CrmModuleShell;
