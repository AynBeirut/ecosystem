import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, deleteField, doc } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Edit3, Users, AlertCircle, FileText, DollarSign, CheckCircle2, ChevronDown, CalendarDays } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { StaffMember, SalaryPayment } from '@/types/staff';
import {
  computeDailyPayAmount,
  computeHourlyPayAmount,
  defaultPayAmount,
  formatPayrollPaymentDetail,
  getStaffPaymentForMonth,
  isStaffPaidForMonth,
  paymentsForStaffMember,
  processStaffPayrollPayment,
} from '@/lib/staffPayrollPayment';
import {
  buildPayrollRoster,
  filterStatementPeriodsForMember,
  formatStaffPayLine,
  formatStaffRoleLabel,
  formatTimesheetTotals,
  getUsbTimesheetSummary,
  hourlyMonthSummary,
  partitionPayrollRoster,
  partitionStaffByEmploymentStatus,
  resolveDailyRate,
  resolveHourlyRate,
  resolvePaymentFrequency,
  resolveStaffStatus,
  canReactivateStaff,
  summarizeStatementPeriods,
  statementPeriodKey,
  sortUsbShifts,
  isPayrollAdvanceDescription,
  type StaffPayrollRecord,
  type UsbTimesheetPeriod,
  type UsbTimesheetShift,
} from '@/lib/staffPayrollDisplay';
import { logAction } from '@/lib/auditLog';
import {
  countPresenceDays,
  type StaffPresenceRecord,
} from '@/lib/staffPresence';
import { financeExpensesCollection } from '@/lib/financeData';
import { isPayrollExpenseListRow } from '@/lib/expenseUiSurface';
import { getActualStoreId, resolveStoreIdForAuthUser } from '@/lib/storeUtils';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import AdminSideSheet from '@/components/admin/AdminSideSheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

type CashBookPayrollLine = {
  id: string;
  name: string;
  amount: number;
  date: string;
  paymentMethod?: string;
  isAdvance: boolean;
};

type CashBookPayrollFilter = 'all' | 'advance' | 'regular';

