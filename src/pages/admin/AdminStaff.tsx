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
import { Trash2, Plus, Edit3, Users, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { StaffMember } from '@/types/staff';
import { logAction } from '@/lib/auditLog';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import { Alert, AlertDescription } from '@/components/ui/alert';

const AdminStaff: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [newStaff, setNewStaff] = useState({
    name: '',
    phone: '',
    role: '',
    salary: 0,
    paymentFrequency: 'monthly' as const,
  });

  useEffect(() => {
    const fetchStaff = async () => {
      if (!user?.storeId) return;
      const db = getFirestore();

      const staffRef = collection(db, 'staff');
      const staffQuery = query(staffRef, where('storeId', '==', user.storeId));
      const staffSnapshot = await getDocs(staffQuery);
      const staffList: StaffMember[] = staffSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as StaffMember));
      setStaff(staffList);
    };
    fetchStaff();
  }, [user?.storeId]);

  const handleAddStaff = async () => {
    if (!newStaff.name || !newStaff.role || !user?.storeId) {
      toast({ title: "Error", description: "Name and role are required", variant: "destructive" });
      return;
    }

    try {
      const db = getFirestore();
      const staffData = {
        ...newStaff,
        status: 'active' as const,
        hireDate: new Date().toISOString(),
        storeId: user.storeId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, 'staff'), staffData);
      setStaff([...staff, { id: docRef.id, ...staffData }]);

      await logAction(
        user.id,
        user.name,
        user.role,
        'create',
        'staffMember',
        docRef.id,
        { newValue: staffData },
        user.storeId
      );

      setNewStaff({
        name: '',
        phone: '',
        role: '',
        salary: 0,
        paymentFrequency: 'monthly',
      });
      setIsAddingStaff(false);
      toast({ title: "Success", description: "Staff member added successfully!" });
    } catch (error) {
      console.error('Error adding staff:', error);
      toast({ title: "Error", description: "Failed to add staff member", variant: "destructive" });
    }
  };

  const handleUpdateStaff = async () => {
    if (!editingStaff || !user?.storeId) return;

    try {
      const db = getFirestore();
      const staffRef = doc(db, 'staff', editingStaff.id);

      const updatedData = {
        ...editingStaff,
        updatedAt: new Date().toISOString(),
      };

      await updateDoc(staffRef, updatedData);
      setStaff(staff.map(s => s.id === editingStaff.id ? updatedData : s));

      const oldStaff = staff.find(s => s.id === editingStaff.id);
      await logAction(
        user.id,
        user.name,
        user.role,
        'update',
        'staffMember',
        editingStaff.id,
        { oldValue: oldStaff, newValue: updatedData },
        user.storeId
      );

      setEditingStaff(null);
      toast({ title: "Success", description: "Staff member updated successfully!" });
    } catch (error) {
      console.error('Error updating staff:', error);
      toast({ title: "Error", description: "Failed to update staff member", variant: "destructive" });
    }
  };

  const handleDeleteStaff = async (staffId: string) => {
    if (!confirm('Are you sure you want to remove this staff member? This will terminate their employment and remove future salary expenses.')) return;

    try {
      const db = getFirestore();
      const deletedStaff = staff.find(s => s.id === staffId);
      const today = new Date().toISOString().split('T')[0];
      
      // Mark staff as terminated with end date instead of deleting
      const staffRef = doc(db, 'staff', staffId);
      await updateDoc(staffRef, {
        status: 'terminated',
        endDate: today,
        updatedAt: new Date().toISOString(),
      });
      
      // Delete only future/current salary expenses (today onwards) for this staff member
      const expensesRef = collection(db, 'expenses');
      const salaryExpensesQuery = query(
        expensesRef, 
        where('staffId', '==', staffId),
        where('storeId', '==', user?.storeId)
      );
      const salaryExpensesSnapshot = await getDocs(salaryExpensesQuery);
      
      // Filter and delete only expenses from today onwards (keep historical records)
      const futureExpenses = salaryExpensesSnapshot.docs.filter(doc => {
        const expenseDate = doc.data().date;
        return expenseDate >= today;
      });
      
      const deletePromises = futureExpenses.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      // Update local state to show terminated status
      setStaff(staff.map(s => s.id === staffId ? { ...s, status: 'terminated', endDate: today } : s));

      if (deletedStaff && user) {
        await logAction(
          user.id,
          user.name,
          user.role,
          'update',
          'staffMember',
          staffId,
          { oldValue: deletedStaff, newValue: { status: 'terminated', endDate: today } },
          user.storeId
        );
      }

      toast({ 
        title: "Success", 
        description: `Staff member terminated. ${futureExpenses.length} future salary expense(s) removed. Historical records preserved.` 
      });
    } catch (error) {
      console.error('Error terminating staff:', error);
      toast({ title: "Error", description: "Failed to terminate staff member", variant: "destructive" });
    }
  };

  return (
    <AdminPageShell
      title="Staff Management (Payroll)"
      description="Manage your team's payroll, roles, and employment status"
      eyebrow="Business Tools"
      actions={(
        <Dialog open={isAddingStaff} onOpenChange={setIsAddingStaff}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Staff Member
            </Button>
          </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Staff Member</DialogTitle>
                <DialogDescription>Add any employee to track their salary and payments</DialogDescription>
              </DialogHeader>
              <Alert className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This is for payroll tracking only. For team members who need to login, use Sub-Accounts instead.
                </AlertDescription>
              </Alert>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={newStaff.name}
                      onChange={(e) => setNewStaff(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={newStaff.phone}
                      onChange={(e) => setNewStaff(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+961 ..."
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="role">Job Title / Role *</Label>
                    <Input
                      id="role"
                      value={newStaff.role}
                      onChange={(e) => setNewStaff(prev => ({ ...prev, role: e.target.value }))}
                      placeholder="Cashier, Cook, Manager, Cleaner..."
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="salary">Salary Amount *</Label>
                    <Input
                      id="salary"
                      type="number"
                      min="0"
                      step="0.01"
                      value={newStaff.salary === 0 ? '' : newStaff.salary}
                      onChange={(e) => setNewStaff(prev => ({ ...prev, salary: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0) }))}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="paymentFrequency">Payment Frequency *</Label>
                    <Select
                      value={newStaff.paymentFrequency}
                      onValueChange={(value: any) => setNewStaff(prev => ({ ...prev, paymentFrequency: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddingStaff(false)}>Cancel</Button>
                <Button onClick={handleAddStaff}>Add Staff Member</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
      )}
    >

        {/* Staff Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <AdminPanel>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{staff.length}</div>
              <p className="text-xs text-gray-500">Total Staff</p>
            </CardContent>
          </AdminPanel>
          <AdminPanel>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{staff.filter(s => s.status === 'active').length}</div>
              <p className="text-xs text-gray-500">Active Staff</p>
            </CardContent>
          </AdminPanel>
          <AdminPanel>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{staff.filter(s => s.status === 'suspended').length}</div>
              <p className="text-xs text-gray-500">Suspended</p>
            </CardContent>
          </AdminPanel>
        </div>

        {/* Staff List */}
        <div className="grid gap-4">
          {staff.length === 0 ? (
            <AdminPanel>
              <CardContent className="py-12 text-center">
                <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500">No staff members yet. Add your first team member to get started.</p>
              </CardContent>
            </AdminPanel>
          ) : (
            staff.map((member) => (
              <AdminPanel key={member.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {member.name}
                        <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
                          {member.status}
                        </Badge>
                        <Badge variant="outline">
                          {member.role === 'sales_person' ? 'Sales' : 'Delivery'}
                        </Badge>
                      </CardTitle>
                      <CardDescription>{member.email}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingStaff(member)}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteStaff(member.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-500">Salary</p>
                      <p className="font-medium">${(member.salary || 0).toFixed(2)}/{(member.paymentFrequency || 'monthly') === 'hourly' ? 'hr' : (member.paymentFrequency || 'monthly') === 'daily' ? 'day' : 'mo'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Status</p>
                      <p className="font-medium capitalize">{member.status}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Hire Date</p>
                      <p className="font-medium">{new Date(member.hireDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                  {member.phone && (
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">Phone: {member.phone}</p>
                    </div>
                  )}
                </CardContent>
              </AdminPanel>
            ))
          )}
        </div>

        {/* Edit Staff Dialog */}
        {editingStaff && (
          <Dialog open={!!editingStaff} onOpenChange={() => setEditingStaff(null)}>
            <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Staff Member</DialogTitle>
                <DialogDescription>Update staff member details</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-name">Full Name *</Label>
                    <Input
                      id="edit-name"
                      value={editingStaff.name}
                      onChange={(e) => setEditingStaff(prev => prev ? { ...prev, name: e.target.value } : null)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-phone">Phone</Label>
                    <Input
                      id="edit-phone"
                      value={editingStaff.phone || ''}
                      onChange={(e) => setEditingStaff(prev => prev ? { ...prev, phone: e.target.value } : null)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-role">Job Title / Role *</Label>
                    <Input
                      id="edit-role"
                      value={editingStaff.role}
                      onChange={(e) => setEditingStaff(prev => prev ? { ...prev, role: e.target.value } : null)}
                      placeholder="Cashier, Cook, Manager..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-status">Status</Label>
                    <Select
                      value={editingStaff.status}
                      onValueChange={(value: any) => setEditingStaff({ ...editingStaff, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                        <SelectItem value="terminated">Terminated</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-salary">Salary Amount *</Label>
                    <Input
                      id="edit-salary"
                      type="number"
                      min="0"
                      step="0.01"
                      value={editingStaff.salary}
                      onChange={(e) => setEditingStaff(prev => prev ? { ...prev, salary: parseFloat(e.target.value) || 0 } : null)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-paymentFrequency">Payment Frequency *</Label>
                    <Select
                      value={editingStaff.paymentFrequency}
                      onValueChange={(value: any) => setEditingStaff({ ...editingStaff, paymentFrequency: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingStaff(null)}>Cancel</Button>
                <Button onClick={handleUpdateStaff}>Update Staff Member</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
    </AdminPageShell>
  );
};

export default AdminStaff;
