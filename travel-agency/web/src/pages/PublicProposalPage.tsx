import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { acceptPublicProposal, fetchPublicProposal } from '../lib/travelApi';
import type { TravelItineraryDay } from '../lib/types';

function hasStructuredDays(days: unknown): days is TravelItineraryDay[] {
  return Array.isArray(days) && days.length > 0 && days.some((d) => Array.isArray(d.items) && d.items.length > 0);
}

export default function PublicProposalPage() {
  const { token } = useParams();
  const [data, setData] = useState<{ quote: Record<string, unknown>; branding: Record<string, unknown> } | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    fetchPublicProposal(token)
      .then((r) => setData({ quote: r.quote, branding: r.branding }))
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'));
  }, [token]);

  async function accept() {
    if (!token) return;
    await acceptPublicProposal(token);
    setAccepted(true);
  }

  if (error) return <p className="p-6 text-red-600">{error}</p>;
  if (!data) return <p className="p-6 text-slate-500">Loading proposal…</p>;

  const q = data.quote;
  const agency = String(data.branding.agencyName || 'Your travel agency');
  const days = q.days;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <header>
          <p className="text-cyan-300 text-sm">{agency}</p>
          <h1 className="text-3xl font-semibold mt-2">{String(q.title)}</h1>
          <p className="text-slate-400 text-sm mt-1">{String(q.quoteNumber)}</p>
        </header>
        {hasStructuredDays(days) ? (
          <section className="bg-slate-800 rounded-2xl p-5 text-sm space-y-4">
            {days.map((day) => (
              <div key={day.id}>
                <h2 className="font-medium text-cyan-200">{day.title}</h2>
                <ul className="mt-2 space-y-2 text-slate-300">
                  {day.items.map((it) => (
                    <li key={it.id}>
                      <span className="text-white">{it.title}</span>
                      {it.time ? <span className="text-slate-500"> · {it.time}</span> : null}
                      {it.sell > 0 ? (
                        <span className="block text-xs text-slate-400">
                          {String(q.currency)} {it.sell.toFixed(2)}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ) : (
          <section className="bg-slate-800 rounded-2xl p-5 text-sm leading-relaxed whitespace-pre-wrap">{String(q.itinerary)}</section>
        )}
        {q.inclusions ? <section><h2 className="font-medium mb-1">Included</h2><p className="text-slate-300 text-sm whitespace-pre-wrap">{String(q.inclusions)}</p></section> : null}
        <p className="text-2xl font-semibold">{String(q.currency)} {Number(q.total).toFixed(2)}</p>
        {!accepted ? (
          <button type="button" onClick={accept} className="w-full bg-cyan-400 text-slate-900 font-semibold py-3 rounded-xl">Accept proposal</button>
        ) : (
          <p className="text-cyan-300 text-center">Thank you — your agent will confirm deposit and booking.</p>
        )}
      </div>
    </div>
  );
}
