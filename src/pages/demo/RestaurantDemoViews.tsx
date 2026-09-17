import React, { useState } from 'react';
import { useRestaurantDemo } from '@/context/RestaurantDemoContext';
import {
  mergeShowcaseWithUserRows,
  RESTAURANT_DEMO_SHOWCASE,
  showcaseCrmRows,
  showcaseGuestRows,
  showcaseOrderRows,
  showcaseProductRows,
  showcaseReservationRows,
  showcaseScheduledOrderRows,
  type DemoShowcaseRow,
} from '@/lib/restaurantDemoShowcase';
import AdminPanel from '@/components/admin/AdminPanel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  adminDashboardHeadingClass,
  adminDashboardSectionLabelClass,
  adminDashboardStatLabelClass,
  adminDashboardSurfaceClass,
} from '@/lib/adminStyles';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import RestaurantDemoDashboard from './RestaurantDemoDashboard';

function DemoPageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-1">
      <p className={adminDashboardSectionLabelClass}>Live Kitchen demo</p>
      <h1 className={adminDashboardHeadingClass}>{title}</h1>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
    </div>
  );
}

function DemoBadge() {
  return (
    <span className="mr-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-900">
      Demo
    </span>
  );
}

function DemoCreateGuard({ children }: { children: React.ReactNode }) {
  const { remainingCreates, error } = useRestaurantDemo();
  if (remainingCreates === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Demo limit reached (5 items). Use <strong>New session</strong> in the banner to try again.
      </p>
    );
  }
  return (
    <>
      {error ? <p className="mb-2 text-sm text-rose-600">{error}</p> : null}
      {children}
    </>
  );
}

function SampleBadge() {
  return (
    <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
      Sample
    </span>
  );
}

function DemoEntityList({
  rows,
  showcase,
}: {
  rows?: Record<string, unknown>[];
  showcase: DemoShowcaseRow[];
}) {
  const merged = mergeShowcaseWithUserRows(showcase, rows);
  return (
    <ul className="mt-4 space-y-2">
      {merged.map((r) => {
        const isShowcase = Boolean((r as DemoShowcaseRow).showcase);
        const row = r as DemoShowcaseRow & Record<string, unknown>;
        return (
          <li key={String(row.id)} className={cn(adminDashboardSurfaceClass, 'px-3 py-2.5 text-sm')}>
            {isShowcase ? <SampleBadge /> : <DemoBadge />}
            <span className="font-medium">{String(row.displayLabel || row.name || row.title || row.id)}</span>
            {row.subtitle ? <span className="text-muted-foreground"> · {String(row.subtitle)}</span> : null}
            {row.meta ? <p className="text-xs text-muted-foreground mt-0.5">{String(row.meta)}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}

export function RestaurantDemoDashboardView() {
  return <RestaurantDemoDashboard />;
}

export function RestaurantDemoProductsView() {
  const { createDemo, entities } = useRestaurantDemo();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('22');
  const [category, setCategory] = useState('Mains');
  return (
    <div className="space-y-4 p-4 md:p-6 max-w-4xl">
      <DemoPageHeader title="Products" description="Menu catalog preview — sample dishes plus your sandbox saves." />
      <AdminPanel>
        <CardHeader>
          <CardTitle>Menu items</CardTitle>
          <CardDescription>Saved as demo products only — not your live catalog.</CardDescription>
        </CardHeader>
        <CardContent>
          <DemoCreateGuard>
            <form
              className="grid max-w-md gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void createDemo({ type: 'products', name, priceUsd: Number(price) || 0, category }).then(() =>
                  setName(''),
                );
              }}
            >
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <Label>Price (USD)</Label>
                <Input value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
              <div>
                <Label>Category</Label>
                <Input value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>
              <Button type="submit">Save demo menu item</Button>
            </form>
          </DemoCreateGuard>
          <DemoEntityList rows={entities.products} showcase={showcaseProductRows()} />
        </CardContent>
      </AdminPanel>
    </div>
  );
}

export function RestaurantDemoCustomersView() {
  const { createDemo, entities } = useRestaurantDemo();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  return (
    <div className="space-y-4 p-4 md:p-6 max-w-4xl">
      <DemoPageHeader title="Guests" description="Guest book for service — sample regulars plus demo entries you add." />
      <AdminPanel>
        <CardHeader>
          <CardTitle>Guest list</CardTitle>
          <CardDescription>Demo guests only — no CRM sync to production.</CardDescription>
        </CardHeader>
        <CardContent>
          <DemoCreateGuard>
            <form
              className="grid max-w-md gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void createDemo({ type: 'guests', name, phone }).then(() => setName(''));
              }}
            >
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <Button type="submit">Save demo guest</Button>
            </form>
          </DemoCreateGuard>
          <DemoEntityList rows={entities.guests} showcase={showcaseGuestRows()} />
        </CardContent>
      </AdminPanel>
    </div>
  );
}

export function RestaurantDemoOrdersView() {
  const { createDemo, entities } = useRestaurantDemo();
  const [table, setTable] = useState('Table 8');
  const [total, setTotal] = useState('86');
  return (
    <div className="space-y-4 p-4 md:p-6 max-w-4xl">
      <DemoPageHeader title="Orders" description="Tonight’s floor — sample tickets plus orders you create in the sandbox." />
      <AdminPanel>
        <CardHeader>
          <CardTitle>Service orders</CardTitle>
          <CardDescription>No kitchen print, POS, or stock impact.</CardDescription>
        </CardHeader>
        <CardContent>
          <DemoCreateGuard>
            <form
              className="grid max-w-md gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void createDemo({ type: 'orders', tableOrChannel: table, totalUsd: Number(total) || 0 });
              }}
            >
              <div>
                <Label>Table / channel</Label>
                <Input value={table} onChange={(e) => setTable(e.target.value)} />
              </div>
              <div>
                <Label>Total (USD)</Label>
                <Input value={total} onChange={(e) => setTotal(e.target.value)} />
              </div>
              <Button type="submit">Save demo order</Button>
            </form>
          </DemoCreateGuard>
          <DemoEntityList rows={entities.orders} showcase={showcaseOrderRows()} />
        </CardContent>
      </AdminPanel>
    </div>
  );
}

