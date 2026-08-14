import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getFirestore, collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Globe } from 'lucide-react';
import { buildStoreRelativePath, isExternalUrl, storeSlugFromHostname } from '@/lib/storeUrls';

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
  const { slug: paramSlug } = useParams<{ slug: string }>();
  const slug = paramSlug || (typeof window !== 'undefined' ? storeSlugFromHostname(window.location.hostname) : '') || '';
  const db = getFirestore();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    const load = async () => {
      const slugSnap = await getDocs(
        query(collection(db, 'storeProfiles'), where('slug', '==', slug))
      );
      if (slugSnap.empty) { setLoading(false); return; }
      const storeDoc = slugSnap.docs[0];
      const storeId = storeDoc.id;
      const storeName = storeDoc.data().name ?? slug;
      setStore({ name: storeName, storeId });

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

  const storeHomeHref = buildStoreRelativePath(slug, '/');

  if (loading) return <div className="flex items-center justify-center min-h-screen"><p className="text-muted-foreground">Loading…</p></div>;

  if (!store) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground">Store not found.</p>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      {isExternalUrl(storeHomeHref) ? (
        <a href={storeHomeHref}>
          <Button variant="ghost" size="sm" className="mb-6 gap-1" asChild={false}>
            <span className="inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" /> Back to store</span>
          </Button>
        </a>
      ) : (
        <Link to={storeHomeHref}>
          <Button variant="ghost" size="sm" className="mb-6 gap-1">
            <ArrowLeft className="h-4 w-4" /> Back to store
          </Button>
        </Link>
      )}

      <div className="mb-8">
        <h1 className="text-3xl font-bold">{store.name} — Blog</h1>
        <p className="text-muted-foreground mt-1">Latest articles and updates</p>
      </div>

      {posts.length === 0 ? (
        <p className="text-muted-foreground">No published posts yet.</p>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => {
            const postHref = buildStoreRelativePath(slug, `/blog/${post.id}`);
            const card = (
              <Card className="group hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="group-hover:text-primary transition-colors">{post.title}</CardTitle>
                      {post.subject && <CardDescription className="mt-1">{post.subject}</CardDescription>}
                    </div>
                    <Badge variant="outline"><Globe className="h-3 w-3 mr-1" /> Public</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {post.mediaUrl && (
                    <img src={post.mediaUrl} alt={post.title} className="w-full h-48 object-cover rounded-lg mb-4" />
                  )}
                  <p className="text-sm text-muted-foreground line-clamp-3">{post.excerpt}</p>
                  {post.publishedAt && (
                    <p className="text-xs text-muted-foreground mt-3">
                      {post.publishedAt.toLocaleDateString()}
                    </p>
                  )}
                </CardContent>
              </Card>
            );

            return isExternalUrl(postHref) ? (
              <a key={post.id} href={postHref} className="block">{card}</a>
            ) : (
              <Link key={post.id} to={postHref} className="block">{card}</Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StoreBlog;
