import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import SEOHead from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RESTAURANT_DEMO_SEED } from '@/lib/restaurantDemoConstants';
import { remainingDemoActions } from '@/lib/restaurantDemoLogic';
import {
  createRestaurantDemoEntity,
  getOrCreateRestaurantDemoSession,
  subscribeRestaurantDemoEntities,
  subscribeRestaurantDemoSession,
  type CreateDemoPayload,
} from '@/lib/restaurantDemoService';
import type { RestaurantDemoEntityType, RestaurantDemoSession } from '@/types/restaurantDemo';
import { cn } from '@/lib/utils';

const SECTIONS: { id: RestaurantDemoEntityType | 'overview'; label: string; locked?: boolean }[] = [
  { id: 'overview', label: 'Today' },
  { id: 'orders', label: 'Service / Orders' },
  { id: 'reservations', label: 'Reservations' },
  { id: 'guests', label: 'Guests & CRM' },
  { id: 'products', label: 'Menu items' },
  { id: 'documents', label: 'Invoices' },
  { id: 'crmTasks', label: 'CRM tasks' },
  { id: 'inventory_locked', label: 'Inventory', locked: true },
  { id: 'accounting_locked', label: 'Accounting', locked: true },
];

const RestaurantInteractiveDemoPage: React.FC = () => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<RestaurantDemoSession | null>(null);
  const [active, setActive] = useState<string>('overview');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [entities, setEntities] = useState<Record<string, Record<string, unknown>[]>>({});

  const remaining = useMemo(
    () => (session ? remainingDemoActions(session.actionCount, session.maxActions) : 0),
    [session],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { sessionId: id, session: s } = await getOrCreateRestaurantDemoSession();
        if (!cancelled) {
          setSessionId(id);
          setSession(s);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not start demo');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    return subscribeRestaurantDemoSession(sessionId, setSession);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const types: RestaurantDemoEntityType[] = [
      'products',
      'guests',
      'reservations',
      'orders',
      'documents',
      'crmTasks',
    ];
    const unsubs = types.map((type) =>
      subscribeRestaurantDemoEntities(sessionId, type, (rows) => {
        setEntities((prev) => ({ ...prev, [type]: rows }));
      }),
    );
    return () => unsubs.forEach((u) => u());
  }, [sessionId]);

  const submit = async (payload: CreateDemoPayload) => {
    if (!sessionId) return;
    setBusy(true);
    setError(null);
    try {
      await createRestaurantDemoEntity(sessionId, payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SEOHead
        title="Live Kitchen Admin Demo | Grabio Restaurant"
        description="Interactive restaurant admin demo — create up to 5 demo menu items, guests, orders, and invoices. No production data. Expires in 30 minutes."
        noindex
      />
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <header className="border-b border-slate-800 bg-slate-900/90 px-4 py-3">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">Demo sandbox · DEMO</p>
              <h1 className="text-lg font-semibold">{RESTAURANT_DEMO_SEED.venueName}</h1>
              <p className="text-xs text-slate-400">
                Live Kitchen admin preview — writes stay in demo only · expires in 30 min
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-teal-700/60 bg-teal-950/50 px-3 py-1 text-xs text-teal-200">
                {remaining} creates left
              </span>
              <Button asChild size="sm" variant="secondary">
                <Link to="/pricing">Subscribe</Link>
              </Button>
            </div>
          </div>
        </header>

        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6 lg:grid-cols-[220px_1fr]">
          <nav className="space-y-1 text-sm">
            {SECTIONS.map((s, i) => (
              <button
                key={`${s.id}-${i}`}
                type="button"
                disabled={s.locked}
                onClick={() => !s.locked && setActive(s.id)}
                className={cn(
                  'flex w-full rounded-md px-3 py-2 text-left',
                  s.locked && 'cursor-not-allowed opacity-40',
                  !s.locked && active === s.id && 'bg-teal-900/40 text-teal-100',
                  !s.locked && active !== s.id && 'text-slate-300 hover:bg-slate-800',
                )}
              >
                {s.label}
                {s.locked ? ' (package)' : ''}
              </button>
            ))}
          </nav>

          <main className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            {error ? <p className="mb-3 text-sm text-rose-400">{error}</p> : null}

            {active === 'overview' && (
              <OverviewPanel session={session} entities={entities} />
            )}
            {active === 'products' && (
              <CreateProductPanel disabled={remaining === 0 || busy} onSubmit={submit} rows={entities.products} />
            )}
            {active === 'guests' && (
              <CreateGuestPanel disabled={remaining === 0 || busy} onSubmit={submit} rows={entities.guests} />
            )}
            {active === 'reservations' && (
              <CreateReservationPanel
                disabled={remaining === 0 || busy}
                onSubmit={submit}
                rows={entities.reservations}
              />
            )}
            {active === 'orders' && (
              <CreateOrderPanel disabled={remaining === 0 || busy} onSubmit={submit} rows={entities.orders} />
            )}
            {active === 'documents' && (
              <CreateDocumentPanel disabled={remaining === 0 || busy} onSubmit={submit} rows={entities.documents} />
            )}
            {active === 'crmTasks' && (
              <CreateCrmPanel disabled={remaining === 0 || busy} onSubmit={submit} rows={entities.crmTasks} />
            )}
          </main>
        </div>
      </div>
    </>
  );
};

function OverviewPanel({
  session,
  entities,
}: {
  session: RestaurantDemoSession | null;
  entities: Record<string, Record<string, unknown>[]>;
}) {
  const created = Object.values(entities).reduce((n, arr) => n + (arr?.length ?? 0), 0);
  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">Daily operations (preview)</h2>
      <p className="text-sm text-slate-400">
        This is what subscribers unlock after Live Kitchen — floor, guests, kitchen, and service. Sample rows below
        are read-only; your creates appear with a <strong className="text-amber-300">DEMO</strong> badge.
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        <li className="rounded-lg border border-slate-700 p-3 text-sm">Open orders (sample): 3</li>
        <li className="rounded-lg border border-slate-700 p-3 text-sm">Guests tonight (sample): 24 covers</li>
        <li className="rounded-lg border border-slate-700 p-3 text-sm">
          Your demo objects: <strong>{created}</strong>
        </li>
        <li className="rounded-lg border border-slate-700 p-3 text-sm">
          Session actions used: {session?.actionCount ?? 0} / {session?.maxActions ?? 5}
        </li>
      </ul>
    </div>
  );
}

