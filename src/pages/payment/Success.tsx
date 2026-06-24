import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2 } from 'lucide-react';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const type = searchParams.get('type'); // 'trial' or 'subscription'

  useEffect(() => {
    // Webhook will handle activation, this is just the UI confirmation
    console.log('Payment successful, type:', type);
  }, [type]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Payment Successful!</CardTitle>
          <CardDescription>
            {type === 'trial'
              ? 'Your trial has been activated'
              : type === 'subscription_modular'
                ? 'Your modular package is now active'
                : 'Your subscription is now active'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-2">
            <p className="text-sm text-gray-600">
              {type === 'trial' 
                ? 'You now have full access to all features for 1 month. We\'ll send you a confirmation email shortly.' 
                : 'Thank you for subscribing! You now have full access to all premium features.'}
            </p>
          </div>
          
          <div className="space-y-2">
            <Button 
              onClick={() => navigate('/admin/dashboard')} 
              className="w-full"
            >
              Go to Dashboard
            </Button>
            <Button 
              onClick={() => navigate('/subscription')} 
              variant="outline" 
              className="w-full"
            >
              View Subscription
            </Button>
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-gray-500 text-center">
              Your account is being activated. This may take a few moments.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
