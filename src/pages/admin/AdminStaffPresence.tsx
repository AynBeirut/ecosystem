import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getFirestore, collection, query, where, getDocs, doc, updateDoc, deleteField } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Search, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  buildPayrollRoster,
  canReactivateStaff,
  formatStaffPayLine,
  partitionPayrollRoster,
  partitionStaffByEmploymentStatus,
  resolvePaymentFrequency,
  resolveStaffStatus,
  type StaffPayrollRecord,
} from '@/lib/staffPayrollDisplay';
import { countPresenceDays, totalPresenceHours, type StaffPresenceRecord } from '@/lib/staffPresence';
import { getActualStoreId, resolveStoreIdForAuthUser } from '@/lib/storeUtils';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import StaffPresenceEditor from '@/components/admin/StaffPresenceEditor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type PayTab = 'all' | 'hourly' | 'daily' | 'monthly';

const AdminStaffPresence: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [staff, setStaff] = useState<StaffPayrollRecord[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [presenceByStaffId, setPresenceByStaffId] = useState<Record<string, StaffPresenceRecord>>({});
  const [search, setSearch] = useState('');

  const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);
  const selectedStaffId = searchParams.get('staff') || '';
  const payTab = (searchParams.get('tab') as PayTab) || 'all';

  const setMonth = (value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('month', value);
      return next;
    });
  };

  const setSelectedStaffId = (id: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id) next.set('staff', id);
      else next.delete('staff');
      return next;
    });
  };

  const setPayTab = (tab: PayTab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
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

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const resolvedStoreId =
          getActualStoreId(user) || (await resolveStoreIdForAuthUser(user.id));
        if (cancelled || !resolvedStoreId) return;
        setStoreId(resolvedStoreId);

        const db = getFirestore();
        const staffSnap = await getDocs(
          query(collection(db, 'staff'), where('storeId', '==', resolvedStoreId)),
        );
        if (cancelled) return;
        const staffList = staffSnap.docs.map(
          (docSnap) => ({ id: docSnap.id, ...docSnap.data() } as StaffPayrollRecord),
        );
        setStaff(staffList);

        const presenceSnap = await getDocs(
          query(
            collection(db, 'staffPresence'),
            where('storeId', '==', resolvedStoreId),
            where('month', '==', month),
          ),
        );
        if (cancelled) return;
        const nextPresence: Record<string, StaffPresenceRecord> = {};
        presenceSnap.docs.forEach((docSnap) => {
          const row = { id: docSnap.id, ...docSnap.data() } as StaffPresenceRecord;
          nextPresence[row.staffId] = row;
        });
        setPresenceByStaffId(nextPresence);
      } catch (error) {
        console.error('Failed to load presence page:', error);
        if (!cancelled) {
          toast({
            title: 'Could not load',
            description: 'Staff or presence data failed to load.',
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id, month, toast]);

  const payrollRoster = useMemo(() => buildPayrollRoster(staff), [staff]);
  const { active: activeStaff } = useMemo(
    () => partitionStaffByEmploymentStatus(payrollRoster),
    [payrollRoster],
  );
  const { hourly, monthly } = useMemo(() => partitionPayrollRoster(activeStaff), [activeStaff]);
  const daily = useMemo(
    () => activeStaff.filter((member) => resolvePaymentFrequency(member) === 'daily'),
    [activeStaff],
  );

  const tabMembers = useMemo(() => {
    if (payTab === 'hourly') return hourly;
    if (payTab === 'daily') return daily;
    if (payTab === 'monthly') return monthly;
    return activeStaff;
  }, [payTab, hourly, daily, monthly, activeStaff]);

  const filteredMembers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return tabMembers;
    return tabMembers.filter((member) =>
      [member.name, member.staffName, member.role, member.localId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [tabMembers, search]);

  const selectedStaff =
    filteredMembers.find((member) => member.id === selectedStaffId) ||
    tabMembers.find((member) => member.id === selectedStaffId) ||
    null;

  useEffect(() => {
    if (loading || filteredMembers.length === 0) return;
    if (selectedStaffId && filteredMembers.some((member) => member.id === selectedStaffId)) return;
    setSelectedStaffId(filteredMembers[0].id);
  }, [loading, filteredMembers, selectedStaffId]);

  const payKindLabel = (member: StaffPayrollRecord) => {
    const freq = resolvePaymentFrequency(member);
    if (freq === 'hourly') return 'Hourly';
    if (freq === 'daily') return 'Daily';
    return 'Monthly';
  };

  return (
    <AdminPageShell
      title="Daily Presence"
      description="Register who was present each day — monthly, daily, and hourly staff. Past dates allowed."
      eyebrow="Business Tools"
      actions={(
        <div className="flex flex-wrap gap-2">
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-40"
            aria-label="Presence month"
          />
          <Button variant="outline" asChild>
            <Link to="/admin/staff">Staff (Payroll)</Link>
          </Button>
        </div>
      )}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(280px,360px)_1fr]">
        <AdminPanel className="h-fit">
          <CardContent className="pt-6 space-y-4">
            <Tabs value={payTab} onValueChange={(value) => setPayTab(value as PayTab)}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="hourly">Hourly</TabsTrigger>
                <TabsTrigger value="daily">Daily</TabsTrigger>
                <TabsTrigger value="monthly">Monthly</TabsTrigger>
              </TabsList>
              <TabsContent value={payTab} className="mt-4 space-y-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder="Search employee…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                {loading ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
                ) : filteredMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No employees in this tab.</p>
                ) : (
                  <ul className="divide-y rounded-lg border max-h-[min(70vh,640px)] overflow-y-auto">
                    {filteredMembers.map((member) => {
                      const presence = presenceByStaffId[member.id];
                      const days = countPresenceDays(presence);
                      const hours = totalPresenceHours(presence);
                      const selected = member.id === selectedStaffId;
                      return (
                        <li key={member.id}>
                          <button
                            type="button"
                            className={`w-full px-3 py-3 text-left transition-colors hover:bg-muted/40 ${
                              selected ? 'bg-muted/60' : ''
                            }`}
                            onClick={() => setSelectedStaffId(member.id)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-medium text-sm">{member.name || member.staffName}</p>
                                <p className="text-xs text-muted-foreground">{formatStaffPayLine(member)}</p>
                              </div>
                              <Badge variant="outline" className="shrink-0 text-[10px]">
                                {payKindLabel(member)}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {days} day{days === 1 ? '' : 's'}
                              {hours > 0 ? ` · ${hours.toFixed(1)} hrs` : ''}
                            </p>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </AdminPanel>

        <AdminPanel>
          <CardContent className="pt-6">
            {!storeId || !user?.id ? (
              <p className="text-sm text-muted-foreground">Sign in with a store to register presence.</p>
            ) : !selectedStaff ? (
              <div className="py-16 text-center text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>Select an employee to register daily presence.</p>
              </div>
            ) : resolveStaffStatus(selectedStaff) !== 'active' ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  This employee is inactive — re-activate to register presence.
                </p>
                {canReactivateStaff(selectedStaff) ? (
                  <Button size="sm" onClick={() => handleReactivateStaff(selectedStaff)}>
                    Re-activate
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <CalendarDays className="h-5 w-5" />
                    {selectedStaff.name || selectedStaff.staffName}
                  </h2>
                  <p className="text-sm text-muted-foreground">{month} · {payKindLabel(selectedStaff)} payroll</p>
                </div>
                <StaffPresenceEditor
                  staff={selectedStaff}
                  month={month}
                  storeId={storeId}
                  record={presenceByStaffId[selectedStaff.id]}
                  actor={{ id: user.id, name: user.name }}
                  onUpdated={(record) =>
                    setPresenceByStaffId((prev) => ({ ...prev, [selectedStaff.id]: record }))
                  }
                />
              </div>
            )}
          </CardContent>
        </AdminPanel>
      </div>
    </AdminPageShell>
  );
};

export default AdminStaffPresence;
