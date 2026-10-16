import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { buildQuotePdfHtml, getDeal, getQuote, saveQuote } from '../lib/travelService';
import type { TravelItineraryDay, TravelItineraryItem, TravelQuote } from '../lib/types';
import { createProposalLinkApi, recordDepositApi } from '../lib/travelApi';
import { newItineraryId, quoteHasStructuredDays, resolveQuoteTotals } from '../lib/quoteItinerary';

const ITEM_TYPES: TravelItineraryItem['type'][] = ['flight', 'hotel', 'activity', 'transfer', 'note'];

function emptyItem(): TravelItineraryItem {
  return { id: newItineraryId('item'), type: 'activity', title: '', cost: 0, sell: 0 };
}

function emptyDay(dayNumber: number): TravelItineraryDay {
  return {
    id: newItineraryId('day'),
    dayNumber,
    title: `Day ${dayNumber}`,
    items: [emptyItem()],
  };
}

function moveInList<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const next = [...list];
  const j = index + dir;
  if (j < 0 || j >= next.length) return list;
  [next[index], next[j]] = [next[j], next[index]];
  return next;
}

export default function QuoteEditorPage() {
  const { dealId, quoteId } = useParams();
  const { storeId } = useSession();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [itinerary, setItinerary] = useState('');
  const [days, setDays] = useState<TravelItineraryDay[]>([]);
  const [currency, setCurrency] = useState('USD');
  const [cost, setCost] = useState(0);
  const [sell, setSell] = useState(0);
  const [shareUrl, setShareUrl] = useState('');
  const [savedQuoteId, setSavedQuoteId] = useState(quoteId || '');
  const [depositAmount, setDepositAmount] = useState(0);
  const [loading, setLoading] = useState(Boolean(quoteId));

  const structuredMode = quoteHasStructuredDays(days);

  const derived = useMemo(
    () => resolveQuoteTotals({ days, costTotal: cost, total: sell }),
    [days, cost, sell],
  );

  useEffect(() => {
    if (!storeId || !quoteId) {
      setLoading(false);
      return;
    }
    getQuote(storeId, quoteId)
      .then((q) => {
        if (!q) return;
        setTitle(q.title);
        setItinerary(q.itinerary);
        setDays(q.days ? [...q.days] : []);
        setCurrency(q.currency);
        if (q.days && q.days.some((d) => d.items.length > 0)) {
          const t = resolveQuoteTotals(q);
          setCost(t.costTotal);
          setSell(t.total);
        } else {
          setCost(q.costTotal);
          setSell(q.total);
        }
      })
      .finally(() => setLoading(false));
  }, [storeId, quoteId]);

  function updateDay(dayId: string, patch: Partial<TravelItineraryDay>) {
    setDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, ...patch } : d)));
  }

  function updateItem(dayId: string, itemId: string, patch: Partial<TravelItineraryItem>) {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? { ...d, items: d.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) }
          : d,
      ),
    );
  }

  function addDay() {
    setDays((prev) => [...prev, emptyDay(prev.length + 1)]);
  }

  function removeDay(dayId: string) {
    setDays((prev) =>
      prev
        .filter((d) => d.id !== dayId)
        .map((d, i) => ({ ...d, dayNumber: i + 1 })),
    );
  }

  function addItem(dayId: string) {
    setDays((prev) =>
      prev.map((d) => (d.id === dayId ? { ...d, items: [...d.items, emptyItem()] } : d)),
    );
  }

  function removeItem(dayId: string, itemId: string) {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId ? { ...d, items: d.items.filter((i) => i.id !== itemId) } : d,
      ),
    );
  }

  async function save() {
    if (!storeId || !dealId) return;
    const deal = await getDeal(storeId, dealId);
    const totals = structuredMode ? resolveQuoteTotals({ days, costTotal: cost, total: sell }) : { costTotal: cost, total: sell, margin: sell - cost };
    const id = await saveQuote(storeId, dealId, quoteId || null, {
      title,
      itinerary,
      currency,
      costTotal: totals.costTotal,
      total: totals.total,
      customerName: deal?.contactName,
      ...(structuredMode ? { days } : { clearStructuredDays: Boolean(quoteId) }),
    });
    setSavedQuoteId(id);
    navigate(`/deals/${dealId}/quote/${id}`, { replace: true });
  }

  async function share() {
    if (!storeId || !savedQuoteId) await save();
    const id = savedQuoteId || quoteId;
    if (!storeId || !id) return;
    const res = await createProposalLinkApi(storeId, id);
    const origin = window.location.origin;
    setShareUrl(`${origin}/travel/p/${res.token}`);
  }

  function downloadPdf() {
    const totals = structuredMode ? derived : { costTotal: cost, total: sell, margin: sell - cost };
    const q: TravelQuote = {
      id: savedQuoteId,
      dealId: dealId || '',
      quoteNumber: 'QT-preview',
      title,
      currency,
      total: totals.total,
      costTotal: totals.costTotal,
      margin: totals.margin,
      itinerary,
      days: structuredMode ? days : undefined,
      status: 'draft',
      createdAt: '',
      updatedAt: '',
    };
    const html = buildQuotePdfHtml(q, 'Your Agency');
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.print();
    }
  }

  async function recordDeposit() {
    if (!storeId || !savedQuoteId) return;
    const res = await recordDepositApi(storeId, savedQuoteId, depositAmount, 'bank');
    alert(`Deposit recorded: ${res.receiptNumber}`);
  }

  const margin = structuredMode ? derived.margin : sell - cost;
  const displayCost = structuredMode ? derived.costTotal : cost;
  const displaySell = structuredMode ? derived.total : sell;

  if (loading) return <p className="text-slate-500 text-sm">Loading quote…</p>;

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">Quote builder</h1>
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 text-sm">
        <input className="w-full border rounded-lg px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Trip title" />
        {!structuredMode ? (
          <textarea
            className="w-full border rounded-lg px-3 py-2 min-h-[120px]"
            value={itinerary}
            onChange={(e) => setItinerary(e.target.value)}
            placeholder="Day-by-day itinerary (legacy text)"
          />
        ) : (
          <p className="text-xs text-slate-500">Structured days below. Legacy text is kept on save for search/PDF fallback.</p>
        )}

        <div className="space-y-3 border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-medium text-slate-800">Itinerary days</h2>
            <button type="button" onClick={addDay} className="text-brand text-xs font-medium">+ Add day</button>
          </div>
          {days.length === 0 ? (
            <p className="text-slate-500 text-xs">No structured days — use the text itinerary and manual totals, or add a day.</p>
          ) : null}
          {days.map((day, dayIndex) => (
            <div key={day.id} className="border border-slate-200 rounded-lg p-3 space-y-2 bg-slate-50/50">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs font-semibold text-slate-500 w-8">#{day.dayNumber}</span>
                <input
                  className="flex-1 min-w-[140px] border rounded-lg px-2 py-1"
                  value={day.title}
                  onChange={(e) => updateDay(day.id, { title: e.target.value })}
                  placeholder="Day title"
                />
                <input
                  className="w-28 border rounded-lg px-2 py-1"
                  value={day.date || ''}
                  onChange={(e) => updateDay(day.id, { date: e.target.value })}
                  placeholder="Date"
                />
                <button type="button" className="text-xs border px-2 py-1 rounded" disabled={dayIndex === 0} onClick={() => setDays(moveInList(days, dayIndex, -1).map((d, i) => ({ ...d, dayNumber: i + 1 })))}>↑</button>
                <button type="button" className="text-xs border px-2 py-1 rounded" disabled={dayIndex === days.length - 1} onClick={() => setDays(moveInList(days, dayIndex, 1).map((d, i) => ({ ...d, dayNumber: i + 1 })))}>↓</button>
                <button type="button" className="text-xs text-red-600" onClick={() => removeDay(day.id)}>Remove</button>
              </div>
              {day.items.map((it, itemIndex) => (
                <div key={it.id} className="bg-white border border-slate-100 rounded-lg p-2 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <select className="border rounded-lg px-2 py-1" value={it.type} onChange={(e) => updateItem(day.id, it.id, { type: e.target.value as TravelItineraryItem['type'] })}>
                      {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input className="flex-1 min-w-[120px] border rounded-lg px-2 py-1" value={it.title} onChange={(e) => updateItem(day.id, it.id, { title: e.target.value })} placeholder="Title" />
                    <input className="w-16 border rounded-lg px-2 py-1" value={it.time || ''} onChange={(e) => updateItem(day.id, it.id, { time: e.target.value })} placeholder="Time" />
                  </div>
                  <input className="w-full border rounded-lg px-2 py-1" value={it.description || ''} onChange={(e) => updateItem(day.id, it.id, { description: e.target.value })} placeholder="Description" />
                  <div className="flex flex-wrap gap-2 items-center">
                    <input type="number" className="w-24 border rounded-lg px-2 py-1" value={it.cost} onChange={(e) => updateItem(day.id, it.id, { cost: Number(e.target.value) })} placeholder="Cost" />
                    <input type="number" className="w-24 border rounded-lg px-2 py-1" value={it.sell} onChange={(e) => updateItem(day.id, it.id, { sell: Number(e.target.value) })} placeholder="Sell" />
                    <span className="text-xs text-slate-500">Margin {currency} {(it.sell - it.cost).toFixed(2)}</span>
                    <button type="button" className="text-xs border px-2 py-1 rounded" disabled={itemIndex === 0} onClick={() => updateDay(day.id, { items: moveInList(day.items, itemIndex, -1) })}>↑</button>
                    <button type="button" className="text-xs border px-2 py-1 rounded" disabled={itemIndex === day.items.length - 1} onClick={() => updateDay(day.id, { items: moveInList(day.items, itemIndex, 1) })}>↓</button>
                    <button type="button" className="text-xs text-red-600" onClick={() => removeItem(day.id, it.id)}>Delete</button>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => addItem(day.id)} className="text-xs text-brand">+ Add item</button>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <input className="border rounded-lg px-2 py-1" value={currency} onChange={(e) => setCurrency(e.target.value)} />
          <input
            type="number"
            className="border rounded-lg px-2 py-1"
            value={displayCost}
            readOnly={structuredMode}
            onChange={(e) => setCost(Number(e.target.value))}
            placeholder="Cost"
          />
          <input
            type="number"
            className="border rounded-lg px-2 py-1"
            value={displaySell}
            readOnly={structuredMode}
            onChange={(e) => setSell(Number(e.target.value))}
            placeholder="Sell"
          />
        </div>
        <p className="text-slate-600">Margin: {currency} {margin.toFixed(2)}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={save} className="bg-brand text-white px-4 py-2 rounded-lg">Save</button>
          <button type="button" onClick={share} className="border px-4 py-2 rounded-lg">Get share link</button>
          <button type="button" onClick={downloadPdf} className="border px-4 py-2 rounded-lg">PDF</button>
        </div>
        {shareUrl ? <p className="text-xs break-all text-brand-dark">{shareUrl}</p> : null}
        <div className="flex gap-2 items-end pt-2 border-t">
          <input type="number" className="border rounded-lg px-2 py-1" value={depositAmount} onChange={(e) => setDepositAmount(Number(e.target.value))} placeholder="Deposit" />
          <button type="button" onClick={recordDeposit} className="border px-3 py-1 rounded-lg">Record deposit</button>
        </div>
      </div>
    </div>
  );
}
