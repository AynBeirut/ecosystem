import React from 'react';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import GrabioGuideChat from '@/components/admin/GrabioGuideChat';
import SallyAvatar from '@/components/admin/SallyAvatar';

const AdminAiAgent: React.FC = () => {
  return (
    <AdminPageShell
        title="Sally"
        description="Sally — setup, packages, modules, and admin navigation."
        backTo="/admin/dashboard"
      >
        <AdminPanel className="max-w-2xl overflow-hidden">
          <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3 bg-gradient-to-r from-teal-500/5 to-pink-500/5">
            <div className="rounded-full p-0.5 bg-gradient-to-br from-teal-400 to-teal-600 shadow-sm">
              <SallyAvatar size="md" ring={false} className="ring-2 ring-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Sally</h2>
              <p className="text-xs text-muted-foreground">Setup, packages, and where to click in admin.</p>
            </div>
          </div>
          <GrabioGuideChat />
        </AdminPanel>
      </AdminPageShell>
  );
};

export default AdminAiAgent;
