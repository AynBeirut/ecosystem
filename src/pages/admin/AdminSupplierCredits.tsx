import React from 'react';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const AdminSupplierCredits: React.FC = () => {
  return (
    <AdminPageShell
      title="Supplier Credits"
      description="Manage supplier credits and apply them to purchase orders."
      eyebrow="Inventory"
      backTo="/admin/suppliers"
      backLabel="Suppliers"
    >
      <AdminPanel>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
          <CardDescription>List credits, apply to PO, expiry tracking, and reconciliation.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Supplier credit management will appear here.</p>
        </CardContent>
      </AdminPanel>
    </AdminPageShell>
  );
};

export default AdminSupplierCredits;
