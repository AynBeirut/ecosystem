import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { XCircle, RefreshCcw } from 'lucide-react';

export default function PaymentFailed() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const type = searchParams.get('type'); // 'trial' or 'subscription'
  const reason = searchParams.get('reason') || 'Unknown error';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
            <XCircle className="h-12 w-12 text-red-600" />
          </div>
          <CardTitle className="text-2xl">Payment Failed</CardTitle>
          <CardDescription>
            {type === 'trial' 
              ? 'We couldn\'t process your trial payment' 
              : 'We couldn\'t process your subscription payment'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="font-semibold text-sm text-red-900 mb-1">Error Details</h3>
            <p className="text-sm text-red-700">{reason}</p>
          </div>

          <div className="text-center space-y-2">
            <p className="text-sm text-gray-600">
              Please check your payment details and try again. If the problem persists, contact your payment provider.
            </p>
          </div>
          
          <div className="space-y-2">
            <Button 
              onClick={() => navigate('/subscription')} 
              className="w-full"
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            <Button 
              onClick={() => navigate('/admin/dashboard')} 
              variant="outline" 
              className="w-full"
            >
              Go to Dashboard
            </Button>
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-gray-500 text-center">
              Need help? Contact us at support@grabio.space
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
