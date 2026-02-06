
import React, { useState, useEffect } from 'react';
import { getFirestore, doc, getDoc, collection, getCountFromServer } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, CreditCard } from 'lucide-react';
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
  const [plan, setPlan] = useState<'monthly' | 'yearly'>('monthly');
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
      }
      setMonthsFreeLeft(freeLeft);
      setIsFreeSeller(isFree);
    };
    fetchSellerStatus();
  }, [user, navigate]);

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
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold mb-2 text-center">Upgrade Your Account</h1>
          <p className="text-center text-gray-600 mb-8">Choose the plan that fits your business needs</p>
          
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
                  onClick={handleUpgrade}
                  variant="outline"
                  disabled={isProcessing}
                >
                  Get Premium
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
                    <span className="text-3xl font-bold">${plan === 'monthly' ? '20' : '220'}</span>
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
                  onClick={handleUpgrade}
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
            <div className="grid md:grid-cols-1 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Extra Storage (10GB)</CardTitle>
                  <CardDescription>
                    <span className="text-2xl font-bold">${plan === 'monthly' ? '5' : '50'}</span>
                    <span className="text-gray-500">/{plan === 'monthly' ? 'month' : 'year'}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">Additional storage for images and documents</p>
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
