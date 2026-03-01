import React, { useState, useEffect } from 'react';
import { getFirestore, doc, getDoc, collection, getCountFromServer } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, CreditCard, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/useAuth';
import { toast } from '@/components/ui/sonner';

const UpgradeToAdmin: React.FC = () => {
  const { user, upgradeToAdmin } = useAuth();
  // ...existing code...
  const [sellerCount, setSellerCount] = useState(0);
  const [isFreeSeller, setIsFreeSeller] = useState(false);
  const [monthsFreeLeft, setMonthsFreeLeft] = useState(0);
  const FREE_SELLER_LIMIT = 50;
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingTrial, setProcessingTrial] = useState(false);
  const [plan, setPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [hasUsedTrial, setHasUsedTrial] = useState(false);
  const navigate = useNavigate();
  const db = getFirestore();

  useEffect(() => {
    // Fetch seller count and user subscription status from Firestore
    const fetchSellerStatus = async () => {
      const db = getFirestore();
      // Get seller count from Firestore
      const sellersCol = collection(db, 'sellers');
      const snapshot = await getCountFromServer(sellersCol);
      const count = snapshot.data().count || 0;
      setSellerCount(count);
      let freeLeft = 0;
      let isFree = false;
      if (user) {
        // Get seller info from Firestore
        const sellerRef = doc(db, 'sellers', user.id);
        const sellerSnap = await getDoc(sellerRef);
        if (sellerSnap.exists()) {
          const sellerData = sellerSnap.data();
          // If user is already a seller/admin, redirect them immediately
          if (sellerData.role === 'admin') {
            navigate('/admin/dashboard', { replace: true });
            return;
          }
          if (sellerData.sellerSince) {
            const months = Math.max(0, 12 - Math.floor((Date.now() - new Date(sellerData.sellerSince).getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
            freeLeft = months;
            isFree = sellerData.sellerIndex < FREE_SELLER_LIMIT && months > 0;
          }
        }
        
        // Check if user has store profile with subscription data
        const storeProfileRef = doc(db, 'storeProfiles', user.id);
        const storeProfileSnap = await getDoc(storeProfileRef);
        if (storeProfileSnap.exists()) {
          const storeData = storeProfileSnap.data();
          setHasUsedTrial(storeData.hasUsedTrial || false);
        }
      }
      setIsFreeSeller(isFree);
      setMonthsFreeLeft(freeLeft);
    };
    fetchSellerStatus();
  }, [user, navigate]);

  const handleSubscribe = async (tier: 'premium' | 'pro', billing: 'monthly' | 'yearly') => {
    if(!user) return;
    
    setIsProcessing(true);
    try {
      const token = await user.getIdToken();
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
          email: user.email,
          userId: user.id,
          name: user.displayName || user.email,
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
      toast.error(error instanceof Error ? error.message : 'Subscription failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartTrial = async () => {
    if (!user) return;

    setProcessingTrial(true);
    try {
      const token = await user.getIdToken();
      const apiUrl = import.meta.env.VITE_FIREBASE_FUNCTION_URL || 'http://localhost:5001/market-flow-7b074/us-central1/api';
      
      const response = await fetch(`${apiUrl}/subscription/trial`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tier: 'pro',
          email: user.email,
          userId: user.id,
          name: user.displayName || user.email,
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
      toast.error(error instanceof Error ? error.message : 'Failed to start trial. Please try again.');
    } finally {
      setProcessingTrial(false);
    }
  };

  // ...existing code...
  if (user?.role === 'admin') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle>You're Already an Admin</CardTitle>
              <CardDescription>
                You already have admin privileges and can access all premium features.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center py-6">
              <CheckCircle2 size={48} className="mx-auto text-green-500 mb-4" />
              <p className="text-gray-600 mb-4">
                Enjoy all premium features and store management capabilities.
              </p>
            </CardContent>
            <CardFooter>
              <Button onClick={() => navigate('/admin')} className="w-full">
                Go to Admin Dashboard
              </Button>
            </CardFooter>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold mb-2 text-center">Upgrade Your Account</h1>
          <p className="text-center text-gray-600 mb-8">Choose the plan that fits your business needs</p>
          
          {/* Trial Option */}
          {!hasUsedTrial && (
            <Card className="mb-8 border-2 border-blue-500 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl flex items-center gap-2">
                      <Zap className="h-6 w-6 text-yellow-500" />
                      Try Pro for $1
                    </CardTitle>
                    <CardDescription className="mt-2">
                      Get full access to all Pro features for 1 month - <strong>Only $1!</strong>
                    </CardDescription>
                  </div>
                  <Badge className="bg-yellow-500 text-white">LIMITED OFFER</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start">
                        <CheckCircle2 className="mr-2 h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Full Pro features for 30 days</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle2 className="mr-2 h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>POS System included</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle2 className="mr-2 h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Composed Products & Services</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle2 className="mr-2 h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Production & Recipe Management</span>
                      </li>
                    </ul>
                  </div>
                  <div className="flex flex-col justify-center">
                    <Button 
                      size="lg"
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      onClick={handleStartTrial}
                      disabled={processingTrial}
                    >
                      {processingTrial ? (
                        <>Processing...</>
                      ) : (
                        <>
                          <Zap className="mr-2 h-5 w-5" />
                          Start $1 Trial Now
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-center text-gray-500 mt-2">
                      No credit card required • Cancel anytime
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Pricing Toggle */}
          <div className="flex justify-center mb-8">
            <div className="bg-white rounded-lg p-1 shadow-sm inline-flex">
              <Button
                variant={plan === 'monthly' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setPlan('monthly')}
              >
                Monthly
              </Button>
              <Button
                variant={plan === 'yearly' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setPlan('yearly')}
              >
                Yearly <span className="ml-1 text-xs text-green-600">(Save 17%)</span>
              </Button>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Premium Plan */}
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-2xl">Premium</CardTitle>
                <CardDescription>
                  <div className="mt-2">
                    <span className="text-3xl font-bold">${plan === 'monthly' ? '10' : '100'}</span>
                    <span className="text-gray-500">/{plan === 'monthly' ? 'month' : 'year'}</span>
                  </div>
                  <p className="text-sm mt-2">Perfect for getting started</p>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <CheckCircle2 className="mr-2 h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Full Store Management</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="mr-2 h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Unlimited Simple Products</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="mr-2 h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Order Management & Tracking</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="mr-2 h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Professional Templates</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="mr-2 h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Dual Currency Support</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="mr-2 h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Basic Inventory Management</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="mr-2 h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Customer & Analytics</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="mr-2 h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>PDF Invoicing</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full"
                  onClick={() => handleUpgrade('premium', plan)}
                  variant="outline"
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Processing...' : 'Get Premium'}
                </Button>
              </CardFooter>
            </Card>

            {/* Pro Plan */}
            <Card className="border-2 border-primary shadow-lg relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-primary text-white px-4 py-1">RECOMMENDED</Badge>
              </div>
              <CardHeader>
                <CardTitle className="text-2xl">Pro</CardTitle>
                <CardDescription>
                  <div className="mt-2">
                    <span className="text-3xl font-bold">${plan === 'monthly' ? '20' : '200'}</span>
                    <span className="text-gray-500">/{plan === 'monthly' ? 'month' : 'year'}</span>
                  </div>
                  <p className="text-sm mt-2">For advanced businesses</p>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <CheckCircle2 className="mr-2 h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span><strong>Everything in Premium</strong></span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="mr-2 h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span><strong>POS System Included</strong> - Point of Sale for in-store</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="mr-2 h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span><strong>Composed Products</strong> - Create products from recipes</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="mr-2 h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span><strong>Composed Services</strong> - Recurring service billing</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="mr-2 h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Advanced Production Management</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="mr-2 h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Raw Materials Tracking</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="mr-2 h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Recipe & Cost Management</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="mr-2 h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Priority Support</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full"
                  onClick={() => handleUpgrade('pro', plan)}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>Processing...</>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Get Pro
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* Add-ons */}
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-4">Add-ons</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Extra Storage (50GB)</CardTitle>
                  <CardDescription>
                    <span className="text-2xl font-bold">${plan === 'monthly' ? '5' : '50'}</span>
                    <span className="text-gray-500">/{plan === 'monthly' ? 'month' : 'year'}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">Additional storage for images and documents</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Custom Domain Hosting</CardTitle>
                  <CardDescription>
                    <span className="text-2xl font-bold">${plan === 'monthly' ? '10' : '100'}</span>
                    <span className="text-gray-500">/{plan === 'monthly' ? 'month' : 'year'}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">Host your store on your own domain with full DNS management</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default UpgradeToAdmin;
