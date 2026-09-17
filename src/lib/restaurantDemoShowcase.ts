/** Read-only showcase rows — never written to Firestore; merged in demo UI only. */

export type DemoShowcaseRow = {
  id: string;
  displayLabel: string;
  showcase: true;
  subtitle?: string;
  meta?: string;
};

export const RESTAURANT_DEMO_SHOWCASE = {
  venueName: 'Bistro Lumière',
  location: 'Gemmayze · Beirut',
  template: 'Fine dining — Live Kitchen',
  packageLabel: 'Live Kitchen · Pro',
  statusOnline: true,
  welcomeName: 'Chef demo',
  tagline: 'Tonight’s service preview — sample numbers only',
  stats: {
    menuItems: 48,
    openOrders: 7,
    revenueTonightUsd: 2840,
    guestsOnBook: 86,
    coversTonight: 24,
    avgCheckUsd: 118,
    reservationsTonight: 12,
    crmTasksOpen: 4,
  },
  exchangeRateNote: '≈ 89,500 LBP / USD (sample)',
  announcement: 'Chef’s tasting menu — Friday & Saturday',
  products: [
    { name: 'Duck confit', priceUsd: 28, category: 'Mains' },
    { name: 'Burrata & fig', priceUsd: 14, category: 'Starters' },
    { name: 'Sea bass en papillote', priceUsd: 32, category: 'Mains' },
    { name: 'Chocolate fondant', priceUsd: 12, category: 'Dessert' },
    { name: 'Sommelier pairing', priceUsd: 24, category: 'Drinks' },
  ],
  guests: [
    { name: 'Amal H.', phone: '+961 ••• 4821', notes: 'Anniversary · window table' },
    { name: 'Marc & Lina T.', phone: '+961 ••• 9902', notes: 'Regulars · no nuts' },
    { name: 'Corporate — Emoove', phone: 'Walk-in', notes: '8 covers · prefix menu' },
  ],
  reservations: [
    { guestName: 'Amal H.', partySize: 2, dateTime: 'Tonight · 8:00 PM', table: 'T12' },
    { guestName: 'Walk-in queue', partySize: 4, dateTime: 'Tonight · 8:30 PM', table: 'Bar' },
    { guestName: 'Marc T.', partySize: 2, dateTime: 'Tonight · 9:15 PM', table: 'T4' },
  ],
  scheduledOrders: [
    { label: 'Catering — Emoove lunch', when: 'Tomorrow · 12:30 PM', totalUsd: 420, status: 'Confirmed' },
    { label: 'Birthday prefix — Table 6', when: 'Fri · 7:00 PM', totalUsd: 640, status: 'Deposit paid' },
    { label: 'Wine club pickup', when: 'Sat · 5:00 PM', totalUsd: 96, status: 'Awaiting prep' },
  ],
  orders: [
    { tableOrChannel: 'Table 8', totalUsd: 186, status: 'In kitchen' },
    { tableOrChannel: 'Table 12', totalUsd: 94, status: 'Served' },
    { tableOrChannel: 'Patio 3', totalUsd: 212, status: 'Open' },
    { tableOrChannel: 'Delivery — Grabio', totalUsd: 58, status: 'Packed' },
  ],
  crmTasks: [
    { title: 'Thank-you after anniversary dinner', guestName: 'Amal H.' },
    { title: 'Confirm prefix menu for Friday', guestName: 'Emoove team' },
    { title: 'VIP re-book — wine pairing', guestName: 'Marc T.' },
  ],
  recentActivity: [
    { type: 'order' as const, label: 'Order placed — Table 8', detail: '$186 · 3 covers', ago: '4 min ago' },
    { type: 'reservation' as const, label: 'Reservation confirmed', detail: 'Amal H. · 2 · 8:00 PM', ago: '12 min ago' },
    { type: 'guest' as const, label: 'Guest note updated', detail: 'Marc T. — no nuts', ago: '28 min ago' },
    { type: 'product' as const, label: '86 sold tonight', detail: 'Sea bass en papillote', ago: '1 hr ago' },
    { type: 'crm' as const, label: 'CRM follow-up due', detail: 'Thank-you after anniversary', ago: '2 hr ago' },
  ],
};

export function showcaseProductRows(): DemoShowcaseRow[] {
  return RESTAURANT_DEMO_SHOWCASE.products.map((p, i) => ({
    id: `showcase-product-${i}`,
    showcase: true,
    displayLabel: p.name,
    subtitle: `$${p.priceUsd} · ${p.category}`,
  }));
}

export function showcaseGuestRows(): DemoShowcaseRow[] {
  return RESTAURANT_DEMO_SHOWCASE.guests.map((g, i) => ({
    id: `showcase-guest-${i}`,
    showcase: true,
    displayLabel: g.name,
    subtitle: g.phone,
    meta: g.notes,
  }));
}

export function showcaseScheduledOrderRows(): DemoShowcaseRow[] {
  return RESTAURANT_DEMO_SHOWCASE.scheduledOrders.map((o, i) => ({
    id: `showcase-scheduled-${i}`,
    showcase: true,
    displayLabel: o.label,
    subtitle: `${o.when} · $${o.totalUsd}`,
    meta: o.status,
  }));
}

export function showcaseReservationRows(): DemoShowcaseRow[] {
  return RESTAURANT_DEMO_SHOWCASE.reservations.map((r, i) => ({
    id: `showcase-reservation-${i}`,
    showcase: true,
    displayLabel: r.guestName,
    subtitle: `${r.partySize} guests · ${r.dateTime}`,
    meta: `Table ${r.table}`,
  }));
}

export function showcaseOrderRows(): DemoShowcaseRow[] {
  return RESTAURANT_DEMO_SHOWCASE.orders.map((o, i) => ({
    id: `showcase-order-${i}`,
    showcase: true,
    displayLabel: o.tableOrChannel,
    subtitle: `$${o.totalUsd}`,
    meta: o.status,
  }));
}

export function showcaseCrmRows(): DemoShowcaseRow[] {
  return RESTAURANT_DEMO_SHOWCASE.crmTasks.map((t, i) => ({
    id: `showcase-crm-${i}`,
    showcase: true,
    displayLabel: t.title,
    subtitle: t.guestName,
  }));
}

export function mergeShowcaseWithUserRows(
  showcase: DemoShowcaseRow[],
  userRows?: Record<string, unknown>[],
): Array<DemoShowcaseRow | Record<string, unknown>> {
  const yours = (userRows ?? []).map((r) => ({ ...r, showcase: false }));
  return [...showcase, ...yours];
}

export function formatDemoMoney(usd: number): string {
  return `$${usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}
