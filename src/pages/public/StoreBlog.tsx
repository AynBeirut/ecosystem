import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getFirestore, collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Globe } from 'lucide-react';

interface BlogPost {
  id: string;
  title: string;
  subject: string;
  excerpt: string;
  mediaUrl: string;
  visibility: string;
  publishedAt: Date | null;
}

interface StoreInfo {
  name: string;
  storeId: string;
}

const StoreBlog: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const db = getFirestore();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    const load = async () => {
      // Resolve slug → storeId
      const slugSnap = await getDocs(
        query(collection(db, 'storeProfiles'), where('slug', '==', slug))
      );
      if (slugSnap.empty) { setLoading(false); return; }
      const storeDoc = slugSnap.docs[0];
      const storeId = storeDoc.id;
      const storeName = storeDoc.data().name ?? slug;
      setStore({ name: storeName, storeId });

      // Fetch published public posts
      const postsSnap = await getDocs(
        query(
          collection(db, 'stores', storeId, 'blogPosts'),
          where('status', '==', 'published'),
          where('visibility', '==', 'public'),
          orderBy('publishedAt', 'desc')
        )
      );
      setPosts(
        postsSnap.docs.map((d) => ({
          id: d.id,
          title: d.data().title ?? '',
          subject: d.data().subject ?? '',
          excerpt: d.data().excerpt ?? '',
          mediaUrl: d.data().mediaUrl ?? '',
          visibility: d.data().visibility ?? 'public',
          publishedAt: d.data().publishedAt?.toDate?.() ?? null,
        }))
      );
      setLoading(false);
    };
    void load();
  }, [slug, db]);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><p className="text-muted-foreground">Loading…</p></div>;

  if (!store) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground">Store not found.</p>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <Link to={`/store/${slug}`}>
        <Button variant="ghost" size="sm" className="mb-6 gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to store
        </Button>
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">{store.name} — Blog</h1>
        <p className="text-muted-foreground mt-1">Latest articles and updates</p>
      </div>

      {posts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No posts published yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {posts.map((post) => (
            <Link key={post.id} to={`/store/${slug}/blog/${post.id}`} className="block group">
              <Card className="hover:border-primary/40 transition-colors">
                {post.mediaUrl && (
                  <div className="overflow-hidden rounded-t-lg max-h-48">
                    <img src={post.mediaUrl} alt={post.title} className="w-full object-cover group-hover:scale-[1.02] transition-transform duration-300" />
                  </div>
                )}
                <CardHeader className="pb-2">
                  {post.subject && <Badge variant="secondary" className="mb-2 w-fit">{post.subject}</Badge>}
                  <CardTitle className="text-lg group-hover:text-primary transition-colors">{post.title}</CardTitle>
                  {post.excerpt && <CardDescription className="line-clamp-2">{post.excerpt}</CardDescription>}
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> Public</span>
                    {post.publishedAt && <span>{post.publishedAt.toLocaleDateString()}</span>}
                    <span className="ml-auto text-primary font-medium group-hover:underline">Read more →</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default StoreBlog;
