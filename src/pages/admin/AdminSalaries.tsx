import React, { useState, useEffect, useRef } from 'react';
import { getFirestore, collection, query, where, getDocs, doc, updateDoc, deleteField } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SalaryPayment } from '@/types/staff';
import {
  buildPayrollRoster,
  canReactivateStaff,
  formatStaffPayLine,
  formatStaffRoleLabel,
  hourlyMonthSummary,
  partitionStaffByEmploymentStatus,
  resolveDailyRate,
  resolveHourlyRate,
  resolvePaymentFrequency,
  resolveStaffStatus,
  resolveMonthPayrollDue,
  formatTimesheetTotals,
  type StaffPayrollRecord,
} from '@/lib/staffPayrollDisplay';
import {
  computeDailyPayAmount,
  computeHourlyPayAmount,
  defaultPayAmount,
  isStaffPaidForMonth,
  processStaffPayrollPayment,
} from '@/lib/staffPayrollPayment';
import {
  normalizeStoreSalaryPayments,
  paymentsForMonth,
  paymentsForStaffMember,
  sumPaymentTotals,
  type NormalizedSalaryPayment,
} from '@/lib/staffPayrollStats';
import { logAction } from '@/lib/auditLog';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import AdminSideSheet from '@/components/admin/AdminSideSheet';
import { getActualStoreId, resolveStoreIdForAuthUser } from '@/lib/storeUtils';

const formatMoney = (value?: number | null) => Number(value ?? 0).toFixed(2);
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const emptyPayForm = () => ({
  staffId: '',
  hourlyRate: '',
  hours: '',
  dailyRate: '',
  days: '',
  baseAmount: '',
  transportAmount: '',
  paymentMethod: 'cash' as 'cash' | 'bank',
  notes: '',
});

