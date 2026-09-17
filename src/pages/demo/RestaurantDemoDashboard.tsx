import React from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  CreditCard,
  Package,
  ShoppingCart,
  User,
  Users,
  UtensilsCrossed,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRestaurantDemo, RESTAURANT_DEMO_ADMIN_BASE } from '@/context/RestaurantDemoContext';
import {
  RESTAURANT_DEMO_SHOWCASE,
  formatDemoMoney,
} from '@/lib/restaurantDemoShowcase';
import {
  adminDashboardHeadingClass,
  adminDashboardListItemClass,
  adminDashboardSectionLabelClass,
  adminDashboardStatLabelClass,
  adminDashboardStatTileClass,
  adminDashboardStatTileInteractiveClass,
  adminDashboardStatValueClass,
  adminDashboardSurfaceClass,
  adminOutlineButtonClass,
} from '@/lib/adminStyles';
import { cn } from '@/lib/utils';

const BASE = RESTAURANT_DEMO_ADMIN_BASE;
const S = RESTAURANT_DEMO_SHOWCASE;

const STAT_TILES = {
  menu: { gradient: 'from-teal-500 to-teal-700', glow: 'group-hover:shadow-teal-500/20', Icon: Package },
  orders: { gradient: 'from-orange-400 to-orange-600', glow: 'group-hover:shadow-orange-500/20', Icon: Clock },
  revenue: { gradient: 'from-emerald-500 to-emerald-700', glow: 'group-hover:shadow-emerald-500/20', Icon: CreditCard },
  guests: { gradient: 'from-indigo-500 to-indigo-700', glow: 'group-hover:shadow-indigo-500/20', Icon: User },
} as const;

const QUICK_ACTIONS = [
  { id: 'orders', to: `${BASE}/orders`, label: 'Orders', gradient: 'from-orange-400 to-orange-600', Icon: ShoppingCart },
  { id: 'guests', to: `${BASE}/customers`, label: 'Guests', gradient: 'from-indigo-500 to-indigo-700', Icon: Users },
  { id: 'menu', to: `${BASE}/products`, label: 'Menu', gradient: 'from-teal-500 to-teal-700', Icon: UtensilsCrossed },
  { id: 'crm', to: `${BASE}/crm/dashboard`, label: 'Sales CRM', gradient: 'from-emerald-500 to-teal-700', Icon: Sparkles },
  { id: 'profile', to: `${BASE}/profile`, label: 'Venue setup', gradient: 'from-violet-500 to-purple-700', Icon: Calendar },
] as const;

const ACTIVITY_ICONS = {
  order: { Icon: ShoppingCart, gradient: 'from-orange-400 to-orange-600' },
  reservation: { Icon: Calendar, gradient: 'from-sky-500 to-blue-700' },
  guest: { Icon: User, gradient: 'from-indigo-500 to-indigo-700' },
  product: { Icon: Package, gradient: 'from-teal-500 to-teal-700' },
  crm: { Icon: Sparkles, gradient: 'from-emerald-500 to-teal-700' },
} as const;

