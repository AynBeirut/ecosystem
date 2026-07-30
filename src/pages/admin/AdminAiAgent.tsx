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
      <AdminPanel className="max-w-2xl overflow-hidden">
        <div className="flex items-start gap-4 p-6">
          <div className="rounded-xl bg-teal-500/15 p-3 text-teal-500 ring-1 ring-teal-500/25">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Coming soon</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Grabio AI Agent will be available on <strong className="text-foreground">30/7/2026</strong>.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Structured action cards and telemetry feed — not a chat bubble.
            </p>
          </div>
        </div>
      </AdminPanel>
    </AdminPageShell>
  );
};

export default AdminAiAgent;
