
import React, { useState, useEffect } from 'react';
import { getFirestore, doc, getDoc, collection, getCountFromServer } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, CreditCard, Star } from 'lucide-react';
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
  const [showBanner, setShowBanner] = useState(true);
  const [plan, setPlan] = useState<'monthly' | 'yearly'>('monthly');
  const navigate = useNavigate();
  const db = getFirestore();
  // Auto-dismiss banner after 2 minutes
  useEffect(() => {
    if (!showBanner) return;
    const timer = setTimeout(() => setShowBanner(false), 120000);
    return () => clearTimeout(timer);
  }, [showBanner]);

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
          if (sellerData.sellerSince) {
            const months = Math.max(0, 12 - Math.floor((Date.now() - new Date(sellerData.sellerSince).getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
            freeLeft = months;
            isFree = sellerData.sellerIndex < FREE_SELLER_LIMIT && months > 0;
          }
        }
      }
      setMonthsFreeLeft(freeLeft);
      setIsFreeSeller(isFree);
    };
    fetchSellerStatus();
  }, [user]);

  const handleUpgrade = async () => {
    setIsProcessing(true);
    try {
  await upgradeToAdmin();
  // Force reload to refresh user context and role
  window.location.href = '/admin';
    } catch (error) {
      toast.error("Subscription failed. Please try again.");
    } finally {
      setIsProcessing(false);
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
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold mb-6 text-center">Upgrade to Admin</h1>
          {showBanner && (
            <div className="mb-6 bg-blue-100 border border-blue-300 text-blue-800 rounded px-4 py-2 text-center text-sm transition-opacity duration-500">
              <strong>First 50 sellers get 1 year free!</strong>
            </div>
          )}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Premium Plan</CardTitle>
              <CardDescription>
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-lg">{plan === 'monthly' ? '$9/month' : '$90/year'}</span>
                  <Button
                    variant={plan === 'monthly' ? 'outline' : 'secondary'}
                    size="sm"
                    onClick={() => setPlan(plan === 'monthly' ? 'yearly' : 'monthly')}
                  >
                    Switch to {plan === 'monthly' ? 'Yearly' : 'Monthly'}
                  </Button>
                </div>
                <span className="text-xs text-gray-500">Unlock store management capabilities and premium features</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li className="flex items-start">
                  <Star className="mr-2 h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <span>Create and manage your own store in the marketplace</span>
                </li>
                <li className="flex items-start">
                  <Star className="mr-2 h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <span>Add unlimited products with custom details and images</span>
                </li>
                <li className="flex items-start">
                  <Star className="mr-2 h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <span>Configure payment options and delivery settings</span>
                </li>
                <li className="flex items-start">
                  <Star className="mr-2 h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <span>Customize your store profile and branding</span>
                </li>
                <li className="flex items-start">
                  <Star className="mr-2 h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <span>Choose from 3 professional store templates</span>
                </li>
                <li className="flex items-start">
                  <Star className="mr-2 h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <span>Create special announcements and promotions</span>
                </li>
                <li className="flex items-start">
                  <Star className="mr-2 h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <span>Access detailed store analytics and insights</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full"
                onClick={handleUpgrade}
                disabled={isProcessing || sellerCount >= FREE_SELLER_LIMIT && !isFreeSeller}
              >
                {isProcessing ? (
                  <>Processing Subscription...</>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Subscribe now
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default UpgradeToAdmin;