const AdminSalaries: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [staff, setStaff] = useState<StaffPayrollRecord[]>([]);
  const [payments, setPayments] = useState<NormalizedSalaryPayment[]>([]);
  const [paymentsLoadError, setPaymentsLoadError] = useState<string | null>(null);
  const [payrollStoreId, setPayrollStoreId] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const isProcessingPaymentRef = useRef(false);
  const [payForm, setPayForm] = useState(emptyPayForm());

  const selectedStaff = staff.find((member) => member.id === payForm.staffId) || null;
  const selectedIsHourly = selectedStaff ? resolvePaymentFrequency(selectedStaff) === 'hourly' : false;
  const selectedIsDaily = selectedStaff ? resolvePaymentFrequency(selectedStaff) === 'daily' : false;
  const selectedIsPaid = selectedStaff
    ? isStaffPaidForMonth(payments, selectedStaff.id, selectedMonth)
    : false;

  const applyStaffToPayForm = (member: StaffPayrollRecord) => {
    const freq = resolvePaymentFrequency(member);
    const isHourly = freq === 'hourly';
    const isDaily = freq === 'daily';
    const monthStats = isHourly ? hourlyMonthSummary(member, selectedMonth) : null;
    const suggestedPay = isHourly || isDaily ? 0 : defaultPayAmount(member, selectedMonth);
    const hourlyRate = isHourly ? monthStats?.hourlyRateUsd || resolveHourlyRate(member) : 0;
    const hours =
      isHourly && monthStats && monthStats.totalHours > 0
        ? monthStats.totalHours
        : isHourly && monthStats && monthStats.payUsd > 0 && hourlyRate > 0
          ? roundMoney(monthStats.payUsd / hourlyRate)
          : 0;
    const hourlyPay = isHourly ? computeHourlyPayAmount(String(hourlyRate || ''), String(hours || '')) : 0;
    const dailyRate = isDaily ? resolveDailyRate(member) : 0;

    setPayForm({
      staffId: member.id,
      hourlyRate: isHourly ? String(hourlyRate || '') : '',
      hours: isHourly ? String(hours || '') : '',
      dailyRate: isDaily ? String(dailyRate || '') : '',
      days: '',
      baseAmount: isHourly ? String(hourlyPay || '') : isDaily ? '0' : String(suggestedPay || ''),
      transportAmount: '',
      paymentMethod: 'cash',
      notes: '',
    });
  };

  const updateHourlyPayForm = (patch: Partial<ReturnType<typeof emptyPayForm>>) => {
    setPayForm((prev) => {
      const next = { ...prev, ...patch };
      const member = staff.find((s) => s.id === next.staffId);
      if (member && resolvePaymentFrequency(member) === 'hourly') {
        next.baseAmount = String(computeHourlyPayAmount(next.hourlyRate, next.hours));
      }
      return next;
    });
  };

  const updateDailyPayForm = (patch: Partial<ReturnType<typeof emptyPayForm>>) => {
    setPayForm((prev) => {
      const next = { ...prev, ...patch };
      const member = staff.find((s) => s.id === next.staffId);
      if (member && resolvePaymentFrequency(member) === 'daily') {
        next.baseAmount = String(computeDailyPayAmount(next.dailyRate, next.days));
      }
      return next;
    });
  };

  const resolvedPayBaseAmount = () => {
    if (selectedIsHourly) return computeHourlyPayAmount(payForm.hourlyRate, payForm.hours);
    if (selectedIsDaily) return computeDailyPayAmount(payForm.dailyRate, payForm.days);
    return Number(payForm.baseAmount) || 0;
  };

  const resolvedPayTotalAmount = () =>
    roundMoney(resolvedPayBaseAmount() + (Number(payForm.transportAmount) || 0));

  const payTypeLabel = (member: StaffPayrollRecord) => {
    const freq = resolvePaymentFrequency(member);
    if (freq === 'hourly') return 'Hourly';
    if (freq === 'daily') return 'Daily';
    return 'Monthly';
  };

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      if (!user?.id) return;
      const db = getFirestore();

      try {
        const storeId =
          getActualStoreId(user) ||
          (await resolveStoreIdForAuthUser(user.id));
        if (cancelled || !storeId) return;
        setPayrollStoreId(storeId);

        const staffSnapshot = await getDocs(
          query(collection(db, 'staff'), where('storeId', '==', storeId)),
        );
        const staffList: StaffPayrollRecord[] = staffSnapshot.docs.map((staffDoc) => ({
          id: staffDoc.id,
          ...staffDoc.data(),
        } as StaffPayrollRecord));
        if (!cancelled) {
          setStaff(buildPayrollRoster(staffList));
        }

        try {
          const paymentsSnapshot = await getDocs(
            query(collection(db, 'salaryPayments'), where('storeId', '==', storeId)),
          );
          const rawPayments = paymentsSnapshot.docs.map(
            (paymentDoc) => ({ id: paymentDoc.id, ...paymentDoc.data() } as SalaryPayment),
          );
          if (!cancelled) {
            setPayments(
              normalizeStoreSalaryPayments(rawPayments, staffList).sort(
                (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime(),
              ),
            );
            setPaymentsLoadError(null);
          }
        } catch (paymentError) {
          console.error('Failed to load salary payments:', paymentError);
          if (!cancelled) {
            setPayments([]);
            setPaymentsLoadError(
              paymentError instanceof Error ? paymentError.message : 'Could not load salary payments.',
            );
          }
        }
      } catch (error) {
        console.error('Failed to load salaries:', error);
        if (!cancelled) setStaff([]);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.storeId]);

  const handleProcessPayment = async () => {
    if (isProcessingPaymentRef.current) return;

    if (!payForm.staffId || !selectedStaff || !user?.id) {
      toast({ title: 'Error', description: 'Please select an employee.', variant: 'destructive' });
      return;
    }

    if (selectedIsPaid) {
      toast({
        title: 'Already paid',
        description: `${selectedStaff.name || selectedStaff.staffName} is already marked paid for ${selectedMonth}.`,
        variant: 'destructive',
      });
      return;
    }

    const baseAmount = resolvedPayBaseAmount();
    const transportAmount = Number(payForm.transportAmount || 0);
    const hourlyRate = Number(payForm.hourlyRate || 0);
    const hoursWorked = Number(payForm.hours || 0);
    const dailyRate = Number(payForm.dailyRate || 0);
    const daysWorked = Number(payForm.days || 0);

    if (selectedIsHourly) {
      if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
        toast({ title: 'Error', description: 'Enter a valid hourly rate.', variant: 'destructive' });
        return;
      }
      if (!Number.isFinite(hoursWorked) || hoursWorked <= 0) {
        toast({ title: 'Error', description: 'Enter hours worked for this month.', variant: 'destructive' });
        return;
      }
    } else if (selectedIsDaily) {
      if (!Number.isFinite(dailyRate) || dailyRate <= 0) {
        toast({ title: 'Error', description: 'Enter a valid daily rate.', variant: 'destructive' });
        return;
      }
      if (!Number.isFinite(daysWorked) || daysWorked <= 0) {
        toast({ title: 'Error', description: 'Enter days worked for this month.', variant: 'destructive' });
        return;
      }
    } else if (!Number.isFinite(baseAmount) || baseAmount < 0) {
      toast({ title: 'Error', description: 'Enter a valid monthly pay amount.', variant: 'destructive' });
      return;
    }
    if (!Number.isFinite(transportAmount) || transportAmount < 0) {
      toast({ title: 'Error', description: 'Enter transport amount (0 if none).', variant: 'destructive' });
      return;
    }
    if (baseAmount + transportAmount <= 0) {
      toast({ title: 'Error', description: 'Pay plus transport must be greater than zero.', variant: 'destructive' });
      return;
    }

    isProcessingPaymentRef.current = true;

    try {
      const storeId =
        payrollStoreId ||
        getActualStoreId(user) ||
        (await resolveStoreIdForAuthUser(user.id));
      if (!storeId) {
        toast({ title: 'Error', description: 'Could not resolve store for this account.', variant: 'destructive' });
        return;
      }

      const db = getFirestore();
      const result = await processStaffPayrollPayment({
        db,
        storeId,
        staff: selectedStaff,
        month: selectedMonth,
        baseAmount,
        transportAmount,
        hourlyRate: selectedIsHourly ? hourlyRate : undefined,
        hoursWorked: selectedIsHourly ? hoursWorked : undefined,
        dailyRate: selectedIsDaily ? dailyRate : undefined,
        daysWorked: selectedIsDaily ? daysWorked : undefined,
        paymentMethod: payForm.paymentMethod,
        notes: payForm.notes,
        actor: { id: user.id, name: user.name, role: user.role },
      });

      const paymentsSnapshot = await getDocs(
        query(collection(db, 'salaryPayments'), where('storeId', '==', storeId)),
      );
      const rawPayments = paymentsSnapshot.docs.map(
        (paymentDoc) => ({ id: paymentDoc.id, ...paymentDoc.data() } as SalaryPayment),
      );
      setPayments(
        normalizeStoreSalaryPayments(rawPayments, staff).sort(
          (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime(),
        ),
      );
      setPaymentsLoadError(null);

      await logAction(
        user.id,
        user.name,
        user.role,
        'create',
        'salaryPayment',
        result.paymentId,
        {
          newValue: {
            staffId: selectedStaff.id,
            month: selectedMonth,
            baseAmount,
            transportAmount,
            totalAmount: result.totalAmount,
            idempotentReplay: result.idempotentReplay,
          },
        },
        storeId,
      );

      toast({
        title: result.idempotentReplay ? 'Already paid' : 'Payment recorded',
        description: result.idempotentReplay
          ? `${selectedStaff.name || selectedStaff.staffName} was already paid for ${selectedMonth}.`
          : `${selectedStaff.name || selectedStaff.staffName}: $${result.totalAmount.toFixed(2)} posted.`,
      });

      setPayForm(emptyPayForm());
      setIsProcessingPayment(false);
    } catch (error) {
      console.error('Error processing payment:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to process payment',
        variant: 'destructive',
      });
    } finally {
      isProcessingPaymentRef.current = false;
    }
  };

  const { active: activeStaff, inactive: inactiveStaff } = partitionStaffByEmploymentStatus(staff);
  const monthPayments = paymentsForMonth(payments, selectedMonth);
  const monthTotals = sumPaymentTotals(monthPayments);
  const monthExcelDue = roundMoney(
    activeStaff.reduce((sum, member) => sum + resolveMonthPayrollDue(member, selectedMonth), 0),
  );
  const monthOutstanding = roundMoney(Math.max(0, monthExcelDue - monthTotals.totalPaid));
  const monthPaidCount = monthTotals.count;
  const monthDueWithExcel = activeStaff.filter(
    (m) => resolveMonthPayrollDue(m, selectedMonth) > 0,
  ).length;

  const openMarkPaidForMember = (member: StaffPayrollRecord) => {
    applyStaffToPayForm(member);
    setIsProcessingPayment(true);
  };

  const handleReactivateStaff = async (member: StaffPayrollRecord) => {
    try {
      const db = getFirestore();
      await updateDoc(doc(db, 'staff', member.id), {
        status: 'active',
        isActive: true,
        endDate: deleteField(),
        updatedAt: new Date().toISOString(),
      });
      setStaff((prev) =>
        prev.map((s) =>
          s.id === member.id
            ? { ...s, status: 'active', isActive: true, endDate: undefined }
            : s,
        ),
      );
      toast({
        title: 'Employee re-activated',
        description: `${member.name || member.staffName} is active again.`,
      });
    } catch (error) {
      console.error('Failed to re-activate staff:', error);
      toast({ title: 'Error', description: 'Could not re-activate employee', variant: 'destructive' });
    }
  };

  const getStaffPayments = (staffId: string) => paymentsForStaffMember(payments, staffId);

  const renderSalaryOverviewCard = (member: StaffPayrollRecord) => {
    const memberPayments = getStaffPayments(member.id);
    const currentMonthPayment = memberPayments.find((p) => p.month === selectedMonth);
    const excelDue = resolveMonthPayrollDue(member, selectedMonth);
    const monthStats =
      resolvePaymentFrequency(member) === 'hourly'
        ? hourlyMonthSummary(member, selectedMonth)
        : null;
    const timesheetLine = formatTimesheetTotals(member, selectedMonth);
    const displayName = member.name || member.staffName || 'Employee';
    const status = resolveStaffStatus(member);
    const isPaid = Boolean(currentMonthPayment);

    return (
      <AdminPanel key={member.id}>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 flex-wrap">
                {displayName}
                {status !== 'active' ? <Badge variant="secondary">{status}</Badge> : null}
                {isPaid ? <Badge variant="default">Paid {selectedMonth}</Badge> : null}
              </CardTitle>
              <CardDescription>
                {formatStaffRoleLabel(member)} · {formatStaffPayLine(member)}
                {timesheetLine ? ` · ${timesheetLine}` : ''}
              </CardDescription>
            </div>
            {canReactivateStaff(member) ? (
              <Button size="sm" onClick={() => handleReactivateStaff(member)}>
                Re-activate
              </Button>
            ) : status === 'active' && !isPaid && excelDue > 0 ? (
              <Button size="sm" onClick={() => openMarkPaidForMember(member)}>
                Mark paid
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-500">Excel due ({selectedMonth})</p>
              <p className="font-bold">${formatMoney(excelDue)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Paid this month</p>
              <p className="font-bold text-green-600">
                ${formatMoney(currentMonthPayment?.totalAmount ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Outstanding</p>
              <p className="font-medium">
                ${formatMoney(Math.max(0, excelDue - Number(currentMonthPayment?.totalAmount ?? 0)))}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Mark-paid records</p>
              <p className="font-medium">{memberPayments.length}</p>
            </div>
          </div>
          {currentMonthPayment && (
            <div className="border-t pt-3 text-sm">
              <span className="text-gray-500">Posted:</span>{' '}
              <span className="font-bold">${formatMoney(currentMonthPayment.totalAmount)}</span>
              {currentMonthPayment.hoursWorked && currentMonthPayment.hourlyRate ? (
                <span className="text-muted-foreground">
                  {' '}
                  · {Number(currentMonthPayment.hoursWorked).toFixed(2)}h × $
                  {Number(currentMonthPayment.hourlyRate).toFixed(2)}
                </span>
              ) : null}
            </div>
          )}
          {monthStats && monthStats.shiftCount > 0 ? (
            <p className="text-xs text-muted-foreground mt-2">
              {selectedMonth}: {monthStats.shiftCount} shifts from Excel
            </p>
          ) : null}
        </CardContent>
      </AdminPanel>
    );
  };
  const getCurrentMonthPayments = () => monthPayments;
  const getTotalPaid = () => monthTotals.totalPaid;

  return (
    <AdminPageShell
      title="Salary Management"
      description={`${selectedMonth}: amounts from USB Excel — use Mark paid to post cash. Legacy POS salary rows are hidden.`}
      eyebrow="Business Tools"
      actions={(
        <div className="flex flex-wrap gap-2">
          <Input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-48"
          />
          <Button onClick={() => setIsProcessingPayment(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Make payment
          </Button>
        </div>
      )}
    >

        {paymentsLoadError ? (
          <AdminPanel className="mb-4 border-amber-200 bg-amber-50">
            <CardContent className="pt-6 text-sm text-amber-900">
              Salary payments could not load ({paymentsLoadError}). Summary cards stay at zero until this is fixed — try refresh or re-login.
            </CardContent>
          </AdminPanel>
        ) : null}

        <AdminSideSheet
          open={isProcessingPayment}
          onOpenChange={(open) => {
            setIsProcessingPayment(open);
            if (!open) setPayForm(emptyPayForm());
          }}
          title={
            selectedStaff
              ? `Make payment — ${selectedStaff.name || selectedStaff.staffName}`
              : 'Make payment'
          }
          description={
            selectedStaff
              ? `${payTypeLabel(selectedStaff)} · ${formatStaffPayLine(selectedStaff)} · ${selectedMonth}${
                  selectedIsPaid ? ' · Already paid this month' : ''
                }`
              : `Record payroll for ${selectedMonth}`
          }
          footer={
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setIsProcessingPayment(false);
                  setPayForm(emptyPayForm());
                }}
              >
                Cancel
              </Button>
              <Button
                className="ml-2"
                onClick={handleProcessPayment}
                disabled={!payForm.staffId || selectedIsPaid}
              >
                Confirm payment
              </Button>
            </>
          }
        >
          <div className="grid gap-4">
            <div>
              <Label htmlFor="staffId">Employee *</Label>
              <Select
                value={payForm.staffId}
                onValueChange={(value) => {
                  const member = staff.find((s) => s.id === value);
                  if (member) applyStaffToPayForm(member);
                }}
              >
                <SelectTrigger id="staffId">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {activeStaff.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name || member.staffName} — {payTypeLabel(member)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedStaff && selectedIsPaid ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                This employee is already paid for {selectedMonth}. Pick another month or another employee.
              </div>
            ) : null}

            {selectedStaff && !selectedIsPaid && selectedIsHourly ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="pay-rate">Hourly rate (USD) *</Label>
                    <Input
                      id="pay-rate"
                      type="number"
                      min="0"
                      step="0.01"
                      value={payForm.hourlyRate}
                      onChange={(e) => updateHourlyPayForm({ hourlyRate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="pay-hours">Hours worked *</Label>
                    <Input
                      id="pay-hours"
                      type="number"
                      min="0"
                      step="0.01"
                      value={payForm.hours}
                      onChange={(e) => updateHourlyPayForm({ hours: e.target.value })}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground -mt-2">
                  {(() => {
                    const stats = hourlyMonthSummary(selectedStaff, selectedMonth);
                    if (stats.hasExcelData || stats.shiftCount > 0) {
                      return `${selectedMonth}: prefilled from Excel (${stats.shiftCount} shifts · $${stats.payUsd.toFixed(2)}).`;
                    }
                    return 'Enter rate and hours manually when Excel tab is empty.';
                  })()}
                </p>
                <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm flex justify-between">
                  <span>Pay (rate × hours)</span>
                  <span className="font-medium">${resolvedPayBaseAmount().toFixed(2)}</span>
                </div>
              </>
            ) : null}

            {selectedStaff && !selectedIsPaid && selectedIsDaily ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="pay-daily-rate">Daily rate (USD) *</Label>
                    <Input
                      id="pay-daily-rate"
                      type="number"
                      min="0"
                      step="0.01"
                      value={payForm.dailyRate}
                      onChange={(e) => updateDailyPayForm({ dailyRate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="pay-days">Days worked *</Label>
                    <Input
                      id="pay-days"
                      type="number"
                      min="0"
                      step="1"
                      value={payForm.days}
                      onChange={(e) => updateDailyPayForm({ days: e.target.value })}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground -mt-2">
                  Daily employee — {formatStaffPayLine(selectedStaff)} · enter days worked in {selectedMonth}.
                </p>
                <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm flex justify-between">
                  <span>Pay (daily rate × days)</span>
                  <span className="font-medium">${resolvedPayBaseAmount().toFixed(2)}</span>
                </div>
              </>
            ) : null}

            {selectedStaff && !selectedIsPaid && !selectedIsHourly && !selectedIsDaily ? (
              <div>
                <Label htmlFor="pay-base">Monthly pay (USD) *</Label>
                <Input
                  id="pay-base"
                  type="number"
                  min="0"
                  step="0.01"
                  value={payForm.baseAmount}
                  onChange={(e) => setPayForm((prev) => ({ ...prev, baseAmount: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Default monthly salary for {selectedMonth}
                </p>
              </div>
            ) : null}

            {selectedStaff && !selectedIsPaid ? (
              <>
                <div>
                  <Label htmlFor="pay-transport">Transport (USD) *</Label>
                  <Input
                    id="pay-transport"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={payForm.transportAmount}
                    onChange={(e) => setPayForm((prev) => ({ ...prev, transportAmount: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="pay-method">Payment method</Label>
                  <Select
                    value={payForm.paymentMethod}
                    onValueChange={(value: 'cash' | 'bank') =>
                      setPayForm((prev) => ({ ...prev, paymentMethod: value }))
                    }
                  >
                    <SelectTrigger id="pay-method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank">Bank</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="pay-notes">Notes</Label>
                  <Input
                    id="pay-notes"
                    value={payForm.notes}
                    onChange={(e) => setPayForm((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Optional"
                  />
                </div>
                <div className="rounded-md border px-4 py-3 space-y-2 text-sm">
                  {selectedIsHourly ? (
                    <>
                      <div className="flex justify-between text-muted-foreground">
                        <span>
                          ${Number(payForm.hourlyRate || 0).toFixed(2)}/hr × {Number(payForm.hours || 0).toFixed(2)} hrs
                        </span>
                        <span>${resolvedPayBaseAmount().toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Transport</span>
                        <span>${(Number(payForm.transportAmount) || 0).toFixed(2)}</span>
                      </div>
                    </>
                  ) : selectedIsDaily ? (
                    <>
                      <div className="flex justify-between text-muted-foreground">
                        <span>
                          ${Number(payForm.dailyRate || 0).toFixed(2)}/day × {Number(payForm.days || 0).toFixed(0)} days
                        </span>
                        <span>${resolvedPayBaseAmount().toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Transport</span>
                        <span>${(Number(payForm.transportAmount) || 0).toFixed(2)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Monthly pay</span>
                      <span>${resolvedPayBaseAmount().toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold border-t pt-2">
                    <span>Total</span>
                    <span>${resolvedPayTotalAmount().toFixed(2)}</span>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </AdminSideSheet>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <AdminPanel>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">${monthExcelDue.toFixed(2)}</div>
              <p className="text-xs text-gray-500">Excel due ({selectedMonth})</p>
            </CardContent>
          </AdminPanel>
          <AdminPanel>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-700">${monthTotals.totalPaid.toFixed(2)}</div>
              <p className="text-xs text-gray-500">Marked paid ({monthPaidCount})</p>
            </CardContent>
          </AdminPanel>
          <AdminPanel>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">${monthOutstanding.toFixed(2)}</div>
              <p className="text-xs text-gray-500">Still to pay</p>
            </CardContent>
          </AdminPanel>
          <AdminPanel>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{monthDueWithExcel}</div>
              <p className="text-xs text-gray-500">Employees with Excel rows</p>
            </CardContent>
          </AdminPanel>
        </div>

        <div className="grid gap-4">
          <h2 className="text-xl font-semibold">Staff Salary Overview</h2>
          {staff.length === 0 ? (
            <AdminPanel>
              <CardContent className="py-12 text-center">
                <DollarSign className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500">No payroll employees yet.</p>
              </CardContent>
            </AdminPanel>
          ) : (
            <div className="space-y-6">
              {activeStaff.length > 0 ? (
                <div className="space-y-4">
                  {inactiveStaff.length > 0 ? (
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Active employees ({activeStaff.length})
                    </h3>
                  ) : null}
                  {activeStaff.map(renderSalaryOverviewCard)}
                </div>
              ) : null}
              {inactiveStaff.length > 0 ? (
                <div className="space-y-4 border-t pt-6">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Inactive employees ({inactiveStaff.length})
                  </h3>
                  {inactiveStaff.map(renderSalaryOverviewCard)}
                </div>
              ) : null}
            </div>
          )}
        </div>
    </AdminPageShell>
  );
};

export default AdminSalaries;
