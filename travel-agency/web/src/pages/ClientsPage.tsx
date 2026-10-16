import { useEffect, useState } from 'react';
import { useSession } from '../context/SessionContext';
import { createContact, listContacts } from '../lib/travelService';
import type { TravelContact } from '../lib/types';

export default function ClientsPage() {
  const { storeId } = useSession();
  const [contacts, setContacts] = useState<TravelContact[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (!storeId) return;
    listContacts(storeId).then(setContacts);
  }, [storeId]);

  async function addClient(e: React.FormEvent) {
    e.preventDefault();
    if (!storeId) return;
    await createContact(storeId, { name, phone });
    setName('');
    setPhone('');
    setContacts(await listContacts(storeId));
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div>
        <h1 className="text-2xl font-semibold mb-4">Clients</h1>
        <ul className="space-y-2">
          {contacts.map((c) => (
            <li key={c.id} className="bg-white border border-slate-200 rounded-lg p-3 text-sm">
              <strong>{c.name}</strong>
              {c.phone ? <span className="text-slate-500"> · {c.phone}</span> : null}
            </li>
          ))}
        </ul>
      </div>
      <form onSubmit={addClient} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 h-fit">
        <h2 className="font-medium">Add client</h2>
        <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <button type="submit" className="bg-brand text-white w-full py-2 rounded-lg text-sm">Save</button>
      </form>
    </div>
  );
}
