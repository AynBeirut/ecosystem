import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { Bell, CheckCircle2, Clock, ExternalLink, Users } from 'lucide-react';
import { useAuth } from '@/context/useAuth';
import { db } from '@/lib/firebase';
import { Order, OrderItem } from '@/types/order';
import { formatMoney } from '@/lib/money/format';
import { getFulfillmentLabel } from '@/lib/fulfillmentOptions';
import {
  formatScheduledForDisplay,
  getMinutesUntilScheduled,
  shouldSendScheduledReminder1h,
  shouldSendScheduledReminder30m,
} from '@/lib/scheduledOrders';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { logAction } from '@/lib/auditLog';

type ScheduledOrder = Order & {
  id: string;
  scheduledFor?: string;
  guestCount?: number;
  scheduledReminder1hSentAt?: string;
  scheduledReminder30mSentAt?: string;
};

function parseCreatedAt(value: ScheduledOrder['createdAt']): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Date.parse(value) || 0;
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return Number((value as { seconds: number }).seconds) * 1000;
  }
  return 0;
}

function countdownLabel(minutes: number | null): string {
  if (minutes === null) return '—';
  if (minutes <= 0) return 'Due now';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

const AdminScheduledOrders: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<ScheduledOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [tab, setTab] = useState<'pending' | 'scheduled' | 'all'>('all');
  const remindedRef = useRef<Set<string>>(new Set());

  const loadOrders = useCallback(async () => {
    if (!user?.storeId) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const q = query(
        collection(db, 'orders'),
        where('storeId', '==', user.storeId),
        where('status', 'in', ['pending', 'confirmed', 'processing', 'ready']),
      );
      const snap = await getDocs(q);
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as ScheduledOrder))
        .filter((o) => o.status === 'pending' || !!o.scheduledFor)
        .sort((a, b) => {
          const aSched = getMinutesUntilScheduled(a.scheduledFor || null);
          const bSched = getMinutesUntilScheduled(b.scheduledFor || null);
          if (aSched !== null && bSched !== null) return aSched - bSched;
          if (aSched !== null) return -1;
          if (bSched !== null) return 1;
          return parseCreatedAt(b.createdAt) - parseCreatedAt(a.createdAt);
        });
      setOrders(rows);
    } catch (err) {
      console.error('Failed to load scheduled orders', err);
      toast({ title: 'Error', description: 'Could not load orders.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast, user?.storeId]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      for (const order of orders) {
        if (!order.scheduledFor) continue;
        const key1h = `${order.id}:1h`;
        const key30m = `${order.id}:30m`;
        const ref = order.invoiceNumber || order.id.slice(-6).toUpperCase();

        if (shouldSendScheduledReminder1h(order, now) && !remindedRef.current.has(key1h)) {
          remindedRef.current.add(key1h);
          toast({
            title: '⏰ Order in 1 hour',
            description: `${ref} · ${order.customerName || 'Customer'}`,
          });
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification('Order in 1 hour', {
              body: `${ref} · ${formatScheduledForDisplay(order.scheduledFor)}`,
            });
          }
        }

        if (shouldSendScheduledReminder30m(order, now) && !remindedRef.current.has(key30m)) {
          remindedRef.current.add(key30m);
          toast({
            title: '🔔 Order in 30 minutes',
            description: `${ref} · ${order.customerName || 'Customer'}`,
          });
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification('Order in 30 minutes', {
              body: `${ref} · ${formatScheduledForDisplay(order.scheduledFor)}`,
            });
          }
        }
      }
    };

    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [orders, toast]);

  const filtered = useMemo(() => {
    if (tab === 'pending') return orders.filter((o) => o.status === 'pending');
    if (tab === 'scheduled') return orders.filter((o) => !!o.scheduledFor);
    return orders;
  }, [orders, tab]);

  const handleAcceptOrder = async (order: ScheduledOrder) => {
    if (!user?.storeId || !user.uid) return;
    setAcceptingId(order.id);
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        status: 'confirmed',
        confirmedAt: new Date().toISOString(),
        confirmedBy: user.uid,
        updatedAt: new Date().toISOString(),
      });
      await logAction(
        user.uid,
        user.name,
        user.role,
        'approve',
        'order',
        order.id,
        { newValue: { status: 'confirmed', scheduledFor: order.scheduledFor } },
        user.storeId,
      );
      toast({
        title: 'Order accepted',
        description: `${order.invoiceNumber || order.id} marked as confirmed.`,
      });
      await loadOrders();
    } catch (err) {
      console.error('Accept order failed', err);
      toast({ title: 'Error', description: 'Could not accept order.', variant: 'destructive' });
    } finally {
      setAcceptingId(null);
    }
  };

  const pendingCount = orders.filter((o) => o.status === 'pending').length;
  const scheduledCount = orders.filter((o) => !!o.scheduledFor).length;

  return (
    <AdminPageShell
      title="Pending & Scheduled Orders"
      description="Accept new orders, track scheduled dine-in / pickup times, and get reminders 1 hour and 30 minutes before."
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant={tab === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setTab('all')}>
          All ({orders.length})
        </Button>
        <Button variant={tab === 'pending' ? 'default' : 'outline'} size="sm" onClick={() => setTab('pending')}>
          Pending ({pendingCount})
        </Button>
        <Button variant={tab === 'scheduled' ? 'default' : 'outline'} size="sm" onClick={() => setTab('scheduled')}>
          Scheduled ({scheduledCount})
        </Button>
        <Button variant="outline" size="sm" onClick={loadOrders} disabled={loading}>
          Refresh
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground animate-pulse">Loading orders…</p>
      ) : filtered.length === 0 ? (
        <AdminPanel>
          <p className="p-4 text-sm text-muted-foreground">No pending or scheduled orders right now.</p>
        </AdminPanel>
      ) : (
        <div className="space-y-4">
          {filtered.map((order) => {
            const mins = getMinutesUntilScheduled(order.scheduledFor || null);
            const itemSummary = (order.items || [])
              .map((item) => {
                const label = item.productName || (item as OrderItem & { name?: string }).name || item.productId;
                return `${item.quantity}x ${label}`;
              })
              .join(', ');
            return (
              <AdminPanel key={order.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {order.invoiceNumber || order.id.slice(-8).toUpperCase()}
                  </CardTitle>
                  <CardDescription>
                    {order.customerName || 'Guest'} · {formatMoney(order.total || 0, { currency: order.currency || 'USD' })}
                  </CardDescription>
                </CardHeader>
                <div className="space-y-3 px-6 pb-6 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-yellow-100 text-yellow-800 capitalize">{order.status || 'pending'}</Badge>
                    {order.scheduledFor && (
                      <Badge variant="outline" className="gap-1">
                        <Clock size={12} />
                        {formatScheduledForDisplay(order.scheduledFor)}
                      </Badge>
                    )}
                    {order.scheduledFor && (
                      <Badge variant="secondary">{countdownLabel(mins)}</Badge>
                    )}
                    {order.guestCount ? (
                      <Badge variant="outline" className="gap-1">
                        <Users size={12} />
                        {order.guestCount} guests
                      </Badge>
                    ) : null}
                    {order.scheduledReminder1hSentAt && (
                      <Badge variant="outline" className="gap-1">
                        <Bell size={12} /> 1h sent
                      </Badge>
                    )}
                    {order.scheduledReminder30mSentAt && (
                      <Badge variant="outline" className="gap-1">
                        <Bell size={12} /> 30m sent
                      </Badge>
                    )}
                  </div>

                  <div className="grid gap-1 text-muted-foreground">
                    {order.customerPhone && <p>Phone: {order.customerPhone}</p>}
                    {order.deliveryMethod && (
                      <p>Service: {getFulfillmentLabel(order.deliveryMethod)}</p>
                    )}
                    {itemSummary && <p>Items: {itemSummary}</p>}
                    {order.deliveryNotes && <p>Notes: {order.deliveryNotes}</p>}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {order.status === 'pending' && (
                      <Button
                        size="sm"
                        onClick={() => handleAcceptOrder(order)}
                        disabled={acceptingId === order.id}
                        className="gap-1"
                      >
                        <CheckCircle2 size={14} />
                        {acceptingId === order.id ? 'Accepting…' : 'Accept order'}
                      </Button>
                    )}
                    <Button asChild size="sm" variant="outline" className="gap-1">
                      <Link to={`/admin/orders?orderId=${encodeURIComponent(order.id)}`}>
                        <ExternalLink size={14} />
                        Open in Orders
                      </Link>
                    </Button>
                  </div>
                </div>
              </AdminPanel>
            );
          })}
        </div>
      )}
    </AdminPageShell>
  );
};

export default AdminScheduledOrders;
