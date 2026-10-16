import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { getContact, listActivities, listDeals } from '../lib/travelService';
import type { TravelActivity, TravelContact, TravelDeal } from '../lib/types';
import { STAGE_LABELS } from '../lib/travelConstants';

export default function ClientDetailPage() {
  const { contactId } = useParams();
  const { storeId } = useSession();
  const [contact, setContact] = useState<TravelContact | null>(null);
  const [deals, setDeals] = useState<TravelDeal[]>([]);
  const [activities, setActivities] = useState<TravelActivity[]>([]);

  useEffect(() => {
    if (!storeId || !contactId) return;
    getContact(storeId, contactId).then(setContact);
    listDeals(storeId).then((all) => setDeals(all.filter((d) => d.contactId === contactId)));
  }, [storeId, contactId]);

  useEffect(() => {
    if (!storeId || deals.length === 0) return;
    Promise.all(deals.map((d) => listActivities(storeId, d.id))).then((groups) => {
      setActivities(groups.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    });
  }, [storeId, deals]);

  if (!contact) return <p className="text-slate-500">Loading client…</p>;

  return (
    <div className="space-y-4">
      <Link to="/crm" className="text-sm text-cyan-700">← CRM</Link>
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <h1 className="text-2xl font-semibold">{contact.name}</h1>
        <p className="text-slate-500 text-sm mt-1">{contact.phone} {contact.email ? `· ${contact.email}` : ''}</p>
        {contact.notes ? <p className="text-sm mt-3 text-slate-700">{contact.notes}</p> : null}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h2 className="font-medium mb-2">Trips & deals</h2>
          <ul className="space-y-2">
            {deals.map((d) => (
              <li key={d.id}>
                <Link to={`/deals/${d.id}`} className="block bg-white border rounded-xl p-3 text-sm hover:border-cyan-300">
                  <strong>{d.title}</strong>
                  <span className="block text-xs text-cyan-800">{STAGE_LABELS[d.stage]}</span>
                </Link>
              </li>
            ))}
            {deals.length === 0 ? <p className="text-sm text-slate-500">No deals yet.</p> : null}
          </ul>
        </div>
        <div>
          <h2 className="font-medium mb-2">Activity history</h2>
          <ul className="space-y-2 text-sm text-slate-600">
            {activities.map((a) => (
              <li key={a.id} className="bg-slate-50 rounded-lg p-2">{a.type}: {a.note}</li>
            ))}
            {activities.length === 0 ? <li>No activity logged.</li> : null}
          </ul>
        </div>
      </div>
    </div>
  );
}
