import React, { useState, useEffect } from 'react';
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
import { Customer } from '@/types/customer';
import { logAction } from '@/lib/auditLog';
import MobileHeader from '@/components/MobileHeader';
import BackButton from '@/components/BackButton';
import { useIsMobile } from '@/hooks/use-mobile';

const CUSTOMER_TIERS = [
  { value: 'bronze', label: 'Bronze', color: 'bg-orange-100 text-orange-800', minPoints: 0 },
  { value: 'silver', label: 'Silver', color: 'bg-gray-100 text-gray-800', minPoints: 500 },
  { value: 'gold', label: 'Gold', color: 'bg-yellow-100 text-yellow-800', minPoints: 1000 },
  { value: 'platinum', label: 'Platinum', color: 'bg-purple-100 text-purple-800', minPoints: 2500 },
];

const AdminCustomers: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [customers, setCustomers] = useState<Customer[]>([]);
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
    };
    fetchCustomers();
  }, [user?.storeId]);

  const getCustomerTier = (points: number) => {
    const tiers = [...CUSTOMER_TIERS].reverse();
    return tiers.find(tier => points >= tier.minPoints) || CUSTOMER_TIERS[0];
  };

  const calculateLifetimeValue = (customerId: string) => {
    // In real app, would fetch order totals from orders collection
    return Math.random() * 10000;
  };

  const handleAddCustomer = async () => {
    if (!newCustomer.name || !newCustomer.email || !user?.storeId) {
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
      const updateData = {
        name: editingCustomer.name,
        email: editingCustomer.email,
        phone: editingCustomer.phone,
        address: editingCustomer.address,
        city: editingCustomer.city,
        country: editingCustomer.country,
        taxId: editingCustomer.taxId,
        creditLimit: editingCustomer.creditLimit,
        paymentTerms: editingCustomer.paymentTerms,
        loyaltyPoints: editingCustomer.loyaltyPoints,
        status: editingCustomer.status,
        notes: editingCustomer.notes,
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

  const getFilteredCustomers = () => {
    return customers.filter(customer => {
      const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           customer.phone.includes(searchTerm);
      const tier = getCustomerTier(customer.loyaltyPoints);
      const matchesTier = filterTier === 'all' || tier.value === filterTier;
      return matchesSearch && matchesTier;
    });
  };

  const filteredCustomers = getFilteredCustomers();
  const activeCustomers = customers.filter(c => c.status === 'active').length;
  const totalLoyaltyPoints = customers.reduce((sum, c) => sum + c.loyaltyPoints, 0);
  const avgCreditLimit = customers.length > 0 
    ? customers.reduce((sum, c) => sum + c.creditLimit, 0) / customers.length 
    : 0;

  const CustomerForm = ({ customer, onChange, isEdit = false }: { 
    customer: typeof newCustomer, 
    onChange: (updates: Partial<typeof newCustomer>) => void,
    isEdit?: boolean 
  }) => (
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
          <Label htmlFor="email">Email *</Label>
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
            value={customer.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
            placeholder="+1234567890"
          />
        </div>
        <div className="col-span-2">
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            value={customer.address}
            onChange={(e) => onChange({ address: e.target.value })}
            placeholder="123 Main St"
          />
        </div>
        <div>
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={customer.city}
            onChange={(e) => onChange({ city: e.target.value })}
            placeholder="New York"
          />
        </div>
        <div>
          <Label htmlFor="country">Country</Label>
          <Input
            id="country"
            value={customer.country}
            onChange={(e) => onChange({ country: e.target.value })}
            placeholder="USA"
          />
        </div>
        <div>
          <Label htmlFor="taxId">Tax ID / VAT</Label>
          <Input
            id="taxId"
            value={customer.taxId}
            onChange={(e) => onChange({ taxId: e.target.value })}
            placeholder="Tax ID"
          />
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select
            value={customer.status}
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
            value={customer.creditLimit}
            onChange={(e) => onChange({ creditLimit: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div>
          <Label htmlFor="paymentTerms">Payment Terms (days)</Label>
          <Input
            id="paymentTerms"
            value={customer.paymentTerms}
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
            value={customer.loyaltyPoints}
            onChange={(e) => onChange({ loyaltyPoints: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div className="col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={customer.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder="Additional notes about the customer..."
            rows={3}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {isMobile ? <MobileHeader title="Customer Management" /> : null}
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {!isMobile && <BackButton />}
            <h1 className="text-2xl font-bold">Customer Management (CRM)</h1>
          </div>
          <Dialog open={isAddingCustomer} onOpenChange={setIsAddingCustomer}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Customer
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Customer</DialogTitle>
                <DialogDescription>Create a new customer profile</DialogDescription>
              </DialogHeader>
              <CustomerForm
                customer={newCustomer}
                onChange={(updates) => setNewCustomer({ ...newCustomer, ...updates })}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddingCustomer(false)}>Cancel</Button>
                <Button onClick={handleAddCustomer}>Add Customer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-gray-500" />
                <div>
                  <div className="text-2xl font-bold">{customers.length}</div>
                  <p className="text-xs text-gray-500">Total Customers</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-gray-500" />
                <div>
                  <div className="text-2xl font-bold">{activeCustomers}</div>
                  <p className="text-xs text-gray-500">Active Customers</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-gray-500" />
                <div>
                  <div className="text-2xl font-bold">{totalLoyaltyPoints.toLocaleString()}</div>
                  <p className="text-xs text-gray-500">Total Loyalty Points</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-gray-500" />
                <div>
                  <div className="text-2xl font-bold">${avgCreditLimit.toFixed(0)}</div>
                  <p className="text-xs text-gray-500">Avg Credit Limit</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-4 mb-6">
          <Input
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
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500">No customers found.</p>
              </CardContent>
            </Card>
          ) : (
            filteredCustomers.map((customer) => {
              const tier = getCustomerTier(customer.loyaltyPoints);
              return (
                <Card key={customer.id}>
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
                        <p className="font-bold text-purple-600">{customer.loyaltyPoints}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Credit Limit</p>
                        <p className="font-medium">${customer.creditLimit.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Payment Terms</p>
                        <p className="font-medium">{customer.paymentTerms} days</p>
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
                </Card>
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
                onChange={(updates) => setEditingCustomer({ ...editingCustomer, ...updates })}
                isEdit
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingCustomer(null)}>Cancel</Button>
                <Button onClick={handleUpdateCustomer}>Update Customer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </main>
    </div>
  );
};

export default AdminCustomers;
