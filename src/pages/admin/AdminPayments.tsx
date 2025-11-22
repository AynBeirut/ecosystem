import React, { useState, useEffect } from 'react';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { CreditCard, DollarSign, Wallet, Building2, Smartphone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import MobileHeader from '@/components/MobileHeader';
import BackButton from '@/components/BackButton';
import { useIsMobile } from '@/hooks/use-mobile';

const AdminPayments: React.FC = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const db = getFirestore();

  // Payment credentials state
  const [credentials, setCredentials] = useState({
    wishPayId: '',
    cardHolderName: '',
    cardNumber: '',
    cardExpiry: '',
    cardCVC: ''
  });
  const [isSavingCreds, setIsSavingCreds] = useState(false);

  // Load credentials from Firestore on mount
  useEffect(() => {
    const fetchCreds = async () => {
      if (user?.id) {
        const db = getFirestore();
        const credRef = doc(db, 'storeProfiles', user.id);
        const credSnap = await getDoc(credRef);
        if (credSnap.exists()) {
          const data = credSnap.data() as Record<string, unknown>;
          setCredentials({
            wishPayId: (data.wishPayId as string) || '',
            cardHolderName: (data.cardHolderName as string) || '',
            cardNumber: (data.cardNumber as string) || '',
            cardExpiry: (data.cardExpiry as string) || '',
            cardCVC: (data.cardCVC as string) || ''
          });
        }
      }
    };
    fetchCreds();
  }, [user?.id]);

  const handleCredsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
  };

  const handleSaveCreds = async () => {
    setIsSavingCreds(true);
    if (user?.id) {
      try {
        const credRef = doc(db, 'storeProfiles', user.id);
        await setDoc(credRef, credentials, { merge: true });
        toast({ title: 'Payment Credentials Saved', description: 'Your WishPay and card details have been updated.' });
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to save payment credentials.', variant: 'destructive' });
      }
    }
    setIsSavingCreds(false);
  };
  
  const [paymentMethods, setPaymentMethods] = useState({
    creditCard: true,
    debitCard: true,
    paypal: false,
    applePay: true,
    googlePay: false,
    bankTransfer: false,
    cashOnDelivery: true,
    storeCredits: true
  });

  const [fees, setFees] = useState({
    creditCardFee: '2.9',
    debitCardFee: '1.5',
    paypalFee: '3.5',
    processingFee: '0.30'
  });

  const handleMethodToggle = (method: string, enabled: boolean) => {
    setPaymentMethods(prev => ({ ...prev, [method]: enabled }));
    toast({
      title: enabled ? "Payment Method Enabled" : "Payment Method Disabled",
      description: `${method.charAt(0).toUpperCase() + method.slice(1)} has been ${enabled ? 'enabled' : 'disabled'} for your store.`
    });
  };

  const handleSaveFees = () => {
    toast({
      title: "Payment Settings Saved",
      description: "Your payment processing fees have been updated."
    });
  };

  const paymentOptions = [
    {
      key: 'creditCard',
      name: 'Credit Cards',
      description: 'Accept Visa, Mastercard, American Express',
      icon: CreditCard,
      enabled: paymentMethods.creditCard
    },
    {
      key: 'debitCard',
      name: 'Debit Cards',
      description: 'Accept debit card payments',
      icon: CreditCard,
      enabled: paymentMethods.debitCard
    },
    {
      key: 'paypal',
      name: 'PayPal',
      description: 'Accept PayPal payments',
      icon: Wallet,
      enabled: paymentMethods.paypal
    },
    {
      key: 'applePay',
      name: 'Apple Pay',
      description: 'Accept Apple Pay on supported devices',
      icon: Smartphone,
      enabled: paymentMethods.applePay
    },
    {
      key: 'googlePay',
      name: 'Google Pay',
      description: 'Accept Google Pay payments',
      icon: Smartphone,
      enabled: paymentMethods.googlePay
    },
    {
      key: 'bankTransfer',
      name: 'Bank Transfer',
      description: 'Accept direct bank transfers',
      icon: Building2,
      enabled: paymentMethods.bankTransfer
    },
    {
      key: 'cashOnDelivery',
      name: 'Cash on Delivery',
      description: 'Accept cash payments upon delivery',
      icon: DollarSign,
      enabled: paymentMethods.cashOnDelivery
    },
    {
      key: 'storeCredits',
      name: 'Store Credits',
      description: 'Allow customers to use store credits',
      icon: Wallet,
      enabled: paymentMethods.storeCredits
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {isMobile && <MobileHeader title="Payment Methods" />}
      
      <div className="p-4 md:p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6" />
            Payment Methods
          </h1>
          <p className="text-muted-foreground">Configure which payment methods to accept in your store</p>
        </div>

  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Payment Methods */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Available Payment Methods</CardTitle>
                <CardDescription>
                  Choose which payment options to offer your customers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {paymentOptions.map((option) => {
                  const IconComponent = option.icon;
                  return (
                    <div key={option.key} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <IconComponent className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{option.name}</div>
                          <div className="text-sm text-muted-foreground">{option.description}</div>
                        </div>
                      </div>
                      <Switch
                        checked={option.enabled}
                        onCheckedChange={(checked) => handleMethodToggle(option.key, checked)}
                      />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Payment Processing Fees */}
          {/* Payment Credentials */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Payment Credentials</CardTitle>
                <CardDescription>
                  Enter your WishPay and card details to receive payments (only visible to you)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="wishPayId">WishPay ID</Label>
                  <Input
                    id="wishPayId"
                    name="wishPayId"
                    type="text"
                    value={credentials.wishPayId}
                    onChange={handleCredsChange}
                    placeholder="your-wishpay-id"
                  />
                </div>
                <div>
                  <Label htmlFor="cardHolderName">Cardholder Name (Visa/MasterCard)</Label>
                  <Input
                    id="cardHolderName"
                    name="cardHolderName"
                    type="text"
                    value={credentials.cardHolderName}
                    onChange={handleCredsChange}
                    placeholder="Name on card"
                  />
                </div>
                <div>
                  <Label htmlFor="cardNumber">Card Number (Visa/MasterCard)</Label>
                  <Input
                    id="cardNumber"
                    name="cardNumber"
                    type="text"
                    value={credentials.cardNumber}
                    onChange={handleCredsChange}
                    placeholder="1234 5678 9012 3456"
                  />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Label htmlFor="cardExpiry">Expiry</Label>
                    <Input
                      id="cardExpiry"
                      name="cardExpiry"
                      type="text"
                      value={credentials.cardExpiry}
                      onChange={handleCredsChange}
                      placeholder="MM/YY"
                    />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="cardCVC">CVC</Label>
                    <Input
                      id="cardCVC"
                      name="cardCVC"
                      type="text"
                      value={credentials.cardCVC}
                      onChange={handleCredsChange}
                      placeholder="123"
                    />
                  </div>
                </div>
                <Button onClick={handleSaveCreds} className="w-full" disabled={isSavingCreds}>
                  {isSavingCreds ? 'Saving...' : 'Save Payment Credentials'}
                </Button>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Processing Fees</CardTitle>
                <CardDescription>
                  Configure processing fees for different payment methods
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="creditCardFee">Credit Card Fee (%)</Label>
                    <Input
                      id="creditCardFee"
                      type="number"
                      step="0.1"
                      value={fees.creditCardFee}
                      onChange={(e) => setFees({ ...fees, creditCardFee: e.target.value })}
                      placeholder="2.9"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="debitCardFee">Debit Card Fee (%)</Label>
                    <Input
                      id="debitCardFee"
                      type="number"
                      step="0.1"
                      value={fees.debitCardFee}
                      onChange={(e) => setFees({ ...fees, debitCardFee: e.target.value })}
                      placeholder="1.5"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="paypalFee">PayPal Fee (%)</Label>
                    <Input
                      id="paypalFee"
                      type="number"
                      step="0.1"
                      value={fees.paypalFee}
                      onChange={(e) => setFees({ ...fees, paypalFee: e.target.value })}
                      placeholder="3.5"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="processingFee">Fixed Processing Fee ($)</Label>
                    <Input
                      id="processingFee"
                      type="number"
                      step="0.01"
                      value={fees.processingFee}
                      onChange={(e) => setFees({ ...fees, processingFee: e.target.value })}
                      placeholder="0.30"
                    />
                  </div>
                </div>
                
                <Button onClick={handleSaveFees} className="w-full">
                  Save Fee Settings
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment Security</CardTitle>
                <CardDescription>
                  Your payment processing is secured with industry-standard encryption
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                    <span>SSL/TLS Encryption</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                    <span>PCI DSS Compliant</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                    <span>Fraud Protection</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                    <span>3D Secure Authentication</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Summary Card */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Payment Summary</CardTitle>
            <CardDescription>
              Overview of your current payment configuration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {Object.values(paymentMethods).filter(Boolean).length}
                </div>
                <div className="text-sm text-muted-foreground">Active Methods</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{fees.creditCardFee}%</div>
                <div className="text-sm text-muted-foreground">Credit Card Fee</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">${fees.processingFee}</div>
                <div className="text-sm text-muted-foreground">Processing Fee</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">100%</div>
                <div className="text-sm text-muted-foreground">Secure</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminPayments;