import React, { useState, useEffect } from 'react';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { useAuth } from '@/context/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CreditCard, DollarSign, Wallet, Building2, Smartphone, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminStatCard from '@/components/admin/AdminStatCard';
import AdminPanel from '@/components/admin/AdminPanel';

const AdminPayments: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const db = getFirestore();

  // Payment credentials state
  const [credentials, setCredentials] = useState({
    whishChannel: '',
    whishSecret: '',
    websiteUrl: '',
    whishSuccessCallbackUrl: '',
    whishFailureCallbackUrl: '',
  });
  const [isSavingCreds, setIsSavingCreds] = useState(false);
  const [isSavingGateways, setIsSavingGateways] = useState(false);
  const [isRunningWhishChecklist, setIsRunningWhishChecklist] = useState(false);
  const [whishChecklist, setWhishChecklist] = useState<Array<{ id: string; label: string; status: 'pass' | 'warn' | 'fail'; detail: string; action?: string }>>([]);
  const [whishChecklistScore, setWhishChecklistScore] = useState<{ value: number; max: number; percentage: number } | null>(null);
  const [whishChecklistStatus, setWhishChecklistStatus] = useState<'pass' | 'warn' | 'fail' | null>(null);

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
            websiteUrl: (data.websiteUrl as string) || '',
            whishSuccessCallbackUrl: (data.whishSuccessCallbackUrl as string) || '',
            whishFailureCallbackUrl: (data.whishFailureCallbackUrl as string) || '',
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

  const [gatewaySettings, setGatewaySettings] = useState({
    whishEnabled: true,
    stripeEnabled: true,
    paypalEnabled: false,
    bankTransferEnabled: false,
    cashOnDeliveryEnabled: true,
    preferredGateway: 'whish' as 'whish' | 'stripe' | 'paypal' | 'manual',
    stripePublishableKey: '',
    paypalClientId: '',
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
          if (data.paymentGatewaySettings) {
            setGatewaySettings((prev) => ({
              ...prev,
              ...data.paymentGatewaySettings,
            }));
          }
        }
      }
    };
    fetchPaymentSettings();
  }, [user?.id, db]);

  const handleMethodToggle = async (method: string, enabled: boolean) => {
    const updatedMethods = { ...paymentMethods, [method]: enabled };
    setPaymentMethods(updatedMethods);
    if (method === 'paypal') {
      setGatewaySettings((prev) => ({ ...prev, paypalEnabled: enabled }));
    }
    if (method === 'bankTransfer') {
      setGatewaySettings((prev) => ({ ...prev, bankTransferEnabled: enabled }));
    }
    if (method === 'cashOnDelivery') {
      setGatewaySettings((prev) => ({ ...prev, cashOnDeliveryEnabled: enabled }));
    }
    
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

  const handleSaveGatewaySettings = async () => {
    if (!user?.id) return;
    setIsSavingGateways(true);
    try {
      const settingsRef = doc(db, 'storeProfiles', user.id);
      await setDoc(settingsRef, { paymentGatewaySettings: gatewaySettings }, { merge: true });
      toast({
        title: 'Gateway settings saved',
        description: 'Payment gateway controls and credentials were updated successfully.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save gateway settings.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingGateways(false);
    }
  };

  const handleRunWhishOpsChecklist = async () => {
    if (!user?.id) return;

    setIsRunningWhishChecklist(true);
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      const idToken = currentUser ? await currentUser.getIdToken() : null;
      if (!idToken) {
        toast({ title: 'Authentication required', description: 'Please sign in again to run the checklist.', variant: 'destructive' });
        return;
      }

      const API_BASE = (import.meta.env as { VITE_API_BASE?: string }).VITE_API_BASE ?? '/api';
      const response = await fetch(`${API_BASE.replace(/\/$/, '')}/payment/whish/ops-checklist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ storeId: user.id }),
      });

      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        toast({
          title: 'Checklist failed',
          description: payload?.message || 'Unable to run Whish production checklist.',
          variant: 'destructive',
        });
        return;
      }

      setWhishChecklist(Array.isArray(payload.checklist) ? payload.checklist : []);
      setWhishChecklistScore(payload.score || null);
      setWhishChecklistStatus(payload.overallStatus || null);

      toast({
        title: 'Whish checklist completed',
        description: `Readiness score: ${payload?.score?.percentage ?? 0}%`,
      });
    } catch (error) {
      toast({
        title: 'Checklist error',
        description: 'Failed to run Whish production checklist.',
        variant: 'destructive',
      });
    } finally {
      setIsRunningWhishChecklist(false);
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

  const enabledMethodsCount = Object.values(paymentMethods).filter(Boolean).length;
  const activeGatewaysCount = [
    gatewaySettings.whishEnabled,
    gatewaySettings.stripeEnabled,
    gatewaySettings.paypalEnabled,
    gatewaySettings.bankTransferEnabled,
    gatewaySettings.cashOnDeliveryEnabled,
  ].filter(Boolean).length;
  const whishConfigured = Boolean(credentials.whishChannel.trim() && credentials.whishSecret.trim());

  return (
    <AdminPageShell
      title="Payment Methods"
      description="Configure which payment methods to accept in your store"
      eyebrow="Profile & Store Setup"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <AdminStatCard title="Methods Enabled" value={enabledMethodsCount} icon={CreditCard} gradient="from-slate-600 to-slate-800" subtitle="Customer checkout options" />
        <AdminStatCard title="Active Gateways" value={activeGatewaysCount} icon={Zap} gradient="from-teal-500 to-teal-700" subtitle="Whish, Stripe, PayPal, etc." />
        <AdminStatCard title="Whish Money" value={whishConfigured ? 'Ready' : 'Setup'} icon={Smartphone} gradient={whishConfigured ? 'from-emerald-500 to-teal-700' : 'from-amber-400 to-yellow-600'} subtitle={whishConfigured ? 'Credentials saved' : 'Add channel & secret'} />
        <AdminStatCard title="Cash on Delivery" value={paymentMethods.cashOnDelivery ? 'On' : 'Off'} icon={DollarSign} gradient={paymentMethods.cashOnDelivery ? 'from-sky-500 to-blue-700' : 'from-slate-400 to-slate-600'} subtitle="In-store / delivery cash" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Payment Methods */}
          <div className="space-y-4">
            <AdminPanel>
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
            </AdminPanel>
            
            <AdminPanel>
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
            </AdminPanel>
          </div>

          {/* Payment Credentials and Processing Fees */}
          <div className="space-y-4">
            <AdminPanel>
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
                <div>
                  <Label htmlFor="whishSuccessCallbackUrl">Whish Success Callback URL (optional override)</Label>
                  <Input
                    id="whishSuccessCallbackUrl"
                    name="whishSuccessCallbackUrl"
                    type="url"
                    value={credentials.whishSuccessCallbackUrl}
                    onChange={handleCredsChange}
                    placeholder="https://api.yourdomain.com/payment/callback"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave empty to use the default API callback endpoint.</p>
                </div>
                <div>
                  <Label htmlFor="whishFailureCallbackUrl">Whish Failure Callback URL (optional override)</Label>
                  <Input
                    id="whishFailureCallbackUrl"
                    name="whishFailureCallbackUrl"
                    type="url"
                    value={credentials.whishFailureCallbackUrl}
                    onChange={handleCredsChange}
                    placeholder="https://api.yourdomain.com/payment/callback?status=failed"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave empty to auto-generate from the default callback endpoint.</p>
                </div>
                <Button onClick={handleSaveCreds} className="w-full" disabled={isSavingCreds}>
                  {isSavingCreds ? 'Saving...' : 'Save Payment Credentials'}
                </Button>
              </CardContent>
            </AdminPanel>

            <AdminPanel>
              <CardHeader>
                <CardTitle>Gateway Control Center</CardTitle>
                <CardDescription>
                  Critical payment gateway controls for checkout and subscription renewals.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center justify-between p-3 border rounded-md">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Whish</p>
                      <Badge variant={gatewaySettings.whishEnabled ? 'default' : 'outline'}>
                        {gatewaySettings.whishEnabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <Switch
                      checked={gatewaySettings.whishEnabled}
                      onCheckedChange={(checked) => setGatewaySettings((prev) => ({ ...prev, whishEnabled: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-md">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Stripe</p>
                      <Badge variant={gatewaySettings.stripeEnabled ? 'default' : 'outline'}>
                        {gatewaySettings.stripeEnabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <Switch
                      checked={gatewaySettings.stripeEnabled}
                      onCheckedChange={(checked) => setGatewaySettings((prev) => ({ ...prev, stripeEnabled: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-md">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">PayPal</p>
                      <Badge variant={gatewaySettings.paypalEnabled ? 'default' : 'outline'}>
                        {gatewaySettings.paypalEnabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <Switch
                      checked={gatewaySettings.paypalEnabled}
                      onCheckedChange={(checked) => setGatewaySettings((prev) => ({ ...prev, paypalEnabled: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-md">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Bank Transfer</p>
                      <Badge variant={gatewaySettings.bankTransferEnabled ? 'default' : 'outline'}>
                        {gatewaySettings.bankTransferEnabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <Switch
                      checked={gatewaySettings.bankTransferEnabled}
                      onCheckedChange={(checked) => setGatewaySettings((prev) => ({ ...prev, bankTransferEnabled: checked }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="preferredGateway">Preferred Gateway</Label>
                    <select
                      id="preferredGateway"
                      value={gatewaySettings.preferredGateway}
                      onChange={(e) => setGatewaySettings((prev) => ({
                        ...prev,
                        preferredGateway: e.target.value as 'whish' | 'stripe' | 'paypal' | 'manual',
                      }))}
                      className="w-full p-2 border rounded-md"
                    >
                      <option value="whish">Whish</option>
                      <option value="stripe">Stripe</option>
                      <option value="paypal">PayPal</option>
                      <option value="manual">Manual Selection</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="stripePublishableKey">Stripe Publishable Key</Label>
                    <Input
                      id="stripePublishableKey"
                      value={gatewaySettings.stripePublishableKey}
                      onChange={(e) => setGatewaySettings((prev) => ({ ...prev, stripePublishableKey: e.target.value }))}
                      placeholder="pk_live_..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="paypalClientId">PayPal Client ID</Label>
                    <Input
                      id="paypalClientId"
                      value={gatewaySettings.paypalClientId}
                      onChange={(e) => setGatewaySettings((prev) => ({ ...prev, paypalClientId: e.target.value }))}
                      placeholder="PayPal app client id"
                    />
                  </div>
                </div>

                <Button onClick={handleSaveGatewaySettings} className="w-full" disabled={isSavingGateways}>
                  {isSavingGateways ? 'Saving...' : 'Save Gateway Controls'}
                </Button>
              </CardContent>
            </AdminPanel>

            <AdminPanel>
              <CardHeader>
                <CardTitle>Whish Production Ops Checklist</CardTitle>
                <CardDescription>
                  Validate production readiness for Whish cutover, callback flow, and order finalization.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={handleRunWhishOpsChecklist} className="w-full" disabled={isRunningWhishChecklist}>
                  {isRunningWhishChecklist ? 'Running checklist...' : 'Run Whish Ops Checklist'}
                </Button>

                {whishChecklistScore && (
                  <div className="p-3 border rounded-md bg-muted/30">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Readiness Score</span>
                      <Badge variant={whishChecklistStatus === 'pass' ? 'default' : 'outline'}>
                        {whishChecklistStatus ? whishChecklistStatus.toUpperCase() : 'UNKNOWN'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {whishChecklistScore.value}/{whishChecklistScore.max} ({whishChecklistScore.percentage}%)
                    </p>
                  </div>
                )}

                {whishChecklist.length > 0 && (
                  <div className="space-y-2">
                    {whishChecklist.map((item) => (
                      <div key={item.id} className="p-3 border rounded-md">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">{item.label}</p>
                          <Badge variant={item.status === 'pass' ? 'default' : 'outline'}>
                            {item.status.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{item.detail}</p>
                        {item.action && <p className="text-xs text-amber-600 mt-1">Action: {item.action}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </AdminPanel>
            
            <AdminPanel>
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
            </AdminPanel>
          </div>
        </div>
    </AdminPageShell>
  );
};

export default AdminPayments;