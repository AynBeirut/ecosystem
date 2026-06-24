import { Button } from '@/components/ui/button';
import { Share2, Twitter, Linkedin } from 'lucide-react';

interface ShareButtonsProps {
  url: string;
  title: string;
  description: string;
}

export function ShareButtons({ url, title, description }: ShareButtonsProps) {
  const shareToTwitter = () => {
    const text = encodeURIComponent(`${title}\n\n${description}`);
    const shareUrl = `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(url)}`;
    window.open(shareUrl, '_blank', 'width=550,height=420');
  };

  const shareToLinkedIn = () => {
    const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
    window.open(shareUrl, '_blank', 'width=550,height=420');
  };

  const shareToLebaneseNewsApp = () => {
    // Placeholder for Lebanese news app integration
    alert('Lebanese news app integration coming soon!');
  };

  return (
    <div className="flex gap-3">
      <Button
        variant="outline"
        size="sm"
        onClick={shareToTwitter}
        className="gap-2"
      >
        <Twitter className="w-4 h-4" />
        Share on X
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        onClick={shareToLinkedIn}
        className="gap-2"
      >
        <Linkedin className="w-4 h-4" />
        Share on LinkedIn
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        onClick={shareToLebaneseNewsApp}
        className="gap-2"
      >
        <Share2 className="w-4 h-4" />
        Lebanese News App
      </Button>
    </div>
  );
}
