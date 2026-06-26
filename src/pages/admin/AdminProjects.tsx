import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, getFirestore, orderBy, query } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import { Button } from '@/components/ui/button';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import ModuleGate from '@/components/ModuleGate';

type Project = {
  id: string;
  name: string;
  clientName?: string;
  status?: string;
};

const AdminProjects: React.FC = () => {
  const { user } = useAuth();
  const storeId = getActualStoreId(user);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeId) return;
    const col = collection(getFirestore(), 'stores', storeId, 'projects');
    void getDocs(query(col, orderBy('name')))
      .then((snap) =>
        setProjects(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Project, 'id'>) }))),
      )
      .finally(() => setLoading(false));
  }, [storeId]);

  return (
    <ModuleGate moduleId="projects">
      <AdminPageShell
        title="Projects (PSA)"
        description="Professional services project tracking"
        eyebrow="Projects"
        backTo="/admin/dashboard"
      >
        {loading ? (
          <p>Loading…</p>
        ) : projects.length === 0 ? (
          <AdminPanel>
            <CardHeader>
              <CardTitle>No projects yet</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">PSA projects will appear here once created.</p>
            </CardContent>
          </AdminPanel>
        ) : (
          <div className="space-y-3">
            {projects.map((p) => (
              <AdminPanel key={p.id}>
                <CardContent className="py-4 flex justify-between">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-sm text-muted-foreground">{p.status ?? 'active'}</span>
                </CardContent>
              </AdminPanel>
            ))}
          </div>
        )}
      </AdminPageShell>
    </ModuleGate>
  );
};

export default AdminProjects;
