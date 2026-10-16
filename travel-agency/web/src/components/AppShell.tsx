import { Link, NavLink, Outlet } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
const nav = [
  { to: '/', label: 'Today' },
  { to: '/crm', label: 'CRM' },
  { to: '/deals', label: 'Deals' },
  { to: '/book', label: 'Book' },
  { to: '/money', label: 'Money' },
  { to: '/settings', label: 'Settings' },
];

export default function AppShell() {
  const { user, logout, storeId, setStoreId, demoSession } = useSession();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex flex-wrap items-center gap-4 justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="font-semibold text-brand-dark">Travel Console</Link>
          <nav className="flex gap-3 text-sm">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  isActive ? 'text-brand-dark font-medium' : 'text-slate-500 hover:text-slate-800'
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {!demoSession ? (
            <input
              className="border border-slate-200 rounded-lg px-2 py-1 w-40"
              placeholder="Store ID"
              value={storeId}
              onChange={(e) => setStoreId(e.target.value.trim())}
            />
          ) : (
            <span className="text-xs text-slate-500">Demo agency</span>
          )}
          <span className="text-slate-500 hidden sm:inline">{user?.email}</span>
          <button type="button" onClick={() => logout()} className="text-slate-600 hover:text-slate-900">
            Sign out
          </button>
        </div>
      </header>
      <main className="flex-1 max-w-[1400px] w-full mx-auto p-4 md:p-6">
        {demoSession ? (
          <p className="mb-4 text-sm text-cyan-900 bg-cyan-50 border border-cyan-100 rounded-lg px-3 py-2">
            Browser demo — use email login for full CRM on Firestore. Proposal:{' '}
            <a className="underline font-medium" href="/travel/p/demo" target="_blank" rel="noreferrer">sample link</a>
          </p>
        ) : null}
        {!storeId ? (
          <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm">
            Enter your agency <strong>Store ID</strong> in the header to load data.
          </p>
        ) : null}
        <Outlet />
      </main>
    </div>
  );
}
