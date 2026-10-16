import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { createDeal, listContacts } from '../lib/travelService';
import type { TravelContact } from '../lib/types';

export default function NewDealPage() {
  const { storeId } = useSession();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<TravelContact[]>([]);
  const [title, setTitle] = useState('');
  const [contactId, setContactId] = useState('');
  const [destination, setDestination] = useState('');
  const [pax, setPax] = useState(2);

  useEffect(() => {
    if (!storeId) return;
    listContacts(storeId).then(setContacts);
  }, [storeId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!storeId) return;
    const contact = contacts.find((c) => c.id === contactId);
    const id = await createDeal(storeId, {
      title,
      contactId: contactId || undefined,
      contactName: contact?.name,
      destination,
      pax,
    });
    navigate(`/deals/${id}`);
  }

  return (
    <form onSubmit={submit} className="max-w-lg space-y-4 bg-white border border-slate-200 rounded-xl p-6">
      <h1 className="text-xl font-semibold">New inquiry</h1>
      <label className="block text-sm">Trip title<input className="mt-1 w-full border rounded-lg px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
      <label className="block text-sm">Client<select className="mt-1 w-full border rounded-lg px-3 py-2" value={contactId} onChange={(e) => setContactId(e.target.value)}><option value="">—</option>{contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="block text-sm">Destination<input className="mt-1 w-full border rounded-lg px-3 py-2" value={destination} onChange={(e) => setDestination(e.target.value)} /></label>
      <label className="block text-sm">Passengers<input type="number" min={1} className="mt-1 w-full border rounded-lg px-3 py-2" value={pax} onChange={(e) => setPax(Number(e.target.value))} /></label>
      <button type="submit" className="bg-brand text-white w-full py-2 rounded-lg font-medium">Create deal</button>
    </form>
  );
}
