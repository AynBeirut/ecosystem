import { ExternalLink, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/components/AppLayout';
import { isFinanceInAppShell, isPlayStoreV1Shell, playStoreWebUrl } from '@/lib/playStoreNavScope';

type WebOnlyNoticeProps = {
  feature: string;
  onLogout: () => void;
};

const WebOnlyNotice = ({ feature, onLogout }: WebOnlyNoticeProps) => {
  const inAppShell = isPlayStoreV1Shell() || isFinanceInAppShell();

  return (
  <AppLayout onLogout={onLogout}>
    <div className="max-w-md mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Monitor className="h-5 w-5 text-teal-600" />
            {inAppShell ? 'Desktop setup' : 'Manage on web'}
          </CardTitle>
          <CardDescription>
            <strong>{feature}</strong> is not in the mobile app for this release.{' '}
            {inAppShell ? 'Use grabio.space on a computer for full setup.' : 'Use the full web app on a computer.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Invoicing, clients, estimates, and receipts work in the app. Setup tools like inventory, staff, and payment
            methods are web-only for now.
          </p>
          {!inAppShell && (
            <Button asChild className="w-full bg-teal-600 hover:bg-teal-700">
              <a href={playStoreWebUrl()}>
                Open full app in browser
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  </AppLayout>
  );
};

export default WebOnlyNotice;
