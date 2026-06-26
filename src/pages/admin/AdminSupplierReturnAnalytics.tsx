import React from 'react';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const AdminSupplierReturnAnalytics: React.FC = () => {
  return (
    <AdminPageShell
      title="Supplier Return Analytics"
      description="Analyze supplier return metrics and performance."
      eyebrow="Inventory"
      backTo="/admin/supplier-returns"
      backLabel="Supplier Returns"
    >
      <AdminPanel>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
          <CardDescription>KPIs, charts, supplier performance, and financial impact.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Analytics dashboard for supplier returns will appear here.</p>
        </CardContent>
      </AdminPanel>
    </AdminPageShell>
  );
};

export default AdminSupplierReturnAnalytics;
