import React, { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '@/context/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Edit3, UserPlus, AlertCircle, Mail, Phone, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SubAccount, SubAccountRole, ROLE_PERMISSIONS } from '@/types/subaccount';
import { logAction } from '@/lib/auditLog';
import MobileHeader from '@/components/MobileHeader';
import BackButton from '@/components/BackButton';
import { useIsMobile } from '@/hooks/use-mobile';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';

const AdminSubAccounts: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [subAccounts, setSubAccounts] = useState<SubAccount[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SubAccount | null>(null);
  const [newAccount, setNewAccount] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'sales' as SubAccountRole,
    commissionRate: 0,
    kmRate: 0,
  });

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
      
      // Also create user profile
      await addDoc(collection(db, 'users'), {
        uid: userCredential.user.uid,
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
      await deleteDoc(doc(db, 'subAccounts', accountId));
      const deletedAccount = subAccounts.find(a => a.id === accountId);
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

      toast({ title: "Success", description: "Sub-account removed successfully!" });
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

  const activeCount = subAccounts.filter(a => a.status === 'active').length;

  return (
    <div className="min-h-screen bg-gray-50">
      {isMobile ? <MobileHeader title="Sub-Accounts" /> : null}
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {!isMobile && <BackButton />}
            <h1 className="text-2xl font-bold">Sub-Accounts (Team Login)</h1>
          </div>
          <Dialog open={isAdding} onOpenChange={setIsAdding}>
            <DialogTrigger asChild>
              <Button disabled={activeCount >= MAX_SUB_ACCOUNTS}>
                <UserPlus className="mr-2 h-4 w-4" />
                Add Sub-Account
              </Button>
            </DialogTrigger>
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
                      onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={newAccount.phone}
                      onChange={(e) => setNewAccount({ ...newAccount, phone: e.target.value })}
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
                    onChange={(e) => setNewAccount({ ...newAccount, email: e.target.value })}
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
                    onChange={(e) => setNewAccount({ ...newAccount, password: e.target.value })}
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
                      <SelectItem value="sales">Sales Person - Can create orders, manage customers</SelectItem>
                      <SelectItem value="delivery">Delivery Person - Can view orders and manage deliveries</SelectItem>
                      <SelectItem value="manager">Manager - Full access to all features</SelectItem>
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
                    <p className="text-xs text-gray-500 mt-1">Percentage commission on sales</p>
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
        </div>

        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Sub-Accounts:</strong> These are separate login accounts for team members. They can sign in and use the system based on their role. 
            This is different from Staff Management (which tracks salaries). Active: {activeCount}/{MAX_SUB_ACCOUNTS}
          </AlertDescription>
        </Alert>

        <div className="grid gap-4">
          {subAccounts.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-gray-500">No sub-accounts yet. Create one to give team members access.</p>
              </CardContent>
            </Card>
          ) : (
            subAccounts.map(account => (
              <Card key={account.id}>
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
              </Card>
            ))
          )}
        </div>
      </main>

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
                  <p className="text-xs text-gray-500 mt-1">Percentage commission on sales</p>
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
    </div>
  );
};

export default AdminSubAccounts;