export function RestaurantDemoCrmView() {
  const { createDemo, entities } = useRestaurantDemo();
  const [title, setTitle] = useState('');
  const [guestName, setGuestName] = useState('');
  return (
    <div className="space-y-4 p-4 md:p-6 max-w-4xl">
      <DemoPageHeader title="Sales CRM" description="Follow-ups and hospitality touches — sample pipeline plus your tasks." />
      <AdminPanel>
        <CardHeader>
          <CardTitle>Follow-ups</CardTitle>
          <CardDescription>Demo tasks — not assigned to real staff.</CardDescription>
        </CardHeader>
        <CardContent>
          <DemoCreateGuard>
            <form
              className="grid max-w-md gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void createDemo({ type: 'crmTasks', title, guestName }).then(() => setTitle(''));
              }}
            >
              <div>
                <Label>Task</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div>
                <Label>Guest (optional)</Label>
                <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} />
              </div>
              <Button type="submit">Save demo CRM task</Button>
            </form>
          </DemoCreateGuard>
          <DemoEntityList rows={entities.crmTasks} showcase={showcaseCrmRows()} />
        </CardContent>
      </AdminPanel>
    </div>
  );
}

export function RestaurantDemoScheduledOrdersView() {
  const { entities, createDemo } = useRestaurantDemo();
  const [label, setLabel] = useState('Private dining — 6 guests');
  const [when, setWhen] = useState('Tomorrow · 7:30 PM');
  const userRows = entities.orders?.filter((r) => String(r.displayLabel || '').includes('Scheduled')) ?? [];
  return (
    <div className="space-y-4 p-4 md:p-6 max-w-4xl">
      <DemoPageHeader
        title="Scheduled Orders"
        description="Future service and catering holds — sample bookings for Bistro Lumière."
      />
      <AdminPanel>
        <CardHeader>
          <CardTitle>Upcoming</CardTitle>
          <CardDescription>Demo only — no kitchen or billing sync.</CardDescription>
        </CardHeader>
        <CardContent>
          <DemoEntityList rows={userRows} showcase={showcaseScheduledOrderRows()} />
        </CardContent>
      </AdminPanel>
      <AdminPanel>
        <CardHeader>
          <CardTitle>Log a demo hold</CardTitle>
          <CardDescription>Saves as a demo order tagged for scheduling preview.</CardDescription>
        </CardHeader>
        <CardContent>
          <DemoCreateGuard>
            <form
              className="grid max-w-md gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void createDemo({
                  type: 'orders',
                  tableOrChannel: `Scheduled · ${label} · ${when}`,
                  totalUsd: 0,
                });
              }}
            >
              <div>
                <Label>Label</Label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} />
              </div>
              <div>
                <Label>When</Label>
                <Input value={when} onChange={(e) => setWhen(e.target.value)} />
              </div>
              <Button type="submit">Save demo scheduled hold</Button>
            </form>
          </DemoCreateGuard>
        </CardContent>
      </AdminPanel>
    </div>
  );
}