function EntityList({ rows }: { rows?: Record<string, unknown>[] }) {
  if (!rows?.length) return <p className="text-xs text-slate-500">No demo rows yet.</p>;
  return (
    <ul className="mt-4 space-y-2">
      {rows.map((r) => (
        <li key={String(r.id)} className="rounded border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-sm">
          <span className="mr-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">DEMO</span>
          {String(r.displayLabel || r.name || r.title || r.id)}
        </li>
      ))}
    </ul>
  );
}

function CreateProductPanel({
  disabled,
  onSubmit,
  rows,
}: {
  disabled: boolean;
  onSubmit: (p: CreateDemoPayload) => Promise<void>;
  rows?: Record<string, unknown>[];
}) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('18');
  const [category, setCategory] = useState('Mains');
  return (
    <div>
      <h2 className="text-base font-semibold">Menu item (demo product)</h2>
      <form
        className="mt-3 grid max-w-md gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit({
            type: 'products',
            name,
            priceUsd: Number(price) || 0,
            category,
          });
          setName('');
        }}
      >
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required disabled={disabled} />
        </div>
        <div>
          <Label>Price (USD)</Label>
          <Input value={price} onChange={(e) => setPrice(e.target.value)} disabled={disabled} />
        </div>
        <div>
          <Label>Category</Label>
          <Input value={category} onChange={(e) => setCategory(e.target.value)} disabled={disabled} />
        </div>
        <Button type="submit" disabled={disabled || !name.trim()}>Save demo menu item</Button>
      </form>
      <EntityList rows={rows} />
    </div>
  );
}

function CreateGuestPanel({
  disabled,
  onSubmit,
  rows,
}: {
  disabled: boolean;
  onSubmit: (p: CreateDemoPayload) => Promise<void>;
  rows?: Record<string, unknown>[];
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  return (
    <div>
      <h2 className="text-base font-semibold">Guest profile</h2>
      <form
        className="mt-3 grid max-w-md gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit({ type: 'guests', name, phone });
          setName('');
        }}
      >
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required disabled={disabled} />
        </div>
        <div>
          <Label>Phone (optional)</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={disabled} />
        </div>
        <Button type="submit" disabled={disabled || !name.trim()}>Save demo guest</Button>
      </form>
      <EntityList rows={rows} />
    </div>
  );
}

