import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { listDeals } from '../lib/travelService';
import type { TravelDeal } from '../lib/types';
import { STAGE_LABELS } from '../lib/travelConstants';

export default function DealsPage() {
  const { storeId } = useSession();
  const [deals, setDeals] = useState<TravelDeal[]>([]);

  useEffect(() => {
    if (!storeId) return;
    listDeals(storeId).then(setDeals);
  }, [storeId]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Deals</h1>
        <Link to="/deals/new" className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium">New deal</Link>
      </div>
      <ul className="space-y-2">
        {deals.map((d) => (
          <li key={d.id}>
            <Link to={`/deals/${d.id}`} className="block bg-white border border-slate-200 rounded-xl p-4 hover:border-brand/40">
              <div className="flex justify-between gap-2">
                <strong>{d.title}</strong>
                <span className="text-xs text-brand-dark font-medium">{STAGE_LABELS[d.stage]}</span>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                {d.contactName || 'No client'} · {d.bookingRef ? `Ref ${d.bookingRef}` : 'No booking yet'}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
