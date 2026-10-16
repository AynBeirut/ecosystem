import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import {
  createContact,
  createTask,
  listAllActivities,
  listContacts,
  listDeals,
  listTasks,
} from '../lib/travelService';
import type { TravelActivity, TravelContact, TravelDeal, TravelTask } from '../lib/types';
import { STAGE_LABELS, TRAVEL_PIPELINE_STAGES } from '../lib/travelConstants';

type Tab = 'pipeline' | 'contacts' | 'tasks' | 'activity';

const ACTIVITY_ICONS: Record<string, string> = {
  whatsapp: '💬',
  call: '📞',
  meeting: '👥',
  email: '✉️',
  note: '📝',
};

export default function CrmPage() {
  const { storeId } = useSession();
  const [tab, setTab] = useState<Tab>('pipeline');
  const [deals, setDeals] = useState<TravelDeal[]>([]);
  const [contacts, setContacts] = useState<TravelContact[]>([]);
  const [tasks, setTasks] = useState<TravelTask[]>([]);
  const [activities, setActivities] = useState<TravelActivity[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');

  useEffect(() => {
    if (!storeId) return;
    Promise.all([
      listDeals(storeId),
      listContacts(storeId),
      listTasks(storeId),
      listAllActivities(storeId),
    ])
      .then(([d, c, t, a]) => {
        setDeals(d);
        setContacts(c);
        setTasks(t);
        setActivities(a);
      })
      .catch((e) => console.error('CRM load failed', e));
  }, [storeId]);

  const pipeline = useMemo(() => {
    const map: Record<string, TravelDeal[]> = {};
    for (const stage of TRAVEL_PIPELINE_STAGES) {
      map[stage] = deals.filter((d) => d.stage === stage);
    }
    return map;
  }, [deals]);

  const openTasks = tasks.filter((t) => t.status === 'open');

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!storeId || !newTaskTitle.trim()) return;
    await createTask(storeId, { title: newTaskTitle.trim() });
    setNewTaskTitle('');
    setTasks(await listTasks(storeId));
  }

  async function addContact(e: React.FormEvent) {
    e.preventDefault();
    if (!storeId) return;
    await createContact(storeId, { name: newContactName, phone: newContactPhone });
    setNewContactName('');
    setNewContactPhone('');
    setContacts(await listContacts(storeId));
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'contacts', label: 'Contacts', count: contacts.length },
    { id: 'tasks', label: 'Tasks', count: openTasks.length },
    { id: 'activity', label: 'Activity' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">CRM</h1>
          <p className="text-sm text-slate-500">
            Leads, pipeline, follow-ups, and client history — not in the Nextra booking portal.
          </p>
        </div>
        <Link to="/deals/new" className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium shrink-0">
          + New lead / deal
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              tab === t.id ? 'bg-cyan-100 text-cyan-900' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.label}
            {t.count !== undefined ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      {tab === 'pipeline' ? (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-[900px]">
            {TRAVEL_PIPELINE_STAGES.filter((s) => s !== 'lost').map((stage) => (
              <div key={stage} className="w-52 shrink-0 bg-slate-100/80 rounded-xl p-2 min-h-[320px]">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide px-1 mb-2">
                  {STAGE_LABELS[stage]} ({pipeline[stage]?.length || 0})
                </p>
                <div className="space-y-2">
                  {(pipeline[stage] || []).map((d) => (
                    <Link
                      key={d.id}
                      to={`/deals/${d.id}`}
                      className="block bg-white border border-slate-200 rounded-lg p-3 shadow-sm hover:border-cyan-300 text-sm"
                    >
                      <strong className="block text-slate-900 leading-snug">{d.title}</strong>
                      <span className="text-slate-500 text-xs">{d.contactName || 'No client'}</span>
                      {d.marginTotal ? (
                        <span className="block text-xs text-emerald-700 mt-1">Margin ₹{d.marginTotal.toLocaleString()}</span>
                      ) : null}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {tab === 'contacts' ? (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-2">
            {contacts.map((c) => (
              <Link
                key={c.id}
                to={`/crm/contacts/${c.id}`}
                className="flex justify-between items-center bg-white border border-slate-200 rounded-xl p-4 hover:border-cyan-300"
              >
                <div>
                  <strong className="text-slate-900">{c.name}</strong>
                  <p className="text-sm text-slate-500">{c.phone || c.email || '—'}</p>
                </div>
                <span className="text-xs text-cyan-700 font-medium">Client 360° →</span>
              </Link>
            ))}
          </div>
          <form onSubmit={addContact} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 h-fit">
            <h2 className="font-medium text-sm">Add contact</h2>
            <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Name" value={newContactName} onChange={(e) => setNewContactName(e.target.value)} required />
            <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Phone" value={newContactPhone} onChange={(e) => setNewContactPhone(e.target.value)} />
            <button type="submit" className="bg-brand text-white w-full py-2 rounded-lg text-sm">Save contact</button>
          </form>
        </div>
      ) : null}

      {tab === 'tasks' ? (
        <div className="grid lg:grid-cols-2 gap-4">
          <ul className="space-y-2">
            {openTasks.map((t) => (
              <li key={t.id} className="bg-white border border-slate-200 rounded-xl p-4 text-sm">
                <strong>{t.title}</strong>
                {t.dueDate ? <p className="text-amber-700 text-xs mt-1">Due {t.dueDate}</p> : null}
                {t.dealTitle ? (
                  <p className="text-slate-500 mt-1">
                    {t.contactName} · <Link to={`/deals/${t.dealId}`} className="text-cyan-700">{t.dealTitle}</Link>
                  </p>
                ) : null}
              </li>
            ))}
            {openTasks.length === 0 ? <p className="text-slate-500 text-sm">No open tasks.</p> : null}
          </ul>
          <form onSubmit={addTask} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 h-fit">
            <h2 className="font-medium text-sm">New follow-up task</h2>
            <input className="w-full border rounded-lg px-3 py-2 text-sm" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="e.g. Call client about revised quote" required />
            <button type="submit" className="bg-brand text-white w-full py-2 rounded-lg text-sm">Add task</button>
          </form>
        </div>
      ) : null}

      {tab === 'activity' ? (
        <ul className="space-y-2">
          {activities.map((a) => (
            <li key={a.id} className="bg-white border border-slate-200 rounded-xl p-4 flex gap-3 text-sm">
              <span className="text-lg">{ACTIVITY_ICONS[a.type] || '•'}</span>
              <div>
                <p className="text-slate-800">{a.note}</p>
                <p className="text-slate-500 text-xs mt-1">
                  {a.contactName} · {a.dealTitle ? <Link to={`/deals/${a.dealId}`} className="text-cyan-700">{a.dealTitle}</Link> : a.dealId}
                  {' · '}{new Date(a.createdAt).toLocaleString()}
                </p>
              </div>
            </li>
          ))}
          {activities.length === 0 ? <p className="text-slate-500 text-sm">Log calls and WhatsApp from a deal page.</p> : null}
        </ul>
      ) : null}
    </div>
  );
}
