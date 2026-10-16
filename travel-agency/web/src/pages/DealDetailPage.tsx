import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { addActivity, getDeal, listActivities, listQuotesForDeal } from '../lib/travelService';
import type { TravelActivity, TravelDeal, TravelQuote } from '../lib/types';
import { STAGE_LABELS } from '../lib/travelConstants';

export default function DealDetailPage() {
  const { dealId } = useParams();
  const { storeId } = useSession();
  const [deal, setDeal] = useState<TravelDeal | null>(null);
  const [quotes, setQuotes] = useState<TravelQuote[]>([]);
  const [activities, setActivities] = useState<TravelActivity[]>([]);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!storeId || !dealId) return;
    getDeal(storeId, dealId).then(setDeal);
    listQuotesForDeal(storeId, dealId).then(setQuotes);
    listActivities(storeId, dealId).then(setActivities);
  }, [storeId, dealId]);

  async function logNote() {
    if (!storeId || !dealId || !note.trim()) return;
    await addActivity(storeId, dealId, 'note', note.trim());
    setNote('');
    setActivities(await listActivities(storeId, dealId));
  }

  if (!deal) return <p className="text-slate-500">Loading deal…</p>;

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <div>
          <p className="text-sm text-brand-dark font-medium">{STAGE_LABELS[deal.stage]}</p>
          <h1 className="text-2xl font-semibold">{deal.title}</h1>
          <p className="text-sm text-slate-500">{deal.contactName || 'No client'}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h2 className="font-medium text-sm mb-2">Timeline</h2>
          <ul className="text-sm text-slate-600 space-y-2">
            {activities.map((a) => (
              <li key={a.id}>{a.type}: {a.note}</li>
            ))}
            {activities.length === 0 ? <li>No activity yet</li> : null}
          </ul>
          <div className="flex gap-2 mt-3">
            <input className="flex-1 border rounded-lg px-2 py-1 text-sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add note" />
            <button type="button" onClick={logNote} className="text-sm bg-slate-100 px-3 rounded-lg">Save</button>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h2 className="font-medium text-sm mb-2">Quotes</h2>
          {quotes.map((q) => (
            <Link key={q.id} to={`/deals/${dealId}/quote/${q.id}`} className="block text-sm py-1 text-brand-dark">
              {q.quoteNumber} — {q.currency} {q.total}
            </Link>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Link to={`/deals/${dealId}/quote`} className="block w-full text-center bg-brand text-white py-2 rounded-lg text-sm font-medium">Edit / send quote</Link>
        <Link to={`/book?dealId=${dealId}`} className="block w-full text-center border border-slate-200 py-2 rounded-lg text-sm">Book via Nextra</Link>
        <p className="text-xs text-slate-400 pt-2">PNR: {deal.pnr || '—'} · Ref: {deal.bookingRef || '—'}</p>
      </div>
    </div>
  );
}
