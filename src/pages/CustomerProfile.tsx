import React, { useEffect, useState } from 'react';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { useAuth } from '@/context/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/sonner';
import { User, Phone, MapPin, CreditCard, Loader2, ShieldCheck } from 'lucide-react';

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
  const [isExportingGdpr, setIsExportingGdpr] = useState(false);
  const [isRequestingDelete, setIsRequestingDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const API_URL = import.meta.env.VITE_API_URL || 'https://us-central1-market-flow-7b074.cloudfunctions.net/api';

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

  const handleGdprExport = async () => {
    if (!user?.id) return;
    setIsExportingGdpr(true);
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Please sign in again.');

      const token = await currentUser.getIdToken();
      const response = await fetch(`${API_URL}/gdpr/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ storeId: user.id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'GDPR export failed');

      const blob = new Blob([JSON.stringify(payload.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `gdpr-customer-export-${user.id}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      toast.success('GDPR export generated and downloaded.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to export your data';
      toast.error(msg);
    } finally {
      setIsExportingGdpr(false);
    }
  };

  const handleDeleteRequest = async () => {
    if (!user?.id) return;
    if (deleteConfirm.trim().toUpperCase() !== 'DELETE') {
      toast.error('Type DELETE to confirm your request.');
      return;
    }

    setIsRequestingDelete(true);
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Please sign in again.');

      const token = await currentUser.getIdToken();
      const response = await fetch(`${API_URL}/gdpr/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ storeId: user.id, confirmDelete: true }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Deletion request failed');

      setDeleteConfirm('');
      toast.success('Deletion request submitted. Our team will process it according to GDPR policy.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to submit deletion request';
      toast.error(msg);
    } finally {
      setIsRequestingDelete(false);
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

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Privacy & GDPR
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-medium">Export My Data</p>
            <p className="text-xs text-gray-500">
              Download your personal account and order-related data in JSON format.
            </p>
            <Button type="button" variant="outline" size="sm" disabled={isExportingGdpr} onClick={handleGdprExport}>
              {isExportingGdpr ? 'Exporting…' : 'Download GDPR Export'}
            </Button>
          </div>

          <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
            <p className="text-sm font-medium text-red-800">Request Account Deletion</p>
            <p className="text-xs text-red-700">
              Submit a right-to-be-forgotten request. Type DELETE to confirm.
            </p>
            <div className="space-y-2">
              <Label htmlFor="customer-delete-confirm">Type DELETE to confirm</Label>
              <Input
                id="customer-delete-confirm"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="DELETE"
              />
            </div>
            <Button type="button" variant="destructive" size="sm" disabled={isRequestingDelete} onClick={handleDeleteRequest}>
              {isRequestingDelete ? 'Submitting…' : 'Submit Deletion Request'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerProfile;
