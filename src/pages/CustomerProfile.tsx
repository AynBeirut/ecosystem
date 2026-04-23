import React, { useEffect, useState } from 'react';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/sonner';
import { User, Phone, MapPin, CreditCard, Loader2 } from 'lucide-react';

const PAYMENT_OPTIONS = [
  { key: 'cashOnDelivery', label: '💵 Cash on Delivery' },
  { key: 'creditCard', label: '💳 Credit Card' },
  { key: 'bankTransfer', label: '🏦 Bank Transfer' },
  { key: 'whatsapp', label: '💬 WhatsApp' },
];

const CustomerProfile: React.FC = () => {
  const { user } = useAuth();
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [preferredPayment, setPreferredPayment] = useState('cashOnDelivery');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    const db = getFirestore();
    getDoc(doc(db, 'users', user.id)).then((snap) => {
      if (snap.exists()) {
        const d = snap.data() as any;
        if (d.phone) setPhone(d.phone);
        if (d.location) setLocation(d.location);
        if (d.preferredPayment) setPreferredPayment(d.preferredPayment);
      }
    }).finally(() => setLoading(false));
  }, [user?.id]);

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const db = getFirestore();
      await setDoc(doc(db, 'users', user.id), {
        phone: phone.trim(),
        location: location.trim(),
        preferredPayment,
        email: user.email,
        displayName: user.name,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      toast.success('Profile updated successfully.');
    } catch {
      toast.error('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">My Profile</h1>

      {/* Account info */}
      <Card className="mb-6">
        <CardContent className="pt-6 flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-7 w-7 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-base">{user?.name || 'User'}</p>
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
        </CardContent>
      </Card>

      {/* Editable details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Delivery Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Phone className="h-4 w-4" /> Phone Number
            </Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 234 567 8900"
              type="tel"
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" /> Delivery Location
            </Label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Street, city, area..."
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <CreditCard className="h-4 w-4" /> Preferred Payment Method
            </Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {PAYMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setPreferredPayment(opt.key)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    preferredPayment === opt.key
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-gray-200 text-gray-600 hover:border-gray-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full mt-2">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerProfile;
