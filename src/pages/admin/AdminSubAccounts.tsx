import React, { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '@/context/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Edit3, UserPlus, AlertCircle, Mail, Phone, Shield, ChevronDown, ChevronUp, TrendingUp, Users, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SubAccount, SubAccountRole, ROLE_PERMISSIONS } from '@/types/subaccount';
import { logAction } from '@/lib/auditLog';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';

const AdminSubAccounts: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subAccounts, setSubAccounts] = useState<SubAccount[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SubAccount | null>(null);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [allCustomers, setAllCustomers] = useState<any[]>([]);
  const [expandedSalesPerson, setExpandedSalesPerson] = useState<string | null>(null);
  const [expandedClients, setExpandedClients] = useState<string | null>(null);
  const [addClientDialogFor, setAddClientDialogFor] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [salesReportStart, setSalesReportStart] = useState('');
  const [salesReportEnd, setSalesReportEnd] = useState('');
  const [newAccount, setNewAccount] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'sales' as SubAccountRole,
    commissionRate: 0,
    kmRate: 0,
  });

  const ROLE_LIMITS = {
    manager: 1,
    sales: 4,
    delivery: 5,
  };
  const MAX_SUB_ACCOUNTS = 10;

  useEffect(() => {
    const fetchSubAccounts = async () => {
      if (!user?.storeId) return;
      const db = getFirestore();

      const subAccountsRef = collection(db, 'subAccounts');
      const q = query(subAccountsRef, where('storeId', '==', user.storeId));
      const snapshot = await getDocs(q);
      const accountsList: SubAccount[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as SubAccount));
      setSubAccounts(accountsList);

      // Fetch all orders for this store
      const ordersRef = collection(db, 'orders');
      const ordersQ = query(ordersRef, where('storeId', '==', user.storeId));
      const ordersSnap = await getDocs(ordersQ);
      setAllOrders(ordersSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Fetch all customers for this store
      const custSnap = await getDocs(query(collection(db, 'customers'), where('storeId', '==', user.storeId)));
      setAllCustomers(custSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchSubAccounts();
  }, [user?.storeId]);

  const handleAddSubAccount = async () => {
    if (!newAccount.name || !newAccount.email || !newAccount.password || !user?.storeId) {
      toast({ title: "Error", description: "All fields are required", variant: "destructive" });
      return;
    }

    if (subAccounts.filter(a => a.status === 'active').length >= MAX_SUB_ACCOUNTS) {
      toast({ title: "Error", description: `Maximum ${MAX_SUB_ACCOUNTS} sub-accounts allowed`, variant: "destructive" });
      return;
    }

    // Check role-specific limits
    const activeRoleCount = subAccounts.filter(a => a.status === 'active' && a.role === newAccount.role).length;
    const roleLimit = ROLE_LIMITS[newAccount.role as SubAccountRole];
    if (activeRoleCount >= roleLimit) {
      toast({ 
        title: "Error", 
        description: `Maximum ${roleLimit} ${newAccount.role} account${roleLimit > 1 ? 's' : ''} allowed`, 
        variant: "destructive" 
      });
      return;
    }

    try {
      const db = getFirestore();
      const auth = getAuth();

      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        newAccount.email,
        newAccount.password
      );

      const subAccountData = {
        storeId: user.storeId,
        name: newAccount.name,
        email: newAccount.email,
        phone: newAccount.phone,
        role: newAccount.role,
        permissions: ROLE_PERMISSIONS[newAccount.role],
        status: 'active' as const,
        createdAt: new Date().toISOString(),
        createdBy: user.id,
        updatedAt: new Date().toISOString(),
        ...(newAccount.role === 'sales' && newAccount.commissionRate > 0 ? { commissionRate: newAccount.commissionRate } : {}),
        ...(newAccount.role === 'delivery' && newAccount.kmRate > 0 ? { kmRate: newAccount.kmRate } : {}),
      };

      const docRef = await addDoc(collection(db, 'subAccounts'), subAccountData);
      
      // Also create user profile with Auth UID as document ID
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        email: newAccount.email,
        name: newAccount.name,
        role: 'sub_account',
        storeId: user.storeId,
        subAccountId: docRef.id,
        createdAt: new Date().toISOString(),
      });

      setSubAccounts([...subAccounts, { id: docRef.id, ...subAccountData }]);

      await logAction(
        user.id,
        user.name,
        user.role,
        'create',
        'subAccount',
        docRef.id,
        { newValue: subAccountData },
        user.storeId
      );

      setNewAccount({
        name: '',
        email: '',
        phone: '',
        password: '',
        role: 'sales',
        commissionRate: 0,
        kmRate: 0,
      });
      setIsAdding(false);
      toast({ 
        title: "Success", 
        description: `Sub-account created! Login: ${newAccount.email}`,
        duration: 5000,
      });
    } catch (error: any) {
      console.error('Error adding sub-account:', error);
      let errorMsg = "Failed to create sub-account";
      if (error.code === 'auth/email-already-in-use') {
        errorMsg = "Email already in use";
      } else if (error.code === 'auth/weak-password') {
        errorMsg = "Password should be at least 6 characters";
      }
      toast({ title: "Error", description: errorMsg, variant: "destructive" });
    }
  };

  const handleUpdateSubAccount = async () => {
    if (!editingAccount || !user?.storeId) return;

    try {
      const db = getFirestore();
      const accountRef = doc(db, 'subAccounts', editingAccount.id);

      const updatedData = {
        ...editingAccount,
        updatedAt: new Date().toISOString(),
      };

      await updateDoc(accountRef, updatedData);
      setSubAccounts(subAccounts.map(a => a.id === editingAccount.id ? updatedData : a));

      const oldAccount = subAccounts.find(a => a.id === editingAccount.id);
      await logAction(
        user.id,
        user.name,
        user.role,
        'update',
        'subAccount',
        editingAccount.id,
        { oldValue: oldAccount, newValue: updatedData },
        user.storeId
      );

      setEditingAccount(null);
      toast({ title: "Success", description: "Sub-account updated successfully!" });
    } catch (error) {
      console.error('Error updating sub-account:', error);
      toast({ title: "Error", description: "Failed to update sub-account", variant: "destructive" });
    }
  };

  const handleDeleteSubAccount = async (accountId: string) => {
    if (!confirm('Are you sure you want to remove this sub-account? They will no longer be able to sign in.')) return;

    try {
      const db = getFirestore();
      const deletedAccount = subAccounts.find(a => a.id === accountId);
      
      // Delete from subAccounts collection
      await deleteDoc(doc(db, 'subAccounts', accountId));
      
      // Find and delete the user document (search by subAccountId)
      const usersRef = collection(db, 'users');
      const userQuery = query(usersRef, where('subAccountId', '==', accountId));
      const userSnapshot = await getDocs(userQuery);
      
      for (const userDoc of userSnapshot.docs) {
        await deleteDoc(doc(db, 'users', userDoc.id));
      }
      
      setSubAccounts(subAccounts.filter(a => a.id !== accountId));

      if (deletedAccount && user) {
        await logAction(
          user.id,
          user.name,
          user.role,
          'delete',
          'subAccount',
          accountId,
          { oldValue: deletedAccount },
          user.storeId
        );
      }

      toast({ 
        title: "Success", 
        description: "Sub-account removed! Note: You must manually delete the user from Firebase Authentication.",
        duration: 8000,
      });
    } catch (error) {
      console.error('Error deleting sub-account:', error);
      toast({ title: "Error", description: "Failed to remove sub-account", variant: "destructive" });
    }
  };

  const getRoleBadgeColor = (role: SubAccountRole) => {
    switch (role) {
      case 'manager': return 'bg-purple-100 text-purple-800';
      case 'sales': return 'bg-blue-100 text-blue-800';
      case 'delivery': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'suspended': return 'bg-yellow-100 text-yellow-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleAddClientToSalesPerson = async (spId: string, spName: string, customer: any) => {
    const storeId = user?.storeId || user?.id;
    if (!storeId) return;
    try {
      const db = getFirestore();
      await updateDoc(doc(db, 'customers', customer.id), {
        assignedSalesPerson: spId,
        assignedSalesPersonName: spName,
      });
      setAllCustomers(prev => prev.map(c =>
        c.id === customer.id ? { ...c, assignedSalesPerson: spId, assignedSalesPersonName: spName } : c
      ));
      toast({ title: 'Client added', description: `${customer.name} linked to ${spName}` });
      setClientSearch('');
    } catch {
      toast({ title: 'Error', description: 'Failed to link client', variant: 'destructive' });
    }
  };

  const handleRemoveClientFromSalesPerson = async (customer: any) => {
    const storeId = user?.storeId || user?.id;
    if (!storeId) return;
    try {
      const db = getFirestore();
      await updateDoc(doc(db, 'customers', customer.id), {
        assignedSalesPerson: '',
        assignedSalesPersonName: '',
      });
      setAllCustomers(prev => prev.map(c =>
        c.id === customer.id ? { ...c, assignedSalesPerson: '', assignedSalesPersonName: '' } : c
      ));
      toast({ title: 'Client removed', description: `${customer.name} unlinked` });
    } catch {
      toast({ title: 'Error', description: 'Failed to unlink client', variant: 'destructive' });
    }
  };

  const activeCount = subAccounts.filter(a => a.status === 'active').length;

  return (
    <AdminPageShell
      title="Sub-Accounts (Team Login)"
      description="Create and manage login accounts for your team members."
      actions={(
        <Button disabled={activeCount >= MAX_SUB_ACCOUNTS} onClick={() => setIsAdding(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Add Sub-Account
        </Button>
      )}
    >
      <Dialog open={isAdding} onOpenChange={setIsAdding}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Sub-Account</DialogTitle>
                <DialogDescription>
                  Create a login account for a team member to access the system
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    This creates a new login account. The person can sign in with their email and password.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={newAccount.name}
                      onChange={(e) => setNewAccount(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={newAccount.phone}
                      onChange={(e) => setNewAccount(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+961 ..."
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newAccount.email}
                    onChange={(e) => setNewAccount(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="john@example.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">This will be their login username</p>
                </div>

                <div>
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newAccount.password}
                    onChange={(e) => setNewAccount(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="At least 6 characters"
                  />
                  <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
                </div>

                <div>
                  <Label htmlFor="role">Role & Permissions *</Label>
                  <Select
                    value={newAccount.role}
                    onValueChange={(value: SubAccountRole) => setNewAccount({ ...newAccount, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sales">Sales Person - Can create orders, manage customers (Max: 4)</SelectItem>
                      <SelectItem value="delivery">Delivery Person - Can view orders and manage deliveries (Max: 5)</SelectItem>
                      <SelectItem value="manager">Manager - Full access to all features (Max: 1)</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="mt-2 p-3 bg-gray-50 rounded text-xs">
                    <strong>Permissions:</strong>
                    <ul className="mt-1 ml-4 list-disc space-y-1">
                      {ROLE_PERMISSIONS[newAccount.role].map(perm => (
                        <li key={perm}>{perm.replace(/_/g, ' ')}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {newAccount.role === 'sales' && (
                  <div>
                    <Label htmlFor="commissionRate">Commission Rate (%) - Optional</Label>
                    <Input
                      id="commissionRate"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={newAccount.commissionRate === 0 ? '' : newAccount.commissionRate}
                      onChange={(e) => setNewAccount({ ...newAccount, commissionRate: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0) })}
                      placeholder="5"
                    />
                    <p className="text-xs text-gray-500 mt-1">Percentage commission on paid sales</p>
                  </div>
                )}

                {newAccount.role === 'delivery' && (
                  <div>
                    <Label htmlFor="kmRate">Pay per KM - Optional</Label>
                    <Input
                      id="kmRate"
                      type="number"
                      min="0"
                      step="0.01"
                      value={newAccount.kmRate === 0 ? '' : newAccount.kmRate}
                      onChange={(e) => setNewAccount({ ...newAccount, kmRate: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0) })}
                      placeholder="1.50"
                    />
                    <p className="text-xs text-gray-500 mt-1">Payment amount per kilometer driven</p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAdding(false)}>Cancel</Button>
                <Button onClick={handleAddSubAccount}>Create Account</Button>
              </DialogFooter>
            </DialogContent>
      </Dialog>

      <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Sub-Accounts:</strong> These are separate login accounts for team members. They can sign in and use the system based on their role. 
            This is different from Staff Management (which tracks salaries). Active: {activeCount}/{MAX_SUB_ACCOUNTS}
          </AlertDescription>
        </Alert>

        <div className="grid gap-4">
          {subAccounts.length === 0 ? (
            <AdminPanel>
              <CardContent className="pt-6">
                <p className="text-center text-gray-500">No sub-accounts yet. Create one to give team members access.</p>
              </CardContent>
            </AdminPanel>
          ) : (
            subAccounts.map(account => (
              <AdminPanel key={account.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-3">
                        {account.name}
                        <Badge className={getRoleBadgeColor(account.role)}>
                          {account.role}
                        </Badge>
                        <Badge className={getStatusBadgeColor(account.status)}>
                          {account.status}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="mt-2 space-y-1">
                        <div className="flex items-center gap-2">
                          <Mail className="h-3 w-3" />
                          <span>{account.email}</span>
                        </div>
                        {account.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-3 w-3" />
                            <span>{account.phone}</span>
                          </div>
                        )}
                        {account.lastLogin && (
                          <div className="text-xs">
                            Last login: {new Date(account.lastLogin).toLocaleString()}
                          </div>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setEditingAccount(account)}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDeleteSubAccount(account.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div>
                    <strong className="text-sm">Permissions:</strong>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {account.permissions.map(perm => (
                        <Badge key={perm} variant="outline" className="text-xs">
                          {perm.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </AdminPanel>
            ))
          )}
        </div>

        {/* ── Salesman Sales Report ── */}
        {(() => {
          const salesPersons = subAccounts.filter(a => a.role === 'sales');
          if (salesPersons.length === 0) return null;

          return (
            <div className="mt-10">
              <div className="flex items-center gap-3 mb-4">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                <h2 className="text-xl font-bold">Salesperson Report & Clients</h2>
              </div>

              {/* Date filter */}
              <div className="flex flex-wrap gap-3 items-center mb-6 p-4 bg-white rounded-lg border">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">From:</label>
                  <input
                    type="date"
                    value={salesReportStart}
                    onChange={e => setSalesReportStart(e.target.value)}
                    className="border rounded px-2 py-1 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">To:</label>
                  <input
                    type="date"
                    value={salesReportEnd}
                    onChange={e => setSalesReportEnd(e.target.value)}
                    className="border rounded px-2 py-1 text-sm"
                  />
                </div>
                {(salesReportStart || salesReportEnd) && (
                  <button
                    onClick={() => { setSalesReportStart(''); setSalesReportEnd(''); }}
                    className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="grid gap-6">
                {salesPersons.map(sp => {
                  // Clients currently linked to this salesperson
                  const linkedClients = allCustomers.filter(c =>
                    c.assignedSalesPerson === sp.id ||
                    // Also show customers who have orders assigned to this salesperson (legacy)
                    (!c.assignedSalesPerson && allOrders.some(o => o.assignedSalesPerson === sp.id && o.customerId === c.id))
                  );
                  const linkedClientIds = new Set(linkedClients.map(c => c.id));

                  // Orders from linked clients OR orders directly assigned to this salesperson (legacy data)
                  const spOrders = allOrders.filter(o => {
                    if (!linkedClientIds.has(o.customerId) && o.assignedSalesPerson !== sp.id) return false;
                    if (String(o.status).toLowerCase() === 'cancelled') return false;
                    if (salesReportStart || salesReportEnd) {
                      const d = (o.createdAt || '').slice(0, 10);
                      if (salesReportStart && d < salesReportStart) return false;
                      if (salesReportEnd && d > salesReportEnd) return false;
                    }
                    return true;
                  }).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

                  const totalSales  = spOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
                  const totalPaid   = spOrders.reduce((s, o) => s + (Number(o.amountPaid) || 0), 0);
                  const outstanding = totalSales - totalPaid;
                  const commRate    = sp.commissionRate || 0;
                  const commEarned  = totalPaid * (commRate / 100);
                  const isExpanded  = expandedSalesPerson === sp.id;
                  const isClientsExpanded = expandedClients === sp.id;

                  // Unlinked customers available to add
                  const unlinkedCustomers = allCustomers.filter(c =>
                    !c.assignedSalesPerson &&
                    c.name?.toLowerCase().includes(clientSearch.toLowerCase())
                  );

                  return (
                    <AdminPanel key={sp.id} className="border-2">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between flex-wrap gap-2">
                          <div>
                            <CardTitle className="flex items-center gap-2 flex-wrap">
                              {sp.name}
                              <Badge className="bg-blue-100 text-blue-800">Sales</Badge>
                              {commRate > 0 && (
                                <Badge className="bg-purple-100 text-purple-800">{commRate}% commission</Badge>
                              )}
                            </CardTitle>
                            <CardDescription>{sp.email}</CardDescription>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={() => setExpandedClients(isClientsExpanded ? null : sp.id)}
                              className="flex items-center gap-1 text-sm text-green-600 hover:text-green-800 border border-green-300 rounded px-2 py-1"
                            >
                              <Users size={14} />
                              Clients ({linkedClients.length})
                              {isClientsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                            <button
                              onClick={() => setExpandedSalesPerson(isExpanded ? null : sp.id)}
                              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 border border-blue-300 rounded px-2 py-1"
                            >
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              {isExpanded ? 'Hide Orders' : 'View Orders'}
                            </button>
                          </div>
                        </div>

                        {/* Summary cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                          <div className="bg-blue-50 rounded-lg p-3 text-center">
                            <div className="text-xs text-gray-500">Orders</div>
                            <div className="text-xl font-bold text-blue-700">{spOrders.length}</div>
                          </div>
                          <div className="bg-green-50 rounded-lg p-3 text-center">
                            <div className="text-xs text-gray-500">Total Sales</div>
                            <div className="text-xl font-bold text-green-700">{totalSales.toFixed(2)}</div>
                          </div>
                          <div className={`rounded-lg p-3 text-center ${outstanding > 0 ? 'bg-orange-50' : 'bg-gray-50'}`}>
                            <div className="text-xs text-gray-500">Outstanding</div>
                            <div className={`text-xl font-bold ${outstanding > 0 ? 'text-orange-600' : 'text-gray-500'}`}>{outstanding.toFixed(2)}</div>
                          </div>
                          <div className="bg-purple-50 rounded-lg p-3 text-center">
                            <div className="text-xs text-gray-500">Commission on Paid</div>
                            <div className="text-xl font-bold text-purple-700">
                              {commRate > 0 ? commEarned.toFixed(2) : '—'}
                            </div>
                            {commRate === 0 && <div className="text-xs text-gray-400">No rate set</div>}
                          </div>
                        </div>
                      </CardHeader>

                      {/* ── Client List ── */}
                      {isClientsExpanded && (
                        <CardContent className="pt-0 border-t bg-green-50/40">
                          <div className="py-3">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="font-semibold text-sm text-green-800 flex items-center gap-1">
                                <Users size={14} /> Linked Clients
                              </h3>
                              <button
                                onClick={() => setAddClientDialogFor(addClientDialogFor === sp.id ? null : sp.id)}
                                className="flex items-center gap-1 text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                              >
                                <Plus size={12} /> Add Client
                              </button>
                            </div>

                            {/* Add client search */}
                            {addClientDialogFor === sp.id && (
                              <div className="mb-3 p-3 bg-white border border-green-200 rounded-lg">
                                <input
                                  type="text"
                                  placeholder="Search unlinked customers..."
                                  value={clientSearch}
                                  onChange={e => setClientSearch(e.target.value)}
                                  className="w-full border rounded px-2 py-1 text-sm mb-2"
                                  autoFocus
                                />
                                <div className="max-h-48 overflow-y-auto space-y-1">
                                  {unlinkedCustomers.length === 0 ? (
                                    <p className="text-xs text-gray-500 text-center py-2">No unlinked customers found</p>
                                  ) : (
                                    unlinkedCustomers.slice(0, 20).map(c => (
                                      <div key={c.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded text-sm">
                                        <div>
                                          <div className="font-medium">{c.name}</div>
                                          {c.phone && <div className="text-xs text-gray-500">{c.phone}</div>}
                                        </div>
                                        <button
                                          onClick={() => handleAddClientToSalesPerson(sp.id, sp.name, c)}
                                          className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200"
                                        >
                                          Add
                                        </button>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Linked clients list */}
                            {linkedClients.length === 0 ? (
                              <p className="text-xs text-gray-500 text-center py-3">No clients linked yet. Click "Add Client" to link customers.</p>
                            ) : (
                              <div className="space-y-2">
                                {linkedClients.map(c => (
                                  <div key={c.id} className="flex items-center justify-between bg-white border border-green-100 rounded-lg px-3 py-2">
                                    <div>
                                      <div className="font-medium text-sm">{c.name}</div>
                                      {c.phone && <div className="text-xs text-gray-500">{c.phone}</div>}
                                    </div>
                                    <button
                                      onClick={() => handleRemoveClientFromSalesPerson(c)}
                                      className="text-red-500 hover:text-red-700 p-1 rounded"
                                      title="Remove client"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      )}

                      {/* ── Orders Table ── */}
                      {isExpanded && (
                        <CardContent className="pt-0 border-t">
                          {spOrders.length === 0 ? (
                            <p className="text-center text-gray-500 py-4">No orders found for linked clients in this period.</p>
                          ) : (
                            <div className="overflow-x-auto mt-3">
                              <table className="min-w-full text-sm">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-xs">Date</th>
                                    <th className="px-3 py-2 text-left text-xs">Invoice</th>
                                    <th className="px-3 py-2 text-left text-xs">Customer</th>
                                    <th className="px-3 py-2 text-right text-xs">Total</th>
                                    <th className="px-3 py-2 text-right text-xs">Paid</th>
                                    <th className="px-3 py-2 text-right text-xs">Balance</th>
                                    {commRate > 0 && <th className="px-3 py-2 text-right text-xs">Commission Paid</th>}
                                    <th className="px-3 py-2 text-left text-xs">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {spOrders.map(o => {
                                    const total     = Number(o.total) || 0;
                                    const paid      = Number(o.amountPaid) || 0;
                                    const balance   = total - paid;
                                    const orderComm = paid * (commRate / 100);
                                    return (
                                      <tr key={o.id} className="border-b hover:bg-gray-50">
                                        <td className="px-3 py-2">{new Date(o.createdAt).toLocaleDateString('en-GB')}</td>
                                        <td className="px-3 py-2">{o.invoiceNumber || '-'}</td>
                                        <td className="px-3 py-2">{o.customerName || '-'}</td>
                                        <td className="px-3 py-2 text-right">{total.toFixed(2)}</td>
                                        <td className="px-3 py-2 text-right text-green-600">{paid.toFixed(2)}</td>
                                        <td className={`px-3 py-2 text-right ${balance > 0 ? 'text-orange-600' : 'text-gray-500'}`}>{balance.toFixed(2)}</td>
                                        {commRate > 0 && <td className="px-3 py-2 text-right text-purple-600 font-medium">{orderComm.toFixed(2)}</td>}
                                        <td className="px-3 py-2">
                                          <span className={`px-2 py-1 rounded text-xs ${
                                            o.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' :
                                            o.paymentStatus === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-red-100 text-red-800'
                                          }`}>{o.paymentStatus || 'unpaid'}</span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                                <tfoot className="bg-gray-100 font-semibold">
                                  <tr>
                                    <td className="px-3 py-2" colSpan={3}>TOTAL</td>
                                    <td className="px-3 py-2 text-right">{totalSales.toFixed(2)}</td>
                                    <td className="px-3 py-2 text-right text-green-600">{totalPaid.toFixed(2)}</td>
                                    <td className={`px-3 py-2 text-right ${outstanding > 0 ? 'text-orange-600' : 'text-gray-500'}`}>{outstanding.toFixed(2)}</td>
                                    {commRate > 0 && <td className="px-3 py-2 text-right text-purple-600">{commEarned.toFixed(2)}</td>}
                                    <td className="px-3 py-2"></td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          )}
                        </CardContent>
                      )}
                    </AdminPanel>
                  );
                })}
              </div>
            </div>
          );
        })()}

      {/* Edit Dialog */}
      <Dialog open={!!editingAccount} onOpenChange={(open) => !open && setEditingAccount(null)}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Sub-Account</DialogTitle>
            <DialogDescription>Update account details and permissions</DialogDescription>
          </DialogHeader>
          {editingAccount && (
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Full Name</Label>
                  <Input
                    value={editingAccount.name}
                    onChange={(e) => setEditingAccount({ ...editingAccount, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={editingAccount.phone || ''}
                    onChange={(e) => setEditingAccount({ ...editingAccount, phone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>Role</Label>
                <Select
                  value={editingAccount.role}
                  onValueChange={(value: SubAccountRole) => 
                    setEditingAccount({ 
                      ...editingAccount, 
                      role: value, 
                      permissions: ROLE_PERMISSIONS[value] 
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales">Sales Person</SelectItem>
                    <SelectItem value="delivery">Delivery Person</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Status</Label>
                <Select
                  value={editingAccount.status}
                  onValueChange={(value: any) => setEditingAccount({ ...editingAccount, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active - Can sign in</SelectItem>
                    <SelectItem value="suspended">Suspended - Cannot sign in</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editingAccount.role === 'sales' && (
                <div>
                  <Label htmlFor="edit-commissionRate">Commission Rate (%) - Optional</Label>
                  <Input
                    id="edit-commissionRate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={(editingAccount.commissionRate || 0) === 0 ? '' : (editingAccount.commissionRate || 0)}
                    onChange={(e) => setEditingAccount({ ...editingAccount, commissionRate: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0) })}
                    placeholder="5"
                  />
                  <p className="text-xs text-gray-500 mt-1">Percentage commission on paid sales</p>
                </div>
              )}

              {editingAccount.role === 'delivery' && (
                <div>
                  <Label htmlFor="edit-kmRate">Pay per KM - Optional</Label>
                  <Input
                    id="edit-kmRate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={(editingAccount.kmRate || 0) === 0 ? '' : (editingAccount.kmRate || 0)}
                    onChange={(e) => setEditingAccount({ ...editingAccount, kmRate: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0) })}
                    placeholder="1.50"
                  />
                  <p className="text-xs text-gray-500 mt-1">Payment amount per kilometer driven</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingAccount(null)}>Cancel</Button>
            <Button onClick={handleUpdateSubAccount}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPageShell>
  );
};

export default AdminSubAccounts;
