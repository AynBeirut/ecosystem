import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Unlock } from 'lucide-react';

interface PostCardProps {
  id: string;
  title: string;
  subject: string;
  excerpt: string;
  visibility: 'free' | 'moderate' | 'premium';
  onClick: () => void;
}

const visibilityConfig = {
  free: {
    label: 'Free',
    icon: Unlock,
    variant: 'secondary' as const,
  },
  moderate: {
    label: 'Moderate',
    icon: Lock,
    variant: 'outline' as const,
  },
  premium: {
    label: 'Premium',
    icon: Lock,
    variant: 'default' as const,
  },
};

export function PostCard({ title, subject, excerpt, visibility, onClick }: PostCardProps) {
  const config = visibilityConfig[visibility];
  const Icon = config.icon;

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 space-y-2">
            <Badge variant={config.variant} className="mb-2">
              <Icon className="w-3 h-3 mr-1" />
              {config.label}
            </Badge>
            <CardTitle className="text-2xl font-serif leading-tight">{title}</CardTitle>
            <CardDescription className="text-base font-medium">{subject}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground line-clamp-3">{excerpt}</p>
      </CardContent>
    </Card>
  );
}
