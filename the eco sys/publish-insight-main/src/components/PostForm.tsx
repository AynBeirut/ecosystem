import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface PostFormProps {
  onSuccess: () => void;
}

export function PostForm({ onSuccess }: PostFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    subject: '',
    excerpt: '',
    content: '',
    visibility: 'free' as 'free' | 'moderate' | 'premium',
    media_url: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('posts').insert({
        ...formData,
        author_id: user.id,
        status: 'draft',
      });

      if (error) throw error;

      toast.success('Post created successfully');
      setFormData({
        title: '',
        subject: '',
        excerpt: '',
        content: '',
        visibility: 'free',
        media_url: '',
      });
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Enter post title"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="subject">Subject</Label>
        <Input
          id="subject"
          value={formData.subject}
          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
          placeholder="Brief subject line"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="excerpt">Excerpt</Label>
        <Textarea
          id="excerpt"
          value={formData.excerpt}
          onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
          placeholder="Short excerpt for the news feed"
          required
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="content">Content</Label>
        <Textarea
          id="content"
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          placeholder="Full article content"
          required
          rows={10}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="media_url">Media URL (optional)</Label>
        <Input
          id="media_url"
          type="url"
          value={formData.media_url}
          onChange={(e) => setFormData({ ...formData, media_url: e.target.value })}
          placeholder="https://example.com/image.jpg"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="visibility">Visibility</Label>
        <Select
          value={formData.visibility}
          onValueChange={(value: 'free' | 'moderate' | 'premium') =>
            setFormData({ ...formData, visibility: value })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="free">Free - All users</SelectItem>
            <SelectItem value="moderate">Moderate - Moderate & Premium users</SelectItem>
            <SelectItem value="premium">Premium - Premium users only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Creating...' : 'Create Post'}
      </Button>
    </form>
  );
}
