import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/Header';
import { ShareButtons } from '@/components/ShareButtons';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Post {
  id: string;
  title: string;
  subject: string;
  content: string;
  excerpt: string;
  visibility: string;
  media_url: string | null;
  published_at: string;
}

export default function PostView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchPost();
    }
  }, [id]);

  const fetchPost = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('id', id)
        .eq('status', 'approved')
        .single();

      if (error) throw error;
      setPost(data);
    } catch (error: any) {
      toast.error('Failed to load post');
      navigate('/');
    } finally {
      setLoading(false);
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

  if (!post) {
    return null;
  }

  return (
    <>
      <Header />
      <main className="container mx-auto py-8 px-4">
        <article className="max-w-3xl mx-auto space-y-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Feed
          </Button>

          <div className="space-y-4">
            <Badge variant="secondary">{post.visibility}</Badge>
            <h1 className="text-4xl font-bold leading-tight">{post.title}</h1>
            <p className="text-xl text-muted-foreground font-medium">{post.subject}</p>
            <p className="text-sm text-muted-foreground">
              Published {new Date(post.published_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>

          {post.media_url && (
            <div className="rounded-lg overflow-hidden">
              <img
                src={post.media_url}
                alt={post.title}
                className="w-full h-auto"
              />
            </div>
          )}

          <div className="prose prose-lg max-w-none">
            <div dangerouslySetInnerHTML={{ __html: post.content.replace(/\n/g, '<br />') }} />
          </div>

          <div className="border-t pt-8">
            <h3 className="text-lg font-semibold mb-4">Share this article</h3>
            <ShareButtons
              url={window.location.href}
              title={post.title}
              description={post.excerpt}
            />
          </div>
        </article>
      </main>
    </>
  );
}
