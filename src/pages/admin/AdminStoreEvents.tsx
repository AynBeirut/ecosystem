import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  CalendarDays,
  Link2,
  List,
  Plus,
  Sparkles,
  Ticket,
  Trash2,
} from 'lucide-react';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import ModuleGate from '@/components/ModuleGate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  cancelEventTicket,
  cancelStoreEvent,
  clearActiveStoreEvent,
  createEventReservation,
  createEventTicket,
  createStoreEvent,
  listEventReservations,
  listEventTickets,
  listStoreEvents,
  listStoreReservations,
  setActiveStoreEvent,
  updateEventReservation,
  updateStoreEvent,
} from '@/lib/storeEventsApi';
import {
  DEFAULT_EVENT_SETTINGS,
  type ActiveEventPointer,
  type EventReservation,
  type EventTicket,
  type StoreEvent,
  type StoreEventSettings,
} from '@/types/storeEvents';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  scheduled: 'bg-blue-100 text-blue-700',
  active: 'bg-emerald-100 text-emerald-700',
  ended: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-100 text-red-700',
  issued: 'bg-amber-100 text-amber-800',
  checked_in: 'bg-cyan-100 text-cyan-800',
  linked: 'bg-emerald-100 text-emerald-800',
};

function toLocalInputValue(iso: string): string {
  if (!iso) return '';
  const date = parseISO(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInputValue(value: string): string {
  if (!value) return new Date().toISOString();
  return new Date(value).toISOString();
}

const emptyForm = () => ({
  name: '',
  startAt: toLocalInputValue(new Date().toISOString()),
  endAt: toLocalInputValue(new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()),
  status: 'draft' as StoreEvent['status'],
  settings: { ...DEFAULT_EVENT_SETTINGS },
});

const AdminStoreEvents: React.FC = () => {
  const { toast } = useToast();
  const [events, setEvents] = useState<StoreEvent[]>([]);
  const [activeEvent, setActiveEvent] = useState<ActiveEventPointer | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedEvent, setSelectedEvent] = useState<StoreEvent | null>(null);
  const [tickets, setTickets] = useState<EventTicket[]>([]);
  const [ticketSummary, setTicketSummary] = useState({ total: 0, linked: 0, issued: 0 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<StoreEvent | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [ticketForm, setTicketForm] = useState({ guestName: '', guestPhone: '', entryFeePaid: false, notes: '' });
  const [reservations, setReservations] = useState<EventReservation[]>([]);
  const [reservationForm, setReservationForm] = useState({
    guestName: '',
    guestPhone: '',
    partySize: '2',
    reservedFor: toLocalInputValue(new Date().toISOString()),
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listStoreEvents();
      setEvents(data.events);
      setActiveEvent(data.activeEvent);
    } catch (error) {
      toast({
        title: 'Could not load events',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadTickets = useCallback(async (eventId: string) => {
    try {
      const data = await listEventTickets(eventId);
      setTickets(data.tickets);
      setTicketSummary(data.summary);
    } catch (error) {
      toast({
        title: 'Could not load tickets',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const loadReservations = useCallback(async (eventId?: string) => {
    try {
      if (eventId) {
        const data = await listEventReservations(eventId);
        setReservations(data.reservations);
        return;
      }
      const data = await listStoreReservations();
      setReservations(data.reservations);
    } catch (error) {
      toast({
        title: 'Could not load reservations',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  }, [toast]);

  useEffect(() => {
    void loadEvents();
    void loadReservations();
  }, [loadEvents, loadReservations]);

  useEffect(() => {
    if (selectedEvent) {
      void loadTickets(selectedEvent.id);
      if (selectedEvent.settings.reservationsEnabled) void loadReservations(selectedEvent.id);
    }
  }, [selectedEvent, loadTickets, loadReservations]);

  const eventDates = useMemo(
    () => [
      ...events.flatMap((event) => {
        const start = parseISO(event.startAt);
        const end = parseISO(event.endAt);
        return [start, end];
      }),
      ...reservations
        .map((reservation) => parseISO(reservation.reservedFor))
        .filter((date) => !Number.isNaN(date.getTime())),
    ],
    [events, reservations],
  );

  const filteredEvents = useMemo(() => {
    if (!selectedDate) return events;
    return events.filter((event) => {
      const start = parseISO(event.startAt);
      const end = parseISO(event.endAt);
      return selectedDate >= start && selectedDate <= end;
    });
  }, [events, selectedDate]);

  const openCreate = () => {
    setEditingEvent(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (event: StoreEvent) => {
    setEditingEvent(event);
    setForm({
      name: event.name,
      startAt: toLocalInputValue(event.startAt),
      endAt: toLocalInputValue(event.endAt),
      status: event.status,
      settings: { ...DEFAULT_EVENT_SETTINGS, ...event.settings },
    });
    setDialogOpen(true);
  };

  const saveEvent = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Event name required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        startAt: fromLocalInputValue(form.startAt),
        endAt: fromLocalInputValue(form.endAt),
        status: form.status,
        settings: form.settings,
      };
      if (editingEvent) {
        await updateStoreEvent(editingEvent.id, payload);
        toast({ title: 'Event updated' });
      } else {
        await createStoreEvent(payload);
        toast({ title: 'Event created' });
      }
      setDialogOpen(false);
      await loadEvents();
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSetActive = async (event: StoreEvent) => {
    try {
      const pointer = await setActiveStoreEvent(event.id);
      setActiveEvent(pointer);
      toast({ title: 'Active event set', description: event.name });
      await loadEvents();
    } catch (error) {
      toast({
        title: 'Could not set active event',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleClearActive = async () => {
    try {
      await clearActiveStoreEvent();
      setActiveEvent(null);
      toast({ title: 'Active event cleared' });
      await loadEvents();
    } catch (error) {
      toast({
        title: 'Could not clear active event',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleCancelEvent = async (event: StoreEvent) => {
    try {
      await cancelStoreEvent(event.id);
      if (selectedEvent?.id === event.id) setSelectedEvent(null);
      toast({ title: 'Event cancelled' });
      await loadEvents();
    } catch (error) {
      toast({
        title: 'Cancel failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleCreateTicket = async () => {
    if (!selectedEvent) return;
    if (!ticketForm.guestName.trim()) {
      toast({ title: 'Guest name required', variant: 'destructive' });
      return;
    }
    try {
      await createEventTicket(selectedEvent.id, ticketForm);
      setTicketForm({ guestName: '', guestPhone: '', entryFeePaid: false, notes: '' });
      toast({ title: 'Ticket issued' });
      await loadTickets(selectedEvent.id);
    } catch (error) {
      toast({
        title: 'Ticket failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleCancelTicket = async (ticket: EventTicket) => {
    if (!selectedEvent) return;
    try {
      await cancelEventTicket(selectedEvent.id, ticket.id);
      toast({ title: 'Ticket cancelled' });
      await loadTickets(selectedEvent.id);
    } catch (error) {
      toast({
        title: 'Cancel failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleCreateReservation = async () => {
    if (!selectedEvent) return;
    if (!reservationForm.guestName.trim()) {
      toast({ title: 'Guest name required', variant: 'destructive' });
      return;
    }
    try {
      await createEventReservation(selectedEvent.id, {
        guestName: reservationForm.guestName.trim(),
        guestPhone: reservationForm.guestPhone.trim(),
        partySize: Number(reservationForm.partySize) || 2,
        reservedFor: fromLocalInputValue(reservationForm.reservedFor),
        notes: reservationForm.notes.trim(),
      });
      setReservationForm({
        guestName: '',
        guestPhone: '',
        partySize: '2',
        reservedFor: toLocalInputValue(new Date().toISOString()),
        notes: '',
      });
      toast({ title: 'Reservation saved' });
      await loadReservations(selectedEvent.id);
      await loadReservations();
    } catch (error) {
      toast({
        title: 'Reservation failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleReservationStatus = async (reservation: EventReservation, status: EventReservation['status']) => {
    if (!selectedEvent) return;
    try {
      await updateEventReservation(selectedEvent.id, reservation.id, { status });
      await loadReservations(selectedEvent.id);
      await loadReservations();
    } catch (error) {
      toast({
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const updateSetting = (key: keyof StoreEventSettings, value: boolean | number | null) => {
    setForm((prev) => ({
      ...prev,
      settings: { ...prev.settings, [key]: value },
    }));
  };

  return (
    <ModuleGate moduleId="pos">
      <AdminPageShell
        title="Store Events"
        description="Plan events, issue entry tickets, and link guest names to POS sales."
        eyebrow="Events"
        backTo="/admin/dashboard"
      >
        {activeEvent && (
          <AdminPanel className="mb-4 border-emerald-200 bg-emerald-50/70">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Active event</p>
                <p className="text-lg font-semibold text-emerald-950">{activeEvent.name}</p>
                <p className="text-sm text-emerald-800">
                  {format(parseISO(activeEvent.startAt), 'MMM d, HH:mm')} – {format(parseISO(activeEvent.endAt), 'MMM d, HH:mm')}
                </p>
              </div>
              <Button variant="outline" onClick={() => void handleClearActive()}>Clear active</Button>
            </CardContent>
          </AdminPanel>
        )}

        <div className="mb-4 flex justify-end">
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />New event</Button>
        </div>

        <Tabs defaultValue="calendar">
          <TabsList>
            <TabsTrigger value="calendar"><CalendarDays className="mr-2 h-4 w-4" />Calendar</TabsTrigger>
            <TabsTrigger value="list"><List className="mr-2 h-4 w-4" />List</TabsTrigger>
            <TabsTrigger value="reservations"><Ticket className="mr-2 h-4 w-4" />Reservations</TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="mt-4 grid gap-4 lg:grid-cols-[320px_1fr]">
            <AdminPanel>
              <CardHeader>
                <CardTitle className="text-base">Calendar</CardTitle>
                <CardDescription>Select a day to filter events.</CardDescription>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  modifiers={{ hasEvent: eventDates }}
                  modifiersClassNames={{ hasEvent: 'bg-teal-100 font-semibold text-teal-900' }}
                />
              </CardContent>
            </AdminPanel>

            <EventListPanel
              loading={loading}
              events={filteredEvents}
              activeEventId={activeEvent?.eventId}
              onSelect={setSelectedEvent}
              onEdit={openEdit}
              onSetActive={(event) => void handleSetActive(event)}
              onCancel={(event) => void handleCancelEvent(event)}
            />
          </TabsContent>

          <TabsContent value="list" className="mt-4">
            <EventListPanel
              loading={loading}
              events={events}
              activeEventId={activeEvent?.eventId}
              onSelect={setSelectedEvent}
              onEdit={openEdit}
              onSetActive={(event) => void handleSetActive(event)}
              onCancel={(event) => void handleCancelEvent(event)}
            />
          </TabsContent>

          <TabsContent value="reservations" className="mt-4">
            <AdminPanel>
              <CardHeader>
                <CardTitle className="text-base">All event reservations</CardTitle>
                <CardDescription>Merged calendar view across events with reservations enabled.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="px-3 py-2">When</th>
                      <th className="px-3 py-2">Event</th>
                      <th className="px-3 py-2">Guest</th>
                      <th className="px-3 py-2">Party</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservations.map((reservation) => (
                      <tr key={reservation.id} className="border-t">
                        <td className="px-3 py-2">{reservation.reservedFor ? format(parseISO(reservation.reservedFor), 'MMM d, HH:mm') : '—'}</td>
                        <td className="px-3 py-2">{reservation.eventName || reservation.eventId}</td>
                        <td className="px-3 py-2">{reservation.guestName}</td>
                        <td className="px-3 py-2">{reservation.partySize}</td>
                        <td className="px-3 py-2"><Badge className={STATUS_COLORS[reservation.status] || ''}>{reservation.status}</Badge></td>
                      </tr>
                    ))}
                    {reservations.length === 0 && (
                      <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No reservations yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </AdminPanel>
          </TabsContent>
        </Tabs>

        {selectedEvent && (
          <AdminPanel className="mt-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Ticket className="h-5 w-5" />Tickets · {selectedEvent.name}
              </CardTitle>
              <CardDescription>
                {ticketSummary.total} total · {ticketSummary.issued} open · {ticketSummary.linked} linked to POS sales
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <Input
                  placeholder="Guest name *"
                  value={ticketForm.guestName}
                  onChange={(e) => setTicketForm((prev) => ({ ...prev, guestName: e.target.value }))}
                />
                <Input
                  placeholder="Phone"
                  value={ticketForm.guestPhone}
                  onChange={(e) => setTicketForm((prev) => ({ ...prev, guestPhone: e.target.value }))}
                />
                <div className="flex items-center gap-2 rounded-md border px-3">
                  <Switch
                    checked={ticketForm.entryFeePaid}
                    onCheckedChange={(checked) => setTicketForm((prev) => ({ ...prev, entryFeePaid: checked }))}
                  />
                  <span className="text-sm">Entry fee paid</span>
                </div>
                <Button onClick={() => void handleCreateTicket()}>Issue ticket</Button>
              </div>

              <div className="overflow-x-auto rounded-lg border">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="px-3 py-2">Ticket #</th>
                      <th className="px-3 py-2">Guest</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Linked sale</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((ticket) => (
                      <tr key={ticket.id} className="border-t">
                        <td className="px-3 py-2 font-mono">{ticket.ticketNumber}</td>
                        <td className="px-3 py-2">{ticket.guestName}</td>
                        <td className="px-3 py-2">
                          <Badge className={STATUS_COLORS[ticket.status] || ''}>{ticket.status}</Badge>
                        </td>
                        <td className="px-3 py-2">
                          {ticket.linkedOrderId ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700">
                              <Link2 className="h-3.5 w-3.5" />{ticket.linkedLocalSaleId || ticket.linkedOrderId.slice(-8)}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {ticket.status !== 'linked' && ticket.status !== 'cancelled' && (
                            <Button size="sm" variant="ghost" onClick={() => void handleCancelTicket(ticket)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {tickets.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No tickets yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </AdminPanel>
        )}

        {selectedEvent?.settings.reservationsEnabled && (
          <AdminPanel className="mt-4">
            <CardHeader>
              <CardTitle className="text-lg">Reservations · {selectedEvent.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-5">
                <Input placeholder="Guest name *" value={reservationForm.guestName} onChange={(e) => setReservationForm((p) => ({ ...p, guestName: e.target.value }))} />
                <Input placeholder="Phone" value={reservationForm.guestPhone} onChange={(e) => setReservationForm((p) => ({ ...p, guestPhone: e.target.value }))} />
                <Input type="number" min={1} placeholder="Party size" value={reservationForm.partySize} onChange={(e) => setReservationForm((p) => ({ ...p, partySize: e.target.value }))} />
                <Input type="datetime-local" value={reservationForm.reservedFor} onChange={(e) => setReservationForm((p) => ({ ...p, reservedFor: e.target.value }))} />
                <Button onClick={() => void handleCreateReservation()}>Add reservation</Button>
              </div>
              <div className="space-y-2">
                {reservations.filter((r) => r.eventId === selectedEvent.id).map((reservation) => (
                  <div key={reservation.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
                    <div>
                      <p className="font-medium">{reservation.guestName} · party {reservation.partySize}</p>
                      <p className="text-sm text-muted-foreground">
                        {reservation.reservedFor ? format(parseISO(reservation.reservedFor), 'MMM d, HH:mm') : '—'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge className={STATUS_COLORS[reservation.status] || ''}>{reservation.status}</Badge>
                      {reservation.status === 'pending' && (
                        <Button size="sm" variant="outline" onClick={() => void handleReservationStatus(reservation, 'confirmed')}>Confirm</Button>
                      )}
                      {reservation.status !== 'cancelled' && (
                        <Button size="sm" variant="ghost" onClick={() => void handleReservationStatus(reservation, 'cancelled')}>Cancel</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </AdminPanel>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{editingEvent ? 'Edit event' : 'Create event'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="event-name">Name</Label>
                <Input id="event-name" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="event-start">Start</Label>
                  <Input id="event-start" type="datetime-local" value={form.startAt} onChange={(e) => setForm((prev) => ({ ...prev, startAt: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="event-end">End</Label>
                  <Input id="event-end" type="datetime-local" value={form.endAt} onChange={(e) => setForm((prev) => ({ ...prev, endAt: e.target.value }))} />
                </div>
              </div>

              <AdminPanel className="border-dashed">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Sparkles className="h-4 w-4" />Event pricing & linking
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Creating an event auto-adds an Entry product to POS catalog. Selling it at register auto-issues ticket T-0001…
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <SettingRow label="Entry fee enabled" checked={form.settings.entryFeeEnabled} onCheckedChange={(v) => updateSetting('entryFeeEnabled', v)} />
                  {form.settings.entryFeeEnabled && (
                    <Input
                      type="number"
                      placeholder="Entry fee amount"
                      value={form.settings.entryFee ?? ''}
                      onChange={(e) => updateSetting('entryFee', e.target.value ? Number(e.target.value) : null)}
                    />
                  )}
                  <SettingRow label="Event discount enabled" checked={form.settings.discountEnabled} onCheckedChange={(v) => updateSetting('discountEnabled', v)} />
                  {form.settings.discountEnabled && (
                    <Input
                      type="number"
                      placeholder="Discount percent"
                      value={form.settings.percent ?? ''}
                      onChange={(e) => updateSetting('percent', e.target.value ? Number(e.target.value) : null)}
                    />
                  )}
                  <SettingRow label="Require guest name on tickets" checked={form.settings.requireGuestName} onCheckedChange={(v) => updateSetting('requireGuestName', v)} />
                  <SettingRow label="Link entry tickets to POS sales" checked={form.settings.linkTicketsToSales} onCheckedChange={(v) => updateSetting('linkTicketsToSales', v)} />
                  <SettingRow label="Reservations enabled" checked={form.settings.reservationsEnabled} onCheckedChange={(v) => updateSetting('reservationsEnabled', v)} />
                </CardContent>
              </AdminPanel>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => void saveEvent()} disabled={saving}>{saving ? 'Saving…' : 'Save event'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AdminPageShell>
    </ModuleGate>
  );
};

function SettingRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function EventListPanel({
  loading,
  events,
  activeEventId,
  onSelect,
  onEdit,
  onSetActive,
  onCancel,
}: {
  loading: boolean;
  events: StoreEvent[];
  activeEventId?: string;
  onSelect: (event: StoreEvent) => void;
  onEdit: (event: StoreEvent) => void;
  onSetActive: (event: StoreEvent) => void;
  onCancel: (event: StoreEvent) => void;
}) {
  if (loading) {
    return <AdminPanel><CardContent className="p-6 text-sm text-muted-foreground">Loading events…</CardContent></AdminPanel>;
  }

  if (events.length === 0) {
    return <AdminPanel><CardContent className="p-6 text-sm text-muted-foreground">No events for this view.</CardContent></AdminPanel>;
  }

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <AdminPanel key={event.id} className={activeEventId === event.id ? 'border-emerald-300' : undefined}>
          <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
            <button type="button" className="text-left" onClick={() => onSelect(event)}>
              <div className="flex items-center gap-2">
                <p className="font-semibold">{event.name}</p>
                <Badge className={STATUS_COLORS[event.status] || ''}>{event.status}</Badge>
                {activeEventId === event.id && <Badge className="bg-emerald-600 text-white">Active</Badge>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {format(parseISO(event.startAt), 'MMM d, yyyy HH:mm')} – {format(parseISO(event.endAt), 'MMM d, yyyy HH:mm')}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {event.settings.entryFeeEnabled ? `Entry fee: ${event.settings.entryFee ?? 0}` : 'No entry fee'} ·
                {event.settings.discountEnabled ? ` ${event.settings.percent ?? 0}% discount` : ' no discount'} ·
                {event.settings.linkTicketsToSales ? ' ticket↔sale linking on' : ' ticket↔sale linking off'}
              </p>
            </button>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => onEdit(event)}>Edit</Button>
              {event.status !== 'cancelled' && activeEventId !== event.id && (
                <Button size="sm" onClick={() => onSetActive(event)}>Set active</Button>
              )}
              {event.status !== 'cancelled' && (
                <Button size="sm" variant="destructive" onClick={() => onCancel(event)}>Cancel</Button>
              )}
            </div>
          </CardContent>
        </AdminPanel>
      ))}
    </div>
  );
}

export default AdminStoreEvents;
