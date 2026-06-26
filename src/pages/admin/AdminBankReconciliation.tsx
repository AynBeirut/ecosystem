import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, getDocs, getFirestore, query, serverTimestamp, where } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { useToast } from '@/hooks/use-toast';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import { isCountedSaleStatus } from '@/lib/salesRules';
import { Order } from '@/types/order';
import { CashCollectionRecord } from '@/types/financial';

type OrderWithId = Order & { id: string };

type EligibleOrder = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  createdAt: string;
  remainingCash: number;
  status: string;
};

const AdminBankReconciliation: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orders, setOrders] = useState<OrderWithId[]>([]);
  const [collections, setCollections] = useState<CashCollectionRecord[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  const [collectionDate, setCollectionDate] = useState(new Date().toISOString().split('T')[0]);
  const [bankAccount, setBankAccount] = useState('');
  const [depositReference, setDepositReference] = useState('');
  const [notes, setNotes] = useState('');

  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [selectedDateFilter, setSelectedDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [orderSearch, setOrderSearch] = useState('');

  const toFiniteNumber = (value: unknown, fallback = 0): number => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const toDisplayDate = (value: unknown): string => {
    const date = new Date(String(value || ''));
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-GB');
  };

  const resolveOrderDate = (order: OrderWithId): string => {
    const raw = order.createdAt;
    if (raw && typeof raw === 'object' && 'toDate' in raw && typeof raw.toDate === 'function') {
      return raw.toDate().toISOString().split('T')[0];
    }
    if (raw && typeof raw === 'object' && 'seconds' in raw) {
      return new Date((raw.seconds as number) * 1000).toISOString().split('T')[0];
    }
    return String(raw || '').slice(0, 10);
  };

  const fetchData = async () => {
    if (!user?.storeId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const db = getFirestore();

      const [ordersSnap, collectionsSnap] = await Promise.all([
        getDocs(query(collection(db, 'orders'), where('storeId', '==', user.storeId))),
        getDocs(query(collection(db, 'cashCollections'), where('storeId', '==', user.storeId))),
      ]);

      const fetchedOrders = ordersSnap.docs.map((docSnapshot) => ({
        id: docSnapshot.id,
        ...(docSnapshot.data() as Order),
      }));

      const fetchedCollections = collectionsSnap.docs
        .map((docSnapshot) => {
          const data = docSnapshot.data() as Omit<CashCollectionRecord, 'id'>;
          return {
            id: docSnapshot.id,
            ...data,
          };
        })
        .sort((a, b) => {
          const at = new Date(String(a.collectionDate || '')).getTime();
          const bt = new Date(String(b.collectionDate || '')).getTime();
          return bt - at;
        });

      setOrders(fetchedOrders);
      setCollections(fetchedCollections);
    } catch (error) {
      console.error('Failed to fetch cash collection data', error);
      toast({
        title: 'Error',
        description: 'Failed to load cash collection data.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.storeId]);

  const allocatedByOrder = useMemo(() => {
    const totals: Record<string, number> = {};
    collections.forEach((entry) => {
      (entry.allocations || []).forEach((allocation) => {
        totals[allocation.orderId] = (totals[allocation.orderId] || 0) + toFiniteNumber(allocation.amount, 0);
      });
    });
    return totals;
  }, [collections]);

  const getCashPaidForOrder = (order: OrderWithId): number => {
    const history = Array.isArray(order.paymentHistory) ? order.paymentHistory : [];
    if (history.length > 0) {
      return history.reduce((sum, payment) => {
        if (String(payment.method || '').toLowerCase() !== 'cash') return sum;
        return sum + Math.max(0, toFiniteNumber(payment.amount, 0));
      }, 0);
    }

    if (String(order.paymentMethod || '').toLowerCase() === 'cash') {
      return Math.max(0, toFiniteNumber(order.amountPaid, 0));
    }

    return 0;
  };

  const eligibleOrders = useMemo<EligibleOrder[]>(() => {
    return orders
      .filter((order) => String(order.status || '').toLowerCase() !== 'cancelled')
      .map((order) => {
        const totalCashPaid = getCashPaidForOrder(order);
        const alreadyAllocated = toFiniteNumber(allocatedByOrder[order.id], 0);
        const remainingCash = Math.max(0, totalCashPaid - alreadyAllocated);

        return {
          id: order.id,
          invoiceNumber: order.invoiceNumber || order.orderNumber || order.id.slice(0, 8),
          customerName: order.customerName || 'Walk-in Customer',
          createdAt: resolveOrderDate(order),
          remainingCash,
          status: order.status || 'unknown',
        };
      })
      .filter((order) => order.remainingCash > 0.009)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, allocatedByOrder]);

  const selectedOrders = useMemo(() => {
    const selectedSet = new Set(selectedOrderIds);
    return eligibleOrders.filter((order) => selectedSet.has(order.id));
  }, [eligibleOrders, selectedOrderIds]);

  const visibleEligibleOrders = useMemo(() => {
    const term = orderSearch.trim().toLowerCase();
    if (!term) return eligibleOrders;
    return eligibleOrders.filter((order) => {
      return (
        String(order.invoiceNumber || '').toLowerCase().includes(term) ||
        String(order.customerName || '').toLowerCase().includes(term)
      );
    });
  }, [eligibleOrders, orderSearch]);

  const selectedTotal = selectedOrders.reduce((sum, order) => sum + order.remainingCash, 0);

  const totalCashReceived = useMemo(() => {
    return orders
      .filter((order) => String(order.status || '').toLowerCase() !== 'cancelled')
      .reduce((sum, order) => sum + getCashPaidForOrder(order), 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  const filteredCollections = useMemo(() => {
    return collections.filter((entry) => {
      if (!filterFrom && !filterTo) return true;
      // Normalize to YYYY-MM-DD (strip time component if any)
      const d = typeof entry.collectionDate === 'string'
        ? entry.collectionDate.slice(0, 10)
        : '';
      if (!d) return true;
      if (filterFrom && d < filterFrom) return false;
      if (filterTo && d > filterTo) return false;
      return true;
    });
  }, [collections, filterFrom, filterTo]);

  const totalDeposited = collections.reduce((sum, entry) => sum + toFiniteNumber(entry.totalAmount, 0), 0);
  const undepositedCash = Math.max(0, totalCashReceived - totalDeposited);

  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const todayCash = useMemo(() => {
    return orders
      .filter(o => String(o.status || '').toLowerCase() !== 'cancelled')
      .filter(o => resolveOrderDate(o) === todayStr)
      .reduce((sum, o) => sum + getCashPaidForOrder(o), 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, todayStr]);

  const yesterdayCash = useMemo(() => {
    return orders
      .filter(o => String(o.status || '').toLowerCase() !== 'cancelled')
      .filter(o => resolveOrderDate(o) === yesterdayStr)
      .reduce((sum, o) => sum + getCashPaidForOrder(o), 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, yesterdayStr]);

  const selectedDateCash = useMemo(() => {
    if (!selectedDateFilter) return 0;
    return orders
      .filter(o => String(o.status || '').toLowerCase() !== 'cancelled')
      .filter(o => resolveOrderDate(o) === selectedDateFilter)
      .reduce((sum, o) => sum + getCashPaidForOrder(o), 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, selectedDateFilter]);

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds((prev) => {
      if (prev.includes(orderId)) return prev.filter((id) => id !== orderId);
      return [...prev, orderId];
    });
  };

  const selectAllEligible = () => {
    setSelectedOrderIds(visibleEligibleOrders.map((order) => order.id));
  };

  const clearSelection = () => {
    setSelectedOrderIds([]);
  };

  const saveCollection = async () => {
    if (!user?.storeId || !user?.id) return;

    if (selectedOrders.length === 0) {
      toast({
        title: 'No Orders Selected',
        description: 'Select at least one order to create a cash collection.',
        variant: 'destructive',
      });
      return;
    }

    if (!bankAccount.trim()) {
      toast({
        title: 'Bank Account Required',
        description: 'Enter a bank account/bank name for this deposit.',
        variant: 'destructive',
      });
      return;
    }

    if (!depositReference.trim()) {
      toast({
        title: 'Reference Required',
        description: 'Enter a bank deposit reference number.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const db = getFirestore();

      const allocations = selectedOrders.map((order) => ({
        orderId: order.id,
        invoiceNumber: order.invoiceNumber,
        customerName: order.customerName,
        amount: Number(order.remainingCash.toFixed(2)),
      }));

      await addDoc(collection(db, 'cashCollections'), {
        storeId: user.storeId,
        collectionDate,
        bankAccount: bankAccount.trim(),
        depositReference: depositReference.trim(),
        notes: notes.trim(),
        totalAmount: Number(selectedTotal.toFixed(2)),
        ordersCount: allocations.length,
        allocations,
        createdById: user.id,
        createdByName: user.name || 'Unknown User',
        createdAt: serverTimestamp(),
      });

      toast({
        title: 'Success',
        description: 'Cash collection saved successfully.',
      });

      setSelectedOrderIds([]);
      setDepositReference('');
      setNotes('');

      await fetchData();
    } catch (error) {
      console.error('Failed to save cash collection', error);
      toast({
        title: 'Error',
        description: 'Failed to save cash collection.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPageShell
      title="Cash Collection"
      description="Record bank deposits from cash orders in 3 steps: pick orders, add deposit details, then save."
    >
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white border rounded p-4">
            <div className="text-sm text-gray-600">Cash Received</div>
            <div className="text-2xl font-bold">${totalCashReceived.toFixed(2)}</div>
          </div>
          <div className="bg-white border rounded p-4">
            <div className="text-sm text-gray-600">Deposited</div>
            <div className="text-2xl font-bold text-green-600">${totalDeposited.toFixed(2)}</div>
          </div>
          <div className="bg-white border rounded p-4">
            <div className="text-sm text-gray-600">Undeposited Cash</div>
            <div className="text-2xl font-bold text-orange-600">${undepositedCash.toFixed(2)}</div>
          </div>
          <div className="bg-white border rounded p-4">
            <div className="text-sm text-gray-600">Collections</div>
            <div className="text-2xl font-bold">{collections.length}</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded p-4">
            <div className="text-sm text-blue-600 font-medium">Today's Cash</div>
            <div className="text-2xl font-bold text-blue-700">${todayCash.toFixed(2)}</div>
            <div className="text-xs text-blue-400 mt-1">{todayStr}</div>
          </div>
          <div className="bg-indigo-50 border border-indigo-200 rounded p-4">
            <div className="text-sm text-indigo-600 font-medium">Yesterday's Cash</div>
            <div className="text-2xl font-bold text-indigo-700">${yesterdayCash.toFixed(2)}</div>
            <div className="text-xs text-indigo-400 mt-1">{yesterdayStr}</div>
          </div>
          <div className="bg-teal-50 border border-teal-200 rounded p-4 col-span-2 md:col-span-1">
            <div className="text-sm text-teal-600 font-medium mb-1">Cash on Date</div>
            <input
              type="date"
              value={selectedDateFilter}
              onChange={e => setSelectedDateFilter(e.target.value)}
              className="w-full border border-teal-300 rounded px-2 py-1 text-sm mb-2 bg-white"
            />
            <div className="text-2xl font-bold text-teal-700">${selectedDateCash.toFixed(2)}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border rounded p-4 space-y-4 lg:col-span-1">
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              <p className="font-semibold mb-1">How to record a deposit</p>
              <p>1) Select the orders from the table.</p>
              <p>2) Enter bank account and reference.</p>
              <p>3) Save to lock this deposit record.</p>
            </div>

            <h2 className="text-lg font-semibold">Record New Bank Deposit</h2>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Collection Date</label>
              <input
                type="date"
                value={collectionDate}
                onChange={(e) => setCollectionDate(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Bank Account / Bank Name</label>
              <input
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                placeholder="e.g. BLOM - Main USD"
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Deposit Reference</label>
              <input
                value={depositReference}
                onChange={(e) => setDepositReference(e.target.value)}
                placeholder="Bank deposit slip / transaction reference"
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Notes (Optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div className="bg-gray-50 rounded p-3">
              <div className="text-sm text-gray-600">Selected Orders</div>
              <div className="font-semibold">{selectedOrders.length}</div>
              <div className="text-sm text-gray-600 mt-1">Deposit Amount</div>
              <div className="text-xl font-bold text-blue-600">${selectedTotal.toFixed(2)}</div>
            </div>

            <button
              onClick={saveCollection}
              disabled={saving || loading}
              className="w-full bg-blue-600 text-white rounded py-2 font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Record Deposit'}
            </button>
          </div>

          <div className="bg-white border rounded p-4 lg:col-span-2">
            <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
              <h2 className="text-lg font-semibold">Orders with Undeposited Cash</h2>
              <div className="flex gap-2">
                <button onClick={selectAllEligible} className="px-3 py-1 border rounded text-sm hover:bg-gray-50">Select All Shown</button>
                <button onClick={clearSelection} className="px-3 py-1 border rounded text-sm hover:bg-gray-50">Clear</button>
              </div>
            </div>

            <div className="mb-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="Search by invoice or customer"
                className="w-full border rounded px-3 py-2 text-sm"
              />
              <div className="rounded border bg-gray-50 px-3 py-2 text-sm text-gray-700">
                {selectedOrders.length} order(s) selected • ${selectedTotal.toFixed(2)} ready to deposit
              </div>
            </div>

            {loading ? (
              <div className="text-sm text-gray-600">Loading orders...</div>
            ) : visibleEligibleOrders.length === 0 ? (
              <div className="text-sm text-gray-600">No matching orders found{orderSearch ? ' for this search' : ''}.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Pick</th>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Invoice</th>
                      <th className="px-3 py-2 text-left">Customer</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-right">Remaining Cash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleEligibleOrders.map((order) => (
                      <tr key={order.id} className="border-t">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedOrderIds.includes(order.id)}
                            onChange={() => toggleOrderSelection(order.id)}
                          />
                        </td>
                        <td className="px-3 py-2">{toDisplayDate(order.createdAt)}</td>
                        <td className="px-3 py-2">{order.invoiceNumber}</td>
                        <td className="px-3 py-2">{order.customerName}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${
                            order.status === 'delivered' || order.status === 'completed' || order.status === 'paid'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>{order.status}</span>
                        </td>
                        <td className="px-3 py-2 text-right font-medium">${order.remainingCash.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border rounded p-4">
          <div className="flex flex-wrap items-end gap-4 mb-4">
            <h2 className="text-lg font-semibold">Cash Collections</h2>
            <div className="flex flex-wrap gap-3 ml-auto items-end">
              <div>
                <label className="block text-xs text-gray-500 mb-1">From</label>
                <input
                  type="date"
                  value={filterFrom}
                  onChange={(e) => setFilterFrom(e.target.value)}
                  className="border rounded px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">To</label>
                <input
                  type="date"
                  value={filterTo}
                  onChange={(e) => setFilterTo(e.target.value)}
                  className="border rounded px-2 py-1 text-sm"
                />
              </div>
              {(filterFrom || filterTo) && (
                <button
                  onClick={() => { setFilterFrom(''); setFilterTo(''); }}
                  className="px-3 py-1 border rounded text-sm hover:bg-gray-50 text-gray-600"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          {filteredCollections.length === 0 ? (
            <div className="text-sm text-gray-600">No cash collections found{(filterFrom || filterTo) ? ' for selected date range' : ''}.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Bank</th>
                      <th className="px-3 py-2 text-left">Reference</th>
                      <th className="px-3 py-2 text-right">Orders</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCollections.map((entry) => (
                      <tr key={entry.id} className="border-t">
                        <td className="px-3 py-2">{toDisplayDate(entry.collectionDate)}</td>
                        <td className="px-3 py-2">{entry.bankAccount || '-'}</td>
                        <td className="px-3 py-2">{entry.depositReference || '-'}</td>
                        <td className="px-3 py-2 text-right">{entry.ordersCount || 0}</td>
                        <td className="px-3 py-2 text-right font-semibold">${toFiniteNumber(entry.totalAmount, 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-gray-300 bg-gray-50">
                    <tr>
                      <td colSpan={3} className="px-3 py-2 font-semibold text-sm">
                        {(filterFrom || filterTo) ? 'Filtered Total' : 'Total'} ({filteredCollections.length} entries)
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {filteredCollections.reduce((s, e) => s + (e.ordersCount || 0), 0)}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-blue-600">
                        ${filteredCollections.reduce((s, e) => s + toFiniteNumber(e.totalAmount, 0), 0).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
    </AdminPageShell>
  );
};

export default AdminBankReconciliation;
