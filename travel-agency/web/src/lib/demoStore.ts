import type { SaveQuoteInput, TravelActivity, TravelContact, TravelDeal, TravelQuote, TravelTask } from './types';
import { buildDubaiHoneymoonDays, buildIstanbulFamilyDays } from './demoItineraryData';
import { quoteHasStructuredDays, resolveQuoteTotals, stripUndefined } from './quoteItinerary';

const now = new Date().toISOString();

let contacts: TravelContact[] = [
  { id: 'c1', name: 'Sharma family', phone: '+91 98xxx', createdAt: now },
  { id: 'c2', name: 'Ahmed Al-Rashid', email: 'ahmed@example.com', createdAt: now },
];

let deals: TravelDeal[] = [
  {
    id: 'd1',
    title: 'Dubai honeymoon — 4 pax',
    contactId: 'c1',
    contactName: 'Sharma family',
    stage: 'quoted',
    destination: 'DXB',
    pax: 4,
    marginTotal: 12400,
    updatedAt: now,
    createdAt: now,
  },
  {
    id: 'd2',
    title: 'Goa weekend flights',
    contactId: 'c2',
    contactName: 'Ahmed Al-Rashid',
    stage: 'deposit_received',
    destination: 'GOI',
    pax: 2,
    marginTotal: 3200,
    updatedAt: now,
    createdAt: now,
  },
  {
    id: 'd3',
    title: 'Istanbul family — 4 pax',
    contactId: 'c1',
    contactName: 'Sharma family',
    stage: 'quoted',
    destination: 'IST',
    pax: 4,
    marginTotal: 26800,
    updatedAt: now,
    createdAt: now,
  },
];

const dubaiDays = buildDubaiHoneymoonDays();
const istanbulDays = buildIstanbulFamilyDays();
const dubaiTotals = resolveQuoteTotals({ days: dubaiDays, costTotal: 0, total: 0 });
const istanbulTotals = resolveQuoteTotals({ days: istanbulDays, costTotal: 0, total: 0 });

let quotes: TravelQuote[] = [
  {
    id: 'q1',
    dealId: 'd1',
    quoteNumber: 'QT-2026-10-01-001',
    title: 'Dubai honeymoon — 4 pax',
    customerName: 'Sharma family',
    currency: 'INR',
    total: dubaiTotals.total,
    costTotal: dubaiTotals.costTotal,
    margin: dubaiTotals.margin,
    itinerary: 'Day 1: Arrive DXB, transfer to hotel\nDay 2–4: City + desert safari\nDay 5: Departure',
    days: dubaiDays,
    inclusions: '4★ hotel · Transfers · Desert safari',
    status: 'sent',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'q2',
    dealId: 'd2',
    quoteNumber: 'QT-2026-09-28-002',
    title: 'Goa weekend — flights only',
    customerName: 'Ahmed Al-Rashid',
    currency: 'INR',
    total: 45000,
    costTotal: 41800,
    margin: 3200,
    itinerary: 'Fri: BOM → GOI morning\nSun: GOI → BOM evening\nNo hotel — client arranged stay.',
    status: 'accepted',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'q3',
    dealId: 'd3',
    quoteNumber: 'QT-2026-10-02-003',
    title: 'Istanbul family — 4 pax',
    customerName: 'Sharma family',
    currency: 'INR',
    total: istanbulTotals.total,
    costTotal: istanbulTotals.costTotal,
    margin: istanbulTotals.margin,
    itinerary: 'Five-day cultural itinerary with Bosphorus cruise.',
    days: istanbulDays,
    inclusions: 'Hotels · Tours · Transfers',
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  },
];

let activities: TravelActivity[] = [
  { id: 'a1', dealId: 'd1', dealTitle: 'Dubai honeymoon', contactName: 'Sharma family', type: 'whatsapp', note: 'Sent quote link', createdAt: now },
  { id: 'a2', dealId: 'd2', dealTitle: 'Goa flights', contactName: 'Ahmed', type: 'call', note: 'Deposit confirmed on phone', createdAt: now },
];

