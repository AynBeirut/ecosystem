import React, { useCallback, useEffect, useState } from 'react';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/sonner';
import { canRetryNotification, normalizeNotificationStatus } from '@/lib/orderNotificationUtils';

type OrderNotificationLog = {
  id: string;
  storeId: string;
  orderId: string;
  channel: 'email' | 'whatsapp';
  recipient?: string;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  provider?: string;
  reason?: string;
  attempts?: number;
  createdAt?: any;
  lastAttemptAt?: any;
};

const API_URL = import.meta.env.VITE_API_URL || 'https://us-central1-market-flow-7b074.cloudfunctions.net/api';

const AdminOrderNotifications: React.FC = () => {
  const { user } = useAuth();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [logs, setLogs] = useState<OrderNotificationLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  useEffect(() => {
    if (user) setStoreId(getActualStoreId(user));
  }, [user]);

  const loadLogs = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const db = getFirestore();
      const q = query(
        collection(db, 'orderNotifications'),
        where('storeId', '==', storeId)
      );
      const snap = await getDocs(q);
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as OrderNotificationLog));
      rows.sort((a, b) => {
        const ta = Number(new Date(String(a.createdAt || 0)).getTime() || 0);
        const tb = Number(new Date(String(b.createdAt || 0)).getTime() || 0);
        return tb - ta;
      });
      setLogs(rows.slice(0, 150));
    } catch (err) {
      console.error('Failed to load notification logs', err);
      toast.error('Failed to load notification logs');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const retryNotification = async (notificationId: string) => {
    setRetryingId(notificationId);
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Not authenticated');
      const token = await currentUser.getIdToken();

      const res = await fetch(`${API_URL}/notifications/order/retry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ notificationId }),
      });

      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Retry failed');
      }

      toast.success('Notification retried');
      loadLogs();
    } catch (err) {
      console.error('Retry failed', err);
      toast.error('Retry failed');
    } finally {
      setRetryingId(null);
    }
  };

  const statusVariant = (status: string) => {
    if (status === 'sent') return 'default';
    if (status === 'failed') return 'destructive';
    return 'secondary';
  };

  return (
    <AdminPageShell
      title="Order Notification Logs"
      description="Email and WhatsApp delivery status with retry support."
      eyebrow="Operations"
      backTo="/admin/dashboard"
    >
        <AdminPanel>
          <CardHeader>
            <CardTitle>Order Notification Logs</CardTitle>
            <CardDescription>Email and WhatsApp delivery status with retry support.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-gray-500">Loading logs...</div>
            ) : logs.length === 0 ? (
              <div className="text-sm text-gray-500">No notification logs yet.</div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div key={log.id} className="rounded-lg border border-gray-200 p-4 bg-white">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <div className="font-semibold text-gray-900">Order #{String(log.orderId || '').slice(-8)}</div>
                        <div className="text-sm text-gray-600">Channel: {log.channel} {log.recipient ? `• ${log.recipient}` : ''}</div>
                        <div className="text-xs text-gray-500">Provider: {log.provider || 'none'} • Attempts: {log.attempts || 0}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusVariant(log.status) as any}>{log.status}</Badge>
                        {canRetryNotification(normalizeNotificationStatus(log.status)) && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={retryingId === log.id}
                            onClick={() => retryNotification(log.id)}
                          >
                            Retry
                          </Button>
                        )}
                      </div>
                    </div>
                    {log.reason && (
                      <div className="mt-3 text-sm text-gray-700 border-t pt-3">{log.reason}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </AdminPanel>
    </AdminPageShell>
  );
};

export default AdminOrderNotifications;
