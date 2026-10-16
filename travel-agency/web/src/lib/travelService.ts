import {
  addDoc,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { auth, db } from './firebase';
// auth used in createTask
import type { SaveQuoteInput, TravelActivity, TravelContact, TravelDeal, TravelQuote, TravelTask } from './types';
import type { TravelActivityType, TravelPipelineStage } from './travelConstants';
import { allocateQuoteNumber } from './quoteSerial';
import { isTravelDemo } from './demoMode';
import { demoStore } from './demoStore';
import { safeTravelRead } from './travelFirestore';
import { quoteHasStructuredDays, resolveQuoteTotals, stripUndefined } from './quoteItinerary';

function col(storeId: string, name: string) {
  return collection(db, 'stores', storeId, name);
}

function mapDeal(id: string, d: DocumentData): TravelDeal {
  return {
    id,
    title: String(d.title || ''),
    contactId: d.contactId ? String(d.contactId) : undefined,
    contactName: d.contactName ? String(d.contactName) : undefined,
    stage: (d.stage as TravelPipelineStage) || 'inquiry',
    destination: d.destination ? String(d.destination) : undefined,
    pax: d.pax ? Number(d.pax) : undefined,
    marginTotal: d.marginTotal ? Number(d.marginTotal) : undefined,
    bookingRef: d.bookingRef ? String(d.bookingRef) : undefined,
    pnr: d.pnr ? String(d.pnr) : undefined,
    assignedAgentId: d.assignedAgentId ? String(d.assignedAgentId) : undefined,
    updatedAt: String(d.updatedAt || ''),
    createdAt: String(d.createdAt || ''),
  };
}

export async function getContact(storeId: string, contactId: string): Promise<TravelContact | null> {
  if (isTravelDemo()) return demoStore.contacts().find((c) => c.id === contactId) || null;
  const snap = await getDoc(doc(db, 'stores', storeId, 'travelContacts', contactId));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    id: snap.id,
    name: String(d.name || ''),
    email: d.email ? String(d.email) : undefined,
    phone: d.phone ? String(d.phone) : undefined,
    notes: d.notes ? String(d.notes) : undefined,
    createdAt: String(d.createdAt || ''),
  };
}

