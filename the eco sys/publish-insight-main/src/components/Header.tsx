import { BookOpen, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function Header() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [userRoles, setUserRoles] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      fetchUserRoles();
    }
  }, [user]);

  const fetchUserRoles = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    setUserRoles(data?.map(r => r.role) || []);
  };

  const isTechnicalAdmin = userRoles.includes('technical_admin');
  const isPublisher = userRoles.includes('publisher') || isTechnicalAdmin;
  const isEditor = userRoles.includes('editor') || isPublisher;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-serif font-semibold">The Publisher</span>
        </div>

        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <User className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{user.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {isTechnicalAdmin && (
                <DropdownMenuItem onClick={() => navigate('/admin')}>
                  Admin Panel
                </DropdownMenuItem>
              )}
              {isPublisher && (
                <DropdownMenuItem onClick={() => navigate('/publisher')}>
                  Publisher Dashboard
                </DropdownMenuItem>
              )}
              {isEditor && (
                <DropdownMenuItem onClick={() => navigate('/editor')}>
                  Editor Dashboard
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive">
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
