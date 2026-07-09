import React, { useState, useEffect, useRef } from 'react';
import { getFirestore, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { DollarSign, Plus, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { StaffMember, SalaryPayment } from '@/types/staff';
import { logAction } from '@/lib/auditLog';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';

const AdminSalaries: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  
  // Double-click prevention lock
  const isProcessingPaymentRef = useRef(false);
  
  const [newPayment, setNewPayment] = useState({
    staffId: '',
    baseSalary: 0,
    commissionAmount: 0,
    bonus: 0,
    deductions: 0,
    notes: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.storeId) return;
      const db = getFirestore();

      const staffRef = collection(db, 'staff');
      const staffQuery = query(staffRef, where('storeId', '==', user.storeId));
      const staffSnapshot = await getDocs(staffQuery);
      const staffList: StaffMember[] = staffSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as StaffMember));
      setStaff(staffList.filter(s => s.status === 'active'));

      const paymentsRef = collection(db, 'salaryPayments');
      const paymentsQuery = query(paymentsRef, where('storeId', '==', user.storeId));
      const paymentsSnapshot = await getDocs(paymentsQuery);
      const paymentsList: SalaryPayment[] = paymentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as SalaryPayment));
      setPayments(paymentsList.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()));
    };
    fetchData();
  }, [user?.storeId]);

  const handleProcessPayment = async () => {
    if (isProcessingPaymentRef.current) {
      console.log('⚠️ Payment processing operation already in progress');
      return;
    }

    if (!newPayment.staffId || !user?.storeId) {
      toast({ title: "Error", description: "Please select a staff member", variant: "destructive" });
      return;
    }

    isProcessingPaymentRef.current = true;
    let operationSucceeded = false;

    try {
      const db = getFirestore();
      const totalAmount = newPayment.baseSalary + newPayment.commissionAmount + newPayment.bonus - newPayment.deductions;

      const paymentData = {
        staffId: newPayment.staffId,
        month: selectedMonth,
        baseSalary: newPayment.baseSalary,
        commissionAmount: newPayment.commissionAmount,
        bonus: newPayment.bonus,
        deductions: newPayment.deductions,
        totalAmount,
        paymentDate: new Date().toISOString(),
        notes: newPayment.notes,
        storeId: user.storeId,
        createdAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, 'salaryPayments'), paymentData);
      setPayments([{ id: docRef.id, ...paymentData }, ...payments]);

      await logAction(
        user.id,
        user.name,
        user.role,
        'create',
        'salaryPayment',
        docRef.id,
        { newValue: paymentData },
        user.storeId
      );

      operationSucceeded = true;
      toast({ title: "Success", description: "Salary payment processed successfully!" });
    } catch (error) {
      console.error('Error processing payment:', error);
      toast({ title: "Error", description: "Failed to process payment", variant: "destructive" });
    } finally {
      isProcessingPaymentRef.current = false;
      
      if (operationSucceeded) {
        setNewPayment({
          staffId: '',
          baseSalary: 0,
          commissionAmount: 0,
          bonus: 0,
          deductions: 0,
          notes: '',
        });
        setIsProcessingPayment(false);
      }
    }
  };

  const getStaffPayments = (staffId: string) => payments.filter(p => p.staffId === staffId);
  const getCurrentMonthPayments = () => payments.filter(p => p.month === selectedMonth);
  const getTotalPaid = () => getCurrentMonthPayments().reduce((sum, p) => sum + p.totalAmount, 0);

  return (
    <AdminPageShell
      title="Salary Management"
      description="Track and process staff salaries, commissions, and bonuses"
      eyebrow="Business Tools"
      actions={(
        <div className="flex flex-wrap gap-2">
          <Input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-48"
          />
          <Dialog open={isProcessingPayment} onOpenChange={setIsProcessingPayment}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Process Payment
              </Button>
            </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Process Salary Payment</DialogTitle>
                  <DialogDescription>Record salary payment for {selectedMonth}</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="staffId">Staff Member *</Label>
                    <Select
                      value={newPayment.staffId}
                      onValueChange={(value) => {
                        const selectedStaff = staff.find(s => s.id === value);
                        setNewPayment({
                          ...newPayment,
                          staffId: value,
                          baseSalary: selectedStaff?.baseSalary || 0,
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select staff member" />
                      </SelectTrigger>
                      <SelectContent>
                        {staff.map(member => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.name} - {member.role === 'sales_person' ? 'Sales' : 'Delivery'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="baseSalary">Base Salary</Label>
                      <Input
                        id="baseSalary"
                        type="number"
                        min="0"
                        step="0.01"
                        value={newPayment.baseSalary === 0 ? '' : newPayment.baseSalary}
                        onChange={(e) => setNewPayment({ ...newPayment, baseSalary: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0) })}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="commissionAmount">Commission</Label>
                      <Input
                        id="commissionAmount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={newPayment.commissionAmount === 0 ? '' : newPayment.commissionAmount}
                        onChange={(e) => setNewPayment({ ...newPayment, commissionAmount: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0) })}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="bonus">Bonus</Label>
                      <Input
                        id="bonus"
                        type="number"
                        min="0"
                        step="0.01"
                        value={newPayment.bonus === 0 ? '' : newPayment.bonus}
                        onChange={(e) => setNewPayment({ ...newPayment, bonus: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0) })}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="deductions">Deductions</Label>
                      <Input
                        id="deductions"
                        type="number"
                        min="0"
                        step="0.01"
                        value={newPayment.deductions === 0 ? '' : newPayment.deductions}
                        onChange={(e) => setNewPayment({ ...newPayment, deductions: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0) })}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div className="p-4 bg-gray-100 rounded">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total Amount:</span>
                      <span>${(newPayment.baseSalary + newPayment.commissionAmount + newPayment.bonus - newPayment.deductions).toFixed(2)}</span>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={newPayment.notes}
                      onChange={(e) => setNewPayment({ ...newPayment, notes: e.target.value })}
                      placeholder="Additional notes..."
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsProcessingPayment(false)}>Cancel</Button>
                  <Button onClick={handleProcessPayment}>Process Payment</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
        </div>
      )}
    >

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <AdminPanel>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{getCurrentMonthPayments().length}</div>
              <p className="text-xs text-gray-500">Payments This Month</p>
            </CardContent>
          </AdminPanel>
          <AdminPanel>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">${getTotalPaid().toFixed(2)}</div>
              <p className="text-xs text-gray-500">Total Paid</p>
            </CardContent>
          </AdminPanel>
          <AdminPanel>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                ${getCurrentMonthPayments().reduce((sum, p) => sum + p.commissionAmount, 0).toFixed(2)}
              </div>
              <p className="text-xs text-gray-500">Total Commissions</p>
            </CardContent>
          </AdminPanel>
          <AdminPanel>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                ${getCurrentMonthPayments().reduce((sum, p) => sum + p.baseSalary, 0).toFixed(2)}
              </div>
              <p className="text-xs text-gray-500">Base Salaries</p>
            </CardContent>
          </AdminPanel>
        </div>

        <div className="grid gap-4">
          <h2 className="text-xl font-semibold">Staff Salary Overview</h2>
          {staff.length === 0 ? (
            <AdminPanel>
              <CardContent className="py-12 text-center">
                <DollarSign className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500">No active staff members.</p>
              </CardContent>
            </AdminPanel>
          ) : (
            staff.map((member) => {
              const memberPayments = getStaffPayments(member.id);
              const currentMonthPayment = memberPayments.find(p => p.month === selectedMonth);
              const totalPaid = memberPayments.reduce((sum, p) => sum + p.totalAmount, 0);

              return (
                <AdminPanel key={member.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {member.name}
                          {currentMonthPayment && <Badge variant="default">Paid</Badge>}
                        </CardTitle>
                        <CardDescription>
                          {member.role === 'sales_person' ? 'Sales Person' : 'Delivery Person'} | Base: ${member.baseSalary.toFixed(2)}/mo
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-500">Commission Rate</p>
                        <p className="font-medium">{member.commissionRate}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Total Earned</p>
                        <p className="font-bold text-green-600">${totalPaid.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Total Commissions</p>
                        <p className="font-medium">${member.totalCommissionEarned.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Payments Count</p>
                        <p className="font-medium">{memberPayments.length}</p>
                      </div>
                    </div>
                    {currentMonthPayment && (
                      <div className="border-t pt-3">
                        <p className="text-sm font-semibold mb-2">Current Month ({selectedMonth}):</p>
                        <div className="grid grid-cols-4 gap-2 text-sm">
                          <div>
                            <span className="text-gray-500">Base:</span> ${currentMonthPayment.baseSalary.toFixed(2)}
                          </div>
                          <div>
                            <span className="text-gray-500">Commission:</span> ${currentMonthPayment.commissionAmount.toFixed(2)}
                          </div>
                          <div>
                            <span className="text-gray-500">Bonus:</span> ${currentMonthPayment.bonus.toFixed(2)}
                          </div>
                          <div>
                            <span className="text-gray-500 font-bold">Total:</span> <span className="font-bold">${currentMonthPayment.totalAmount.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </AdminPanel>
              );
            })
          )}
        </div>
    </AdminPageShell>
  );
};

export default AdminSalaries;
