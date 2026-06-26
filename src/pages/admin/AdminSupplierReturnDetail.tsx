import React from 'react';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const AdminSupplierReturnDetail: React.FC = () => {
  return (
    <AdminPageShell
      title="Supplier Return Details"
      description="View and manage details for a specific supplier return."
      eyebrow="Inventory"
      backTo="/admin/supplier-returns"
      backLabel="Supplier Returns"
    >
      <AdminPanel>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
          <CardDescription>SRA details, item list, photos, communication thread, and status timeline.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Supplier return detail view will appear here.</p>
        </CardContent>
      </AdminPanel>
    </AdminPageShell>
  );
};

export default AdminSupplierReturnDetail;