const AdminStaff: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [staff, setStaff] = useState<StaffPayrollRecord[]>([]);
  const [payrollStoreId, setPayrollStoreId] = useState<string | null>(null);
  const [isPayrollLoading, setIsPayrollLoading] = useState(true);
  const [payrollTab, setPayrollTab] = useState<'all' | 'hourly' | 'monthly' | 'cashbook'>('all');
  const [cashBookPayrollFilter, setCashBookPayrollFilter] = useState<CashBookPayrollFilter>('all');
  const [cashBookPayroll, setCashBookPayroll] = useState<CashBookPayrollLine[]>([]);
  const [showAllRecords, setShowAllRecords] = useState(false);
  const [statementStaff, setStatementStaff] = useState<StaffPayrollRecord | null>(null);
  const [expandedStatementPeriodKey, setExpandedStatementPeriodKey] = useState<string | null>(null);
  const [presenceByStaffId, setPresenceByStaffId] = useState<Record<string, StaffPresenceRecord>>({});
  const [salaryPayments, setSalaryPayments] = useState<SalaryPayment[]>([]);
  const [payMonth, setPayMonth] = useState(new Date().toISOString().slice(0, 7));
  const [payDialogStaff, setPayDialogStaff] = useState<StaffPayrollRecord | null>(null);
  const [payDialogOverwrite, setPayDialogOverwrite] = useState(false);
  const [payForm, setPayForm] = useState({
    hourlyRate: '',
    hours: '',
    dailyRate: '',
    days: '',
    baseAmount: '',
    transportAmount: '',
    paymentMethod: 'cash' as 'cash' | 'bank',
    payKind: 'regular' as 'regular' | 'advance',
    notes: '',
  });
  const isPayingRef = useRef(false);
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffPayrollRecord | null>(null);
  const [newStaff, setNewStaff] = useState({
    name: '',
    phone: '',
    role: '',
    salary: 0,
    paymentFrequency: 'monthly' as const,
  });

  useEffect(() => {
    let cancelled = false;

    const fetchStaff = async () => {
      if (!user?.id) {
        setIsPayrollLoading(false);
        return;
      }

      setIsPayrollLoading(true);
      try {
        const storeId =
          getActualStoreId(user) ||
          (await resolveStoreIdForAuthUser(user.id));
        if (cancelled || !storeId) return;
        setPayrollStoreId(storeId);

        const db = getFirestore();
        const staffSnapshot = await getDocs(
          query(collection(db, 'staff'), where('storeId', '==', storeId)),
        );
        if (cancelled) return;

        const staffList: StaffPayrollRecord[] = staffSnapshot.docs.map((staffDoc) => ({
          id: staffDoc.id,
          ...staffDoc.data(),
        } as StaffPayrollRecord));
        setStaff(staffList);

        try {
          const paymentsSnap = await getDocs(
            query(collection(db, 'salaryPayments'), where('storeId', '==', storeId)),
          );
          if (!cancelled) {
            setSalaryPayments(
              paymentsSnap.docs.map(
                (paymentDoc) => ({ id: paymentDoc.id, ...paymentDoc.data() } as SalaryPayment),
              ),
            );
          }
        } catch (paymentError) {
          console.error('Failed to load salary payments:', paymentError);
          if (!cancelled) setSalaryPayments([]);
        }

        try {
          const monthKey = payMonth;
          const presenceSnap = await getDocs(
            query(
              collection(db, 'staffPresence'),
              where('storeId', '==', storeId),
              where('month', '==', monthKey),
            ),
          );
          if (!cancelled) {
            const nextPresence: Record<string, StaffPresenceRecord> = {};
            presenceSnap.docs.forEach((presenceDoc) => {
              const row = { id: presenceDoc.id, ...presenceDoc.data() } as StaffPresenceRecord;
              nextPresence[row.staffId] = row;
            });
            setPresenceByStaffId(nextPresence);
          }
        } catch (presenceError) {
          console.error('Failed to load staff presence:', presenceError);
          if (!cancelled) setPresenceByStaffId({});
        }

        try {
          const expensesSnap = await getDocs(
            query(financeExpensesCollection(db, storeId), where('storeId', '==', storeId)),
          );
          if (!cancelled) {
            const lines: CashBookPayrollLine[] = expensesSnap.docs
              .map((expDoc) => ({ id: expDoc.id, ...expDoc.data() } as Record<string, unknown>))
              .filter((row) => isPayrollExpenseListRow(row))
              .map((row) => {
                const name = String(row.name || row.description || 'Payroll');
                const original = String(row.cashBookOriginalDescription || '');
                return {
                  id: String(row.id),
                  name,
                  amount: roundMoney(Number(row.amount ?? 0)),
                  date: String(row.expenseDate || row.startDate || row.date || ''),
                  paymentMethod: row.paymentMethod ? String(row.paymentMethod) : undefined,
                  isAdvance: isPayrollAdvanceDescription(name, original, String(row.description || '')),
                };
              })
              .sort((a, b) => b.date.localeCompare(a.date));
            setCashBookPayroll(lines);
          }
        } catch (cashBookError) {
          console.error('Failed to load cash book payroll:', cashBookError);
          if (!cancelled) setCashBookPayroll([]);
        }
      } catch (error) {
        console.error('Failed to load staff payroll:', error);
        if (!cancelled) {
          setStaff([]);
          toast({
            title: 'Could not load staff',
            description: 'Store session may be stale — try logging out and back in.',
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) setIsPayrollLoading(false);
      }
    };

    fetchStaff();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.storeId, payMonth, toast]);

  const presencePageUrl = (member: StaffPayrollRecord) => {
    const tab = resolvePaymentFrequency(member);
    return `/admin/staff-presence?month=${encodeURIComponent(payMonth)}&staff=${encodeURIComponent(member.id)}&tab=${tab}`;
  };

  const openPayDialog = (member: StaffPayrollRecord, existingPayment?: SalaryPayment) => {
    const freq = resolvePaymentFrequency(member);
    const isHourly = freq === 'hourly';
    const isDaily = freq === 'daily';
    const monthStats = isHourly ? hourlyMonthSummary(member, payMonth) : null;
    const suggestedPay = isHourly || isDaily ? 0 : defaultPayAmount(member, payMonth);
    const hourlyRate = existingPayment?.hourlyRate
      ? Number(existingPayment.hourlyRate)
      : isHourly
        ? monthStats?.hourlyRateUsd || resolveHourlyRate(member)
        : 0;
    const hours = existingPayment?.hoursWorked
      ? Number(existingPayment.hoursWorked)
      : isHourly && monthStats && monthStats.totalHours > 0
        ? monthStats.totalHours
        : isHourly && monthStats && monthStats.payUsd > 0 && hourlyRate > 0
          ? roundMoney(monthStats.payUsd / hourlyRate)
          : 0;
    const dailyRate = existingPayment?.dailyRate
      ? Number(existingPayment.dailyRate)
      : isDaily
        ? resolveDailyRate(member)
        : 0;
    const days = existingPayment?.daysWorked
      ? Number(existingPayment.daysWorked)
      : isDaily
        ? countPresenceDays(presenceByStaffId[member.id]) || 0
        : 0;
    const baseFromPayment = existingPayment
      ? Number(existingPayment.baseSalary ?? 0)
      : isHourly
        ? computeHourlyPayAmount(String(hourlyRate || ''), String(hours || ''))
        : isDaily
          ? computeDailyPayAmount(String(dailyRate || ''), String(days || ''))
          : suggestedPay;
    const computedBase = isHourly
      ? computeHourlyPayAmount(String(hourlyRate || ''), String(hours || ''))
      : isDaily
        ? computeDailyPayAmount(String(dailyRate || ''), String(days || ''))
        : baseFromPayment;

    setPayDialogOverwrite(Boolean(existingPayment));
    setPayDialogStaff(member);
    setPayForm({
      hourlyRate: isHourly ? String(hourlyRate || '') : '',
      hours: isHourly ? String(hours || '') : '',
      dailyRate: isDaily ? String(dailyRate || '') : '',
      days: isDaily ? String(days || '') : '',
      baseAmount:
        isHourly || isDaily
          ? String(computedBase || baseFromPayment || '')
          : String(baseFromPayment || ''),
      transportAmount: existingPayment ? String(existingPayment.transportAmount ?? 0) : '',
      paymentMethod: (existingPayment?.paymentMethod as 'cash' | 'bank') || 'cash',
      payKind: isPayrollAdvanceDescription(existingPayment?.notes || '') ? 'advance' : 'regular',
      notes: existingPayment?.notes || '',
    });
  };

  const updateHourlyPayForm = (patch: Partial<typeof payForm>) => {
    setPayForm((prev) => {
      const next = { ...prev, ...patch };
      if (payDialogStaff && resolvePaymentFrequency(payDialogStaff) === 'hourly') {
        next.baseAmount = String(computeHourlyPayAmount(next.hourlyRate, next.hours));
      }
      return next;
    });
  };

  const updateDailyPayForm = (patch: Partial<typeof payForm>) => {
    setPayForm((prev) => {
      const next = { ...prev, ...patch };
      if (payDialogStaff && resolvePaymentFrequency(payDialogStaff) === 'daily') {
        next.baseAmount = String(computeDailyPayAmount(next.dailyRate, next.days));
      }
      return next;
    });
  };

  const resolvedPayBaseAmount = () => {
    if (!payDialogStaff) return Number(payForm.baseAmount) || 0;
    const freq = resolvePaymentFrequency(payDialogStaff);
    if (freq === 'hourly') return computeHourlyPayAmount(payForm.hourlyRate, payForm.hours);
    if (freq === 'daily') return computeDailyPayAmount(payForm.dailyRate, payForm.days);
    return Number(payForm.baseAmount) || 0;
  };

  const resolvedPayTotalAmount = () =>
    roundMoney(resolvedPayBaseAmount() + (Number(payForm.transportAmount) || 0));

  const handleMarkAsPaid = async () => {
    if (!payDialogStaff || !activeStoreId || isPayingRef.current) return;

    const freq = resolvePaymentFrequency(payDialogStaff);
    const isHourly = freq === 'hourly';
    const isDaily = freq === 'daily';
    const baseAmount = resolvedPayBaseAmount();
    const transportAmount = Number(payForm.transportAmount || 0);
    const hourlyRate = Number(payForm.hourlyRate || 0);
    const hoursWorked = Number(payForm.hours || 0);
    const dailyRate = Number(payForm.dailyRate || 0);
    const daysWorked = Number(payForm.days || 0);
    if (isHourly) {
      if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
        toast({ title: 'Error', description: 'Enter a valid hourly rate.', variant: 'destructive' });
        return;
      }
      if (!Number.isFinite(hoursWorked) || hoursWorked <= 0) {
        toast({ title: 'Error', description: 'Enter hours worked for this month.', variant: 'destructive' });
        return;
      }
    } else if (isDaily) {
      if (!Number.isFinite(dailyRate) || dailyRate <= 0) {
        toast({ title: 'Error', description: 'Enter a valid daily rate.', variant: 'destructive' });
        return;
      }
      if (!Number.isFinite(daysWorked) || daysWorked <= 0) {
        toast({ title: 'Error', description: 'Enter days worked for this month.', variant: 'destructive' });
        return;
      }
    } else if (!Number.isFinite(baseAmount) || baseAmount < 0) {
      toast({ title: 'Error', description: 'Enter a valid pay amount.', variant: 'destructive' });
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

    isPayingRef.current = true;
    try {
      const db = getFirestore();
      const result = await processStaffPayrollPayment({
        db,
        storeId: activeStoreId,
        staff: payDialogStaff,
        month: payMonth,
        baseAmount,
        transportAmount,
        hourlyRate: isHourly ? hourlyRate : undefined,
        hoursWorked: isHourly ? hoursWorked : undefined,
        dailyRate: isDaily ? dailyRate : undefined,
        daysWorked: isDaily ? daysWorked : undefined,
        paymentMethod: payForm.paymentMethod,
        notes:
          payForm.payKind === 'advance'
            ? (payForm.notes.trim() || 'Advance on salary')
            : payForm.notes,
        actor: { id: user.id, name: user.name, role: user.role },
        overwriteExisting: payDialogOverwrite,
      });

      const paymentSnap = await getDocs(
        query(collection(db, 'salaryPayments'), where('storeId', '==', activeStoreId)),
      );
      setSalaryPayments(
        paymentSnap.docs.map((paymentDoc) => ({ id: paymentDoc.id, ...paymentDoc.data() } as SalaryPayment)),
      );

      await logAction(
        user.id,
        user.name,
        user.role,
        'create',
        'salaryPayment',
        result.paymentId,
        {
          newValue: {
            staffId: payDialogStaff.id,
            staffName: payDialogStaff.name,
            month: payMonth,
            baseAmount,
            transportAmount,
            totalAmount: result.totalAmount,
            idempotentReplay: result.idempotentReplay,
          },
        },
        activeStoreId,
      );

      toast({
        title: result.idempotentReplay ? 'Already paid' : payDialogOverwrite ? 'Payment updated' : 'Payment recorded',
        description: result.idempotentReplay
          ? `${payDialogStaff.name} was already marked paid for ${payMonth}. Open View payment to update amounts.`
          : `${payDialogStaff.name}: $${result.totalAmount.toFixed(2)} posted (pay + transport → employee & transport GL).`,
      });
      setPayDialogStaff(null);
      setPayDialogOverwrite(false);
    } catch (error) {
      console.error('Payroll payment failed:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to mark employee as paid.',
        variant: 'destructive',
      });
    } finally {
      isPayingRef.current = false;
    }
  };

  const handleAddStaff = async () => {
    if (!newStaff.name || !newStaff.role || !activeStoreId) {
      toast({ title: "Error", description: "Name and role are required", variant: "destructive" });
      return;
    }

    try {
      const db = getFirestore();
      const staffData = {
        ...newStaff,
        status: 'active' as const,
        hireDate: new Date().toISOString(),
        storeId: activeStoreId,
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
        activeStoreId
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
    if (!editingStaff || !activeStoreId) return;

    try {
      const db = getFirestore();
      const staffRef = doc(db, 'staff', editingStaff.id);

      const updatedData = {
        ...editingStaff,
        isActive: resolveStaffStatus(editingStaff) === 'active' || editingStaff.status === 'active',
        updatedAt: new Date().toISOString(),
      };
      if (updatedData.isActive) {
        delete (updatedData as { endDate?: string }).endDate;
      }

      await updateDoc(staffRef, {
        ...updatedData,
        ...(updatedData.isActive ? { endDate: deleteField() } : {}),
      });
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
        activeStoreId
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
        isActive: false,
        endDate: today,
        updatedAt: new Date().toISOString(),
      });
      
      // Delete only future/current salary expenses (today onwards) for this staff member
      const expensesRef = financeExpensesCollection(db, activeStoreId);
      const salaryExpensesQuery = query(
        expensesRef,
        where('linkedStaffId', '==', staffId),
        where('storeId', '==', activeStoreId)
      );
      const salaryExpensesSnapshot = await getDocs(salaryExpensesQuery);
      
      // Filter and delete only expenses from today onwards (keep historical records)
      const futureExpenses = salaryExpensesSnapshot.docs.filter(doc => {
        const data = doc.data();
        const expenseDate = String(data.startDate || data.expenseDate || data.date || '');
        return expenseDate >= today;
      });
      
      const deletePromises = futureExpenses.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      // Update local state to show terminated status
      setStaff(staff.map(s =>
        s.id === staffId ? { ...s, status: 'terminated', isActive: false, endDate: today } : s,
      ));

      if (deletedStaff && user) {
        await logAction(
          user.id,
          user.name,
          user.role,
          'update',
          'staffMember',
          staffId,
          { oldValue: deletedStaff, newValue: { status: 'terminated', isActive: false, endDate: today } },
          activeStoreId
        );
      }

      toast({ 
        title: "Success", 
        description: `Staff member terminated. ${futureExpenses.length} future salary expense(s) removed. Use Re-activate anytime to restore.` 
      });
    } catch (error) {
      console.error('Error terminating staff:', error);
      toast({ title: "Error", description: "Failed to terminate staff member", variant: "destructive" });
    }
  };

  const handleToggleStaffActive = async (member: StaffPayrollRecord) => {
    const current = resolveStaffStatus(member);
    const nextStatus = current === 'active' ? 'suspended' : 'active';
    try {
      const db = getFirestore();
      const staffRef = doc(db, 'staff', member.id);
      const patch: Record<string, unknown> = {
        status: nextStatus,
        isActive: nextStatus === 'active',
        updatedAt: new Date().toISOString(),
      };
      if (nextStatus === 'active') {
        patch.endDate = deleteField();
      }
      await updateDoc(staffRef, patch);
      setStaff((prev) =>
        prev.map((s) =>
          s.id === member.id
            ? {
                ...s,
                status: nextStatus,
                isActive: nextStatus === 'active',
                endDate: nextStatus === 'active' ? undefined : s.endDate,
              }
            : s,
        ),
      );
      toast({
        title: nextStatus === 'active' ? 'Employee re-activated' : 'Employee inactive',
        description:
          nextStatus === 'active'
            ? `${member.name || member.staffName} is active again and back on payroll.`
            : `${member.name || member.staffName} is inactive (can re-activate later).`,
      });
    } catch (error) {
      console.error('Failed to toggle staff status:', error);
      toast({ title: 'Error', description: 'Could not update employment status', variant: 'destructive' });
    }
  };

  const payrollRoster = buildPayrollRoster(staff);
  const { hourly: hourlyStaff, monthly: monthlyStaff } = partitionPayrollRoster(staff);
  const activeStoreId = payrollStoreId || getActualStoreId(user) || '';
  const visibleStaff = showAllRecords
    ? staff
    : payrollTab === 'hourly'
      ? hourlyStaff
      : payrollTab === 'monthly'
        ? monthlyStaff
        : payrollRoster;
  const duplicateCount = Math.max(0, staff.length - payrollRoster.length);
  const cashBookAdvanceLines = useMemo(
    () => cashBookPayroll.filter((row) => row.isAdvance),
    [cashBookPayroll],
  );
  const cashBookRegularLines = useMemo(
    () => cashBookPayroll.filter((row) => !row.isAdvance),
    [cashBookPayroll],
  );
  const filteredCashBookPayroll = useMemo(() => {
    if (cashBookPayrollFilter === 'advance') return cashBookAdvanceLines;
    if (cashBookPayrollFilter === 'regular') return cashBookRegularLines;
    return cashBookPayroll;
  }, [cashBookPayroll, cashBookPayrollFilter, cashBookAdvanceLines, cashBookRegularLines]);

  const cashBookPayrollTotal = cashBookPayroll.reduce((sum, row) => sum + row.amount, 0);
  const cashBookAdvanceTotal = cashBookAdvanceLines.reduce((sum, row) => sum + row.amount, 0);
  const { active: activePayrollStaff, inactive: inactivePayrollStaff } =
    partitionStaffByEmploymentStatus(payrollRoster);

  const renderStaffRosterSections = (
    members: StaffPayrollRecord[],
    options?: { showActiveHeading?: boolean; showInactiveHeading?: boolean; includeInactive?: boolean },
  ) => {
    const { active, inactive } = partitionStaffByEmploymentStatus(members);
    const showActiveHeading = options?.showActiveHeading ?? inactive.length > 0;
    const showInactiveHeading = options?.showInactiveHeading ?? true;
    const includeInactive = options?.includeInactive ?? true;

    if (active.length === 0 && (!includeInactive || inactive.length === 0)) {
      if (members.length === 0) {
        return (
          <AdminPanel>
            <CardContent className="py-12 text-center text-muted-foreground">No payroll employees yet.</CardContent>
          </AdminPanel>
        );
      }
      return null;
    }

    return (
      <div className="space-y-6">
        {active.length > 0 ? (
          <div className="space-y-3">
            {showActiveHeading ? (
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Active employees ({active.length})
              </h3>
            ) : null}
            <div className="grid gap-4">{active.map(renderStaffCard)}</div>
          </div>
        ) : null}
        {includeInactive && inactive.length > 0 ? (
          <div className="space-y-3 border-t pt-6">
            {showInactiveHeading ? (
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Inactive employees ({inactive.length})
              </h3>
            ) : null}
            <div className="grid gap-4">{inactive.map(renderStaffCard)}</div>
          </div>
        ) : null}
      </div>
    );
  };

  const renderStaffCard = (member: StaffPayrollRecord) => {
    const status = resolveStaffStatus(member);
    const timesheetLine = formatTimesheetTotals(member, payMonth);
    const payLine = formatStaffPayLine(member);
    const roleLabel = formatStaffRoleLabel(member);
    const paidForMonth = isStaffPaidForMonth(salaryPayments, member.id, payMonth);
    const monthPayment = getStaffPaymentForMonth(salaryPayments, member.id, payMonth);
    const payKind =
      resolvePaymentFrequency(member) === 'hourly'
        ? 'Hourly'
        : resolvePaymentFrequency(member) === 'daily'
          ? 'Daily'
          : 'Monthly';
    const monthStats =
      resolvePaymentFrequency(member) === 'hourly' ? hourlyMonthSummary(member, payMonth) : null;
    const paymentFreq = resolvePaymentFrequency(member);
    const showPresence = paymentFreq === 'monthly' || paymentFreq === 'daily' || paymentFreq === 'hourly';
    const presenceDays = countPresenceDays(presenceByStaffId[member.id]);

    return (
      <AdminPanel key={member.id}>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex flex-wrap items-center gap-2">
                {member.name || member.staffName}
                <Badge variant={status === 'active' ? 'default' : 'secondary'}>{status}</Badge>
                <Badge variant="outline">{payKind}</Badge>
                <Badge variant="secondary">{roleLabel}</Badge>
                {paidForMonth ? (
                  <Badge className="bg-green-600 hover:bg-green-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Paid {payMonth}
                  </Badge>
                ) : null}
              </CardTitle>
              <CardDescription>
                {roleLabel} · {payLine}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0 justify-end">
              <Button
                variant={canReactivateStaff(member) ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleToggleStaffActive(member)}
                title={
                  canReactivateStaff(member)
                    ? 'Restore this employee to active payroll'
                    : 'Deactivate without deleting — you can re-activate later'
                }
              >
                {canReactivateStaff(member) ? 'Re-activate' : 'Set inactive'}
              </Button>
              {!paidForMonth ? (
                <Button size="sm" onClick={() => openPayDialog(member)}>
                  <DollarSign className="h-4 w-4 mr-1" />
                  Mark as paid
                </Button>
              ) : monthPayment ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openPayDialog(member, monthPayment)}
                >
                  <DollarSign className="h-4 w-4 mr-1" />
                  View payment
                </Button>
              ) : null}
              {showPresence ? (
                <Button variant="outline" size="sm" asChild>
                  <Link to={presencePageUrl(member)}>
                    <CalendarDays className="h-4 w-4 mr-1" />
                    Presence
                  </Link>
                </Button>
              ) : null}
              <Button variant="outline" size="sm" onClick={() => {
                setExpandedStatementPeriodKey(null);
                setStatementStaff(member);
              }}>
                <FileText className="h-4 w-4 mr-1" />
                Statement
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditingStaff(member)}>
                <Edit3 className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleDeleteStaff(member.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-500">Pay rate</p>
              <p className="font-medium">{payLine}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">{payKind === 'Hourly' ? 'Excel timesheet' : payKind === 'Daily' ? 'Pay basis' : 'Pay basis'}</p>
              <p className="font-medium">
                {payKind === 'Daily'
                  ? `${formatStaffPayLine(member)} · ${presenceDays} day${presenceDays === 1 ? '' : 's'} marked in ${payMonth}`
                  : payKind === 'Monthly'
                    ? presenceDays > 0
                      ? `${presenceDays} day${presenceDays === 1 ? '' : 's'} present in ${payMonth}`
                      : 'Mark daily presence before month-end pay'
                    : timesheetLine || (payKind === 'Hourly' ? 'Enter pay manually' : 'Monthly salary')}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <p className="font-medium capitalize">{status}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Hire date</p>
              <p className="font-medium">
                {member.hireDate ? new Date(member.hireDate).toLocaleDateString() : '—'}
              </p>
            </div>
          </div>
          {monthPayment ? (
            <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm mb-3">
              <p className="font-medium text-green-900">{payMonth} payment recorded</p>
              <p className="text-green-800">
                ${Number(monthPayment.totalAmount || 0).toFixed(2)} total
                {monthPayment.hoursWorked && monthPayment.hourlyRate
                  ? ` · ${Number(monthPayment.hoursWorked).toFixed(2)} hrs × $${Number(monthPayment.hourlyRate).toFixed(2)}`
                  : monthPayment.daysWorked && monthPayment.dailyRate
                    ? ` · ${Number(monthPayment.daysWorked).toFixed(0)} days × $${Number(monthPayment.dailyRate).toFixed(2)}`
                    : ''}
                {Number(monthPayment.transportAmount || 0) > 0
                  ? ` · transport $${Number(monthPayment.transportAmount).toFixed(2)}`
                  : ''}
                {monthPayment.paymentMethod ? ` · ${monthPayment.paymentMethod}` : ''}
              </p>
              {monthPayment.notes ? (
                <p className="text-xs text-green-700 mt-1">Note: {monthPayment.notes}</p>
              ) : null}
              <p className="text-xs text-green-700 mt-1">
                Paid {new Date(monthPayment.paymentDate).toLocaleString()} · one payment per month (use View payment to correct)
              </p>
            </div>
          ) : null}
          {monthStats && payKind === 'Hourly' ? (
            <p className="text-xs text-muted-foreground">
              {payMonth}: {monthStats.shiftCount} shifts · ${monthStats.payUsd.toFixed(2)} from Excel
            </p>
          ) : null}
          {member.phone ? <p className="text-sm text-gray-500 mt-2">Phone: {member.phone}</p> : null}
        </CardContent>
      </AdminPanel>
    );
  };

  return (
    <AdminPageShell
      title="Staff Management (Payroll)"
      description="Roster and monthly pay — payroll from the USB cash book is on the Cash book payroll tab (same lines hidden on Invoice Manager → Expenses)."
      eyebrow="Business Tools"
      actions={(
        <div className="flex flex-wrap gap-2">
          <Input
            type="month"
            value={payMonth}
            onChange={(e) => setPayMonth(e.target.value)}
            className="w-40"
            aria-label="Payroll month"
          />
          <Button variant="outline" asChild>
            <Link to="/admin/salaries">Salary payments</Link>
          </Button>
          <Button onClick={() => setIsAddingStaff(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Staff Member
          </Button>
        </div>
      )}
    >

        {/* Staff Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <AdminPanel>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{payrollRoster.length}</div>
              <p className="text-xs text-gray-500">Payroll employees</p>
            </CardContent>
          </AdminPanel>
          <AdminPanel>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{activePayrollStaff.length}</div>
              <p className="text-xs text-gray-500">Active</p>
            </CardContent>
          </AdminPanel>
          <AdminPanel>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{inactivePayrollStaff.length}</div>
              <p className="text-xs text-gray-500">Inactive</p>
            </CardContent>
          </AdminPanel>
          <AdminPanel>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{hourlyStaff.length}</div>
              <p className="text-xs text-gray-500">Hourly (Excel)</p>
            </CardContent>
          </AdminPanel>
          <AdminPanel>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{monthlyStaff.length}</div>
              <p className="text-xs text-gray-500">Monthly</p>
            </CardContent>
          </AdminPanel>
          <AdminPanel>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{cashBookPayroll.length}</div>
              <p className="text-xs text-gray-500">Cash book payroll</p>
              <p className="text-xs font-medium text-teal-700">${cashBookPayrollTotal.toFixed(2)}</p>
            </CardContent>
          </AdminPanel>
          <AdminPanel>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{duplicateCount}</div>
              <p className="text-xs text-gray-500">Duplicate POS rows hidden</p>
            </CardContent>
          </AdminPanel>
        </div>

        {isPayrollLoading ? (
          <AdminPanel>
            <CardContent className="py-12 text-center text-muted-foreground">Loading staff payroll…</CardContent>
          </AdminPanel>
        ) : null}

        <Tabs value={payrollTab} onValueChange={(v) => setPayrollTab(v as 'all' | 'hourly' | 'monthly' | 'cashbook')} className="mb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="all">All ({payrollRoster.length})</TabsTrigger>
              <TabsTrigger value="hourly">Hourly ({hourlyStaff.length})</TabsTrigger>
              <TabsTrigger value="monthly">Monthly ({monthlyStaff.length})</TabsTrigger>
              <TabsTrigger value="cashbook">
                Cash book payroll ({cashBookPayroll.length})
              </TabsTrigger>
            </TabsList>
            <Button variant="outline" size="sm" onClick={() => setShowAllRecords((v) => !v)}>
              {showAllRecords ? 'Show payroll roster only' : `Show all Firestore rows (${staff.length})`}
            </Button>
          </div>

          <TabsContent value="all" className="mt-4 space-y-6">
            {showAllRecords ? (
              renderStaffRosterSections(visibleStaff)
            ) : (
              <>
                {hourlyStaff.length > 0 ? (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Hourly employees (Excel timesheets)
                    </h3>
                    {renderStaffRosterSections(hourlyStaff, {
                      showActiveHeading: false,
                      includeInactive: false,
                    })}
                  </div>
                ) : null}
                {monthlyStaff.length > 0 ? (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Monthly employees
                    </h3>
                    {renderStaffRosterSections(monthlyStaff, {
                      showActiveHeading: false,
                      includeInactive: false,
                    })}
                  </div>
                ) : null}
                {inactivePayrollStaff.length > 0 ? (
                  <div className="space-y-3 border-t pt-6">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Inactive employees ({inactivePayrollStaff.length})
                    </h3>
                    <div className="grid gap-4">{inactivePayrollStaff.map(renderStaffCard)}</div>
                  </div>
                ) : null}
                {payrollRoster.length === 0 ? (
                  <AdminPanel>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      No payroll employees yet.
                    </CardContent>
                  </AdminPanel>
                ) : null}
              </>
            )}
          </TabsContent>

          <TabsContent value="hourly" className="mt-4">
            {hourlyStaff.length === 0 ? (
              <AdminPanel>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No hourly employees in USB import yet.
                </CardContent>
              </AdminPanel>
            ) : (
              renderStaffRosterSections(hourlyStaff)
            )}
          </TabsContent>

          <TabsContent value="monthly" className="mt-4">
            {monthlyStaff.length === 0 ? (
              <AdminPanel>
                <CardContent className="py-12 text-center text-muted-foreground">No monthly employees.</CardContent>
              </AdminPanel>
            ) : (
              renderStaffRosterSections(monthlyStaff)
            )}
          </TabsContent>

          <TabsContent value="cashbook" className="mt-4 space-y-4">
            <Alert>
              <AlertDescription>
                {cashBookPayroll.length} payroll lines · ${cashBookPayrollTotal.toFixed(2)} from Final Data Expenses
                · {cashBookAdvanceLines.length} advances (${cashBookAdvanceTotal.toFixed(2)}). Working-day wages and
                advances on salary belong here, not Purchases.
              </AlertDescription>
            </Alert>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['all', `All (${cashBookPayroll.length})`],
                  ['regular', `Wages & hourly (${cashBookRegularLines.length})`],
                  ['advance', `Advance on salary (${cashBookAdvanceLines.length})`],
                ] as const
              ).map(([key, label]) => (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant={cashBookPayrollFilter === key ? 'default' : 'outline'}
                  className={cashBookPayrollFilter === key ? 'bg-teal-600 hover:bg-teal-700' : ''}
                  onClick={() => setCashBookPayrollFilter(key)}
                >
                  {label}
                </Button>
              ))}
            </div>
            <AdminPanel>
              <CardHeader>
                <CardTitle>Cash book payroll lines</CardTitle>
                <CardDescription>Paid wage lines from financeExpenses (`expenseUiSurface: payroll`)</CardDescription>
              </CardHeader>
              <CardContent>
                {filteredCashBookPayroll.length === 0 ? (
                  <p className="py-8 text-center text-muted-foreground">
                    {cashBookPayroll.length === 0
                      ? 'No payroll cash-book lines for this store.'
                      : 'No lines in this filter.'}
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[28rem] overflow-y-auto">
                    {filteredCashBookPayroll.map((line) => (
                      <div
                        key={line.id}
                        className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate flex items-center gap-2">
                            <span className="truncate">{line.name}</span>
                            {line.isAdvance ? (
                              <Badge variant="secondary" className="shrink-0 text-xs">Advance</Badge>
                            ) : null}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {line.date ? new Date(line.date).toLocaleDateString() : '—'}
                            {line.paymentMethod ? ` · ${line.paymentMethod}` : ''}
                          </p>
                        </div>
                        <span className="font-semibold shrink-0">${line.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </AdminPanel>
          </TabsContent>
        </Tabs>

        <AdminSideSheet
          open={!!payDialogStaff}
          onOpenChange={(open) => {
            if (!open) {
              setPayDialogStaff(null);
              setPayDialogOverwrite(false);
            }
          }}
          title={
            payDialogStaff
              ? payDialogOverwrite
                ? `View payment — ${payDialogStaff.name || payDialogStaff.staffName}`
                : `Mark as paid — ${payDialogStaff.name || payDialogStaff.staffName}`
              : 'Mark as paid'
          }
          description={
            payDialogStaff
              ? payDialogOverwrite
                ? `${payMonth} is already paid. Review amounts below and save to update this month's payment.`
                : `Posts pay + transport to employee sub-accounts for ${payMonth}. Same month cannot be paid twice.`
              : undefined
          }
          footer={
            payDialogStaff ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setPayDialogStaff(null);
                    setPayDialogOverwrite(false);
                  }}
                >
                  Cancel
                </Button>
                <Button className="ml-2" onClick={handleMarkAsPaid}>
                  {payDialogOverwrite ? 'Update payment' : 'Confirm payment'}
                </Button>
              </>
            ) : undefined
          }
        >
          {payDialogStaff ? (
              <div className="grid gap-4">
                {resolvePaymentFrequency(payDialogStaff) === 'hourly' ? (
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
                        const stats = hourlyMonthSummary(payDialogStaff, payMonth);
                        if (stats.hasExcelData || stats.shiftCount > 0) {
                          return `${payMonth}: prefilled from Excel (${stats.shiftCount} shifts · $${stats.payUsd.toFixed(2)}). Adjust hours if needed.`;
                        }
                        return 'Enter rate and hours manually when Excel tab is empty.';
                      })()}
                    </p>
                    <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm">
                      <div className="flex justify-between">
                        <span>Pay (rate × hours)</span>
                        <span className="font-medium">${resolvedPayBaseAmount().toFixed(2)}</span>
                      </div>
                    </div>
                  </>
                ) : resolvePaymentFrequency(payDialogStaff) === 'daily' ? (
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
                      Daily employee — days prefilled from presence log ({countPresenceDays(presenceByStaffId[payDialogStaff.id])} marked). Adjust if needed.
                    </p>
                    <Button type="button" variant="link" className="h-auto p-0 text-xs" asChild>
                      <Link
                        to={presencePageUrl(payDialogStaff)}
                        onClick={() => setPayDialogStaff(null)}
                      >
                        Edit daily presence for {payMonth}
                      </Link>
                    </Button>
                    <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm">
                      <div className="flex justify-between">
                        <span>Pay (daily rate × days)</span>
                        <span className="font-medium">${resolvedPayBaseAmount().toFixed(2)}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
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
                        Monthly salary for {payMonth}
                        {countPresenceDays(presenceByStaffId[payDialogStaff.id]) > 0
                          ? ` · ${countPresenceDays(presenceByStaffId[payDialogStaff.id])} day(s) marked present`
                          : ''}
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="sm" className="w-fit" asChild>
                      <Link
                        to={presencePageUrl(payDialogStaff)}
                        onClick={() => setPayDialogStaff(null)}
                      >
                        <CalendarDays className="h-4 w-4 mr-1" />
                        Log daily presence (incl. past dates)
                      </Link>
                    </Button>
                  </>
                )}
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
                  <Label htmlFor="pay-kind">Payment type</Label>
                  <Select
                    value={payForm.payKind}
                    onValueChange={(value: 'regular' | 'advance') =>
                      setPayForm((prev) => ({
                        ...prev,
                        payKind: value,
                        notes:
                          value === 'advance' && !prev.notes.trim()
                            ? 'Advance on salary'
                            : prev.notes,
                      }))
                    }
                  >
                    <SelectTrigger id="pay-kind">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="regular">Regular pay</SelectItem>
                      <SelectItem value="advance">Advance on salary</SelectItem>
                    </SelectContent>
                  </Select>
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
                  {resolvePaymentFrequency(payDialogStaff) === 'hourly' ? (
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
                  ) : resolvePaymentFrequency(payDialogStaff) === 'daily' ? (
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
              </div>
          ) : null}
        </AdminSideSheet>

        <AdminSideSheet
          open={!!statementStaff}
          onOpenChange={(open) => {
            if (!open) {
              setStatementStaff(null);
              setExpandedStatementPeriodKey(null);
            }
          }}
          title={
            statementStaff
              ? `Employee statement — ${statementStaff.name || statementStaff.staffName}`
              : 'Employee statement'
          }
          description={
            statementStaff
              ? `${formatStaffPayLine(statementStaff)} · ${formatStaffRoleLabel(statementStaff)} · Excel timesheet + recorded payments`
              : undefined
          }
          size="detail"
          tall
          footer={
            <Button variant="outline" onClick={() => setStatementStaff(null)}>
              Close
            </Button>
          }
        >
          {statementStaff ? (() => {
                const summary = getUsbTimesheetSummary(statementStaff);
                const periods = filterStatementPeriodsForMember(
                  statementStaff,
                  summary?.periods || [],
                );
                const totals = summarizeStatementPeriods(periods);
                const recordedPayments = paymentsForStaffMember(salaryPayments, statementStaff.id);
                const totalRecordedPaid = recordedPayments.reduce(
                  (sum, payment) => sum + Number(payment.totalAmount || 0),
                  0,
                );
                return (
                  <div key={statementStaff.id} className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <AdminPanel>
                        <CardContent className="pt-4">
                          <p className="text-xs text-gray-500">Total paid (recorded)</p>
                          <p className="text-xl font-semibold">${totalRecordedPaid.toFixed(2)}</p>
                        </CardContent>
                      </AdminPanel>
                      <AdminPanel>
                        <CardContent className="pt-4">
                          <p className="text-xs text-gray-500">Payments</p>
                          <p className="text-xl font-semibold">{recordedPayments.length}</p>
                        </CardContent>
                      </AdminPanel>
                      <AdminPanel>
                        <CardContent className="pt-4">
                          <p className="text-xs text-gray-500">Excel shifts</p>
                          <p className="text-xl font-semibold">{totals.shiftCount}</p>
                        </CardContent>
                      </AdminPanel>
                      <AdminPanel>
                        <CardContent className="pt-4">
                          <p className="text-xs text-gray-500">Excel pay</p>
                          <p className="text-xl font-semibold">${totals.totalPayUsd.toFixed(2)}</p>
                        </CardContent>
                      </AdminPanel>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Recorded payments
                      </h3>
                      <div className="overflow-x-auto rounded-lg border">
                        <table className="min-w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="px-3 py-2 text-left">Month</th>
                              <th className="px-3 py-2 text-left">Detail</th>
                              <th className="px-3 py-2 text-right">Transport</th>
                              <th className="px-3 py-2 text-right">Total</th>
                              <th className="px-3 py-2 text-left">Method</th>
                              <th className="px-3 py-2 text-left">Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recordedPayments.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                                  No payments recorded yet — use Mark as paid on the staff card.
                                </td>
                              </tr>
                            ) : (
                              recordedPayments.map((payment) => (
                                <tr key={payment.id} className="border-t">
                                  <td className="px-3 py-2">{payment.month || '—'}</td>
                                  <td className="px-3 py-2">{formatPayrollPaymentDetail(payment)}</td>
                                  <td className="px-3 py-2 text-right">
                                    ${Number(payment.transportAmount || 0).toFixed(2)}
                                  </td>
                                  <td className="px-3 py-2 text-right font-medium">
                                    ${Number(payment.totalAmount || 0).toFixed(2)}
                                  </td>
                                  <td className="px-3 py-2 capitalize">{payment.paymentMethod || '—'}</td>
                                  <td className="px-3 py-2">{payment.notes || '—'}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Excel timesheet periods
                      </h3>
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="min-w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-3 py-2 text-left w-8" aria-hidden />
                            <th className="px-3 py-2 text-left">Period</th>
                            <th className="px-3 py-2 text-left">Sheet</th>
                            <th className="px-3 py-2 text-right">Shifts</th>
                            <th className="px-3 py-2 text-right">Pay USD</th>
                          </tr>
                        </thead>
                        <tbody>
                          {periods.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                                No Excel rows for this employee (manual hourly/daily/monthly pay only).
                              </td>
                            </tr>
                          ) : (
                            periods.map((period: UsbTimesheetPeriod, index: number) => {
                              const periodKey = statementPeriodKey(period, index);
                              const expanded = expandedStatementPeriodKey === periodKey;
                              const shifts = sortUsbShifts(period.shifts || []);
                              const totalHours = shifts.reduce(
                                (sum, shift) => sum + Number(shift.regularHours || 0),
                                0,
                              );
                              const totalTransport = shifts.reduce(
                                (sum, shift) => sum + Number(shift.transportUsd || 0),
                                0,
                              );
                              return (
                                <React.Fragment key={periodKey}>
                                  <tr
                                    className={`border-t cursor-pointer transition-colors ${
                                      expanded ? 'bg-muted/40' : 'hover:bg-muted/20'
                                    }`}
                                    onClick={() =>
                                      setExpandedStatementPeriodKey(expanded ? null : periodKey)
                                    }
                                    role="button"
                                    tabIndex={0}
                                    aria-expanded={expanded}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        setExpandedStatementPeriodKey(expanded ? null : periodKey);
                                      }
                                    }}
                                  >
                                    <td className="px-3 py-2 text-muted-foreground">
                                      <ChevronDown
                                        className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
                                      />
                                    </td>
                                    <td className="px-3 py-2">
                                      {[period.dateFrom, period.dateTo].filter(Boolean).join(' → ') || '—'}
                                    </td>
                                    <td className="px-3 py-2">{period.sheetName || '—'}</td>
                                    <td className="px-3 py-2 text-right">{Number(period.shiftCount || 0)}</td>
                                    <td className="px-3 py-2 text-right font-medium">
                                      ${Number(period.totalPayUsd || 0).toFixed(2)}
                                    </td>
                                  </tr>
                                  {expanded ? (
                                    <tr className="border-t bg-muted/10">
                                      <td colSpan={5} className="px-3 py-3">
                                        {shifts.length === 0 ? (
                                          <p className="text-sm text-muted-foreground">
                                            Daily shift rows are not stored for this period yet. Re-run USB staff sync to load day/hour detail from Excel.
                                          </p>
                                        ) : (
                                          <div className="space-y-2">
                                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                              Daily breakdown · {shifts.length} shift{shifts.length === 1 ? '' : 's'}
                                              {totalHours > 0 ? ` · ${totalHours.toFixed(1)} hrs` : ''}
                                              {totalTransport > 0 ? ` · transport $${totalTransport.toFixed(2)}` : ''}
                                            </p>
                                            <div className="overflow-x-auto rounded-md border bg-background">
                                              <table className="min-w-full text-sm">
                                                <thead className="bg-muted/30">
                                                  <tr>
                                                    <th className="px-3 py-2 text-left">Date</th>
                                                    <th className="px-3 py-2 text-right">Hours</th>
                                                    <th className="px-3 py-2 text-right">Rate</th>
                                                    <th className="px-3 py-2 text-right">Transport</th>
                                                    <th className="px-3 py-2 text-right">Total</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {shifts.map((shift: UsbTimesheetShift, shiftIndex: number) => (
                                                    <tr key={`${shift.date}-${shiftIndex}`} className="border-t">
                                                      <td className="px-3 py-2">{shift.date || '—'}</td>
                                                      <td className="px-3 py-2 text-right">
                                                        {Number(shift.regularHours || 0).toFixed(1)}
                                                      </td>
                                                      <td className="px-3 py-2 text-right">
                                                        ${Number(shift.hourlyRateUsd || period.hourlyRateUsd || 0).toFixed(2)}
                                                      </td>
                                                      <td className="px-3 py-2 text-right">
                                                        ${Number(shift.transportUsd || 0).toFixed(2)}
                                                      </td>
                                                      <td className="px-3 py-2 text-right font-medium">
                                                        ${Number(shift.totalUsd || 0).toFixed(2)}
                                                      </td>
                                                    </tr>
                                                  ))}
                                                </tbody>
                                                <tfoot className="border-t bg-muted/20">
                                                  <tr>
                                                    <td className="px-3 py-2 font-medium">Period total</td>
                                                    <td className="px-3 py-2 text-right font-medium">
                                                      {totalHours.toFixed(1)}
                                                    </td>
                                                    <td className="px-3 py-2" />
                                                    <td className="px-3 py-2 text-right font-medium">
                                                      ${totalTransport.toFixed(2)}
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-medium">
                                                      ${Number(period.totalPayUsd || 0).toFixed(2)}
                                                    </td>
                                                  </tr>
                                                </tfoot>
                                              </table>
                                            </div>
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  ) : null}
                                </React.Fragment>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                    </div>
                  </div>
                );
          })() : null}
        </AdminSideSheet>

        <AdminSideSheet
          open={!!editingStaff}
          onOpenChange={(open) => {
            if (!open) setEditingStaff(null);
          }}
          title="Edit Staff Member"
          description="Update staff member details"
          size="form"
          tall
          footer={
            editingStaff ? (
              <>
                <Button variant="outline" onClick={() => setEditingStaff(null)}>
                  Cancel
                </Button>
                <Button className="ml-2" onClick={handleUpdateStaff}>
                  Save changes
                </Button>
              </>
            ) : undefined
          }
        >
          {editingStaff ? (
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
          ) : null}
        </AdminSideSheet>

        <AdminSideSheet
          open={isAddingStaff}
          onOpenChange={setIsAddingStaff}
          title="Add New Staff Member"
          description="Add any employee to track their salary and payments"
          size="form"
          footer={
            <>
              <Button variant="outline" onClick={() => setIsAddingStaff(false)}>
                Cancel
              </Button>
              <Button className="ml-2" onClick={handleAddStaff}>
                Add Staff Member
              </Button>
            </>
          }
        >
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
                  onChange={(e) => setNewStaff((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="John Doe"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={newStaff.phone}
                  onChange={(e) => setNewStaff((prev) => ({ ...prev, phone: e.target.value }))}
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
                  onChange={(e) => setNewStaff((prev) => ({ ...prev, role: e.target.value }))}
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
                  onChange={(e) =>
                    setNewStaff((prev) => ({
                      ...prev,
                      salary: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0,
                    }))
                  }
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="paymentFrequency">Payment Frequency *</Label>
                <Select
                  value={newStaff.paymentFrequency}
                  onValueChange={(value: 'hourly' | 'daily' | 'monthly') =>
                    setNewStaff((prev) => ({ ...prev, paymentFrequency: value }))
                  }
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
        </AdminSideSheet>
    </AdminPageShell>
  );
};

export default AdminStaff;
