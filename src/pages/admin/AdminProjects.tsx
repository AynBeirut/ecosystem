import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, getFirestore, orderBy, query } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Projects (PSA)</h1>
          <Button asChild variant="outline">
            <Link to="/admin">Dashboard</Link>
          </Button>
        </div>
        {loading ? (
          <p>Loading…</p>
        ) : projects.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No projects yet</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">PSA projects will appear here once created.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {projects.map((p) => (
              <Card key={p.id}>
                <CardContent className="py-4 flex justify-between">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-sm text-muted-foreground">{p.status ?? 'active'}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ModuleGate>
  );
};

export default AdminProjects;