export async function listContacts(storeId: string): Promise<TravelContact[]> {
  if (isTravelDemo()) return demoStore.contacts();
  return safeTravelRead('listContacts', async () => {
    const snap = await getDocs(col(storeId, 'travelContacts'));
    return snap.docs
      .map((x) => ({
        id: x.id,
        name: String(x.data().name || ''),
        email: x.data().email ? String(x.data().email) : undefined,
        phone: x.data().phone ? String(x.data().phone) : undefined,
        notes: x.data().notes ? String(x.data().notes) : undefined,
        createdAt: String(x.data().createdAt || ''),
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, []);
}

export async function createContact(storeId: string, input: { name: string; email?: string; phone?: string }) {
  if (isTravelDemo()) return demoStore.addContact(input);
  const now = new Date().toISOString();
  const ref = await addDoc(col(storeId, 'travelContacts'), { ...input, createdAt: now });
  return ref.id;
}

export async function listDeals(storeId: string): Promise<TravelDeal[]> {
  if (isTravelDemo()) return demoStore.deals();
  return safeTravelRead('listDeals', async () => {
    const snap = await getDocs(col(storeId, 'travelDeals'));
    return snap.docs
      .map((x) => mapDeal(x.id, x.data()))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, []);
}

export async function getDeal(storeId: string, dealId: string): Promise<TravelDeal | null> {
  if (isTravelDemo()) return demoStore.getDeal(dealId);
  const snap = await getDoc(doc(db, 'stores', storeId, 'travelDeals', dealId));
  if (!snap.exists()) return null;
  return mapDeal(snap.id, snap.data());
}

export async function createDeal(
  storeId: string,
  input: { title: string; contactId?: string; contactName?: string; destination?: string; pax?: number },
) {
  if (isTravelDemo()) {
    return demoStore.addDeal(input);
  }
  const now = new Date().toISOString();
  const ref = await addDoc(col(storeId, 'travelDeals'), {
    ...input,
    stage: 'inquiry',
    marginTotal: 0,
    createdAt: now,
    updatedAt: now,
    assignedAgentId: auth.currentUser?.uid || null,
  });
  return ref.id;
}

export async function updateDealStage(storeId: string, dealId: string, stage: TravelPipelineStage) {
  if (isTravelDemo()) {
    demoStore.updateDeal(dealId, { stage });
    return;
  }
  await updateDoc(doc(db, 'stores', storeId, 'travelDeals', dealId), {
    stage,
    updatedAt: new Date().toISOString(),
  });
}

export async function listQuotesForDeal(storeId: string, dealId: string): Promise<TravelQuote[]> {
  if (isTravelDemo()) return demoStore.quotesForDeal(dealId);
  const snap = await getDocs(query(col(storeId, 'travelQuotes'), where('dealId', '==', dealId)));
  return snap.docs
    .map((x) => ({ id: x.id, ...(x.data() as Omit<TravelQuote, 'id'>) }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getQuote(storeId: string, quoteId: string): Promise<TravelQuote | null> {
  if (isTravelDemo()) return demoStore.getQuote(quoteId) || null;
  const snap = await getDoc(doc(db, 'stores', storeId, 'travelQuotes', quoteId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<TravelQuote, 'id'>) };
}

function buildQuoteWritePayload(
  dealId: string,
  input: SaveQuoteInput,
  totals: { costTotal: number; total: number; margin: number },
  now: string,
  forUpdate: boolean,
): Record<string, unknown> {
  const { clearStructuredDays, days, ...rest } = input;
  const base = stripUndefined({
    ...rest,
    dealId,
    margin: totals.margin,
    costTotal: totals.costTotal,
    total: totals.total,
    updatedAt: now,
  }) as Record<string, unknown>;

  if (quoteHasStructuredDays(days)) {
    base.days = days;
  } else if (forUpdate && clearStructuredDays) {
    base.days = deleteField();
  }
  return base;
}

export async function saveQuote(
  storeId: string,
  dealId: string,
  quoteId: string | null,
  input: SaveQuoteInput,
): Promise<string> {
  if (isTravelDemo()) {
    return demoStore.saveQuote(dealId, quoteId, input);
  }
  const now = new Date().toISOString();
  const structured = quoteHasStructuredDays(input.days);
  const { costTotal, total, margin } = resolveQuoteTotals({
    days: structured ? input.days : undefined,
    costTotal: input.costTotal,
    total: input.total,
    lines: input.lines,
  });
  const totals = { costTotal, total, margin };
  if (quoteId) {
    const payload = buildQuoteWritePayload(dealId, input, totals, now, true);
    await setDoc(doc(db, 'stores', storeId, 'travelQuotes', quoteId), payload, { merge: true });
    await updateDoc(doc(db, 'stores', storeId, 'travelDeals', dealId), {
      marginTotal: margin,
      stage: 'quoted',
      updatedAt: now,
    });
    return quoteId;
  }
  const quoteNumber = await allocateQuoteNumber(storeId);
  const payload = buildQuoteWritePayload(dealId, input, totals, now, false);
  const ref = await addDoc(col(storeId, 'travelQuotes'), {
    ...payload,
    quoteNumber,
    status: 'draft',
    createdAt: now,
  });
  await updateDoc(doc(db, 'stores', storeId, 'travelDeals', dealId), {
    marginTotal: margin,
    stage: 'quoted',
    updatedAt: now,
  });
  return ref.id;
}

export async function listActivities(storeId: string, dealId: string): Promise<TravelActivity[]> {
  if (isTravelDemo()) return demoStore.activitiesForDeal(dealId);
  const snap = await getDocs(query(col(storeId, 'travelActivities'), where('dealId', '==', dealId)));
  return snap.docs
    .map((x) => ({
      id: x.id,
      dealId: String(x.data().dealId),
      type: x.data().type as TravelActivityType,
      note: String(x.data().note || ''),
      createdAt: String(x.data().createdAt || ''),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addActivity(storeId: string, dealId: string, type: TravelActivityType, note: string) {
  if (isTravelDemo()) {
    demoStore.addActivity(dealId, type, note);
    return;
  }
  await addDoc(col(storeId, 'travelActivities'), {
    dealId,
    type,
    note,
    createdAt: new Date().toISOString(),
    createdBy: auth.currentUser?.uid || null,
  });
}

export async function listAllActivities(storeId: string, limit = 50): Promise<TravelActivity[]> {
  if (isTravelDemo()) return demoStore.allActivities();
  return safeTravelRead('listAllActivities', async () => {
    const snap = await getDocs(col(storeId, 'travelActivities'));
    return snap.docs
      .map((x) => {
    const d = x.data();
    return {
      id: x.id,
      dealId: String(d.dealId),
      dealTitle: d.dealTitle ? String(d.dealTitle) : undefined,
      contactName: d.contactName ? String(d.contactName) : undefined,
      type: d.type as TravelActivityType,
      note: String(d.note || ''),
      createdAt: String(d.createdAt || ''),
    };
  })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
  }, []);
}

export async function listTasks(storeId: string): Promise<TravelTask[]> {
  if (isTravelDemo()) return demoStore.tasks();
  return safeTravelRead('listTasks', async () => {
    const snap = await getDocs(col(storeId, 'travelTasks'));
    return snap.docs
      .map((x) => {
    const d = x.data();
    return {
      id: x.id,
      dealId: d.dealId ? String(d.dealId) : undefined,
      dealTitle: d.dealTitle ? String(d.dealTitle) : undefined,
      contactName: d.contactName ? String(d.contactName) : undefined,
      title: String(d.title || ''),
      dueDate: d.dueDate ? String(d.dueDate) : undefined,
      status: (d.status as 'open' | 'done') || 'open',
      createdAt: String(d.createdAt || ''),
    };
  })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, []);
}

export async function createTask(
  storeId: string,
  input: { title: string; dealId?: string; dealTitle?: string; contactName?: string; dueDate?: string },
) {
  if (isTravelDemo()) {
    demoStore.addTask(input);
    return;
  }
  await addDoc(col(storeId, 'travelTasks'), {
    ...input,
    status: 'open',
    createdAt: new Date().toISOString(),
    createdBy: auth.currentUser?.uid || null,
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function itineraryPdfSection(quote: TravelQuote): string {
  if (quote.days && quote.days.some((d) => d.items.length > 0)) {
    const blocks = quote.days
      .map((day) => {
        const lines = day.items
          .map(
            (it) =>
              `<li><strong>${escapeHtml(it.title)}</strong> (${it.type}) — ${quote.currency} ${it.sell.toFixed(2)}</li>`,
          )
          .join('');
        return `<h4>${escapeHtml(day.title)}</h4><ul>${lines}</ul>`;
      })
      .join('');
    return `<div class="box"><h3>Itinerary</h3>${blocks}</div>`;
  }
  return `<div class="box"><h3>Itinerary</h3><pre style="white-space:pre-wrap">${escapeHtml(quote.itinerary)}</pre></div>`;
}

export function buildQuotePdfHtml(quote: TravelQuote, agencyName: string): string {
  const totals = resolveQuoteTotals(quote);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${quote.quoteNumber}</title>
  <style>body{font-family:system-ui,sans-serif;padding:32px;color:#0f172a}h1{color:#0891b2}
  .box{border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-top:16px}</style></head>
  <body><h1>${escapeHtml(agencyName)}</h1><h2>${escapeHtml(quote.title)}</h2><p><strong>${escapeHtml(quote.quoteNumber)}</strong></p>
  ${itineraryPdfSection(quote)}
  <p><strong>Total:</strong> ${quote.currency} ${totals.total.toFixed(2)}</p>
  </body></html>`;
}