function CreateReservationPanel({
  disabled,
  onSubmit,
  rows,
}: {
  disabled: boolean;
  onSubmit: (p: CreateDemoPayload) => Promise<void>;
  rows?: Record<string, unknown>[];
}) {
  const [guestName, setGuestName] = useState('');
  const [partySize, setPartySize] = useState('2');
  const [dateTime, setDateTime] = useState('Tonight 7:30 PM');
  return (
    <div>
      <h2 className="text-base font-semibold">Reservation</h2>
      <form
        className="mt-3 grid max-w-md gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit({
            type: 'reservations',
            guestName,
            partySize: Number(partySize) || 1,
            dateTime,
          });
          setGuestName('');
        }}
      >
        <div>
          <Label>Guest name</Label>
          <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} required disabled={disabled} />
        </div>
        <div>
          <Label>Party size</Label>
          <Input value={partySize} onChange={(e) => setPartySize(e.target.value)} disabled={disabled} />
        </div>
        <div>
          <Label>When</Label>
          <Input value={dateTime} onChange={(e) => setDateTime(e.target.value)} disabled={disabled} />
        </div>
        <Button type="submit" disabled={disabled || !guestName.trim()}>Save demo reservation</Button>
      </form>
      <EntityList rows={rows} />
    </div>
  );
}

function CreateOrderPanel({
  disabled,
  onSubmit,
  rows,
}: {
  disabled: boolean;
  onSubmit: (p: CreateDemoPayload) => Promise<void>;
  rows?: Record<string, unknown>[];
}) {
  const [tableOrChannel, setTable] = useState('Table 12');
  const [total, setTotal] = useState('64');
  return (
    <div>
      <h2 className="text-base font-semibold">Service order</h2>
      <form
        className="mt-3 grid max-w-md gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit({
            type: 'orders',
            tableOrChannel,
            totalUsd: Number(total) || 0,
          });
        }}
      >
        <div>
          <Label>Table / channel</Label>
          <Input value={tableOrChannel} onChange={(e) => setTable(e.target.value)} disabled={disabled} />
        </div>
        <div>
          <Label>Total (USD)</Label>
          <Input value={total} onChange={(e) => setTotal(e.target.value)} disabled={disabled} />
        </div>
        <Button type="submit" disabled={disabled}>Save demo order</Button>
      </form>
      <EntityList rows={rows} />
    </div>
  );
}

function CreateDocumentPanel({
  disabled,
  onSubmit,
  rows,
}: {
  disabled: boolean;
  onSubmit: (p: CreateDemoPayload) => Promise<void>;
  rows?: Record<string, unknown>[];
}) {
  const [amount, setAmount] = useState('120');
  return (
    <div>
      <h2 className="text-base font-semibold">Demo invoice</h2>
      <p className="text-xs text-slate-500">Never posts to GL or real invoice numbering.</p>
      <form
        className="mt-3 grid max-w-md gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit({
            type: 'documents',
            docType: 'invoice',
            amountUsd: Number(amount) || 0,
          });
        }}
      >
        <div>
          <Label>Amount (USD)</Label>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} disabled={disabled} />
        </div>
        <Button type="submit" disabled={disabled}>Save demo invoice</Button>
      </form>
      <EntityList rows={rows} />
    </div>
  );
}

function CreateCrmPanel({
  disabled,
  onSubmit,
  rows,
}: {
  disabled: boolean;
  onSubmit: (p: CreateDemoPayload) => Promise<void>;
  rows?: Record<string, unknown>[];
}) {
  const [title, setTitle] = useState('');
  const [guestName, setGuestName] = useState('');
  return (
    <div>
      <h2 className="text-base font-semibold">CRM follow-up</h2>
      <form
        className="mt-3 grid max-w-md gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit({ type: 'crmTasks', title, guestName });
          setTitle('');
        }}
      >
        <div>
          <Label>Task</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required disabled={disabled} />
        </div>
        <div>
          <Label>Guest (optional)</Label>
          <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} disabled={disabled} />
        </div>
        <Button type="submit" disabled={disabled || !title.trim()}>Save demo CRM task</Button>
      </form>
      <EntityList rows={rows} />
    </div>
  );
}

export default RestaurantInteractiveDemoPage;
