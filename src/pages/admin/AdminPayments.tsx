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
    whishChannel: '',
    whishSecret: '',
    websiteUrl: ''
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
            whishChannel: (data.whishChannel as string) || '',
            whishSecret: (data.whishSecret as string) || '',
            websiteUrl: (data.websiteUrl as string) || ''
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
        toast({ 
          title: '✅ Payment Credentials Saved Successfully!', 
          description: 'Your Whish Money credentials are now active. Customers can now pay through your merchant account.',
          duration: 5000
        });
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

  // Load payment methods and fees from Firestore on mount
  useEffect(() => {
    const fetchPaymentSettings = async () => {
      if (user?.id) {
        const settingsRef = doc(db, 'storeProfiles', user.id);
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          if (data.paymentMethods) {
            setPaymentMethods(data.paymentMethods);
          }
          if (data.paymentFees) {
            setFees(data.paymentFees);
          }
        }
      }
    };
    fetchPaymentSettings();
  }, [user?.id, db]);

  const handleMethodToggle = async (method: string, enabled: boolean) => {
    const updatedMethods = { ...paymentMethods, [method]: enabled };
    setPaymentMethods(updatedMethods);
    
    // Save to Firestore immediately
    if (user?.id) {
      try {
        const settingsRef = doc(db, 'storeProfiles', user.id);
        await setDoc(settingsRef, { paymentMethods: updatedMethods }, { merge: true });
        toast({
          title: enabled ? "Payment Method Enabled" : "Payment Method Disabled",
          description: `${method.charAt(0).toUpperCase() + method.slice(1)} has been ${enabled ? 'enabled' : 'disabled'} for your store.`
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to save payment method setting.",
          variant: "destructive"
        });
        // Revert on error
        setPaymentMethods(paymentMethods);
      }
    }
  };

  const handleSaveFees = async () => {
    if (user?.id) {
      try {
        const settingsRef = doc(db, 'storeProfiles', user.id);
        await setDoc(settingsRef, { paymentFees: fees }, { merge: true });
        toast({
          title: "✅ Fee Settings Saved Successfully!",
          description: "Your payment processing fees have been updated.",
          duration: 4000
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to save fee settings.",
          variant: "destructive"
        });
      }
    }
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
        <BackButton />
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6" />
            Payment Methods
          </h1>
          <p className="text-muted-foreground">Configure which payment methods to accept in your store</p>
        </div>

  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

          {/* Payment Credentials and Processing Fees */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Payment Credentials</CardTitle>
                <CardDescription>
                  Enter your Whish Money credentials to receive payments (only visible to you)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="whishChannel">Whish Money Channel ID</Label>
                  <Input
                    id="whishChannel"
                    name="whishChannel"
                    type="text"
                    value={credentials.whishChannel}
                    onChange={handleCredsChange}
                    placeholder="10198838"
                  />
                  <p className="text-xs text-gray-500 mt-1">Your Whish Money merchant channel ID</p>
                </div>
                <div>
                  <Label htmlFor="whishSecret">Whish Money Secret Key</Label>
                  <Input
                    id="whishSecret"
                    name="whishSecret"
                    type="password"
                    value={credentials.whishSecret}
                    onChange={handleCredsChange}
                    placeholder="Enter your secret key"
                  />
                  <p className="text-xs text-gray-500 mt-1">Keep this secret! Used to process payments</p>
                </div>
                <div>
                  <Label htmlFor="websiteUrl">Store Website URL</Label>
                  <Input
                    id="websiteUrl"
                    name="websiteUrl"
                    type="url"
                    value={credentials.websiteUrl}
                    onChange={handleCredsChange}
                    placeholder="https://grabio.space"
                  />
                  <p className="text-xs text-gray-500 mt-1">Your store's public URL for payment redirects</p>
                </div>
                <Button onClick={handleSaveCreds} className="w-full" disabled={isSavingCreds}>
                  {isSavingCreds ? 'Saving...' : 'Save Payment Credentials'}
                </Button>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Processing Fees</CardTitle>
                <CardDescription>
                  Configure processing fees for different payment methods (Optional - for display purposes only)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Whish Money charges their own fees directly. These settings are for your reference/display only and don't affect actual charges.
                  </p>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="creditCardFee">Credit Card Fee (%)</Label>
                    <Input
                      id="creditCardFee"
                      type="number"
                      step="0.1"
                      value={fees.creditCardFee === 0 || fees.creditCardFee === '' ? '' : fees.creditCardFee}
                      onChange={(e) => setFees({ ...fees, creditCardFee: e.target.value === '' ? 0 : e.target.value })}
                      placeholder="2.9"
                    />
                    <p className="text-xs text-gray-500 mt-1">Typical: 2.9% (Visa, Mastercard, Amex)</p>
                  </div>
                  
                  <div>
                    <Label htmlFor="debitCardFee">Debit Card Fee (%)</Label>
                    <Input
                      id="debitCardFee"
                      type="number"
                      step="0.1"
                      value={fees.debitCardFee === 0 || fees.debitCardFee === '' ? '' : fees.debitCardFee}
                      onChange={(e) => setFees({ ...fees, debitCardFee: e.target.value === '' ? 0 : e.target.value })}
                      placeholder="1.5"
                    />
                    <p className="text-xs text-gray-500 mt-1">Typical: 1.5% (Usually lower than credit cards)</p>
                  </div>
                  
                  <div>
                    <Label htmlFor="paypalFee">PayPal Fee (%)</Label>
                    <Input
                      id="paypalFee"
                      type="number"
                      step="0.1"
                      value={fees.paypalFee === 0 || fees.paypalFee === '' ? '' : fees.paypalFee}
                      onChange={(e) => setFees({ ...fees, paypalFee: e.target.value === '' ? 0 : e.target.value })}
                      placeholder="3.5"
                    />
                    <p className="text-xs text-gray-500 mt-1">Typical: 3.5% (If you enable PayPal in the future)</p>
                  </div>
                  
                  <div>
                    <Label htmlFor="processingFee">Fixed Processing Fee ($)</Label>
                    <Input
                      id="processingFee"
                      type="number"
                      step="0.01"
                      value={fees.processingFee === 0 || fees.processingFee === '' ? '' : fees.processingFee}
                      onChange={(e) => setFees({ ...fees, processingFee: e.target.value === '' ? 0 : e.target.value })}
                      placeholder="0.30"
                    />
                    <p className="text-xs text-gray-500 mt-1">Typical: $0.30 per transaction (flat fee added to percentage)</p>
                  </div>
                </div>
                
                <Button onClick={handleSaveFees} className="w-full">
                  Save Fee Settings
                </Button>
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