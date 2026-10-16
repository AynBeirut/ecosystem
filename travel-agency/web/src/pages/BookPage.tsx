import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { nextraBookApi, nextraSearchApi } from '../lib/travelApi';
import { getDeal } from '../lib/travelService';

type Offer = { offerId: string; title: string; currency: string; totalPrice: number; summary?: string };

export default function BookPage() {
  const { storeId } = useSession();
  const [params] = useSearchParams();
  const dealId = params.get('dealId') || '';
  const [dealTitle, setDealTitle] = useState('');
  const [origin, setOrigin] = useState('DEL');
  const [destination, setDestination] = useState('DXB');
  const [date, setDate] = useState('');
  const [offers, setOffers] = useState<Offer[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (storeId && dealId) getDeal(storeId, dealId).then((d) => setDealTitle(d?.title || ''));
  }, [storeId, dealId]);

  async function search() {
    if (!storeId) return;
    setMessage('');
    const res = await nextraSearchApi(storeId, {
      productType: 'flight',
      origin,
      destination,
      departureDate: date,
      adults: 2,
    });
    setOffers(res.offers || []);
  }

  async function book(offerId: string) {
    if (!storeId) return;
    const res = await nextraBookApi(storeId, { offerId, productType: 'flight', dealId });
    setMessage(`Booked: ${res.result.bookingRef}${res.result.pnr ? ` · PNR ${res.result.pnr}` : ''}`);
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">Book</h1>
      {dealTitle ? <p className="text-sm bg-cyan-50 text-cyan-900 px-3 py-2 rounded-lg inline-block">Deal: {dealTitle}</p> : null}
      <div className="bg-white border border-slate-200 rounded-xl p-4 grid sm:grid-cols-2 gap-3">
        <input className="border rounded-lg px-3 py-2 text-sm" value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="From" />
        <input className="border rounded-lg px-3 py-2 text-sm" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="To" />
        <input type="date" className="border rounded-lg px-3 py-2 text-sm sm:col-span-2" value={date} onChange={(e) => setDate(e.target.value)} />
        <button type="button" onClick={search} className="sm:col-span-2 bg-brand text-white py-2 rounded-lg text-sm font-medium">Search (Nextra API)</button>
      </div>
      <ul className="space-y-2">
        {offers.map((o) => (
          <li key={o.offerId} className="bg-white border border-slate-200 rounded-xl p-4 flex justify-between items-center gap-2">
            <div className="text-sm">
              <strong>{o.title}</strong>
              <p className="text-slate-500">{o.summary}</p>
            </div>
            <div className="text-right">
              <p className="font-medium">{o.currency} {o.totalPrice}</p>
              <button type="button" onClick={() => book(o.offerId)} className="text-sm text-brand-dark font-medium">Book</button>
            </div>
          </li>
        ))}
      </ul>
      {message ? <p className="text-sm text-green-700">{message}</p> : null}
    </div>
  );
}
