import React, { useState, useEffect, useCallback } from 'react';
import { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import ModuleGate from '@/components/ModuleGate';
import { Plus, Pencil, Trash2, Globe, EyeOff } from 'lucide-react';

type PostVisibility = 'public' | 'subscribers';
type PostStatus = 'draft' | 'published';

interface BlogPost {
  id: string;
  title: string;
  subject: string;
  excerpt: string;
  content: string;
  visibility: PostVisibility;
  status: PostStatus;
  mediaUrl: string;
  createdAt: Date | null;
  publishedAt: Date | null;
}

const EMPTY_FORM = {
  title: '',
  subject: '',
  excerpt: '',
  content: '',
  visibility: 'public' as PostVisibility,
  mediaUrl: '',
};

const BlogPublisher: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const storeId = getActualStoreId(user);
  const db = getFirestore();

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const colRef = useCallback(
    () => collection(db, 'stores', storeId!, 'blogPosts'),
    [db, storeId]
  );

  useEffect(() => {
    if (!storeId) return;
    const q = query(colRef(), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setPosts(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: data.title ?? '',
            subject: data.subject ?? '',
            excerpt: data.excerpt ?? '',
            content: data.content ?? '',
            visibility: data.visibility ?? 'public',
            status: data.status ?? 'draft',
            mediaUrl: data.mediaUrl ?? '',
            createdAt: data.createdAt?.toDate?.() ?? null,
            publishedAt: data.publishedAt?.toDate?.() ?? null,
          };
        })
      );
      setLoading(false);
    });
    return unsub;
  }, [storeId, colRef]);

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (post: BlogPost) => {
    setEditingId(post.id);
    setForm({
      title: post.title,
      subject: post.subject,
      excerpt: post.excerpt,
      content: post.content,
      visibility: post.visibility,
      mediaUrl: post.mediaUrl,
    });
    setShowForm(true);
  };

  const handleSave = async (publishNow: boolean) => {
    if (!form.title.trim() || !form.content.trim()) {
      toast({ title: 'Title and content are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        ...form,
        status: publishNow ? 'published' : 'draft',
        authorId: user?.uid ?? '',
        storeId,
      };
      if (publishNow) payload.publishedAt = serverTimestamp();

      if (editingId) {
        await updateDoc(doc(colRef(), editingId), payload);
        toast({ title: publishNow ? 'Post published' : 'Draft saved' });
      } else {
        payload.createdAt = serverTimestamp();
        await addDoc(colRef(), payload);
        toast({ title: publishNow ? 'Post published' : 'Draft saved' });
      }
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (post: BlogPost) => {
    const next = post.status === 'published' ? 'draft' : 'published';
    await updateDoc(doc(colRef(), post.id), {
      status: next,
      ...(next === 'published' ? { publishedAt: serverTimestamp() } : {}),
    });
    toast({ title: next === 'published' ? 'Post published' : 'Post unpublished' });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this post?')) return;
    await deleteDoc(doc(colRef(), id));
    toast({ title: 'Post deleted' });
  };

  return (
    <ModuleGate moduleId="blog_publisher">
      <AdminPageShell
        title="Blog Publisher"
        description="Write and publish articles visible on your public store page."
        eyebrow="Content"
        backTo="/admin/dashboard"
        className="max-w-4xl"
        actions={(
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" /> New Post
          </Button>
        )}
      >

        {/* Post form */}
        {showForm && (
          <AdminPanel>
            <CardHeader>
              <CardTitle>{editingId ? 'Edit Post' : 'New Post'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Title *</Label>
                  <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Post title" />
                </div>
                <div className="space-y-1.5">
                  <Label>Subject / Category</Label>
                  <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="e.g. Business Tips" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Excerpt</Label>
                <Textarea value={form.excerpt} onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))} placeholder="Short summary shown in the feed" rows={2} />
              </div>

              <div className="space-y-1.5">
                <Label>Content *</Label>
                <Textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="Full article content" rows={12} />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Visibility</Label>
                  <Select value={form.visibility} onValueChange={v => setForm(f => ({ ...f, visibility: v as PostVisibility }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">🌐 Public — everyone</SelectItem>
                      <SelectItem value="subscribers">🔒 Subscribers only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Cover image URL (optional)</Label>
                  <Input type="url" value={form.mediaUrl} onChange={e => setForm(f => ({ ...f, mediaUrl: e.target.value }))} placeholder="https://..." />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button onClick={() => void handleSave(true)} disabled={saving} className="flex-1">
                  {saving ? 'Saving…' : '🚀 Publish Now'}
                </Button>
                <Button onClick={() => void handleSave(false)} disabled={saving} variant="outline" className="flex-1">
                  {saving ? 'Saving…' : '💾 Save as Draft'}
                </Button>
                <Button variant="ghost" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </AdminPanel>
        )}

        {/* Post list */}
        {loading ? (
          <p className="text-muted-foreground">Loading posts…</p>
        ) : posts.length === 0 ? (
          <AdminPanel>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No posts yet. Create your first article!</p>
            </CardContent>
          </AdminPanel>
        ) : (
          <div className="space-y-3">
            {posts.map(post => (
              <AdminPanel key={post.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">{post.title}</CardTitle>
                      {post.subject && <CardDescription>{post.subject}</CardDescription>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={post.status === 'published' ? 'default' : 'secondary'}>
                        {post.status === 'published' ? 'Published' : 'Draft'}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        {post.visibility === 'public' ? <Globe className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        {post.visibility}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                {post.excerpt && (
                  <CardContent className="pb-2 pt-0">
                    <p className="text-sm text-muted-foreground line-clamp-2">{post.excerpt}</p>
                  </CardContent>
                )}
                <CardContent className="pt-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => openEdit(post)}>
                      <Pencil className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void togglePublish(post)}>
                      {post.status === 'published' ? <><EyeOff className="h-3 w-3 mr-1" /> Unpublish</> : <><Globe className="h-3 w-3 mr-1" /> Publish</>}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => void handleDelete(post.id)}>
                      <Trash2 className="h-3 w-3 mr-1" /> Delete
                    </Button>
                    {post.publishedAt && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        Published {post.publishedAt.toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </CardContent>
              </AdminPanel>
            ))}
          </div>
        )}
      </AdminPageShell>
    </ModuleGate>
  );
};

export default BlogPublisher;
