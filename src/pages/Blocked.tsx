import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/useAuth';
import { useState, useEffect } from 'react';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { StoreProfile } from '@/types/storeProfile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Ban, Mail, CreditCard } from 'lucide-react';

export default function Blocked() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<StoreProfile | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;
      const db = getFirestore();
      const profileRef = doc(db, 'storeProfiles', user.id);
      const profileSnap = await getDoc(profileRef);
      if (profileSnap.exists()) {
        setProfile(profileSnap.data() as StoreProfile);
      }
    };
    fetchProfile();
  }, [user]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const daysUntilDeletion = profile?.blockedAt 
    ? Math.max(0, 30 - Math.floor((Date.now() - new Date(profile.blockedAt).getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
            <Ban className="h-12 w-12 text-red-600" />
          </div>
          <CardTitle className="text-2xl">Account Blocked</CardTitle>
          <CardDescription>
            Your account has been blocked due to expired subscription
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 space-y-4">
            <div>
              <h3 className="font-semibold text-red-900 mb-2">Why was my account blocked?</h3>
              <p className="text-sm text-red-700">
                Your subscription expired and the 7-day grace period has ended. We've temporarily blocked access to admin features to prevent further use.
              </p>
            </div>

            {profile?.blockedAt && (
              <div>
                <h3 className="font-semibold text-red-900 mb-2">Account Status</h3>
                <dl className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <dt className="text-red-700">Blocked On:</dt>
                    <dd className="text-red-900 font-medium">{formatDate(profile.blockedAt)}</dd>
                  </div>
                  {daysUntilDeletion !== null && (
                    <div className="flex justify-between">
                      <dt className="text-red-700">Data Deletion:</dt>
                      <dd className="text-red-900 font-medium">
                        {daysUntilDeletion > 0 
                          ? `In ${daysUntilDeletion} days` 
                          : 'Scheduled for deletion'}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {daysUntilDeletion !== null && daysUntilDeletion > 0 && (
              <div className="bg-yellow-50 border border-yellow-300 rounded p-3">
                <p className="text-sm text-yellow-900">
                  <strong>Warning:</strong> Your store data will be permanently deleted in {daysUntilDeletion} days if you don't renew your subscription.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900">How to restore access:</h3>
            <div className="space-y-2">
              <div className="flex items-start gap-3 p-3 border rounded-lg">
                <CreditCard className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm">Renew Your Subscription</h4>
                  <p className="text-sm text-gray-600">
                    Subscribe to restore full access to your account and data
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 border rounded-lg">
                <Mail className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm">Contact Support</h4>
                  <p className="text-sm text-gray-600">
                    If you believe this is a mistake, reach out to our support team
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <Button 
              onClick={() => navigate('/subscription')} 
              className="w-full"
              size="lg"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Renew Subscription
            </Button>
            <Button 
              onClick={() => navigate('/')} 
              variant="outline" 
              className="w-full"
            >
              Go to Marketplace
            </Button>
          </div>

          <div className="pt-4 border-t text-center">
            <p className="text-sm text-gray-600 mb-2">Need help?</p>
            <p className="text-sm font-medium">
              Email: <a href="mailto:support@grabio.space" className="text-blue-600 hover:underline">support@grabio.space</a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