export default function RestaurantDemoDashboard() {
  const { session, entities } = useRestaurantDemo();
  const userCreated = Object.values(entities).reduce((n, arr) => n + (arr?.length ?? 0), 0);
  const createsLeft = (session?.maxActions ?? 5) - (session?.actionCount ?? 0);

  const menuCount = S.stats.menuItems + (entities.products?.length ?? 0);
  const orderCount = S.stats.openOrders + (entities.orders?.length ?? 0);
  const guestCount = S.stats.guestsOnBook + (entities.guests?.length ?? 0);
  const revenue = S.stats.revenueTonightUsd;

  return (
    <div className="space-y-5 p-4 md:p-6 max-w-[1400px]">
      <section
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-5 md:p-6 text-white shadow-lg"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(circle at 20% 20%, rgba(20,184,166,0.35) 0%, transparent 45%), radial-gradient(circle at 80% 0%, rgba(99,102,241,0.25) 0%, transparent 40%)',
          }}
          aria-hidden
        />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-teal-300/90 mb-1">
              <span className="h-px w-4 bg-teal-400/50" />
              Restaurant demo
              <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[8px] text-amber-200">SAMPLE DATA</span>
              <span className="h-px w-4 bg-teal-400/50" />
            </p>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight leading-tight">{S.venueName}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
              <span className="text-slate-300">Welcome back, {S.welcomeName}</span>
              <span className="hidden sm:inline text-slate-600">·</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]" />
                Store online
              </span>
              <span className="hidden sm:inline text-slate-600">·</span>
              <span>{S.stats.coversTonight} covers tonight</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="h-8 border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white text-xs"
              asChild
            >
              <Link to={`${BASE}/profile`}>Venue profile</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 border-amber-300/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20 text-xs"
              asChild
            >
              <Link to="/pricing">Subscribe</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {[
          { key: 'menu', to: `${BASE}/products`, label: 'Menu items', value: menuCount, tile: STAT_TILES.menu },
          { key: 'orders', to: `${BASE}/orders`, label: 'Open orders', value: orderCount, tile: STAT_TILES.orders },
          {
            key: 'revenue',
            to: `${BASE}/orders`,
            label: 'Revenue tonight',
            value: formatDemoMoney(revenue),
            tile: STAT_TILES.revenue,
            sub: S.exchangeRateNote,
          },
          { key: 'guests', to: `${BASE}/customers`, label: 'Guests on book', value: guestCount, tile: STAT_TILES.guests },
        ].map((item) => (
          <Link key={item.key} to={item.to} className="h-full group">
            <Card
              className={cn(
                'h-full min-h-[120px] p-4 overflow-hidden',
                adminDashboardStatTileClass,
                adminDashboardStatTileInteractiveClass,
              )}
            >
              <CardContent className="h-full flex items-center gap-4 p-0">
                <div
                  className={cn(
                    'h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br text-white flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_8px_16px_-6px_rgba(15,23,42,0.45)] transition-shadow',
                    item.tile.gradient,
                    item.tile.glow,
                  )}
                >
                  <item.tile.Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className={adminDashboardStatLabelClass}>{item.label}</div>
                  <div className={adminDashboardStatValueClass}>{item.value}</div>
                  {item.sub ? <div className="text-xs text-slate-500 truncate">{item.sub}</div> : null}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={cn(adminDashboardStatTileClass, 'p-3 text-center')}>
          <p className={adminDashboardStatLabelClass}>Avg check</p>
          <p className={adminDashboardStatValueClass}>{formatDemoMoney(S.stats.avgCheckUsd)}</p>
        </div>
        <div className={cn(adminDashboardStatTileClass, 'p-3 text-center')}>
          <p className={adminDashboardStatLabelClass}>Reservations</p>
          <p className={adminDashboardStatValueClass}>{S.stats.reservationsTonight}</p>
        </div>
        <div className={cn(adminDashboardStatTileClass, 'p-3 text-center')}>
          <p className={adminDashboardStatLabelClass}>Your sandbox saves</p>
          <p className={adminDashboardStatValueClass}>{userCreated}</p>
        </div>
        <div className={cn(adminDashboardStatTileClass, 'p-3 text-center')}>
          <p className={adminDashboardStatLabelClass}>Creates left</p>
          <p className={adminDashboardStatValueClass}>{createsLeft}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 space-y-5">
          <div className={cn('p-4 md:p-5', adminDashboardSurfaceClass)}>
            <div className="mb-4">
              <p className={adminDashboardSectionLabelClass}>Shortcuts</p>
              <h3 className={adminDashboardHeadingClass}>Quick Actions</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {QUICK_ACTIONS.map((item) => (
                <Link
                  key={item.id}
                  to={item.to}
                  className={cn('group flex items-center gap-3 p-3', adminDashboardListItemClass, 'hover:-translate-y-0.5')}
                >
                  <div
                    className={cn(
                      'h-9 w-9 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_6px_12px_-4px_rgba(15,23,42,0.4)] group-hover:scale-105 transition-transform',
                      item.gradient,
                    )}
                  >
                    <item.Icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium text-slate-800 leading-tight">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className={cn('p-4 md:p-5', adminDashboardSurfaceClass)}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className={adminDashboardSectionLabelClass}>Live feed</p>
                <h3 className={adminDashboardHeadingClass}>Recent Activity</h3>
              </div>
              <span className="text-xs font-medium text-teal-700">Sample timeline</span>
            </div>
            <ul className="space-y-2">
              {S.recentActivity.map((ev, idx) => {
                const meta = ACTIVITY_ICONS[ev.type];
                return (
                  <li key={idx} className={cn('p-3', adminDashboardListItemClass)}>
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shadow-sm',
                          meta.gradient,
                        )}
                      >
                        <meta.Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">{ev.label}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{ev.detail} · {ev.ago}</div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <p className={adminDashboardSectionLabelClass}>Tonight</p>
            <h3 className={adminDashboardHeadingClass}>Reservations</h3>
          </div>
          <div className={cn('p-4 space-y-2', adminDashboardSurfaceClass)}>
            {S.reservations.map((r, i) => (
              <div key={i} className={cn('p-3', adminDashboardListItemClass)}>
                <div className="flex justify-between gap-2 text-sm font-medium text-slate-800">
                  <span>{r.guestName}</span>
                  <span className="text-slate-500">{r.table}</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {r.partySize} guests · {r.dateTime}
                </div>
              </div>
            ))}
          </div>

          <div>
            <p className={adminDashboardSectionLabelClass}>Overview</p>
            <h3 className={adminDashboardHeadingClass}>Store Summary</h3>
          </div>
          <Card className={cn('overflow-hidden', adminDashboardSurfaceClass)}>
            <CardContent className="pt-5 pb-2">
              <dl className="divide-y divide-slate-100">
                <div className="flex items-start justify-between gap-3 py-3 first:pt-0">
                  <dt className={adminDashboardStatLabelClass}>Store</dt>
                  <dd className="text-sm font-semibold text-slate-900 text-right">{S.venueName}</dd>
                </div>
                <div className="flex items-start justify-between gap-3 py-3">
                  <dt className={adminDashboardStatLabelClass}>Location</dt>
                  <dd className="text-sm text-slate-700 text-right">{S.location}</dd>
                </div>
                <div className="flex items-start justify-between gap-3 py-3">
                  <dt className={adminDashboardStatLabelClass}>Package</dt>
                  <dd className="text-sm text-slate-700 text-right">{S.packageLabel}</dd>
                </div>
                <div className="flex items-start justify-between gap-3 py-3">
                  <dt className={adminDashboardStatLabelClass}>Announcement</dt>
                  <dd className="text-sm text-slate-700 text-right">{S.announcement}</dd>
                </div>
                <div className="flex items-start justify-between gap-3 py-3">
                  <dt className={adminDashboardStatLabelClass}>CRM tasks</dt>
                  <dd className="text-sm text-slate-700 text-right">{S.stats.crmTasksOpen} open</dd>
                </div>
              </dl>
              <Button variant="outline" size="sm" className={cn('w-full mt-3 mb-2', adminOutlineButtonClass)} asChild>
                <Link to={`${BASE}/crm/dashboard`}>Open CRM board</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