let tasks: TravelTask[] = [
  { id: 't1', dealId: 'd1', dealTitle: 'Dubai honeymoon', contactName: 'Sharma family', title: 'Follow up on quote — 3 days', dueDate: '2026-10-02', status: 'open', createdAt: now },
  { id: 't2', dealId: 'd2', dealTitle: 'Goa flights', contactName: 'Ahmed', title: 'Book flights after deposit', dueDate: '2026-10-01', status: 'open', createdAt: now },
];

export const demoStore = {
  contacts: () => [...contacts],
  deals: () => [...deals].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  getDeal: (id: string) => deals.find((d) => d.id === id) || null,
  addContact: (input: { name: string; email?: string; phone?: string }) => {
    const c: TravelContact = { id: `c${Date.now()}`, ...input, createdAt: new Date().toISOString() };
    contacts = [c, ...contacts];
    return c.id;
  },
  addDeal: (input: Partial<TravelDeal> & { title: string }) => {
    const t = new Date().toISOString();
    const d: TravelDeal = {
      id: `d${Date.now()}`,
      title: input.title,
      contactId: input.contactId,
      contactName: input.contactName,
      stage: 'inquiry',
      destination: input.destination,
      pax: input.pax,
      marginTotal: 0,
      createdAt: t,
      updatedAt: t,
    };
    deals = [d, ...deals];
    return d.id;
  },
  updateDeal: (id: string, patch: Partial<TravelDeal>) => {
    deals = deals.map((d) => (d.id === id ? { ...d, ...patch, updatedAt: new Date().toISOString() } : d));
  },
  quotesForDeal: (dealId: string) => quotes.filter((q) => q.dealId === dealId),
  getQuote: (id: string) => quotes.find((q) => q.id === id),
  saveQuote: (dealId: string, quoteId: string | null, input: SaveQuoteInput) => {
    const t = new Date().toISOString();
    const structured = quoteHasStructuredDays(input.days);
    const { costTotal, total, margin } = resolveQuoteTotals({
      days: structured ? input.days : undefined,
      costTotal: input.costTotal,
      total: input.total,
      lines: input.lines,
    });
    const { clearStructuredDays, days, ...rest } = input;
    const patch = stripUndefined({
      ...rest,
      margin,
      costTotal,
      total,
      updatedAt: t,
    }) as Partial<TravelQuote>;

    if (quoteId) {
      quotes = quotes.map((q) => {
        if (q.id !== quoteId) return q;
        const next: TravelQuote = { ...q, ...patch };
        if (structured && days) next.days = days;
        else if (clearStructuredDays) delete next.days;
        return next;
      });
      demoStore.updateDeal(dealId, { stage: 'quoted', marginTotal: margin });
      return quoteId;
    }
    const n: TravelQuote = {
      id: `q${Date.now()}`,
      dealId,
      quoteNumber: `QT-${new Date().toISOString().slice(0, 10)}-${String(quotes.length + 1).padStart(3, '0')}`,
      title: input.title,
      currency: input.currency,
      total,
      costTotal,
      margin,
      itinerary: input.itinerary || '',
      status: 'draft',
      customerName: input.customerName,
      createdAt: t,
      updatedAt: t,
      ...(structured && days ? { days } : {}),
    };
    quotes = [n, ...quotes];
    demoStore.updateDeal(dealId, { stage: 'quoted', marginTotal: margin });
    return n.id;
  },
  activitiesForDeal: (dealId: string) => activities.filter((a) => a.dealId === dealId),
  addActivity: (dealId: string, type: TravelActivity['type'], note: string) => {
    const deal = deals.find((d) => d.id === dealId);
    activities = [{
      id: `a${Date.now()}`,
      dealId,
      dealTitle: deal?.title,
      contactName: deal?.contactName,
      type,
      note,
      createdAt: new Date().toISOString(),
    }, ...activities];
  },
  allActivities: () => [...activities].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  tasks: () => [...tasks],
  addTask: (input: { title: string; dealId?: string; dealTitle?: string; contactName?: string; dueDate?: string }) => {
    tasks = [{
      id: `t${Date.now()}`,
      ...input,
      status: 'open',
      createdAt: new Date().toISOString(),
    }, ...tasks];
  },
};
