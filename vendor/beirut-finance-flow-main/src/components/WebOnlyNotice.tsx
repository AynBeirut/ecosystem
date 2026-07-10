import { ExternalLink, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/components/AppLayout';
import { playStoreWebUrl } from '@/lib/playStoreNavScope';

type WebOnlyNoticeProps = {
  feature: string;
  onLogout: () => void;
};

const WebOnlyNotice = ({ feature, onLogout }: WebOnlyNoticeProps) => (
  <AppLayout onLogout={onLogout}>
    <div className="max-w-md mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Monitor className="h-5 w-5 text-teal-600" />
            Manage on web
          </CardTitle>
          <CardDescription>
            <strong>{feature}</strong> is not in the mobile app for this release. Use the full web app on a computer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Invoicing, clients, estimates, and receipts work in the app. Setup tools like inventory, staff, and payment
            methods are web-only for now.
          </p>
          <Button asChild className="w-full bg-teal-600 hover:bg-teal-700">
            <a href={playStoreWebUrl()} target="_blank" rel="noopener noreferrer">
              Open full app in browser
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  </AppLayout>
);

export default WebOnlyNotice;
