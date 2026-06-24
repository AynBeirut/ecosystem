import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/Header';
import { PostCard } from '@/components/PostCard';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

interface Post {
  id: string;
  title: string;
  subject: string;
  excerpt: string;
  visibility: 'free' | 'moderate' | 'premium';
}

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [hasRole, setHasRole] = useState<boolean | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      checkUserRole();
      fetchPosts();
    }
  }, [user]);

  const checkUserRole = async () => {
    if (!user) return;

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (!roles || roles.length === 0) {
      navigate('/plan');
    } else {
      setHasRole(true);
    }
  };

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('id, title, subject, excerpt, visibility')
        .eq('status', 'approved')
        .order('published_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoadingPosts(false);
    }
  };

  if (loading || !user || hasRole === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container max-w-4xl py-8">
        <div className="mb-8 space-y-2">
          <h1 className="text-4xl md:text-5xl font-serif font-bold">Latest Research & Analysis</h1>
          <p className="text-lg text-muted-foreground">
            Political news, research papers, and predictive insights
          </p>
        </div>

        {loadingPosts ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading posts...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12 space-y-4">
            <p className="text-muted-foreground">No published posts yet</p>
            <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
          </div>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                {...post}
                onClick={() => navigate(`/post/${post.id}`)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

