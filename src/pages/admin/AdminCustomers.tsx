import React, { useState, useEffect, useCallback } from 'react';
import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Users, Plus, Edit2, Trash2, Star, DollarSign, TrendingUp, Award } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminStatCard from '@/components/admin/AdminStatCard';
import AdminPanel from '@/components/admin/AdminPanel';
import { logAction } from '@/lib/auditLog';

const CUSTOMER_TIERS = [
  { value: 'bronze', label: 'Bronze', color: 'bg-orange-100 text-orange-800', minPercent: 0 },
  { value: 'silver', label: 'Silver', color: 'bg-gray-100 text-gray-800', minPercent: 25 },
  { value: 'gold', label: 'Gold', color: 'bg-yellow-100 text-yellow-800', minPercent: 50 },
  { value: 'platinum', label: 'Platinum', color: 'bg-purple-100 text-purple-800', minPercent: 75 },
];

// CustomerForm component moved outside to prevent recreation on every render
const CustomerForm: React.FC<{ 
  customer: any;
  onChange: (updates: any) => void;
  isEdit?: boolean;
  salesPersons?: { id: string; name: string }[];
}> = React.memo(({ customer, onChange, isEdit = false, salesPersons = [] }) => (
  <div className="grid gap-4">
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2">
        <Label htmlFor="name">Customer Name *</Label>
        <Input
          id="name"
          value={customer.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="John Doe"
        />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={customer.email}
          onChange={(e) => onChange({ email: e.target.value })}
          placeholder="customer@example.com"
        />
      </div>
      <div>
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          value={customer.phone || ''}
          onChange={(e) => onChange({ phone: e.target.value })}
          placeholder="+1234567890"
        />
      </div>
      <div className="col-span-2">
        <Label htmlFor="address">Address</Label>
        <Input
          id="address"
          value={customer.address || ''}
          onChange={(e) => onChange({ address: e.target.value })}
          placeholder="123 Main St"
        />
      </div>
      <div>
        <Label htmlFor="city">City</Label>
        <Input
          id="city"
          value={customer.city || ''}
          onChange={(e) => onChange({ city: e.target.value })}
          placeholder="New York"
        />
      </div>
      <div>
        <Label htmlFor="country">Country</Label>
        <Input
          id="country"
          value={customer.country || ''}
          onChange={(e) => onChange({ country: e.target.value })}
          placeholder="USA"
        />
      </div>
      <div>
        <Label htmlFor="taxId">Tax ID / VAT</Label>
        <Input
          id="taxId"
          value={customer.taxId || ''}
          onChange={(e) => onChange({ taxId: e.target.value })}
          placeholder="Tax ID"
        />
      </div>
      <div>
        <Label htmlFor="status">Status</Label>
        <Select
          value={customer.status || 'active'}
          onValueChange={(value: typeof customer.status) => onChange({ status: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="creditLimit">Credit Limit</Label>
        <Input
          id="creditLimit"
          type="number"
          min="0"
          step="0.01"
          value={customer.creditLimit === 0 ? '' : customer.creditLimit}
          onChange={(e) => onChange({ creditLimit: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0) })}
          placeholder="0.00"
        />
      </div>
      <div>
        <Label htmlFor="paymentTerms">Payment Terms (days)</Label>
        <Input
          id="paymentTerms"
          value={customer.paymentTerms || ''}
          onChange={(e) => onChange({ paymentTerms: e.target.value })}
          placeholder="30"
        />
      </div>
      <div>
        <Label htmlFor="loyaltyPoints">Loyalty Points</Label>
        <Input
          id="loyaltyPoints"
          type="number"
          min="0"
          value={customer.loyaltyPoints === 0 ? '' : customer.loyaltyPoints}
          onChange={(e) => onChange({ loyaltyPoints: e.target.value === '' ? 0 : (parseInt(e.target.value) || 0) })}
          placeholder="0"
        />
      </div>
      {salesPersons.length > 0 && (
        <div className="col-span-2">
          <Label htmlFor="assignedSalesPerson">Assigned Salesperson</Label>
          <Select
            value={customer.assignedSalesPerson || 'none'}
            onValueChange={(val) => {
              const sp = salesPersons.find(s => s.id === val);
              onChange({
                assignedSalesPerson: val === 'none' ? '' : val,
                assignedSalesPersonName: sp ? sp.name : '',
              });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="No salesperson" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No salesperson</SelectItem>
              {salesPersons.map(sp => (
                <SelectItem key={sp.id} value={sp.id}>{sp.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500 mt-1">All new orders for this customer will be auto-assigned to this salesperson</p>
        </div>
      )}
      <div className="col-span-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={customer.notes || ''}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Additional notes about the customer..."
          rows={3}
        />
      </div>
    </div>
  </div>
));

const AdminCustomers: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [salesPersons, setSalesPersons] = useState<{ id: string; name: string }[]>([]);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTier, setFilterTier] = useState<string>('all');
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: '',
    taxId: '',
    creditLimit: 0,
    paymentTerms: '30',
    loyaltyPoints: 0,
    status: 'active' as 'active' | 'inactive' | 'suspended',
    notes: '',
    assignedSalesPerson: '',
    assignedSalesPersonName: '',
  });

  useEffect(() => {
    const fetchCustomers = async () => {
      if (!user?.storeId) return;
      const db = getFirestore();
      const customersRef = collection(db, 'customers');
      const q = query(customersRef, where('storeId', '==', user.storeId));
      const snapshot = await getDocs(q);
      const customersList: Customer[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Customer));
      setCustomers(customersList);

      // Fetch salespeople from subAccounts
      const saSnap = await getDocs(query(collection(db, 'subAccounts'), where('storeId', '==', user.storeId), where('role', '==', 'sales')));
      setSalesPersons(saSnap.docs.map(d => ({ id: d.id, name: (d.data() as any).name || '' })));
    };
    fetchCustomers();
  }, [user?.storeId]);

  const getEffectiveTierPoints = (customer: Customer): number => {
    const loyaltyPoints = Number(customer.loyaltyPoints || 0);
    if (loyaltyPoints > 0) return loyaltyPoints;

    // Backward compatibility: many records only have lifetimeValue populated.
    // Use a 1:1 fallback so tiers still reflect real customer value.
    const lifetimeValue = Number(customer.lifetimeValue || 0);
    return Math.max(0, Math.floor(lifetimeValue));
  };

  const getCustomerTier = (customer: Customer) => {
    const customerScore = getEffectiveTierPoints(customer);
    const maxScore = Math.max(0, ...customers.map((c) => getEffectiveTierPoints(c)));

    // Percentage-based tiering: classify customer score as % of top customer score.
    // If all scores are zero, everyone defaults to Bronze.
    const scorePercent = maxScore > 0 ? (customerScore / maxScore) * 100 : 0;

    const tiers = [...CUSTOMER_TIERS].reverse();
    return tiers.find((tier) => scorePercent >= tier.minPercent) || CUSTOMER_TIERS[0];
  };

  const calculateLifetimeValue = (customerId: string) => {
    // In real app, would fetch order totals from orders collection
    return Math.random() * 10000;
  };

  const handleAddCustomer = async () => {
    if (!newCustomer.name || !user?.storeId) {
      toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }

    try {
      const db = getFirestore();
      const customerData = {
        ...newCustomer,
        lifetimeValue: 0,
        totalOrders: 0,
        lastOrderDate: null,
        storeId: user.storeId,
        createdAt: new Date().toISOString(),
        createdBy: user.id,
      };

      const docRef = await addDoc(collection(db, 'customers'), customerData);
      const newCustomerObj = { id: docRef.id, ...customerData };
      setCustomers([...customers, newCustomerObj]);

      await logAction(
        user.id,
        user.name,
        user.role,
        'create',
        'customer',
        docRef.id,
        { newValue: customerData },
        user.storeId
      );

      setNewCustomer({
        name: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        country: '',
        taxId: '',
        creditLimit: 0,
        paymentTerms: '30',
        loyaltyPoints: 0,
        status: 'active',
        notes: '',
        assignedSalesPerson: '',
        assignedSalesPersonName: '',
      });
      setIsAddingCustomer(false);
      toast({ title: "Success", description: "Customer added successfully!" });
    } catch (error) {
      console.error('Error adding customer:', error);
      toast({ title: "Error", description: "Failed to add customer", variant: "destructive" });
    }
  };

  const handleUpdateCustomer = async () => {
    if (!editingCustomer || !user?.storeId) return;

    try {
      const db = getFirestore();
      const customerRef = doc(db, 'customers', editingCustomer.id);
      
      // Filter out undefined values to prevent Firestore errors
      const updateData: any = {
        name: editingCustomer.name,
        email: editingCustomer.email,
        phone: editingCustomer.phone || '',
        address: editingCustomer.address || '',
        city: editingCustomer.city || '',
        country: editingCustomer.country || '',
        taxId: editingCustomer.taxId || '',
        creditLimit: editingCustomer.creditLimit || 0,
        paymentTerms: editingCustomer.paymentTerms || '30',
        loyaltyPoints: editingCustomer.loyaltyPoints || 0,
        status: editingCustomer.status || 'active',
        notes: editingCustomer.notes || '',
        assignedSalesPerson: (editingCustomer as any).assignedSalesPerson || '',
        assignedSalesPersonName: (editingCustomer as any).assignedSalesPersonName || '',
      };

      await updateDoc(customerRef, updateData);
      setCustomers(customers.map(c => c.id === editingCustomer.id ? editingCustomer : c));

      await logAction(
        user.id,
        user.name,
        user.role,
        'update',
        'customer',
        editingCustomer.id,
        { 
          oldValue: customers.find(c => c.id === editingCustomer.id),
          newValue: editingCustomer 
        },
        user.storeId
      );

      setEditingCustomer(null);
      toast({ title: "Success", description: "Customer updated successfully!" });
    } catch (error) {
      console.error('Error updating customer:', error);
      toast({ title: "Error", description: "Failed to update customer", variant: "destructive" });
    }
  };

  const handleDeleteCustomer = async (customer: Customer) => {
    if (!confirm(`Delete customer "${customer.name}"? This will also delete their order history.`)) return;
    if (!user?.storeId) return;

    try {
      const db = getFirestore();
      await deleteDoc(doc(db, 'customers', customer.id));
      setCustomers(customers.filter(c => c.id !== customer.id));

      await logAction(
        user.id,
        user.name,
        user.role,
        'delete',
        'customer',
        customer.id,
        { oldValue: customer },
        user.storeId
      );

      toast({ title: "Success", description: "Customer deleted successfully!" });
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast({ title: "Error", description: "Failed to delete customer", variant: "destructive" });
    }
  };

  // Memoized onChange handler to prevent input blur
  const handleCustomerFormChange = useCallback((updates: Partial<Customer>) => {
    setEditingCustomer(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  const getFilteredCustomers = () => {
    const filtered = customers.filter(customer => {
      const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           customer.phone.includes(searchTerm);
      const tier = getCustomerTier(customer);
      const matchesTier = filterTier === 'all' || tier.value === filterTier;
      return matchesSearch && matchesTier;
    });

    // Display highest-value customers first.
    return filtered.sort((a, b) => {
      const scoreDiff = getEffectiveTierPoints(b) - getEffectiveTierPoints(a);
      if (scoreDiff !== 0) return scoreDiff;

      // Tie-breaker: higher lifetime value first.
      return Number(b.lifetimeValue || 0) - Number(a.lifetimeValue || 0);
    });
  };

  const filteredCustomers = getFilteredCustomers();
  const activeCustomers = customers.filter(c => c.status === 'active').length;
  const totalLoyaltyPoints = customers.reduce((sum, c) => sum + c.loyaltyPoints, 0);
  const avgCreditLimit = customers.length > 0 
    ? customers.reduce((sum, c) => sum + c.creditLimit, 0) / customers.length 
    : 0;

  return (
    <AdminPageShell
      title="Customer Management (CRM)"
      eyebrow="Sales & Customers"
      actions={(
        <Button onClick={() => setIsAddingCustomer(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Customer
        </Button>
      )}
    >
      <Dialog open={isAddingCustomer} onOpenChange={setIsAddingCustomer}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Customer</DialogTitle>
            <DialogDescription>Create a new customer profile</DialogDescription>
          </DialogHeader>
          <CustomerForm
            customer={newCustomer}
            onChange={(updates) => setNewCustomer({ ...newCustomer, ...updates })}
            salesPersons={salesPersons}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingCustomer(false)}>Cancel</Button>
            <Button onClick={handleAddCustomer}>Add Customer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <AdminStatCard title="Total Customers" value={customers.length} icon={Users} gradient="from-slate-600 to-slate-800" subtitle="All profiles" />
          <AdminStatCard title="Active Customers" value={activeCustomers} icon={TrendingUp} gradient="from-emerald-500 to-teal-700" subtitle="Status active" />
          <AdminStatCard title="Loyalty Points" value={totalLoyaltyPoints.toLocaleString()} icon={Award} gradient="from-violet-500 to-purple-700" subtitle="Total across customers" />
          <AdminStatCard title="Avg Credit Limit" value={`$${avgCreditLimit.toFixed(0)}`} icon={DollarSign} gradient="from-sky-500 to-blue-700" subtitle="Per customer average" />
        </div>

        <div className="flex gap-4 mb-6">
          <Input
            id="customer-search"
            name="customerSearch"
            placeholder="Search by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
          <Select value={filterTier} onValueChange={setFilterTier}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tiers</SelectItem>
              {CUSTOMER_TIERS.map(tier => (
                <SelectItem key={tier.value} value={tier.value}>
                  {tier.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4">
          {filteredCustomers.length === 0 ? (
            <AdminPanel>
              <CardContent className="py-12 text-center">
                <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500">No customers found.</p>
              </CardContent>
            </AdminPanel>
          ) : (
            filteredCustomers.map((customer) => {
              const tier = getCustomerTier(customer);
              return (
                <AdminPanel key={customer.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                          {customer.name}
                          <Badge className={tier.color}>
                            <Star className="h-3 w-3 mr-1" />
                            {tier.label}
                          </Badge>
                          <Badge variant={customer.status === 'active' ? 'default' : 'secondary'}>
                            {customer.status}
                          </Badge>
                        </CardTitle>
                        <CardDescription>
                          {customer.email} | {customer.phone || 'No phone'}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingCustomer(customer)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteCustomer(customer)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Loyalty Points</p>
                        <p className="font-bold text-purple-600">{customer.loyaltyPoints || 0}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Credit Limit</p>
                        <p className="font-medium">${(customer.creditLimit || 0).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Payment Terms</p>
                        <p className="font-medium">{customer.paymentTerms || 0} days</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Total Orders</p>
                        <p className="font-medium">{customer.totalOrders || 0}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Lifetime Value</p>
                        <p className="font-bold text-green-600">${(customer.lifetimeValue || 0).toFixed(2)}</p>
                      </div>
                    </div>
                    {customer.address && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-sm text-gray-500">Address</p>
                        <p className="text-sm">
                          {customer.address}, {customer.city} {customer.country}
                        </p>
                      </div>
                    )}
                    {customer.notes && (
                      <div className="mt-2">
                        <p className="text-sm text-gray-600 italic">{customer.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </AdminPanel>
              );
            })
          )}
        </div>

        {editingCustomer && (
          <Dialog open={!!editingCustomer} onOpenChange={() => setEditingCustomer(null)}>
            <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Customer</DialogTitle>
                <DialogDescription>Update customer information</DialogDescription>
              </DialogHeader>
              <CustomerForm
                customer={editingCustomer}
                onChange={handleCustomerFormChange}
                isEdit
                salesPersons={salesPersons}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingCustomer(null)}>Cancel</Button>
                <Button onClick={handleUpdateCustomer}>Update Customer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
    </AdminPageShell>
  );
};

export default AdminCustomers;
