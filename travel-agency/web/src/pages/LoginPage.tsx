import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { isTravelDemo } from '../lib/demoMode';

export default function LoginPage() {
  const { login, enterDemo } = useSession();
  const navigate = useNavigate();
  const showStaging = import.meta.env.VITE_SHOW_STAGING_LOGIN === 'true';
  const [email, setEmail] = useState(import.meta.env.VITE_DEMO_EMAIL || '');
  const [password, setPassword] = useState(import.meta.env.VITE_DEMO_PASSWORD || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 w-full max-w-md space-y-4">
        <h1 className="text-xl font-semibold text-slate-900">Agent sign in</h1>
        <p className="text-sm text-slate-500">One console for deals, quotes, and booking.</p>
        {showStaging ? (
          <div className="text-sm bg-slate-100 border border-slate-200 rounded-lg p-3 space-y-1">
            <p className="font-medium text-slate-800">Staging test login (full demo data)</p>
            <p><span className="text-slate-500">Email:</span> {import.meta.env.VITE_DEMO_EMAIL}</p>
            <p><span className="text-slate-500">Password:</span> {import.meta.env.VITE_DEMO_PASSWORD}</p>
            <p className="text-xs text-slate-500">Store ID auto-fills after sign-in: {import.meta.env.VITE_DEFAULT_STORE_ID}</p>
          </div>
        ) : null}
        <label className="block text-sm">
          Email
          <input
            type="email"
            className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          Password
          <input
            type="password"
            className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-brand text-white rounded-lg py-2.5 font-medium hover:bg-brand-dark disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        {isTravelDemo() ? (
          <button
            type="button"
            onClick={() => {
              enterDemo();
              navigate('/');
            }}
            className="w-full border-2 border-brand text-brand-dark rounded-lg py-2.5 font-medium"
          >
            Enter demo (no API)
          </button>
        ) : null}
      </form>
    </div>
  );
}
