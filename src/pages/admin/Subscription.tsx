import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/useAuth';
import { useNavigate } from 'react-router-dom';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { StoreProfile } from '@/types/storeProfile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const PRICING = {
  trial: 1.00,
  premium: {
    monthly: 10,
    yearly: 100,
  },
  pro: {
    monthly: 20,
    yearly: 200,
  },
  storage: {
    monthly: 5,
    yearly: 50,
  },
  customDomain: {
    monthly: 10,
    yearly: 100,
  },
};

export default function Subscription() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StoreProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [subscriptionInfo, setSubscriptionInfo] = useState<{ billingHistory?: Array<{ paymentId: string; amount: number; status: string; type: string; createdAt: string }> } | null>(null);
  const [loadingInfo, setLoadingInfo] =useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  const firebaseAuth = getAuth();

  const loadSubscriptionInfo = useCallback(async () => {
    if (!user) return;

    try {
      setLoadingInfo(true);
      const currentUser = firebaseAuth.currentUser;
      if (!currentUser) return;
      
      const token = await currentUser.getIdToken();
      const apiUrl = import.meta.env.VITE_FIREBASE_FUNCTION_URL || 'http://localhost:5001/market-flow-7b074/us-central1/api';
      
      const response = await fetch(`${apiUrl}/subscription/info`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load subscription info');
      }

      const data = await response.json();
      setSubscriptionInfo(data);
    } catch (error) {
      console.error('Error loading subscription:', error);
      toast({
        title: 'Error',
        description: 'Failed to load subscription information',
        variant: 'destructive',
      });
    } finally {
      setLoadingInfo(false);
    }
  }, [firebaseAuth, user, toast]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }
      const db = getFirestore();
      const profileRef = doc(db, 'storeProfiles', user.id);
      const profileSnap = await getDoc(profileRef);
      if (profileSnap.exists()) {
        setProfile(profileSnap.data() as StoreProfile);
      }
      setIsLoading(false);
    };
    fetchProfile();
    loadSubscriptionInfo();
  }, [user, loadSubscriptionInfo]);

  const handleStartTrial = async () => {
    const currentUser = firebaseAuth.currentUser;
    if (!currentUser) return;

    try {
      setProcessingPayment(true);
      const token = await currentUser.getIdToken();
      const apiUrl = import.meta.env.VITE_FIREBASE_FUNCTION_URL || 'http://localhost:5001/market-flow-7b074/us-central1/api';
      
      const response = await fetch(`${apiUrl}/subscription/trial`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tier: 'pro',
          email: user?.email,
          userId: user?.id,
          name: user?.name,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start trial');
      }

      const data = await response.json();
      
      // Redirect to payment page
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      }
    } catch (error) {
      console.error('Error starting trial:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to start trial',
        variant: 'destructive',
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleSubscribe = async (tier: 'premium' | 'pro', billing: 'monthly' | 'yearly', addOns: string[] = []) => {
    const currentUser = firebaseAuth.currentUser;
    if (!currentUser) return;

    try {
      setProcessingPayment(true);
      const token = await currentUser.getIdToken();
      const apiUrl = import.meta.env.VITE_FIREBASE_FUNCTION_URL || 'http://localhost:5001/market-flow-7b074/us-central1/api';
      
      const response = await fetch(`${apiUrl}/subscription/subscribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tier,
          billing,
          addOns,
          email: user?.email,
          userId: user?.id,
          name: user?.name,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to subscribe');
      }

      const data = await response.json();
      
      // Redirect to payment page
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      }
    } catch (error) {
      console.error('Error subscribing:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to subscribe',
        variant: 'destructive',
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleCancelSubscription = async () => {
    const currentUser = firebaseAuth.currentUser;
    if (!currentUser) return;

    try {
      const token = await currentUser.getIdToken();
      const apiUrl = import.meta.env.VITE_FIREBASE_FUNCTION_URL || 'http://localhost:5001/market-flow-7b074/us-central1/api';
      
      const response = await fetch(`${apiUrl}/subscription/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to cancel subscription');
      }

      toast({
        title: 'Success',
        description: 'Your subscription has been cancelled. You will retain access until the end of your current billing period.',
      });

      // Reload subscription info and redirect to dashboard
      await loadSubscriptionInfo();
      
      setTimeout(() => {
        navigate('/admin/dashboard');
      }, 2000);
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      toast({
        title: 'Error',
        description: 'Failed to cancel subscription',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'trial':
        return <Badge variant="secondary">Trial</Badge>;
      case 'active':
        return <Badge variant="default">Active</Badge>;
      case 'grace':
        return <Badge variant="destructive">Grace Period</Badge>;
      case 'expired':
        return <Badge variant="outline">Expired</Badge>;
      case 'blocked':
        return <Badge variant="destructive">Blocked</Badge>;
      default:
        return <Badge variant="outline">No Subscription</Badge>;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatAmount = (amount: number) => {
    return `$${(amount / 100).toFixed(2)}`;
  };

  if (isLoading || loadingInfo) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading subscription...</p>
        </div>
      </div>
    );
  }

  const isLegacyUser = profile?.isLegacyUser && profile?.legacyExpiresAt;
  const hasActiveSubscription = profile?.subscriptionStatus === 'active' || profile?.subscriptionStatus === 'trial';
  const canStartTrial = !profile?.hasUsedTrial && !hasActiveSubscription && !isLegacyUser;

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <h1 className="text-3xl font-bold mb-8">Subscription Management</h1>

      {/* Current Subscription Status */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>Manage your subscription and billing</CardDescription>
            </div>
            {getStatusBadge(profile?.subscriptionStatus)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">Plan Details</h3>
              <dl className="space-y-2">
                {isLegacyUser && (
                  <>
                    <div>
                      <dt className="text-sm text-gray-600">Status</dt>
                      <dd className="font-medium flex items-center gap-2">
                        <Badge variant="secondary">Legacy User - Free Access</Badge>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-600">Free Access Until</dt>
                      <dd className="font-medium">{formatDate(profile?.legacyExpiresAt)}</dd>
                    </div>
                  </>
                )}
                <div>
                  <dt className="text-sm text-gray-600">Tier</dt>
                  <dd className="font-medium capitalize">{profile?.subscriptionTier || 'None'}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-600">Billing Cycle</dt>
                  <dd className="font-medium capitalize">{profile?.subscriptionPlan || 'N/A'}</dd>
                </div>
                {profile?.subscriptionEndsAt && (
                  <div>
                    <dt className="text-sm text-gray-600">
                      {profile?.subscriptionStatus === 'trial' ? 'Trial Ends' : 'Next Billing Date'}
                    </dt>
                    <dd className="font-medium">{formatDate(profile?.subscriptionEndsAt)}</dd>
                  </div>
                )}
                {profile?.addOns && profile.addOns.length > 0 && (
                  <div>
                    <dt className="text-sm text-gray-600">Add-ons</dt>
                    <dd className="font-medium">
                      {profile.addOns.map((addon: string) => (
                        <Badge key={addon} variant="outline" className="mr-2">
                          {addon}
                        </Badge>
                      ))}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">Actions</h3>
              <div className="space-y-2">
                {canStartTrial && (
                  <Button
                    onClick={handleStartTrial}
                    disabled={processingPayment}
                    className="w-full"
                  >
                    {processingPayment ? 'Processing...' : `Start $1 Trial (1 Month)`}
                  </Button>
                )}
                
                {hasActiveSubscription && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="w-full">
                        Cancel Subscription
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Your subscription will be cancelled, but you'll retain access until{' '}
                          {formatDate(profile?.subscriptionEndsAt)}. You can resubscribe at any time.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                        <AlertDialogAction onClick={handleCancelSubscription}>
                          Cancel Subscription
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Available Plans */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Available Plans</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Premium Plan */}
          <Card>
            <CardHeader>
              <CardTitle>Premium</CardTitle>
              <CardDescription>For growing businesses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="text-3xl font-bold">${PRICING.premium.monthly}<span className="text-lg text-gray-600">/month</span></div>
                <div className="text-sm text-gray-600">or ${PRICING.premium.yearly}/year (save 17%)</div>
              </div>
              <ul className="space-y-2 mb-6">
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm">Raw materials & finished goods</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm">Online store</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm">Basic analytics</span>
                </li>
              </ul>
              <div className="space-y-2">
                <Button
                  onClick={() => handleSubscribe('premium', 'monthly')}
                  disabled={processingPayment}
                  variant="outline"
                  className="w-full"
                >
                  Subscribe Monthly
                </Button>
                <Button
                  onClick={() => handleSubscribe('premium', 'yearly')}
                  disabled={processingPayment}
                  className="w-full"
                >
                  Subscribe Yearly (Save 17%)
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Pro Plan */}
          <Card className="border-primary">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Pro</CardTitle>
                  <CardDescription>For advanced manufacturers</CardDescription>
                </div>
                <Badge>Popular</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="text-3xl font-bold">${PRICING.pro.monthly}<span className="text-lg text-gray-600">/month</span></div>
                <div className="text-sm text-gray-600">or ${PRICING.pro.yearly}/year (save 17%)</div>
              </div>
              <ul className="space-y-2 mb-6">
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm">Everything in Premium</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm">Composed products & recipes</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm">Advanced analytics</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm">Priority support</span>
                </li>
              </ul>
              <div className="space-y-2">
                <Button
                  onClick={() => handleSubscribe('pro', 'monthly')}
                  disabled={processingPayment}
                  variant="outline"
                  className="w-full"
                >
                  Subscribe Monthly
                </Button>
                <Button
                  onClick={() => handleSubscribe('pro', 'yearly')}
                  disabled={processingPayment}
                  className="w-full"
                >
                  Subscribe Yearly (Save 17%)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add-ons */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Add-ons & Upgrades</CardTitle>
          <CardDescription>Enhance your plan with additional features</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Storage Add-on */}
            <div className="border-2 rounded-lg p-6 hover:border-primary transition-colors">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-lg">Extend My Store</h3>
                {profile?.addOns?.includes('storage') && (
                  <Badge variant="default">Active</Badge>
                )}
              </div>
              <p className="text-sm text-gray-600 mb-1">Additional 10GB storage for products and media</p>
              <p className="text-xs text-gray-500 mb-4">Perfect for growing catalogs with many products</p>
              <div className="text-2xl font-bold mb-4">
                ${PRICING.storage.monthly}<span className="text-base text-gray-600">/month</span>
              </div>
              <div className="text-sm text-gray-600 mb-4">
                or ${PRICING.storage.yearly}/year <Badge variant="secondary" className="ml-1">Save $10</Badge>
              </div>
              {!profile?.addOns?.includes('storage') ? (
                <div className="space-y-2">
                  <Button
                    onClick={() => handleSubscribe(profile?.subscriptionTier || 'pro', 'monthly', ['storage'])}
                    disabled={processingPayment || !hasActiveSubscription}
                    variant="outline"
                    className="w-full"
                  >
                    Add Monthly ($5/mo)
                  </Button>
                  <Button
                    onClick={() => handleSubscribe(profile?.subscriptionTier || 'pro', 'yearly', ['storage'])}
                    disabled={processingPayment || !hasActiveSubscription}
                    className="w-full"
                  >
                    Add Yearly ($50/yr)
                  </Button>
                  {!hasActiveSubscription && (
                    <p className="text-xs text-red-600 mt-2">* Requires active subscription</p>
                  )}
                </div>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full">
                      Remove Add-on
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove Storage Add-on?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove the extra 10GB storage from your plan. Your existing data won't be deleted, but you won't be able to add new items if you exceed the base storage limit.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep Add-on</AlertDialogCancel>
                      <AlertDialogAction onClick={handleCancelSubscription}>
                        Remove Add-on
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
            
            {/* Custom Domain Add-on */}
            <div className="border-2 rounded-lg p-6 hover:border-primary transition-colors">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-lg">Custom Domain Hosting</h3>
                {profile?.addOns?.includes('customDomainHosting') && (
                  <Badge variant="default">Active</Badge>
                )}
              </div>
              <p className="text-sm text-gray-600 mb-1">Host your store on your own custom domain</p>
              <p className="text-xs text-gray-500 mb-2">Includes DNS management with nameservers</p>
              {profile?.addOns?.includes('customDomainHosting') && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
                  <p className="text-xs font-semibold text-blue-900 mb-1">Your DNS Nameservers:</p>
                  <p className="text-xs font-mono text-blue-800">ns1.emoove.co</p>
                  <p className="text-xs font-mono text-blue-800">ns2.emoove.co</p>
                  <p className="text-xs text-blue-700 mt-2">Point your domain to these nameservers</p>
                </div>
              )}
              <div className="text-2xl font-bold mb-4">
                ${PRICING.customDomain.monthly}<span className="text-base text-gray-600">/month</span>
              </div>
              <div className="text-sm text-gray-600 mb-4">
                or ${PRICING.customDomain.yearly}/year <Badge variant="secondary" className="ml-1">Save $20</Badge>
              </div>
              {!profile?.addOns?.includes('customDomainHosting') ? (
                <div className="space-y-2">
                  <Button
                    onClick={() => handleSubscribe(profile?.subscriptionTier || 'pro', 'monthly', ['customDomainHosting'])}
                    disabled={processingPayment || !hasActiveSubscription}
                    variant="outline"
                    className="w-full"
                  >
                    Add Monthly ($10/mo)
                  </Button>
                  <Button
                    onClick={() => handleSubscribe(profile?.subscriptionTier || 'pro', 'yearly', ['customDomainHosting'])}
                    disabled={processingPayment || !hasActiveSubscription}
                    className="w-full"
                  >
                    Add Yearly ($100/yr)
                  </Button>
                  {!hasActiveSubscription && (
                    <p className="text-xs text-red-600 mt-2">* Requires active subscription</p>
                  )}
                </div>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full">
                      Remove Add-on
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove Custom Domain?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove custom domain hosting from your plan. Your store will revert to the default grabio.space domain.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep Add-on</AlertDialogCancel>
                      <AlertDialogAction onClick={handleCancelSubscription}>
                        Remove Add-on
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment History */}
      {subscriptionInfo?.billingHistory && subscriptionInfo.billingHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
            <CardDescription>Your recent transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4">Date</th>
                    <th className="text-left py-2 px-4">Type</th>
                    <th className="text-left py-2 px-4">Amount</th>
                    <th className="text-left py-2 px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptionInfo.billingHistory.map((payment, index: number) => (
                    <tr key={index} className="border-b">
                      <td className="py-2 px-4">{formatDate(payment.createdAt)}</td>
                      <td className="py-2 px-4 capitalize">{payment.type}</td>
                      <td className="py-2 px-4">{formatAmount(payment.amount)}</td>
                      <td className="py-2 px-4">
                        <Badge
                          variant={
                            payment.status === 'success' 
                              ? 'default' 
                              : payment.status === 'failed' 
                              ? 'destructive' 
                              : 'outline'
                          }
                        >
                          {payment.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Premium Support - Only for Premium and Pro users */}
      {(profile?.subscriptionTier === 'premium' || profile?.subscriptionTier === 'pro') && hasActiveSubscription && (
        <Card className="mt-8 border-2 border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Premium WhatsApp Support
            </CardTitle>
            <CardDescription>Get direct support via WhatsApp</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 mb-4">
              As a {profile?.subscriptionTier?.toUpperCase()} member, you have access to our dedicated WhatsApp support line.
            </p>
            <a 
              href="https://wa.me/96179190116" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Chat on WhatsApp: +961 79 190 116
            </a>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
