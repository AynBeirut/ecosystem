import { useEffect, useState } from 'react';
import { useSession } from '../context/SessionContext';
import { loadMoneySummary, type MoneySummary } from '../lib/moneySummary';

export default function MoneyPage() {
  const { storeId } = useSession();
  const [summary, setSummary] = useState<MoneySummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!storeId) return;
    loadMoneySummary(storeId)
      .then(setSummary)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'));
  }, [storeId]);

  if (!storeId) return <p className="text-slate-500 text-sm">Set store ID in the header.</p>;
  if (error) return <p className="text-red-600 text-sm">{error}</p>;
  if (!summary) return <p className="text-slate-500">Loading…</p>;

  const wallet = summary.wallet;
  const byStage = summary.byStage;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Money</h1>
      {summary.creditAlert ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 text-sm">Credit alert: high due relative to available balance.</div>
      ) : null}
      <div className="grid sm:grid-cols-3 gap-3">
        <Stat label="Open deals" value={String(summary.openDeals)} />
        <Stat label="Booked" value={String(summary.bookedDeals)} />
        <Stat label="Pipeline margin" value={String(summary.totalMargin)} />
      </div>
      <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm">
        <h2 className="font-medium mb-2">Nextra wallet</h2>
        <p>{wallet.currency} {wallet.available} available · {wallet.due} due · balance {wallet.balance}</p>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm">
        <h2 className="font-medium mb-2">Pipeline by stage</h2>
        <ul>{Object.entries(byStage || {}).map(([k, v]) => <li key={k}>{k}: {v}</li>)}</ul>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