export function RestaurantDemoEventsView() {
  const { createDemo, entities } = useRestaurantDemo();
  const [guestName, setGuestName] = useState('');
  const [partySize, setPartySize] = useState('2');
  const [dateTime, setDateTime] = useState('Tonight · 8:00 PM');
  return (
    <div className="space-y-4 p-4 md:p-6 max-w-4xl">
      <DemoPageHeader
        title="Reservations"
        description="Tonight’s book — sample tables plus reservations you add in the sandbox."
      />
      <AdminPanel>
        <CardHeader>
          <CardTitle>Reservation list</CardTitle>
          <CardDescription>{RESTAURANT_DEMO_SHOWCASE.venueName} · {RESTAURANT_DEMO_SHOWCASE.location}</CardDescription>
        </CardHeader>
        <CardContent>
          <DemoCreateGuard>
            <form
              className="grid max-w-md gap-3 mb-6"
              onSubmit={(e) => {
                e.preventDefault();
                void createDemo({
                  type: 'reservations',
                  guestName,
                  partySize: Number(partySize) || 2,
                  dateTime,
                }).then(() => setGuestName(''));
              }}
            >
              <div>
                <Label>Guest name</Label>
                <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} required />
              </div>
              <div>
                <Label>Party size</Label>
                <Input value={partySize} onChange={(e) => setPartySize(e.target.value)} />
              </div>
              <div>
                <Label>Date & time</Label>
                <Input value={dateTime} onChange={(e) => setDateTime(e.target.value)} />
              </div>
              <Button type="submit">Save demo reservation</Button>
            </form>
          </DemoCreateGuard>
          <DemoEntityList rows={entities.reservations} showcase={showcaseReservationRows()} />
        </CardContent>
      </AdminPanel>
    </div>
  );
}

export function RestaurantDemoProfileView() {
  const { profile, toAdminPath } = useRestaurantDemo();
  const s = profile.venueOpsSettings;
  const showcase = RESTAURANT_DEMO_SHOWCASE;
  const toggles = [
    { label: 'Restaurant-focused sidebar', on: s?.restaurantFirstNavEnabled },
    { label: 'Guest CRM', on: s?.enableCrmPipeline },
    { label: 'Reservations hub', on: s?.enableReservationsHub },
    { label: 'Full inventory module', on: s?.enableFullInventory },
    { label: 'Business finance', on: s?.enableBusinessFinance },
    { label: 'Storefront builder', on: s?.enableStorefrontBuilder },
    { label: 'SEO ops', on: s?.enableSeoOps },
  ];
  return (
    <div className="space-y-4 p-4 md:p-6 max-w-3xl">
      <DemoPageHeader
        title="Store Profile"
        description="How subscribers configure venue ops — read-only preview in demo."
      />
      <AdminPanel>
        <CardHeader>
          <CardTitle>{showcase.venueName}</CardTitle>
          <CardDescription>{showcase.location} · {showcase.packageLabel}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <dl className="grid gap-2 sm:grid-cols-2">
            <div className={cn(adminDashboardSurfaceClass, 'p-3')}>
              <dt className={adminDashboardStatLabelClass}>Status</dt>
              <dd className="font-medium">Online · accepting reservations</dd>
            </div>
            <div className={cn(adminDashboardSurfaceClass, 'p-3')}>
              <dt className={adminDashboardStatLabelClass}>Announcement</dt>
              <dd className="font-medium">{showcase.announcement}</dd>
            </div>
          </dl>
          <div>
            <p className={adminDashboardSectionLabelClass}>Venue operations toggles</p>
            <ul className="mt-2 space-y-2">
              {toggles.map((t) => (
                <li key={t.label} className={cn(adminDashboardSurfaceClass, 'flex justify-between px-3 py-2')}>
                  <span>{t.label}</span>
                  <span className={t.on ? 'text-teal-700 font-medium' : 'text-muted-foreground'}>
                    {t.on ? 'On' : 'Off'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/pricing">Subscribe to edit on your venue</Link>
          </Button>
        </CardContent>
      </AdminPanel>
    </div>
  );
}

export function RestaurantDemoUnknownView() {
  const { toAdminPath } = useRestaurantDemo();
  return (
    <div className="p-6 md:p-10 max-w-lg">
      <DemoPageHeader
        title="Not in this demo"
        description="That admin screen isn’t wired in the sandbox. Use the sidebar or dashboard shortcuts."
      />
      <Button asChild className="mt-4">
        <Link to={toAdminPath('/admin/dashboard')}>Back to dashboard</Link>
      </Button>
    </div>
  );
}
