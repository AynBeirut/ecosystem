import React from 'react';
import { Bot } from 'lucide-react';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';

const AdminAiAgent: React.FC = () => {
  return (
    <AdminPageShell
      title="Grabio AI Agent"
      description="Your in-dashboard AI specialist workspace."
      backTo="/admin/dashboard"
    >
      <AdminPanel className="max-w-2xl">
        <div className="flex items-start gap-4 p-6">
          <div className="rounded-xl bg-teal-100 p-3 text-teal-700">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Coming soon</h2>
            <p className="mt-1 text-sm text-slate-600">
              Grabio AI Agent will be available on <strong>30/7/2026</strong>.
            </p>
          </div>
        </div>
      </AdminPanel>
    </AdminPageShell>
  );
};

export default AdminAiAgent;
