import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';

interface BlogPost {
  id: string;
  title: string;
  subject: string;
  excerpt: string;
  content: string;
  mediaUrl: string;
  visibility: string;
  publishedAt: Date | null;
}

const StoreBlogPost: React.FC = () => {
  const { slug, postId } = useParams<{ slug: string; postId: string }>();
  const db = getFirestore();
  const navigate = useNavigate();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [storeName, setStoreName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug || !postId) return;
    const load = async () => {
      // Resolve slug → storeId
      const slugSnap = await getDocs(
        query(collection(db, 'storeProfiles'), where('slug', '==', slug))
      );
      if (slugSnap.empty) { navigate(`/store/${slug}/blog`); return; }
      const storeDoc = slugSnap.docs[0];
      const storeId = storeDoc.id;
      setStoreName(storeDoc.data().name ?? slug);

      const postSnap = await getDoc(doc(db, 'stores', storeId, 'blogPosts', postId));
      if (!postSnap.exists()) {
        navigate(`/store/${slug}/blog`);
        return;
      }
      const d = postSnap.data();
      if (d?.status !== 'published' || d?.visibility !== 'public') {
        navigate(`/store/${slug}/blog`);
        return;
      }
      setPost({
        id: postSnap.id,
        title: d.title ?? '',
        subject: d.subject ?? '',
        excerpt: d.excerpt ?? '',
        content: d.content ?? '',
        mediaUrl: d.mediaUrl ?? '',
        visibility: d.visibility ?? 'public',
        publishedAt: d.publishedAt?.toDate?.() ?? null,
      });
      setLoading(false);
    };
    void load();
  }, [slug, postId, db, navigate]);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><p className="text-muted-foreground">Loading…</p></div>;
  if (!post) return null;

  return (
    <div className="container mx-auto px-4 py-10 max-w-2xl">
      <Link to={`/store/${slug}/blog`}>
        <Button variant="ghost" size="sm" className="mb-6 gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to {storeName} Blog
        </Button>
      </Link>

      <article className="space-y-6">
        {post.subject && <Badge variant="secondary">{post.subject}</Badge>}
        <h1 className="text-4xl font-bold leading-tight">{post.title}</h1>
        {post.excerpt && <p className="text-xl text-muted-foreground">{post.excerpt}</p>}
        {post.publishedAt && (
          <p className="text-sm text-muted-foreground">
            Published {post.publishedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        )}

        {post.mediaUrl && (
          <div className="rounded-xl overflow-hidden">
            <img src={post.mediaUrl} alt={post.title} className="w-full h-auto" />
          </div>
        )}

        <div
          className="prose prose-lg max-w-none text-foreground leading-relaxed"
          dangerouslySetInnerHTML={{ __html: post.content.replace(/\n/g, '<br />') }}
        />
      </article>
    </div>
  );
};

export default StoreBlogPost;
