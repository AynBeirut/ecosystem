import React, { useEffect, useState } from 'react';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Store } from 'lucide-react';
import { useAuth } from '@/context/useAuth';
import { toast } from '@/components/ui/sonner';

const UpgradeToAdmin: React.FC = () => {
  const { user, upgradeToAdmin } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();
  const db = getFirestore();

  useEffect(() => {
    const checkSellerStatus = async () => {
      if (!user?.id) return;
      const sellerRef = doc(db, 'sellers', user.id);
      const sellerSnap = await getDoc(sellerRef);
      if (sellerSnap.exists() && sellerSnap.data()?.role === 'admin') {
        setIsAdmin(true);
      }
    };

    checkSellerStatus();
  }, [db, user?.id]);

  const handleBecomeSeller = async () => {
    if (!user) return;

    setIsProcessing(true);
    try {
      await upgradeToAdmin();
      toast.success('Seller account activated. Complete your profile and choose your subscription plan.');
      const hasEcosystem =
        import.meta.env.VITE_ECOSYSTEM_MODULAR === 'true' ||
        import.meta.env.VITE_ECOSYSTEM_PACKAGE_DRAFT === 'true';
      navigate(hasEcosystem ? '/onboarding/package' : '/admin/profile', { replace: true });
    } catch (error) {
      console.error('Failed to become seller:', error);
      toast.error('Failed to activate seller account. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isAdmin || user?.role === 'admin') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Seller Account Active</CardTitle>
              <CardDescription>
                Your seller account is already enabled. Manage your profile and subscription from your admin area.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center py-6">
              <CheckCircle2 size={48} className="mx-auto text-green-500 mb-4" />
            </CardContent>
            <CardFooter className="flex gap-3">
              <Button onClick={() => navigate('/admin/profile')} variant="outline" className="w-full">
                Edit Profile
              </Button>
              <Button onClick={() => navigate('/subscription')} className="w-full">
                Manage Plan
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
        <Card className="max-w-xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Become a Seller
            </CardTitle>
            <CardDescription>
              Start by enabling your seller account. After this step, complete your store profile and subscription from your admin profile page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                <span>Step 1: Become a seller</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                <span>Step 2: Edit your store profile</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                <span>Step 3: Choose and manage your subscription plan</span>
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button onClick={handleBecomeSeller} disabled={isProcessing} className="w-full">
              {isProcessing ? 'Activating...' : 'Become a Seller'}
            </Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
};

export default UpgradeToAdmin;
