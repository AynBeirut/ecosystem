import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getFirestore, collection, query, where, getDocs, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type RenewalCharge = {
  id: string;
  subscriptionId: string;
  customerName: string;
  serviceName: string;
  paymentType: 'monthly' | 'yearly';
  amount: number;
  dueDate: string;
  nextCycleDate?: string;
  status: 'pending' | 'paid' | 'failed';
  createdAt?: string;
};

type ChargeFilter = 'all' | 'pending' | 'overdue' | 'paid' | 'failed';

const AdminServiceRenewals: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [charges, setCharges] = useState<RenewalCharge[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<ChargeFilter>('pending');

  const getStatusBadgeClass = (status: RenewalCharge['status']) => {
    if (status === 'paid') return 'bg-green-100 text-green-800 border-green-200';
    if (status === 'failed') return 'bg-red-100 text-red-800 border-red-200';
    return 'bg-orange-100 text-orange-800 border-orange-200';
  };

  const fetchCharges = useCallback(async () => {
    if (!user) {
      setCharges([]);
      setLoading(false);
      return;
    }

    const storeId = getActualStoreId(user);
    if (!storeId) {
      setCharges([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const db = getFirestore();
      const chargesRef = collection(db, 'serviceRenewalCharges');
      const chargesQuery = query(chargesRef, where('storeId', '==', storeId));
      const snapshot = await getDocs(chargesQuery);

      const list: RenewalCharge[] = snapshot.docs
        .map((entry) => {
          const data = entry.data() as Partial<RenewalCharge>;
          return {
            id: entry.id,
            subscriptionId: String(data.subscriptionId || ''),
            customerName: String(data.customerName || 'Unknown customer'),
            serviceName: String(data.serviceName || 'Service'),
            paymentType: data.paymentType === 'yearly' ? 'yearly' : 'monthly',
            amount: Number(data.amount || 0),
            dueDate: String(data.dueDate || ''),
            nextCycleDate: typeof data.nextCycleDate === 'string' ? data.nextCycleDate : undefined,
            status: data.status === 'paid' || data.status === 'failed' ? data.status : 'pending',
            createdAt: typeof data.createdAt === 'string' ? data.createdAt : undefined,
          };
        })
        .sort((a, b) => {
          const aTime = new Date(a.dueDate || a.createdAt || 0).getTime();
          const bTime = new Date(b.dueDate || b.createdAt || 0).getTime();
          return bTime - aTime;
        });

      setCharges(list);
    } catch (error) {
      console.error('Failed to fetch service renewal charges', error);
      toast({
        title: 'Load Failed',
        description: 'Unable to load service renewal charges.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    void fetchCharges();
  }, [fetchCharges]);

  const markChargePaid = async (charge: RenewalCharge) => {
    if (!charge.subscriptionId) {
      toast({ title: 'Invalid Charge', description: 'Missing subscription link for this charge.', variant: 'destructive' });
      return;
    }

    setProcessingId(charge.id);
    try {
      const db = getFirestore();
      const nowIso = new Date().toISOString();
      const nextBillingDate = charge.nextCycleDate || charge.dueDate;

      await updateDoc(doc(db, 'serviceRenewalCharges', charge.id), {
        status: 'paid',
        paidAt: nowIso,
        updatedAt: nowIso,
      });

      await updateDoc(doc(db, 'serviceSubscriptions', charge.subscriptionId), {
        status: 'active',
        billingStatus: 'paid',
        nextBillingDate,
        paymentDueSince: null,
        lastSuccessfulChargeAt: nowIso,
        lastPaidChargeId: charge.id,
        updatedAt: nowIso,
        billingHistory: arrayUnion({
          date: nowIso,
          amount: charge.amount,
          paymentType: charge.paymentType,
          transactionId: charge.id,
          status: 'success',
          description: `Service renewal (${charge.paymentType})`,
        }),
      });

      toast({ title: 'Renewal Paid', description: 'Subscription reactivated and next cycle scheduled.' });
      await fetchCharges();
    } catch (error) {
      console.error('Failed to mark renewal charge as paid', error);
      toast({
        title: 'Update Failed',
        description: 'Could not mark this renewal as paid.',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const markChargeFailed = async (charge: RenewalCharge) => {
    if (!charge.subscriptionId) {
      toast({ title: 'Invalid Charge', description: 'Missing subscription link for this charge.', variant: 'destructive' });
      return;
    }

    setProcessingId(charge.id);
    try {
      const db = getFirestore();
      const nowIso = new Date().toISOString();

      await updateDoc(doc(db, 'serviceRenewalCharges', charge.id), {
        status: 'failed',
        failedAt: nowIso,
        updatedAt: nowIso,
      });

      await updateDoc(doc(db, 'serviceSubscriptions', charge.subscriptionId), {
        status: 'payment_due',
        billingStatus: 'failed',
        paymentDueSince: nowIso,
        lastFailedChargeId: charge.id,
        updatedAt: nowIso,
      });

      toast({ title: 'Marked Failed', description: 'Renewal remains due and flagged as failed.' });
      await fetchCharges();
    } catch (error) {
      console.error('Failed to mark renewal charge as failed', error);
      toast({
        title: 'Update Failed',
        description: 'Could not mark this renewal as failed.',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const retryCharge = async (charge: RenewalCharge) => {
    if (!charge.subscriptionId) {
      toast({ title: 'Invalid Charge', description: 'Missing subscription link for this charge.', variant: 'destructive' });
      return;
    }

    setProcessingId(charge.id);
    try {
      const db = getFirestore();
      const nowIso = new Date().toISOString();

      await updateDoc(doc(db, 'serviceRenewalCharges', charge.id), {
        status: 'pending',
        retriedAt: nowIso,
        updatedAt: nowIso,
      });

      await updateDoc(doc(db, 'serviceSubscriptions', charge.subscriptionId), {
        status: 'payment_due',
        billingStatus: 'retry_pending',
        paymentDueSince: nowIso,
        updatedAt: nowIso,
      });

      toast({ title: 'Retry Ready', description: 'Renewal charge moved back to pending.' });
      await fetchCharges();
    } catch (error) {
      console.error('Failed to retry renewal charge', error);
      toast({
        title: 'Update Failed',
        description: 'Could not retry this renewal charge.',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const summary = useMemo(() => {
    const now = Date.now();
    const pending = charges.filter((item) => item.status === 'pending');
    const pendingAmount = pending.reduce((sum, item) => sum + item.amount, 0);
    const overdueCount = pending.filter((item) => new Date(item.dueDate).getTime() < now).length;
    return {
      total: charges.length,
      pending: pending.length,
      pendingAmount,
      overdueCount,
    };
  }, [charges]);

  const filteredCharges = useMemo(() => {
    const now = Date.now();
    if (activeFilter === 'all') return charges;
    if (activeFilter === 'overdue') {
      return charges.filter((item) => item.status === 'pending' && new Date(item.dueDate).getTime() < now);
    }
    return charges.filter((item) => item.status === activeFilter);
  }, [charges, activeFilter]);

  return (
    <AdminPageShell
      title="Service Renewals"
      description="Manage recurring service renewal charges and reactivate subscriptions after payment"
      eyebrow="Business Tools"
      backTo="/admin/dashboard"
      backLabel="Dashboard"
    >

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <AdminPanel>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Total Charges</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{summary.total}</div></CardContent>
          </AdminPanel>
          <AdminPanel>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Pending</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-orange-600">{summary.pending}</div></CardContent>
          </AdminPanel>
          <AdminPanel>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Pending Amount</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">${summary.pendingAmount.toFixed(2)}</div></CardContent>
          </AdminPanel>
          <AdminPanel>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Overdue</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-red-600">{summary.overdueCount}</div></CardContent>
          </AdminPanel>
        </div>

        <AdminPanel>
          <CardHeader>
            <CardTitle>Renewal Charges</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-4">
              <Button size="sm" variant={activeFilter === 'pending' ? 'default' : 'outline'} onClick={() => setActiveFilter('pending')}>Pending</Button>
              <Button size="sm" variant={activeFilter === 'overdue' ? 'default' : 'outline'} onClick={() => setActiveFilter('overdue')}>Overdue</Button>
              <Button size="sm" variant={activeFilter === 'paid' ? 'default' : 'outline'} onClick={() => setActiveFilter('paid')}>Paid</Button>
              <Button size="sm" variant={activeFilter === 'failed' ? 'default' : 'outline'} onClick={() => setActiveFilter('failed')}>Failed</Button>
              <Button size="sm" variant={activeFilter === 'all' ? 'default' : 'outline'} onClick={() => setActiveFilter('all')}>All</Button>
            </div>

            {loading ? (
              <div className="text-sm text-muted-foreground">Loading renewal charges...</div>
            ) : filteredCharges.length === 0 ? (
              <div className="text-sm text-muted-foreground">No charges found for this filter.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">Customer</th>
                      <th className="text-left py-2 px-2">Service</th>
                      <th className="text-left py-2 px-2">Type</th>
                      <th className="text-right py-2 px-2">Amount</th>
                      <th className="text-left py-2 px-2">Due Date</th>
                      <th className="text-left py-2 px-2">Status</th>
                      <th className="text-right py-2 px-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCharges.map((charge) => (
                      <tr key={charge.id} className="border-b">
                        <td className="py-2 px-2">{charge.customerName}</td>
                        <td className="py-2 px-2">{charge.serviceName}</td>
                        <td className="py-2 px-2 capitalize">{charge.paymentType}</td>
                        <td className="py-2 px-2 text-right">${charge.amount.toFixed(2)}</td>
                        <td className="py-2 px-2">{charge.dueDate ? new Date(charge.dueDate).toLocaleDateString() : '-'}</td>
                        <td className="py-2 px-2">
                          <Badge variant="outline" className={`${getStatusBadgeClass(charge.status)} capitalize`}>
                            {charge.status}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 text-right">
                          {charge.status === 'pending' && (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                onClick={() => void markChargePaid(charge)}
                                disabled={processingId === charge.id}
                              >
                                {processingId === charge.id ? 'Processing...' : 'Mark Paid'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void markChargeFailed(charge)}
                                disabled={processingId === charge.id}
                              >
                                Mark Failed
                              </Button>
                            </div>
                          )}
                          {charge.status === 'failed' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void retryCharge(charge)}
                              disabled={processingId === charge.id}
                            >
                              Retry
                            </Button>
                          )}
                          {charge.status === 'paid' && <span className="text-xs text-muted-foreground">-</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </AdminPanel>
    </AdminPageShell>
  );
};

export default AdminServiceRenewals;
