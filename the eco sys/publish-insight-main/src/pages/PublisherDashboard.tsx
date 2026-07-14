import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PostForm } from '@/components/PostForm';
import { toast } from 'sonner';
import { Plus, FileText } from 'lucide-react';

interface Post {
  id: string;
  title: string;
  subject: string;
  status: string;
  visibility: string;
  created_at: string;
}

export default function PublisherDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    checkPublisherAccess();
  }, [user, navigate]);

  const checkPublisherAccess = async () => {
    if (!user) return;

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isPublisher = roles?.some(r => r.role === 'publisher' || r.role === 'technical_admin');
    
    if (!isPublisher) {
      toast.error('Access denied');
      navigate('/');
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('approved')
      .eq('id', user.id)
      .single();

    if (!profile?.approved && !roles?.some(r => r.role === 'technical_admin')) {
      toast.error('Your account is pending approval');
      navigate('/');
      return;
    }

    fetchPosts();
  };

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('id, title, subject, status, visibility, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (error: any) {
      toast.error('Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (postId: string) => {
    try {
      const { error } = await supabase
        .from('posts')
        .update({ status: 'approved', published_at: new Date().toISOString() })
        .eq('id', postId);

      if (error) throw error;
      toast.success('Post approved and published');
      fetchPosts();
    } catch (error: any) {
      toast.error('Failed to approve post');
    }
  };

  const handleReject = async (postId: string) => {
    try {
      const { error } = await supabase
        .from('posts')
        .update({ status: 'rejected' })
        .eq('id', postId);

      if (error) throw error;
      toast.success('Post rejected');
      fetchPosts();
    } catch (error: any) {
      toast.error('Failed to reject post');
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
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Publisher Dashboard</h1>
              <p className="text-muted-foreground">Create and manage posts</p>
            </div>
            <Button onClick={() => setShowForm(!showForm)}>
              <Plus className="w-4 h-4 mr-2" />
              New Post
            </Button>
          </div>

          {showForm && (
            <Card>
              <CardHeader>
                <CardTitle>Create New Post</CardTitle>
              </CardHeader>
              <CardContent>
                <PostForm onSuccess={() => {
                  setShowForm(false);
                  fetchPosts();
                }} />
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {posts.map((post) => (
              <Card key={post.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="mb-2">{post.title}</CardTitle>
                      <CardDescription>{post.subject}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant={
                        post.status === 'approved' ? 'default' :
                        post.status === 'pending_review' ? 'secondary' :
                        post.status === 'rejected' ? 'destructive' : 'outline'
                      }>
                        {post.status}
                      </Badge>
                      <Badge variant="outline">{post.visibility}</Badge>
                    </div>
                  </div>
                </CardHeader>
                {post.status === 'pending_review' && (
                  <CardContent className="flex gap-2">
                    <Button onClick={() => handleApprove(post.id)} className="flex-1">
                      Approve & Publish
                    </Button>
                    <Button variant="outline" onClick={() => handleReject(post.id)} className="flex-1">
                      Reject
                    </Button>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
