import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/Header';
import { toast } from 'sonner';
import { Check, X } from 'lucide-react';

interface PendingUser {
  id: string;
  email: string;
  full_name: string | null;
  roles: string[];
}

export default function AdminPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    checkAdminAccess();
  }, [user, navigate]);

  const checkAdminAccess = async () => {
    if (!user) return;

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isTechnicalAdmin = roles?.some(r => r.role === 'technical_admin');
    
    if (!isTechnicalAdmin) {
      toast.error('Access denied');
      navigate('/');
      return;
    }

    fetchPendingUsers();
  };

  const fetchPendingUsers = async () => {
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          full_name,
          approved
        `)
        .eq('approved', false);

      if (error) throw error;

      const usersWithRoles = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: userRoles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', profile.id);

          return {
            ...profile,
            roles: userRoles?.map(r => r.role) || [],
          };
        })
      );

      const filtered = usersWithRoles.filter(u => 
        u.roles.includes('publisher') || u.roles.includes('editor')
      );

      setPendingUsers(filtered);
    } catch (error: any) {
      toast.error('Failed to load pending users');
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (userId: string, approved: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ approved })
        .eq('id', userId);

      if (error) throw error;

      toast.success(approved ? 'User approved' : 'User rejected');
      fetchPendingUsers();
    } catch (error: any) {
      toast.error('Failed to update user status');
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Technical Admin Panel</h1>
            <p className="text-muted-foreground">Approve or reject publisher and editor requests</p>
          </div>

          {pendingUsers.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No pending approvals
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {pendingUsers.map((user) => (
                <Card key={user.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{user.full_name || user.email}</CardTitle>
                        <CardDescription>{user.email}</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {user.roles.map((role) => (
                          <Badge key={role} variant="outline">
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex gap-2">
                    <Button
                      onClick={() => handleApproval(user.id, true)}
                      className="flex-1"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleApproval(user.id, false)}
                      className="flex-1"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
